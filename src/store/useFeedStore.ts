import { create } from 'zustand';
import { Discussion } from '../types';

interface FeedState {
  discussions: Discussion[];
  isLoading: boolean;
  hasMore: boolean;
  setDiscussions: (discussions: Discussion[]) => void;
  appendDiscussions: (discussions: Discussion[]) => void;
  prependDiscussion: (discussion: Discussion) => void;
  setLoading: (v: boolean) => void;
  setHasMore: (v: boolean) => void;
  incrementReplyCount: (discussionId: string) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  discussions: [],
  isLoading: false,
  hasMore: true,
  setDiscussions: (discussions) => set({ discussions }),
  appendDiscussions: (more) =>
    set((state) => ({ discussions: [...state.discussions, ...more] })),
  prependDiscussion: (discussion) =>
    set((state) => ({ discussions: [discussion, ...state.discussions] })),
  setLoading: (isLoading) => set({ isLoading }),
  setHasMore: (hasMore) => set({ hasMore }),
  incrementReplyCount: (discussionId) =>
    set((state) => ({
      discussions: state.discussions.map((d) =>
        d.id === discussionId ? { ...d, replyCount: d.replyCount + 1 } : d,
      ),
    })),
}));
