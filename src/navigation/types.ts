export type AuthStackParamList = {
  Welcome: undefined;
  Register: { mode: 'login' | 'register' };
  Onboarding: undefined;
};

export type FeedStackParamList = {
  FeedHome: undefined;
  Forum: undefined;
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
  Feed: undefined;
  Forum: undefined;
  Notifications: undefined;
  Profile: undefined;
};
