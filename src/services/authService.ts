import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from '../types';

export async function registerUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: `${firstName} ${lastName}` });
  await sendEmailVerification(user);
  // Email is intentionally NOT stored here: the users doc is world-readable by
  // any authenticated user, and the email already lives in Firebase Auth.
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    firstName,
    lastName,
    nationality: '',
    countryCode: '',
    location: '',
    photoURL: '',
    languages: [],
    points: 0,
    createdAt: Date.now(),
  });
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
