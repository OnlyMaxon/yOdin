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
  points?: number;
  createdAt: number;
}

export type PostCategory = 'news' | 'events' | 'places';

export const POST_CATEGORIES: PostCategory[] = ['news', 'events', 'places'];

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  authorNationality: string;
  authorCountryCode: string;
  title: string;
  description: string;
  category: PostCategory;
  imageURL?: string;
  location: string;
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
  acceptedReplyId?: string;
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
  likes?: string[];
  dislikes?: string[];
}

export interface AppNotification {
  id: string;
  type: 'reply' | 'accepted';
  toUserId: string;
  fromUserId: string;
  fromUserName: string;
  fromUserPhoto?: string;
  discussionId: string;
  discussionQuestion: string;
  createdAt: number;
  read: boolean;
}
