import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore, DocumentReference } from 'firebase-admin/firestore';
import { identityFrom, corrections, str, IDENTITY_FIELDS, Identity } from './authorIdentity';

// ── Profile edits reach the content already published ────────────────────────
// Author name, photo and flag are copied onto every content document at
// creation so a feed card renders with zero extra reads (§6 of
// ARCHITECTURE.md). That document names the cost — "anything touching an author
// has to rewrite every copy" — and until now only *account deletion* paid it.
// A plain avatar change did not: the new picture appeared on new content while
// every existing post, question, comment, reply and notification kept the old
// one, which reads as a bug and is one.
//
// So the same sweep the deletion flow performs runs on a profile edit, with the
// author's new identity instead of the anonymous placeholder.
//
// Loop safety: this trigger listens on `users/{uid}` and writes to posts,
// discussions, comments, replies and notifications — never back to `users`, so
// it cannot retrigger itself. The content updates do fire the existing update
// triggers, and all of them bail: `onPostUpdated` only acts when the like count
// or comment count changes, `onReplyUpdated` only on a vote change, and there
// is no comment-update trigger at all. `onDiscussionUpdated` does act — that is
// deliberate, it is what carries the new name into the Algolia index.
//
// Getter, not a module constant: index.ts calls initializeApp() in its body.
const db = () => getFirestore();

// index.ts sets the global region in its body but imports this module above
// that line, so the definition below would never see it.
const REGION = 'europe-west1';

export const onUserProfileUpdated = onDocumentUpdated(
  {
    region: REGION,
    document: 'users/{uid}',
    // A prolific author can own a few thousand documents. BulkWriter manages
    // about 500 writes a second, so even an extreme case finishes well inside
    // this, and the timeout stays the backstop rather than the design.
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Most writes to a user document are not identity changes at all — a
    // follow, a language switch, a points award — and each one would otherwise
    // start a full sweep.
    if (!IDENTITY_FIELDS.some((field) => str(before[field]) !== str(after[field]))) return;

    // Two different profiles can still produce the same copied values: an
    // avatar re-uploaded without being changed, a first name edited from "Max"
    // to "Max". `corrections` would find nothing for every document, so stop
    // before reading them all.
    const truth = identityFrom(after);
    const was = identityFrom(before);
    if (
      truth.authorName === was.authorName &&
      truth.authorPhoto === was.authorPhoto &&
      truth.authorNationality === was.authorNationality &&
      truth.authorCountryCode === was.authorCountryCode
    ) {
      return;
    }

    await sweep(event.params.uid, truth);
  },
);

async function sweep(uid: string, truth: Identity): Promise<void> {
  // The same five queries the deletion sweep runs, so the indexes they need
  // already exist — `comments.authorId` and `replies.authorId` are declared
  // with COLLECTION_GROUP scope in firestore.indexes.json for exactly this.
  const [posts, discussions, comments, replies, notifications] = await Promise.all([
    db().collection('posts').where('authorId', '==', uid).get(),
    db().collection('discussions').where('authorId', '==', uid).get(),
    db().collectionGroup('comments').where('authorId', '==', uid).get(),
    db().collectionGroup('replies').where('authorId', '==', uid).get(),
    db().collection('notifications').where('fromUserId', '==', uid).get(),
  ]);

  // An accepted answer's author name is copied onto the question too, and the
  // question carries no author id for that answer — so the only way to find
  // those questions is from the replies side. Parents are de-duplicated before
  // reading: several of this user's replies can sit under one question.
  const parentByPath = new Map<string, DocumentReference>();
  for (const reply of replies.docs) {
    const parent = reply.ref.parent.parent;
    if (parent) parentByPath.set(parent.path, parent);
  }
  const parents = [...parentByPath.values()];
  const parentSnaps = parents.length ? await db().getAll(...parents) : [];
  const acceptedIn = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  for (const snap of parentSnaps) {
    const acceptedId = snap.get('acceptedReplyId');
    if (typeof acceptedId === 'string') acceptedIn.set(acceptedId, snap);
  }

  const writer = db().bulkWriter();
  let touched = 0;
  const amend = (ref: DocumentReference, fields: Record<string, string>) => {
    if (Object.keys(fields).length === 0) return;
    writer.update(ref, fields);
    touched += 1;
  };

  for (const doc of [...posts.docs, ...discussions.docs, ...comments.docs, ...replies.docs]) {
    amend(doc.ref, corrections(doc.data(), truth));
  }

  // Notifications name their sender in their own two fields.
  for (const note of notifications.docs) {
    const fields: Record<string, string> = {};
    if (str(note.get('fromUserName')) !== truth.authorName) fields.fromUserName = truth.authorName;
    if (str(note.get('fromUserPhoto')) !== truth.authorPhoto) fields.fromUserPhoto = truth.authorPhoto;
    amend(note.ref, fields);
  }

  // Only the questions where *this user's* reply is the accepted one. The
  // update also makes onDiscussionUpdated resync the name into Algolia.
  for (const reply of replies.docs) {
    const question = acceptedIn.get(reply.id);
    if (!question) continue;
    if (str(question.get('acceptedReplyAuthorName')) === truth.authorName) continue;
    amend(question.ref, { acceptedReplyAuthorName: truth.authorName });
  }

  await writer.close();

  // Deliberately not capped. A cap would leave the rest of someone's history
  // showing the old name — the exact bug this fixes, made silent. The count is
  // logged instead, so a sweep that ever grows alarming is visible in the logs
  // rather than inferred from a bill.
  console.log(`identity sweep ${uid}: ${touched} document(s) rewritten`);
}
