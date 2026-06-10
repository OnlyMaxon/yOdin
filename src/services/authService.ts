import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
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
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email,
    firstName,
    lastName,
    nationality: '',
    countryCode: '',
    location: '',
    photoURL: '',
    languages: [],
    createdAt: Date.now(),
  });
}

export async function loginUser(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
}

export async function updateUserProfile(uid: string, data: Partial<User>): Promise<void> {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

export async function ensureMicrosoftProfile(user: FirebaseUser): Promise<void> {
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (snap.exists()) return;

  const displayName = user.displayName ?? '';
  const spaceIdx = displayName.indexOf(' ');
  const firstName = spaceIdx > 0 ? displayName.slice(0, spaceIdx) : displayName;
  const lastName = spaceIdx > 0 ? displayName.slice(spaceIdx + 1) : '';

  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email ?? '',
    firstName,
    lastName,
    nationality: '',
    countryCode: '',
    location: '',
    photoURL: user.photoURL ?? '',
    languages: [],
    createdAt: Date.now(),
  });
}
