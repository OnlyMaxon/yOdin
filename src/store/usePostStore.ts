import { create } from 'zustand';
import { Post, PostCategory } from '../types';

export type FeedFilter = 'all' | PostCategory;

interface PostState {
  posts: Post[];
  filter: FeedFilter;
  isLoading: boolean;
  hasMore: boolean;
  setPosts: (posts: Post[]) => void;
  appendPosts: (posts: Post[]) => void;
  prependPost: (post: Post) => void;
  setFilter: (filter: FeedFilter) => void;
  setLoading: (v: boolean) => void;
  setHasMore: (v: boolean) => void;
  removePost: (postId: string) => void;
}

export const usePostStore = create<PostState>((set) => ({
  posts: [],
  filter: 'all',
  isLoading: false,
  hasMore: true,
  setPosts: (posts) => set({ posts }),
  appendPosts: (more) => set((state) => ({ posts: [...state.posts, ...more] })),
  prependPost: (post) => set((state) => ({ posts: [post, ...state.posts] })),
  setFilter: (filter) => set({ filter }),
  setLoading: (isLoading) => set({ isLoading }),
  setHasMore: (hasMore) => set({ hasMore }),
  removePost: (postId) =>
    set((state) => ({ posts: state.posts.filter((p) => p.id !== postId) })),
}));
