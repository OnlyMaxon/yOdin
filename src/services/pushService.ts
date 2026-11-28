import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import i18n from 'i18next';
import { db } from './firebase';

// Notifications are Firestore documents; the in-app list renders them live
// through onSnapshot, which only works while the app is running. This is the
// other half — the device token that lets a Cloud Function reach the lock
// screen. See functions/src/push.ts for the sending side.
//
// The token is the *native* FCM/APNs one, not an Expo push token: everything
// else here already runs on Firebase, so the function sends through
// firebase-admin and nothing has to be registered with Expo's push service.

// Must match CHANNEL_ID in functions/src/push.ts. Android silently drops a
// notification addressed to a channel that was never created.
const CHANNEL_ID = 'default';

// How a notification behaves while the app is in the foreground. Without this
// the OS stays silent, on the assumption the running app shows it itself —
// which ours only does on the notifications tab.
export function configurePushHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'yOdin',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {});
}

// Ask once, then register the device. Returns false when the user said no, so
// a caller can stop asking rather than prompting on every launch.
//
// Tokens go in a subcollection and not on the profile document: every signed-in
// user may read every profile, and a push token is not something to publish.
// The document id *is* the token, so a reinstall adds a row rather than
// overwriting, and the sender prunes the dead ones when FCM rejects them.
export async function registerForPush(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return false;

    const token = await Notifications.getDevicePushTokenAsync();
    if (!token?.data || typeof token.data !== 'string') return false;

    await setDoc(doc(db, 'users', uid, 'pushTokens', token.data), {
      platform: Platform.OS,
      updatedAt: serverTimestamp(),
    });
    await syncUserLanguage(uid);
    return true;
  } catch {
    // A device without Play Services, an emulator, a revoked permission — none
    // of it is worth surfacing. The app works, it just stays quiet.
    return false;
  }
}

// The app's language lives in AsyncStorage, which the server cannot see — and
// a push has to arrive already written, in a language the recipient reads. So
// the choice is mirrored onto the profile: it is the only thing the sender
// needs that the device alone knows. Called at registration and whenever the
// setting changes.
export async function syncUserLanguage(uid: string, language?: string): Promise<void> {
  if (!uid) return;
  await updateDoc(doc(db, 'users', uid), {
    language: language ?? i18n.language ?? 'en',
  }).catch(() => {});
}

// Called on sign-out, so the next person on this device does not receive the
// previous one's notifications.
export async function unregisterPush(uid: string): Promise<void> {
  if (!uid) return;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    if (!token?.data || typeof token.data !== 'string') return;
    await deleteDoc(doc(db, 'users', uid, 'pushTokens', token.data));
  } catch {
    // Best effort. A token left behind is cleaned up by the sender the first
    // time FCM reports it unregistered.
  }
}
