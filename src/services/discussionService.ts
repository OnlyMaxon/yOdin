import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { deleteStorageFolder } from './storageService';
import { Discussion, Reply } from '../types';

const PAGE_SIZE = 15;

// Generate a discussion id up front so photos can be uploaded to its storage
// path and their URLs written into the document at creation time.
export function newDiscussionId(): string {
  return doc(collection(db, 'discussions')).id;
}

export async function createDiscussion(
  data: Omit<Discussion, 'id' | 'createdAt' | 'replyCount'>,
  id?: string,
): Promise<string> {
  const payload = { ...data, replyCount: 0, feedScore: 0, engagement: 0, isAnswered: false, createdAt: serverTimestamp() };
  if (id) {
    await setDoc(doc(db, 'discussions', id), payload);
    return id;
  }
  const created = await addDoc(collection(db, 'discussions'), payload);
  return created.id;
}

// The forum is global by default: questions from every region and nationality
// are shown. Pass `nationalities` to restrict the forum to one or more
// nationalities (Firestore `in` supports up to 30 values).
export async function fetchDiscussions(
  nationalities?: string[],
  answerFilter?: 'all' | 'answered' | 'unanswered',
  cursor?: DocumentSnapshot,
): Promise<{ discussions: Discussion[]; lastDoc: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [];
  if (nationalities && nationalities.length > 0 && nationalities.length <= 30)
    constraints.push(where('authorNationality', 'in', nationalities));
  if (answerFilter === 'answered')
    constraints.push(where('isAnswered', '==', true));
  else if (answerFilter === 'unanswered')
    constraints.push(where('isAnswered', '==', false));
  constraints.push(orderBy('feedScore', 'desc'), limit(PAGE_SIZE));
  if (cursor) constraints.push(startAfter(cursor));

  const snap = await getDocs(query(collection(db, 'discussions'), ...constraints));
  const discussions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Discussion));
  const lastDoc = snap.docs[snap.docs.length - 1] ?? null;
  return { discussions, lastDoc };
}

export async function fetchDiscussionById(discussionId: string): Promise<Discussion | null> {
  const snap = await getDoc(doc(db, 'discussions', discussionId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Discussion) : null;
}

// "Question of the day": the single most-active question (most replies + reply
// likes/dislikes). Returns null until at least one question has activity.
export async function fetchTopQuestion(): Promise<Discussion | null> {
  const snap = await getDocs(
    query(
      collection(db, 'discussions'),
      where('engagement', '>', 0),
      orderBy('engagement', 'desc'),
      limit(1),
    ),
  );
  const d = snap.docs[0];
  return d ? ({ id: d.id, ...d.data() } as Discussion) : null;
}

export async function fetchUserDiscussions(uid: string): Promise<Discussion[]> {
  const snap = await getDocs(
    query(
      collection(db, 'discussions'),
      where('authorId', '==', uid),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Discussion));
}

export async function fetchSavedDiscussions(uid: string): Promise<Discussion[]> {
  const snap = await getDocs(
    query(
      collection(db, 'discussions'),
      where('savedBy', 'array-contains', uid),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Discussion));
}

export async function addReply(
  discussionId: string,
  data: Omit<Reply, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'discussions', discussionId, 'replies'), {
    ...data,
    likes: [],
    dislikes: [],
    createdAt: serverTimestamp(),
  });
  // replyCount is maintained server-side by the onReplyCreated function.
  return ref.id;
}

export async function fetchReplies(discussionId: string): Promise<Reply[]> {
  const snap = await getDocs(
    query(
      collection(db, 'discussions', discussionId, 'replies'),
      orderBy('createdAt', 'asc'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reply));
}

export async function saveDiscussion(userId: string, discussionId: string): Promise<void> {
  await updateDoc(doc(db, 'discussions', discussionId), {
    savedBy: arrayUnion(userId),
  });
}

export async function unsaveDiscussion(userId: string, discussionId: string): Promise<void> {
  await updateDoc(doc(db, 'discussions', discussionId), {
    savedBy: arrayRemove(userId),
  });
}

export async function voteReply(
  discussionId: string,
  replyId: string,
  userId: string,
  vote: 'like' | 'dislike',
  current: { liked: boolean; disliked: boolean },
): Promise<void> {
  const replyRef = doc(db, 'discussions', discussionId, 'replies', replyId);
  const update: Record<string, unknown> = {};
  if (vote === 'like') {
    update.likes = current.liked ? arrayRemove(userId) : arrayUnion(userId);
    if (current.disliked) update.dislikes = arrayRemove(userId);
  } else {
    update.dislikes = current.disliked ? arrayRemove(userId) : arrayUnion(userId);
    if (current.liked) update.likes = arrayRemove(userId);
  }
  await updateDoc(replyRef, update);
}

export async function acceptReply(
  discussionId: string,
  replyId: string,
  replyText: string,
  replyAuthorName: string,
): Promise<void> {
  // Denormalize the accepted answer onto the discussion so the forum feed can
  // show it under the question without an extra read per card.
  // The reputation point is awarded server-side by the onDiscussionUpdated
  // Cloud Function — never from the client, which could otherwise farm points.
  await updateDoc(doc(db, 'discussions', discussionId), {
    acceptedReplyId: replyId,
    acceptedReplyText: replyText,
    acceptedReplyAuthorName: replyAuthorName,
    isAnswered: true,
  });
}

export async function deleteDiscussion(discussionId: string): Promise<void> {
  const repliesSnap = await getDocs(collection(db, 'discussions', discussionId, 'replies'));
  const batch = writeBatch(db);
  repliesSnap.docs.forEach((replyDoc) => batch.delete(replyDoc.ref));
  batch.delete(doc(db, 'discussions', discussionId));
  await batch.commit();
  // Clean up any attached photos from storage (best-effort).
  deleteStorageFolder(`discussions/${discussionId}`).catch(() => {});
}

export { PAGE_SIZE };
