const firebaseErrors: Record<string, string> = {
  'auth/email-already-in-use': 'This email is already registered.',
  'auth/invalid-email': 'Invalid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'No internet connection.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/already-initialized': 'Auth already initialized.',
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as any).code as string | undefined;
    if (code && firebaseErrors[code]) return firebaseErrors[code];
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
