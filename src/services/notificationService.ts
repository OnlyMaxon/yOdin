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
} from 'firebase/firestore';
import { db } from './firebase';
import { AppNotification } from '../types';

export async function fetchNotifications(uid: string): Promise<AppNotification[]> {
  const snap = await getDocs(
    query(
      collection(db, 'notifications'),
      where('toUserId', '==', uid),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
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
