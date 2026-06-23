import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { algoliasearch } from 'algoliasearch';

initializeApp();
const db = getFirestore();

const ALGOLIA_APP_ID = defineSecret('ALGOLIA_APP_ID');
const ALGOLIA_WRITE_KEY = defineSecret('ALGOLIA_WRITE_KEY');
const INDEX = 'discussions';

function getClient() {
  return algoliasearch(ALGOLIA_APP_ID.value(), ALGOLIA_WRITE_KEY.value());
}

// New discussion → index in Algolia
export const onDiscussionCreated = onDocumentCreated(
  { document: 'discussions/{docId}', secrets: [ALGOLIA_APP_ID, ALGOLIA_WRITE_KEY] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await getClient().saveObject({
      indexName: INDEX,
      body: {
        objectID: event.params.docId,
        _tags: [data.location ?? ''],
        question: data.question ?? '',
        authorId: data.authorId ?? '',
        authorName: data.authorName ?? '',
        authorPhoto: data.authorPhoto ?? '',
        authorNationality: data.authorNationality ?? '',
        authorCountryCode: data.authorCountryCode ?? '',
        location: data.location ?? '',
        replyCount: 0,
        createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
      },
    });
  },
);

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
      const newFeedScore = (after.replyCount ?? 0) * 2;
      if ((before.feedScore ?? 0) !== newFeedScore) {
        await db.doc(`discussions/${event.params.docId}`).update({ feedScore: newFeedScore });
      }
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

    const newFeedScore = (after.likes?.length ?? 0) * 3 + (after.commentCount ?? 0) * 2;
    if ((before.feedScore ?? 0) !== newFeedScore) {
      await db.doc(`posts/${event.params.docId}`).update({ feedScore: newFeedScore });
    }
  },
);
