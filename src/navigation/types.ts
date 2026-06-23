// Only AuthStackParamList lives here — it's consumed by AuthNavigator. Each tab
// stack (Feed/Forum/Profile/Notifications) declares and exports its own param
// list in its file, so keeping copies here would only invite drift.
export type AuthStackParamList = {
  Welcome: undefined;
  Register: { mode: 'login' | 'register' };
  ForgotPassword: undefined;
  Onboarding: undefined;
};
