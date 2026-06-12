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
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { Post, PostCategory, PostComment } from '../types';

const PAGE_SIZE = 15;

export async function createPost(
  data: Omit<Post, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'posts'), {
    ...data,
    likes: [],
    dislikes: [],
    commentCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function votePost(
  postId: string,
  userId: string,
  vote: 'like' | 'dislike',
  current: { liked: boolean; disliked: boolean },
): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  const update: Record<string, unknown> = {};
  if (vote === 'like') {
    update.likes = current.liked ? arrayRemove(userId) : arrayUnion(userId);
    if (current.disliked) update.dislikes = arrayRemove(userId);
  } else {
    update.dislikes = current.disliked ? arrayRemove(userId) : arrayUnion(userId);
    if (current.liked) update.likes = arrayRemove(userId);
  }
  await updateDoc(postRef, update);
}

export async function addComment(
  postId: string,
  data: Omit<PostComment, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'posts', postId, 'comments'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });
  return ref.id;
}

export async function fetchComments(postId: string): Promise<PostComment[]> {
  const snap = await getDocs(
    query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PostComment));
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
