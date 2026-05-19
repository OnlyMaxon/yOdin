export interface User {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  nationality: string;
  countryCode: string;
  location: string;
  photoURL?: string;
  languages?: string[];
  createdAt: number;
}

export interface Discussion {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  authorNationality: string;
  authorCountryCode: string;
  question: string;
  location: string;
  createdAt: number;
  replyCount: number;
  savedBy?: string[];
}

export interface Reply {
  id: string;
  discussionId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  authorNationality: string;
  authorCountryCode: string;
  text: string;
  createdAt: number;
}

export interface AppNotification {
  id: string;
  type: 'reply';
  toUserId: string;
  fromUserId: string;
  fromUserName: string;
  fromUserPhoto?: string;
  discussionId: string;
  discussionQuestion: string;
  createdAt: number;
  read: boolean;
}
