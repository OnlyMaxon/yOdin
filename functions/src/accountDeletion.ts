import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import {
  getFirestore,
  FieldValue,
  Timestamp,
  DocumentReference,
  Query,
  QuerySnapshot,
} from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createHmac } from 'crypto';

// ── Account deletion ─────────────────────────────────────────────────────────
// Deleting an account removes the profile, the handle's owner, everything the
// user authored as a top-level post or discussion (with everything under it),
// and their media. Replies and comments they left on other people's content
// survive so those threads stay readable, but are stripped of every author
// field. Play and GDPR both require the retained text to be disclosed in the
// privacy policy.
//
// Getters, not module-level constants: index.ts calls initializeApp(), and this
// module is loaded before that line runs.
const db = () => getFirestore();
const auth = () => getAuth();

const EMAIL_HASH_KEY = defineSecret('EMAIL_HASH_KEY');

// authorId written onto surviving content. The client renders it as a
// localized "Deleted account" label, so no language-specific text lands in data.
export const DELETED_ID = 'deleted';
const ANONYMOUS_AUTHOR = {
  authorId: DELETED_ID,
  authorName: '',
  authorPhoto: '',
  authorNationality: '',
  authorCountryCode: '',
};

// The app's media lives in the EU bucket. The project's default bucket is a
// stale US one that still holds a few old avatars, so it is swept as well.
const MEDIA_BUCKET = 'yodin-23362';
const LEGACY_BUCKET = 'yodin-23362.firebasestorage.app';

// index.ts sets the global region in its body, but this module is imported at
// the top of that file, so its function definitions run first and never see it.
// Firestore triggers still land correctly (their region comes from the database
// location), but a callable would silently deploy to us-central1 — sending the
// deletion of an EU user's data through the US. Pinned explicitly instead.
const REGION = 'europe-west1';

// The client re-authenticates with the password right before calling. Checking
// the token's auth_time server-side means a phone left signed in can't skip
// that step by calling the function directly.
const REAUTH_WINDOW_S = 5 * 60;

// How long a rule-breaker's email stays blocked. Enforced twice: the
// blockedEmails TTL policy deletes the record, and the signup check compares
// expiresAt itself because TTL deletion can lag up to a day behind.
const BLOCK_MS = 365 * 24 * 60 * 60 * 1000;

// Aliases of one mailbox must hash alike, or `user+2@gmail.com` walks straight
// past the block. Plus-tags are dropped for every provider; the dot rule is
// Gmail's alone.
function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 0) return email;
  let local = email.slice(0, at).split('+')[0];
  let domain = email.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

// Keyed HMAC, not a bare SHA-256: email addresses are guessable, so an unkeyed
// hash could be reversed by hashing candidate addresses.
function emailHash(email: string): string {
  return createHmac('sha256', EMAIL_HASH_KEY.value()).update(normalizeEmail(email)).digest('hex');
}

function isAuthNotFound(e: unknown): boolean {
  return (e as { code?: string })?.code === 'auth/user-not-found';
}

// Runs one phase's writes to completion before the next phase queries, so a
// later query never races a write that hasn't landed yet.
async function writePhase(fill: (w: FirebaseFirestore.BulkWriter) => void): Promise<void> {
  const writer = db().bulkWriter();
  fill(writer);
  await writer.close();
}

