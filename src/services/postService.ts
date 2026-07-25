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
  runTransaction,
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
    // Event sign-up sheets always start empty — the author can't pre-seed it.
    ...(data.signupEnabled ? { participants: [] } : {}),
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

// Join an event's sign-up sheet. Runs in a transaction so the participant cap
// can't be exceeded by two people tapping "I'm going" at the same time.
// Throws 'event-full' when the limit is reached. Idempotent if already joined.
export async function joinEvent(postId: string, uid: string): Promise<void> {
  const ref = doc(db, 'posts', postId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('not-found');
    const data = snap.data();
    const participants: string[] = data.participants ?? [];
    if (participants.includes(uid)) return;
    const cap: number | null = data.participantLimit ?? null;
    if (cap != null && participants.length >= cap) throw new Error('event-full');
    tx.update(ref, { participants: arrayUnion(uid) });
  });
}

export async function leaveEvent(postId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), { participants: arrayRemove(uid) });
}

export async function addComment(
  postId: string,
  data: Omit<PostComment, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'posts', postId, 'comments'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  // commentCount is maintained server-side by the onCommentCreated function.
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

export async function deletePost(postId: string, authorId: string): Promise<void> {
  await deleteDoc(doc(db, 'posts', postId));
  // Remove the post's media from storage (best-effort). Media lives under the
  // author's uid-scoped folder: posts/{authorId}/{postId}/…
  deleteStorageFolder(`posts/${authorId}/${postId}`).catch(() => {});
}

export { PAGE_SIZE };
