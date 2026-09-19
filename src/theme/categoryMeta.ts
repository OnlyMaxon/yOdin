import { PostCategory } from '../types';

// Per-category emoji + accent colour, matching the Figma design kit. Shared by
// the Feed filter chips and the New Post creation chips so both stay in sync.
// The colour tints the chip when its category is active/selected.
export const CATEGORY_META: Record<PostCategory, { emoji: string; color: string }> = {
  news: { emoji: '📰', color: '#4F46E5' },
  events: { emoji: '🎉', color: '#FF6B6B' },
  places: { emoji: '📍', color: '#10B981' },
  lifestyle: { emoji: '✨', color: '#F59E0B' },
};
