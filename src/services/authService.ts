import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { auth, db, functions } from './firebase';
import { unregisterPush } from './pushService';
import { User } from '../types';
import { normalizeUsername, isValidUsername } from '../utils/mentions';
import { TERMS_VERSION } from '../config/links';
import { reauthenticateWithApple } from './appleAuth';
import { signInWithMicrosoft } from './microsoftAuth';

export async function registerUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  username: string,
): Promise<void> {
  const uname = normalizeUsername(username);
  if (!isValidUsername(uname)) throw new Error('username-invalid');
  // Fail before creating the auth account if the name is already claimed.
  const existing = await getDoc(doc(db, 'usernames', uname));
  if (existing.exists()) throw new Error('username-taken');

  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: `${firstName} ${lastName}` });
  await sendEmailVerification(user);

  // Write the profile and claim the username atomically. Email is intentionally
  // NOT stored (the users doc is world-readable; email lives in Auth). The
  // create-only rule on usernames/{uname} makes this fail if the name was
  // claimed in the race — then we delete the just-created auth account so none
  // is left orphaned.
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', user.uid), {
      uid: user.uid,
      firstName,
      lastName,
      username: uname,
      nationality: '',
      countryCode: '',
      location: '',
      photoURL: '',
      languages: [],
      points: 0,
      createdAt: Date.now(),
      // The signup gate blocks the button until the terms are accepted; record
      // that it happened and against which revision (see TERMS_VERSION).
      acceptedTermsAt: Date.now(),
      acceptedTermsVersion: TERMS_VERSION,
    });
    batch.set(doc(db, 'usernames', uname), { uid: user.uid });
    await batch.commit();
  } catch {
    await user.delete().catch(() => {});
    throw new Error('username-taken');
  }
}

export async function loginUser(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logoutUser(): Promise<void> {
  // Drop this device's push token first — after signOut the rules no longer
  // allow writing under the user, so the next person to sign in here would
  // keep receiving the previous one's notifications.
  await unregisterPush(auth.currentUser?.uid ?? '');
  await signOut(auth);
}

// Single source of truth for reading a user profile (auth flow + social screens).
export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ({ uid, ...snap.data() } as User) : null;
}

export async function updateUserProfile(uid: string, data: Partial<User>): Promise<void> {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function resendVerificationEmail(): Promise<void> {
  const user = auth.currentUser;
  if (user) await sendEmailVerification(user);
}

export type ReauthMethod = 'password' | 'apple' | 'microsoft';

// Which credential this account can actually prove itself with. A provider
// account has no password at all, so asking for one is a dead end: Apple shows
// up as a real Firebase provider, while Microsoft signs in with a custom token
// and therefore carries no providerData whatsoever — the uid prefix minted in
// functions/src/microsoftAuth.ts is the only marker it leaves.
export function getReauthMethod(): ReauthMethod {
  const user = auth.currentUser;
  if (!user) return 'password';
  if (user.providerData.some((p) => p.providerId === 'apple.com')) return 'apple';
  if (user.uid.startsWith('ms:')) return 'microsoft';
  return 'password';
}

// Deleting an account is a server job: it spans other people's documents, media
// in two buckets and the Auth record, and a client that closed midway would
// leave the account half removed. The session is re-proven first — the function
// refuses tokens older than five minutes, so this step can't be skipped by
// calling it directly from a signed-in phone.
export async function deleteOwnAccount(password?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('not-signed-in');

  const method = getReauthMethod();
  if (method === 'apple') {
    await reauthenticateWithApple();
  } else if (method === 'microsoft') {
    // No Firebase credential exists for a custom-token session, so the only way
    // to refresh auth_time is to run the whole Microsoft flow again. It lands on
    // the same uid, and the server skips profile creation for an existing one.
    await signInWithMicrosoft();
  } else {
    if (!user.email || !password) throw new Error('not-signed-in');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  }

  await httpsCallable(functions, 'deleteAccount')();
  // The Auth record is already gone; this just clears the local session so the
  // app doesn't sit on a dead token.
  await signOut(auth).catch(() => {});
}
