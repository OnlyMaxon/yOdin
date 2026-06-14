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
