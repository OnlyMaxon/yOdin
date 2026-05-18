import {
  collection,
  addDoc,
  getDocs,
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
  const constraints: any[] = [
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

export async function addReply(
  discussionId: string,
  data: Omit<Reply, 'id' | 'createdAt'>,
): Promise<void> {
  await addDoc(collection(db, 'discussions', discussionId, 'replies'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'discussions', discussionId), {
    replyCount: increment(1),
  });
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

export async function deleteDiscussion(discussionId: string): Promise<void> {
  await deleteDoc(doc(db, 'discussions', discussionId));
}
