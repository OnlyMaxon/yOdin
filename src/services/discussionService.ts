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
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { Discussion, Reply } from '../types';

const PAGE_SIZE = 15;

export async function createDiscussion(
  data: Omit<Discussion, 'id' | 'createdAt' | 'replyCount'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'discussions'), {
    ...data,
    replyCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function fetchDiscussions(
  location: string,
  cursor?: DocumentSnapshot,
): Promise<{ discussions: Discussion[]; lastDoc: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [
    where('location', '==', location),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE),
  ];
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
  await updateDoc(doc(db, 'discussions', discussionId), {
    replyCount: increment(1),
  });
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
  replyAuthorId: string,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'discussions', discussionId), { acceptedReplyId: replyId });
  batch.update(doc(db, 'users', replyAuthorId), { points: increment(1) });
  await batch.commit();
}

export async function deleteDiscussion(discussionId: string): Promise<void> {
  const repliesSnap = await getDocs(collection(db, 'discussions', discussionId, 'replies'));
  const batch = writeBatch(db);
  repliesSnap.docs.forEach((replyDoc) => batch.delete(replyDoc.ref));
  batch.delete(doc(db, 'discussions', discussionId));
  await batch.commit();
}

export { PAGE_SIZE };
