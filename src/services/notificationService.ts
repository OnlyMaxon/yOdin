import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  doc,
  writeBatch,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { AppNotification } from '../types';
import { parseMentions } from '../utils/mentions';
import { resolveUsernames } from './userService';

// Realtime subscription: keeps the unread badge and list live for as long as the
// user is signed in. Returns an unsubscribe function.
export function subscribeNotifications(
  uid: string,
  onChange: (notifications: AppNotification[]) => void,
): () => void {
  const q = query(
    collection(db, 'notifications'),
    where('toUserId', '==', uid),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification))),
    () => {
      // Silent: a transient listener error shouldn't crash the app shell.
    },
  );
}

export async function createNotification(
  data: {
    toUserId: string;
    fromUserId: string;
    fromUserName: string;
    fromUserPhoto: string;
    discussionId: string;
    discussionQuestion: string;
  },
  type: 'reply' | 'accepted' = 'reply',
): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    ...data,
    type,
    createdAt: serverTimestamp(),
    read: false,
  });
}

// Sent to an event's author when someone taps "I'm going" on their post.
export async function createParticipantNotification(data: {
  toUserId: string;
  fromUserId: string;
  fromUserName: string;
  fromUserPhoto: string;
  postId: string;
  postTitle: string;
}): Promise<void> {
  await addDoc(collection(db, 'notifications'), {
    ...data,
    type: 'participant',
    createdAt: serverTimestamp(),
    read: false,
  });
}

// Parse @mentions out of a freshly-written piece of text and notify each
// mentioned user (resolved via the usernames registry). Skips the author and
// de-dupes. Best-effort — a mention that fails to resolve/notify never blocks
// the post/comment that triggered it. Pass exactly one of `post`/`discussion`
// (whichever the text belongs to) so the notice links to the right place.
export async function notifyMentions(params: {
  text: string;
  from: { uid: string; name: string; photo: string };
  post?: { id: string; title: string };
  discussion?: { id: string; question: string };
}): Promise<void> {
  const names = parseMentions(params.text);
  if (names.length === 0) return;
  const uids = (await resolveUsernames(names)).filter((uid) => uid !== params.from.uid);
  if (uids.length === 0) return;

  const target = params.post
    ? { postId: params.post.id, postTitle: params.post.title }
    : { discussionId: params.discussion!.id, discussionQuestion: params.discussion!.question };

  await Promise.all(
    uids.map((toUserId) =>
      addDoc(collection(db, 'notifications'), {
        type: 'mention',
        toUserId,
        fromUserId: params.from.uid,
        fromUserName: params.from.name,
        fromUserPhoto: params.from.photo,
        ...target,
        createdAt: serverTimestamp(),
        read: false,
      }).catch(() => {}),
    ),
  );
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => {
    batch.update(doc(db, 'notifications', id), { read: true });
  });
  await batch.commit();
}

export async function deleteReadNotifications(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, 'notifications', id)));
  await batch.commit();
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function cleanupOldNotifications(uid: string): Promise<void> {
  const cutoff = Timestamp.fromMillis(Date.now() - SEVEN_DAYS_MS);
  const snap = await getDocs(
    query(
      collection(db, 'notifications'),
      where('toUserId', '==', uid),
      where('read', '==', true),
      where('createdAt', '<', cutoff),
    ),
  );
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
