import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from '../types';
import { normalizeUsername, isValidUsername } from '../utils/mentions';

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