async function purgeAccount(uid: string): Promise<void> {
  // Auth first: if the runtime service account lacks Auth permissions, fail
  // here, before anything has been deleted, rather than leave the account half
  // gone. user-not-found is fine — a retry after the Auth record was removed.
  const authUser = await auth().getUser(uid).catch((e) => {
    if (isAuthNotFound(e)) return null;
    throw e;
  });

  const userRef = db().doc(`users/${uid}`);
  const profile = (await userRef.get()).data();

  // 1. Remember a rule-breaker's email while it can still be read. Only accounts
  //    with a moderation history qualify; everyone else may come back freely.
  const violator = (profile?.moderationStrikes ?? 0) > 0 || (profile?.banCount ?? 0) > 0;
  if (violator && authUser?.email) {
    await db().doc(`blockedEmails/${emailHash(authUser.email)}`).set({
      expiresAt: Timestamp.fromMillis(Date.now() + BLOCK_MS),
    });
  }

  // 2. The user's own posts and discussions go entirely, subcollections
  //    included. Other people's replies under them go too — the same as when the
  //    author deletes a discussion by hand. The existing onDelete triggers drop
  //    each discussion from Algolia and tolerate the parent already being gone.
  const [posts, discussions] = await Promise.all([
    db().collection('posts').where('authorId', '==', uid).get(),
    db().collection('discussions').where('authorId', '==', uid).get(),
  ]);
  for (const d of [...posts.docs, ...discussions.docs]) {
    await db().recursiveDelete(d.ref);
  }

  // 3. Media is filed under the uid, so three prefixes per bucket cover it all.
  await Promise.all(
    [MEDIA_BUCKET, LEGACY_BUCKET].flatMap((name) =>
      ['avatars', 'posts', 'discussions'].map((dir) =>
        getStorage().bucket(name).deleteFiles({ prefix: `${dir}/${uid}/` }),
      ),
    ),
  );

  // 4. Replies and comments on other people's content stay, anonymised.
  const [replies, comments] = await Promise.all([
    db().collectionGroup('replies').where('authorId', '==', uid).get(),
    db().collectionGroup('comments').where('authorId', '==', uid).get(),
  ]);
  // An accepted answer's author name is also copied onto its discussion, and
  // from there into the search index.
  const parents = replies.docs.map((r) => r.ref.parent.parent as DocumentReference);
  const parentSnaps = parents.length ? await db().getAll(...parents) : [];
  await writePhase((w) => {
    for (const d of [...replies.docs, ...comments.docs]) w.update(d.ref, ANONYMOUS_AUTHOR);
    parentSnaps.forEach((disc, i) => {
      if (disc.exists && disc.get('acceptedReplyId') === replies.docs[i].id) {
        w.update(disc.ref, { acceptedReplyAuthorName: '' });
      }
    });
  });

  // 5. Pull the uid out of every array that references it — votes, saves, event
  //    sign-ups, other users' follow lists. Merged per document so a post that
  //    was both liked and saved gets one write. The existing update triggers
  //    recompute engagement and feedScore from the shorter arrays.
  const arrayRefs: [Query, string][] = [
    [db().collection('posts').where('likes', 'array-contains', uid), 'likes'],
    [db().collection('posts').where('dislikes', 'array-contains', uid), 'dislikes'],
    [db().collection('posts').where('savedBy', 'array-contains', uid), 'savedBy'],
    [db().collection('posts').where('participants', 'array-contains', uid), 'participants'],
    [db().collection('discussions').where('savedBy', 'array-contains', uid), 'savedBy'],
    [db().collectionGroup('replies').where('likes', 'array-contains', uid), 'likes'],
    [db().collectionGroup('replies').where('dislikes', 'array-contains', uid), 'dislikes'],
    [db().collection('users').where('following', 'array-contains', uid), 'following'],
  ];
  const arraySnaps = await Promise.all(arrayRefs.map(([q]) => q.get()));
  const scrub = new Map<string, { ref: DocumentReference; fields: Record<string, FieldValue> }>();
  arraySnaps.forEach((snap: QuerySnapshot, i) => {
    for (const d of snap.docs) {
      const entry = scrub.get(d.ref.path) ?? { ref: d.ref, fields: {} };
      entry.fields[arrayRefs[i][1]] = FieldValue.arrayRemove(uid);
      scrub.set(d.ref.path, entry);
    }
  });

  // 6. Notifications addressed to the user go; ones they triggered for others
  //    stay, like their replies, without the sender's name.
  const [toUser, fromUser] = await Promise.all([
    db().collection('notifications').where('toUserId', '==', uid).get(),
    db().collection('notifications').where('fromUserId', '==', uid).get(),
  ]);
  const deletedNotifications = new Set(toUser.docs.map((d) => d.ref.path));

  // 7. Reports about the user's content. A report on a post or discussion points
  //    at something already deleted, so it goes. One on a reply or comment stays
  //    reviewable if the target survived; otherwise it goes too. Reports the
  //    user filed stay as they are, per the retention stated in the policy.
  const reportsAbout = await db().collection('reports').where('targetAuthorId', '==', uid).get();
  const reportTargets = await Promise.all(
    reportsAbout.docs.map(async (r) => {
      const path = r.get('targetPath') as string | undefined;
      if (r.get('targetType') === 'post' || r.get('targetType') === 'discussion') return false;
      // Older reports carry no path; keep them reviewable rather than guess.
      return path ? (await db().doc(path).get()).exists : true;
    }),
  );

  // 8. Reserve the handle forever: an entry with no uid can't be claimed (the
  //    registry is create-only) and resolves to nobody, so old @mentions don't
  //    start pointing at whoever registers the name next.
  const handles = await db().collection('usernames').where('uid', '==', uid).get();

  await writePhase((w) => {
    for (const { ref, fields } of scrub.values()) w.update(ref, fields);
    for (const d of toUser.docs) w.delete(d.ref);
    for (const d of fromUser.docs) {
      if (!deletedNotifications.has(d.ref.path)) {
        w.update(d.ref, { fromUserId: DELETED_ID, fromUserName: '' });
      }
    }
    reportsAbout.docs.forEach((r, i) => {
      if (reportTargets[i]) w.update(r.ref, { targetAuthorId: DELETED_ID });
      else w.delete(r.ref);
    });
    for (const h of handles.docs) w.set(h.ref, { deleted: true });
  });

  // 9. The profile, then the Auth record last: until it is gone the user can
  //    still sign in and retry, and every step above is safe to repeat.
  await userRef.delete();
  await auth().deleteUser(uid).catch((e) => {
    if (!isAuthNotFound(e)) throw e;
  });
}

