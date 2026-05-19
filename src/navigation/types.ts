export type AuthStackParamList = {
  Welcome: undefined;
  Register: { mode: 'login' | 'register' };
  Onboarding: undefined;
};

export type TabParamList = {
  Feed: undefined;
  Notifications: undefined;
  NewDiscussion: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  DiscussionDetail: { discussionId: string };
  UserProfile: { userId: string };
};
