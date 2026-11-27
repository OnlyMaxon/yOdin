import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { algoliasearch } from 'algoliasearch';
import { setGlobalOptions } from 'firebase-functions';
import { DELETED_ID } from './accountDeletion';
import { identityOf, corrections, str } from './authorIdentity';

// Firestore lives in eur3 — keep the functions on the same continent so triggers
// don't make a round trip to the US.
setGlobalOptions({ region: 'europe-west1' });

initializeApp();
const db = getFirestore();

const ALGOLIA_APP_ID = defineSecret('ALGOLIA_APP_ID');
const ALGOLIA_WRITE_KEY = defineSecret('ALGOLIA_WRITE_KEY');
const INDEX = 'discussions';

function getClient() {
  return algoliasearch(ALGOLIA_APP_ID.value(), ALGOLIA_WRITE_KEY.value());
}

// Reddit-style "hot" score: a time baseline that grows for newer items plus a
// logarithmic engagement boost. Because it's anchored to absolute time it stays
// monotonic in createdAt — new content surfaces and old content sinks naturally,
// with no scheduled decay job. ~12.5 h of recency ≈ a 10× engagement jump.
const EPOCH_S = 1_700_000_000;
function hotScore(engagement: number, createdAtMs: number): number {
  const order = Math.log10(Math.max(engagement, 0) + 1);
  const seconds = createdAtMs / 1000 - EPOCH_S;
  return Number((order + seconds / 45000).toFixed(7));
}
function createdMs(data: FirebaseFirestore.DocumentData): number {
  return data.createdAt?.toMillis?.() ?? Date.now();
}

// New discussion → index in Algolia
export const onDiscussionCreated = onDocumentCreated(
  { document: 'discussions/{docId}', secrets: [ALGOLIA_APP_ID, ALGOLIA_WRITE_KEY] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    // Resolved before indexing, not after: Algolia is written once here and
    // onDiscussionUpdated never re-syncs the author fields, so a forged name
    // would otherwise sit in the search index forever even after the document
    // itself had been corrected.
    const truth = await identityOf(data.authorId);
    const author = truth ?? {
      authorName: str(data.authorName),
      authorPhoto: str(data.authorPhoto),
      authorNationality: str(data.authorNationality),
      authorCountryCode: str(data.authorCountryCode),
    };

    // Before Algolia, deliberately. Indexing can fail — a bad secret, an
    // outage, a rate limit — and this handler throws when it does, so anything
    // after that call simply does not run. The author correction is the half
    // that must not be skippable by an outage; a missing feed score only costs
    // the question some reach.
    await db.doc(`discussions/${event.params.docId}`)
      .update({
        feedScore: hotScore(0, createdMs(data)),
        ...(truth ? corrections(data, truth) : {}),
      })
      .catch(() => {});

    await getClient().saveObject({
      indexName: INDEX,
      body: {
        objectID: event.params.docId,
        _tags: [data.location ?? ''],
        question: data.question ?? '',
        authorId: data.authorId ?? '',
        authorName: author.authorName,
        authorPhoto: author.authorPhoto,
        authorNationality: author.authorNationality,
        authorCountryCode: author.authorCountryCode,
        location: data.location ?? '',
        replyCount: 0,
        // Seed the answered facet so the forum "answered/unanswered" search
        // filter has a value to match from the moment the doc is indexed.
        isAnswered: data.isAnswered ?? false,
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
      },
    });
  },
);

// New post → seed its recency-based feed score (no onCreate Algolia for posts).
export const onPostCreated = onDocumentCreated('posts/{docId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const truth = await identityOf(data.authorId);
  await db.doc(`posts/${event.params.docId}`)
    .update({
      feedScore: hotScore(0, createdMs(data)),
      ...(truth ? corrections(data, truth) : {}),
    })
    .catch(() => {});
});

// Discussion deleted → remove from Algolia
export const onDiscussionDeleted = onDocumentDeleted(
  { document: 'discussions/{docId}', secrets: [ALGOLIA_APP_ID, ALGOLIA_WRITE_KEY] },
  async (event) => {
    await getClient().deleteObject({ indexName: INDEX, objectID: event.params.docId });
  },
);

