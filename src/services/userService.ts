import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  getCountFromServer,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

// ── Usernames (@handles) ─────────────────────────────────────────────────────
// The `usernames/{username}` collection is the authoritative uniqueness guard
// AND the @mention lookup index: doc id = the username, body = { uid }. A
// create-only security rule makes claiming a taken name fail atomically.

// True if the (already normalized) username is not yet claimed.
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'usernames', username));
  return !snap.exists();
}

// Resolve mentioned usernames → the uids that actually exist (deduped).
export async function resolveUsernames(usernames: string[]): Promise<string[]> {
  if (usernames.length === 0) return [];
  const snaps = await Promise.all(usernames.map((n) => getDoc(doc(db, 'usernames', n))));
  const uids = snaps
    .filter((s) => s.exists())
    .map((s) => s.data()?.uid as string | undefined)
    .filter((uid): uid is string => typeof uid === 'string');
  return Array.from(new Set(uids));
}

// Change a user's username atomically: release the old registry entry, claim the
// new one (create-only → the whole batch fails if it's taken, leaving the old
// name intact), and update the denormalized copy on the user doc.
export async function changeUsername(
  uid: string,
  oldUsername: string | undefined,
  newUsername: string,
): Promise<void> {
  const batch = writeBatch(db);
  if (oldUsername) batch.delete(doc(db, 'usernames', oldUsername));
  batch.set(doc(db, 'usernames', newUsername), { uid });
  batch.update(doc(db, 'users', uid), { username: newUsername });
  await batch.commit();
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

// Resolve a list of uids to their user documents (missing/deleted ones dropped).
export async function fetchUsersByIds(uids: string[]): Promise<User[]> {
  if (uids.length === 0) return [];
  const snaps = await Promise.all(uids.map((id) => getDoc(doc(db, 'users', id))));
  return snaps
    .filter((s) => s.exists())
    .map((s) => ({ ...(s.data() as object), uid: s.id } as User));
}

// The users who follow `uid` (their `following` array contains it).
export async function fetchFollowers(uid: string): Promise<User[]> {
  const snap = await getDocs(
    query(collection(db, 'users'), where('following', 'array-contains', uid)),
  );
  return snap.docs.map((d) => ({ ...(d.data() as object), uid: d.id } as User));
}

// The users `uid` follows (resolved from its own `following` array).
export async function fetchFollowing(uid: string): Promise<User[]> {
  const snap = await getDoc(doc(db, 'users', uid));
  const ids = (snap.exists() ? (snap.data().following as string[] | undefined) : undefined) ?? [];
  return fetchUsersByIds(ids);
}