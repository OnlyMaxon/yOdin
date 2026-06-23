import { create } from 'zustand';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '../types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  profile: User | null;
  pendingEmailVerification: boolean;
  isModerator: boolean;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: User | null) => void;
  setPendingEmailVerification: (val: boolean) => void;
  setIsModerator: (isModerator: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  profile: null,
  pendingEmailVerification: false,
  isModerator: false,
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setProfile: (profile) => set({ profile }),
  setPendingEmailVerification: (pendingEmailVerification) => set({ pendingEmailVerification }),
  setIsModerator: (isModerator) => set({ isModerator }),
  reset: () => set({ firebaseUser: null, profile: null, pendingEmailVerification: false, isModerator: false }),
}));
