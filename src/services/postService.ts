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
  deleteDoc,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { Post, PostCategory } from '../types';

const PAGE_SIZE = 15;

export async function createPost(
  data: Omit<Post, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'posts'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function fetchPosts(
  location: string,
  category?: PostCategory,
  cursor?: DocumentSnapshot,
): Promise<{ posts: Post[]; lastDoc: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [where('location', '==', location)];
  if (category) constraints.push(where('category', '==', category));
  constraints.push(orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
  if (cursor) constraints.push(startAfter(cursor));

  const snap = await getDocs(query(collection(db, 'posts'), ...constraints));
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
  const lastDoc = snap.docs[snap.docs.length - 1] ?? null;
  return { posts, lastDoc };
}

export async function deletePost(postId: string): Promise<void> {
  await deleteDoc(doc(db, 'posts', postId));
}

export { PAGE_SIZE };