export const deleteAccount = onCall(
  { region: REGION, secrets: [EMAIL_HASH_KEY], timeoutSeconds: 540, memory: '512MiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to delete your account.');
    const authTime = request.auth?.token.auth_time ?? 0;
    if (Date.now() / 1000 - authTime > REAUTH_WINDOW_S) {
      throw new HttpsError('failed-precondition', 'recent-login-required');
    }
    await purgeAccount(uid);
    return { deleted: true };
  },
);

// ── Re-registration guard ────────────────────────────────────────────────────
// Signup happens entirely client-side, so nothing in the app can refuse it.
// Every signup writes users/{uid} straight after creating the Auth account, and
// this trigger undoes the whole signup if the email belongs to a blocked
// rule-breaker. The app then finds its Auth user gone and shows why.
export const onUserProfileCreated = onDocumentCreated(
  { region: REGION, document: 'users/{uid}', secrets: [EMAIL_HASH_KEY] },
  async (event) => {
    const uid = event.params.uid;
    const user = await auth().getUser(uid).catch((e) => {
      if (isAuthNotFound(e)) return null;
      throw e;
    });
    if (!user?.email) return;

    const block = await db().doc(`blockedEmails/${emailHash(user.email)}`).get();
    const expiresAt = block.get('expiresAt') as Timestamp | undefined;
    if (!expiresAt || expiresAt.toMillis() < Date.now()) return;

    // A fresh signup, not a deleted account: release the handle it just
    // claimed instead of reserving it.
    const handles = await db().collection('usernames').where('uid', '==', uid).get();
    const batch = db().batch();
    for (const h of handles.docs) batch.delete(h.ref);
    batch.delete(db().doc(`users/${uid}`));
    await batch.commit();
    await auth().deleteUser(uid).catch((e) => {
      if (!isAuthNotFound(e)) throw e;
    });
  },
);
