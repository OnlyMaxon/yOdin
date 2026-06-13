import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

export async function fetchUser(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
}

// Following is stored as an array on the follower's own user document, so a
// follow/unfollow is just a self-update (allowed by the existing owner rule).
export async function followUser(myUid: string, targetUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', myUid), { following: arrayUnion(targetUid) });
}

export async function unfollowUser(myUid: string, targetUid: string): Promise<void> {
  await updateDoc(doc(db, 'users', myUid), { following: arrayRemove(targetUid) });
}

// Followers = everyone whose `following` array contains this user.
export async function countFollowers(uid: string): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, 'users'), where('following', 'array-contains', uid)),
  );
  return snap.data().count;
}