// Discussion updated → sync replyCount and acceptedReplyId only when they change
export const onDiscussionUpdated = onDocumentUpdated(
  { document: 'discussions/{docId}', secrets: [ALGOLIA_APP_ID, ALGOLIA_WRITE_KEY] },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const updates: Record<string, unknown> = {};

    if (before.replyCount !== after.replyCount) {
      updates.replyCount = after.replyCount;
      const newFeedScore = hotScore((after.replyCount ?? 0) * 2, createdMs(after));
      if ((before.feedScore ?? 0) !== newFeedScore) {
        await db.doc(`discussions/${event.params.docId}`).update({ feedScore: newFeedScore });
      }
    }
    // Keep the answered facet in sync so search's answered/unanswered filter
    // reflects reality (it flips true when an answer is accepted).
    if (before.isAnswered !== after.isAnswered) {
      updates.isAnswered = after.isAnswered ?? false;
    }
    if (after.acceptedReplyId && before.acceptedReplyId !== after.acceptedReplyId) {
      updates.acceptedReplyId = after.acceptedReplyId;
      if (after.acceptedReplyText) updates.acceptedReplyText = after.acceptedReplyText;
      if (after.acceptedReplyAuthorName) updates.acceptedReplyAuthorName = after.acceptedReplyAuthorName;

      // Award the reputation point here, server-side. The client cannot be
      // trusted to do this (it could increment any user's points arbitrarily).
      // We read the accepted reply to learn its author, then grant exactly +1.
      try {
        const replySnap = await db
          .doc(`discussions/${event.params.docId}/replies/${after.acceptedReplyId}`)
          .get();
        const authorId = replySnap.get('authorId') as string | undefined;
        if (authorId) {
          await db.doc(`users/${authorId}`).update({ points: FieldValue.increment(1) });
        }
      } catch {
        // Point award is best-effort; a failure must not block the Algolia sync.
      }
    }

    // Account deletion blanks the accepted answer's author without touching
    // acceptedReplyId, so the name has to sync on its own as well.
    if (before.acceptedReplyAuthorName !== after.acceptedReplyAuthorName) {
      updates.acceptedReplyAuthorName = after.acceptedReplyAuthorName ?? '';
    }

    if (Object.keys(updates).length === 0) return;

    await getClient().partialUpdateObject({
      indexName: INDEX,
      objectID: event.params.docId,
      attributesToUpdate: updates,
    });
  },
);

// Post liked or commented → recompute feedScore server-side
export const onPostUpdated = onDocumentUpdated(
  { document: 'posts/{docId}' },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const likesChanged = (before.likes?.length ?? 0) !== (after.likes?.length ?? 0);
    const commentCountChanged = (before.commentCount ?? 0) !== (after.commentCount ?? 0);
    if (!likesChanged && !commentCountChanged) return;

    const engagement = (after.likes?.length ?? 0) * 3 + (after.commentCount ?? 0) * 2;
    const newFeedScore = hotScore(engagement, createdMs(after));
    if ((before.feedScore ?? 0) !== newFeedScore) {
      await db.doc(`posts/${event.params.docId}`).update({ feedScore: newFeedScore });
    }
  },
);

// ── Counters maintained server-side ──────────────────────────────────────────
// The client no longer increments commentCount/replyCount (which fed feedScore
// and was forgeable). Counts are derived from the actual sub-documents here, so
// they can't be inflated without real content. (.catch swallows the case where
// the parent was already deleted — e.g. a discussion delete that batch-removes
// its replies.)

export const onCommentCreated = onDocumentCreated(
  'posts/{postId}/comments/{commentId}',
  async (event) => {
    await db.doc(`posts/${event.params.postId}`)
      .update({ commentCount: FieldValue.increment(1) })
      .catch(() => {});
    await correctAuthor(event);
  },
);

export const onCommentDeleted = onDocumentDeleted(
  'posts/{postId}/comments/{commentId}',
  async (event) => {
    await db.doc(`posts/${event.params.postId}`)
      .update({ commentCount: FieldValue.increment(-1) })
      .catch(() => {});
  },
);

export const onReplyCreated = onDocumentCreated(
  'discussions/{discussionId}/replies/{replyId}',
  async (event) => {
    // A new reply adds 1 comment of activity (its votes start at 0).
    await db.doc(`discussions/${event.params.discussionId}`)
      .update({ replyCount: FieldValue.increment(1), engagement: FieldValue.increment(1) })
      .catch(() => {});
    await correctAuthor(event);
  },
);

export const onReplyDeleted = onDocumentDeleted(
  'discussions/{discussionId}/replies/{replyId}',
  async (event) => {
    const r = event.data?.data();
    const votes = (r?.likes?.length ?? 0) + (r?.dislikes?.length ?? 0);
    await db.doc(`discussions/${event.params.discussionId}`)
      .update({
        replyCount: FieldValue.increment(-1),
        engagement: FieldValue.increment(-(1 + votes)),
      })
      .catch(() => {});
  },
);

