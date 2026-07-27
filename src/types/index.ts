export interface User {
  uid: string;
  email?: string;
  firstName: string;
  lastName: string;
  // Unique @handle for mentions. Lowercase [a-z0-9_], 3–20 chars. The
  // authoritative uniqueness/lookup lives in the `usernames/{username}` registry;
  // this field is the denormalized display copy. Optional: legacy users may not
  // have one until migrated.
  username?: string;
  nationality: string;
  countryCode: string;
  location: string;
  photoURL?: string;
  languages?: string[];
  points?: number;
  createdAt: number;
  following?: string[];
  // Moderation (maintained server-side, read-only on the client):
  // epoch-ms until which the user may not comment/reply; how many removals have
  // accrued since the last ban; how many bans they've served (drives escalation).
  commentBlockedUntil?: number;
  moderationStrikes?: number;
  banCount?: number;
}

export type PostCategory = 'news' | 'events' | 'places' | 'lifestyle';

export const POST_CATEGORIES: PostCategory[] = ['news', 'events', 'places', 'lifestyle'];

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
  imageURLs?: string[];
  // A post carries either photos or a single short video (mutually exclusive).
  // videoPoster is a small JPEG still shown in the feed so the video itself is
  // only fetched when the user taps to play.
  videoURL?: string;
  videoPoster?: string;
  location: string;
  createdAt: number;
  likes?: string[];
  dislikes?: string[];
  commentCount?: number;
  savedBy?: string[];
  // Event RSVP. Only set on `events` posts whose author turned on a sign-up
  // sheet. `participantLimit` null/absent = unlimited; `participants` holds the
  // UIDs of everyone who tapped "I'm going".
  signupEnabled?: boolean;
  participantLimit?: number | null;
  participants?: string[];
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
  // Optional single short video (mutually exclusive with photos). See Post.
  videoURL?: string;
  videoPoster?: string;
  location?: string;
  createdAt: number;
  replyCount: number;
  // Total activity under the question (replies + their likes/dislikes), kept by
  // Cloud Functions. Used to pick the "question of the day".
  engagement?: number;
  savedBy?: string[];
  acceptedReplyId?: string;
  acceptedReplyText?: string;
  acceptedReplyAuthorName?: string;
  isAnswered?: boolean;
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
  type: 'reply' | 'accepted' | 'participant' | 'removed' | 'blocked' | 'mention';
  toUserId: string;
  fromUserId: string;
  fromUserName: string;
  fromUserPhoto?: string;
  // Forum notifications (reply/accepted) carry the discussion they belong to.
  discussionId?: string;
  discussionQuestion?: string;
  // Event sign-up notifications (participant) carry the post instead.
  postId?: string;
  postTitle?: string;
  // Moderation notifications (removed/blocked), created server-side.
  // contentSnippet: a short excerpt of the removed item; blockDays: ban length.
  contentSnippet?: string;
  blockDays?: number;
  createdAt: number;
  read: boolean;
}

export type ReportStatus = 'pending' | 'removed' | 'kept';

export type ReportTargetType = 'post' | 'discussion' | 'comment' | 'reply';

// Instagram-style report reasons. Keys map to `report.reasons.<key>` strings.
export const REPORT_REASONS = [
  'spam',
  'hate',
  'violence',
  'harassment',
  'nudity',
  'falseInfo',
  'scam',
  'selfHarm',
  'ip',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export interface Report {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  // Full Firestore document path of the target, so a moderator can remove a
  // nested comment/reply without reconstructing its parent ids.
  targetPath?: string;
  targetTitle: string;
  targetAuthorId: string;
  reportedBy: string;
  reason: string;
  status: ReportStatus;
  createdAt: number;
}
