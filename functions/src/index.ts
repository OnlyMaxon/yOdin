import {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { algoliasearch } from 'algoliasearch';

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
    }
    if (after.acceptedReplyId && before.acceptedReplyId !== after.acceptedReplyId) {
      updates.acceptedReplyId = after.acceptedReplyId;
      if (after.acceptedReplyText) updates.acceptedReplyText = after.acceptedReplyText;
      if (after.acceptedReplyAuthorName) updates.acceptedReplyAuthorName = after.acceptedReplyAuthorName;
    }

    if (Object.keys(updates).length === 0) return;

    await getClient().partialUpdateObject({
      indexName: INDEX,
      objectID: event.params.docId,
      attributesToUpdate: updates,
    });
  },
);
