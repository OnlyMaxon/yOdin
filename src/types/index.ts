export interface User {
  uid: string;
  email?: string;
  firstName: string;
  lastName: string;
  nationality: string;
  countryCode: string;
  location: string;
  photoURL?: string;
  languages?: string[];
  points?: number;
  createdAt: number;
  following?: string[];
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
  imageURLs?: string[];
  location: string;
  createdAt: number;
  likes?: string[];
  dislikes?: string[];
  commentCount?: number;
  savedBy?: string[];
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  authorNationality: string;
  authorCountryCode: string;
  text: string;
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
  imageURLs?: string[];
  location?: string;
  createdAt: number;
  replyCount: number;
  savedBy?: string[];
  acceptedReplyId?: string;
  acceptedReplyText?: string;
  acceptedReplyAuthorName?: string;
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
  // Reddit-style threading: null/absent = top-level reply to the question,
  // otherwise the id of the reply this one answers.
  parentReplyId?: string | null;
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

export type ReportStatus = 'pending' | 'removed' | 'kept';

export interface Report {
  id: string;
  targetType: 'post' | 'discussion';
  targetId: string;
  targetTitle: string;
  targetAuthorId: string;
  reportedBy: string;
  reason: string;
  status: ReportStatus;
  createdAt: number;
}
