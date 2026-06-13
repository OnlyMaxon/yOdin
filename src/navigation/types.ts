export type AuthStackParamList = {
  Welcome: undefined;
  Register: { mode: 'login' | 'register' };
  Onboarding: undefined;
};

export type FeedStackParamList = {
  FeedHome: undefined;
  UserProfile: { userId: string };
  DiscussionDetail: { discussionId: string; question: string };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  DiscussionDetail: { discussionId: string; question: string };
};

export type ForumStackParamList = {
  ForumHome: undefined;
  DiscussionDetail: { discussionId: string; question: string };
};

export type NotificationsStackParamList = {
  NotificationsHome: undefined;
  DiscussionDetail: { discussionId: string; question: string };
};

export type TabParamList = {
  Forum: undefined;
  Feed: undefined;
  Notifications: undefined;
  Profile: undefined;
};
