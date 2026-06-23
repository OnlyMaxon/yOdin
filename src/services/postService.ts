import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { deleteStorageFolder } from './storageService';
import { Post, PostCategory, PostComment } from '../types';

const PAGE_SIZE = 15;

// Generate a post id up front so an image can be uploaded to its storage path
// and the resulting URL written into the document at creation time.
export function newPostId(): string {
  return doc(collection(db, 'posts')).id;
}

export async function createPost(
  data: Omit<Post, 'id' | 'createdAt'>,
  id?: string,
): Promise<string> {
  const payload = {
    ...data,
    likes: [],
    dislikes: [],
    commentCount: 0,
    feedScore: 0,
    createdAt: serverTimestamp(),
  };
  if (id) {
    await setDoc(doc(db, 'posts', id), payload);
    return id;
  }
  const created = await addDoc(collection(db, 'posts'), payload);
  return created.id;
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

// The feed is global by default: posts from every region and nationality are
// shown. Pass `nationalities` to restrict the feed to one or more nationalities
// (Firestore `in` supports up to 30 values).
export async function fetchPosts(
  category?: PostCategory,
  nationalities?: string[],
  cursor?: DocumentSnapshot,
): Promise<{ posts: Post[]; lastDoc: DocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [];
  if (category) constraints.push(where('category', '==', category));
  if (nationalities && nationalities.length > 0 && nationalities.length <= 30)
    constraints.push(where('authorNationality', 'in', nationalities));
  constraints.push(orderBy('feedScore', 'desc'), limit(PAGE_SIZE));
  if (cursor) constraints.push(startAfter(cursor));

  const snap = await getDocs(query(collection(db, 'posts'), ...constraints));
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
  const lastDoc = snap.docs[snap.docs.length - 1] ?? null;
  return { posts, lastDoc };
}

export async function fetchPostById(postId: string): Promise<Post | null> {
  const snap = await getDoc(doc(db, 'posts', postId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Post) : null;
}

export async function savePost(userId: string, postId: string): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), { savedBy: arrayUnion(userId) });
}

export async function unsavePost(userId: string, postId: string): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), { savedBy: arrayRemove(userId) });
}

export async function fetchUserPosts(uid: string): Promise<Post[]> {
  const snap = await getDocs(
    query(collection(db, 'posts'), where('authorId', '==', uid), orderBy('createdAt', 'desc')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
}

export async function fetchSavedPosts(uid: string): Promise<Post[]> {
  const snap = await getDocs(
    query(
      collection(db, 'posts'),
      where('savedBy', 'array-contains', uid),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
}

export async function deletePost(postId: string): Promise<void> {
  await deleteDoc(doc(db, 'posts', postId));
  // Remove all of the post's photos from storage (best-effort).
  deleteStorageFolder(`posts/${postId}`).catch(() => {});
}

export { PAGE_SIZE };