// Comments and replies are corrected on their own document rather than folded
// into an existing write, because the counter update above targets the parent.
// Safe against loops: there is no onCommentUpdated, and onReplyUpdated only
// acts when the vote count changes, which this never does.
async function correctAuthor(event: {
  data?: { data: () => FirebaseFirestore.DocumentData; ref: FirebaseFirestore.DocumentReference };
}): Promise<void> {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  const truth = await identityOf(data.authorId);
  if (!truth) return;
  const fix = corrections(data, truth);
  if (Object.keys(fix).length === 0) return;
  await snap.ref.update(fix).catch(() => {});
}

// `fromUserName` / `fromUserPhoto` are written by the client, so a notification
// can arrive looking like it came from "yOdin Support" — and it lands in the
// same list as the real ones, which makes it the most convincing phishing
// surface in the app. Corrected from the sender's own profile. Moderation
// notices are sent by the Admin SDK with `fromUserId: 'system'`, which has no
// profile, so identityOf() returns null and those are left untouched.
export const onNotificationCreated = onDocumentCreated(
  'notifications/{docId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const truth = await identityOf(data.fromUserId);
    if (!truth) return;
    const fix: Record<string, string> = {};
    if (str(data.fromUserName) !== truth.authorName) fix.fromUserName = truth.authorName;
    if (str(data.fromUserPhoto) !== truth.authorPhoto) fix.fromUserPhoto = truth.authorPhoto;
    if (Object.keys(fix).length === 0) return;
    await snap.ref.update(fix).catch(() => {});
  },
);

// ── Moderation: removal notice + escalating comment ban ──────────────────────
// When a moderator marks a report 'removed', notify the author and add a strike.
// Strikes are only added on moderator-confirmed removals (not raw reports), so
// the ban can't be farmed. Every 5 strikes triggers a comment ban that escalates
// 3 days → 7 days → 30 days. The ban is enforced by the Firestore rules, which
// reject comment/reply creates while `now < commentBlockedUntil`.
const BAN_THRESHOLD = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
function banDurationMs(banCount: number): number {
  if (banCount <= 1) return 3 * DAY_MS;
  if (banCount === 2) return 7 * DAY_MS;
  return 30 * DAY_MS;
}

export const onReportUpdated = onDocumentUpdated('reports/{reportId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;
  // Only act on the pending → removed transition.
  if (before.status === after.status || after.status !== 'removed') return;

  const authorId: string | undefined = after.targetAuthorId;
  // Content left by a deleted account can still be removed, but there is
  // nobody left to notify or strike.
  if (!authorId || authorId === DELETED_ID) return;
  const snippet = String(after.targetTitle ?? '').slice(0, 140);

  // 1) Tell the author their content was removed.
  await db.collection('notifications').add({
    type: 'removed',
    toUserId: authorId,
    fromUserId: 'system',
    fromUserName: '',
    contentSnippet: snippet,
    createdAt: FieldValue.serverTimestamp(),
    read: false,
  }).catch(() => {});

  // 2) Add a strike; on every 5th, apply an escalating comment ban.
  const userRef = db.doc(`users/${authorId}`);
  let banDays = 0;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) return;
    const strikes = (snap.get('moderationStrikes') ?? 0) + 1;
    if (strikes < BAN_THRESHOLD) {
      tx.update(userRef, { moderationStrikes: strikes });
      return;
    }
    const banCount = (snap.get('banCount') ?? 0) + 1;
    const ms = banDurationMs(banCount);
    tx.update(userRef, {
      moderationStrikes: 0,
      banCount,
      commentBlockedUntil: Date.now() + ms,
    });
    banDays = Math.round(ms / DAY_MS);
  }).catch(() => {});

  // 3) Notify the user about the ban so they know why they can't comment.
  if (banDays > 0) {
    await db.collection('notifications').add({
      type: 'blocked',
      toUserId: authorId,
      fromUserId: 'system',
      fromUserName: '',
      blockDays: banDays,
      createdAt: FieldValue.serverTimestamp(),
      read: false,
    }).catch(() => {});
  }
});

// Reply voted (likes/dislikes changed) → adjust the parent question's activity.
export const onReplyUpdated = onDocumentUpdated(
  'discussions/{discussionId}/replies/{replyId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    const beforeVotes = (before.likes?.length ?? 0) + (before.dislikes?.length ?? 0);
    const afterVotes = (after.likes?.length ?? 0) + (after.dislikes?.length ?? 0);
    const delta = afterVotes - beforeVotes;
    if (delta === 0) return;
    await db.doc(`discussions/${event.params.discussionId}`)
      .update({ engagement: FieldValue.increment(delta) })
      .catch(() => {});
  },
);

export { deleteAccount, onUserProfileCreated } from './accountDeletion';
export { onBlockCreated, onBlockDeleted } from './blocking';
export { microsoftSignIn } from './microsoftAuth';
export { appleEnsureProfile } from './appleAuth';
