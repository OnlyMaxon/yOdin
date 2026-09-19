import { PostCategory } from '../types';

export type ColorPalette = typeof LightColors;

// Palette locked to the Figma design kit (yOdin Social App UI Kit) 1:1.
// Light = index.css :root, Dark = index.css .dark. Brand accents mirror the kit's
// DesignSystem tokens: violet (primary), coral (accent), emerald (success),
// amber (lifestyle / warning).
export const LightColors = {
  primary: '#6C35DE',
  // Figma --secondary: the soft violet tint used for active / highlighted rows.
  primaryLight: '#EDE8F9',
  // Figma --secondary-foreground: text/icon colour sitting ON a secondary
  // (primaryLight) surface. Equals primary in light; a lighter lavender in dark.
  secondaryText: '#6C35DE',
  // Figma --muted: the quiet grey-violet fill behind inactive chips / pills.
  muted: '#E8E3F5',
  accent: '#FF6B6B',
  amber: '#F59E0B',
  pink: '#EC4899',
  background: '#F3F0FB',
  surface: '#FFFFFF',
  // Figma --foreground / --muted-foreground / --border.
  textPrimary: '#18132A',
  textSecondary: '#7B6FA0',
  border: '#E2DCF3',
  success: '#10B981',
  successTint: '#ECFDF5',
  notification: '#EF4444',
  tabBar: '#FFFFFF',
  tabBarActive: '#6C35DE',
  // Figma nav bar: inactive tabs use --muted-foreground, not a neutral grey.
  tabBarInactive: '#7B6FA0',
};

export const DarkColors: ColorPalette = {
  primary: '#8B5CF6',
  primaryLight: '#2A2040',
  secondaryText: '#C4B5F7',
  muted: '#231A3A',
  accent: '#FF6B6B',
  amber: '#F59E0B',
  pink: '#F472B6',
  background: '#0F0A1E',
  surface: '#1C1530',
  textPrimary: '#F0ECF9',
  textSecondary: '#9B8FC4',
  border: '#2E2248',
  success: '#10B981',
  successTint: '#17251F',
  notification: '#EF4444',
  tabBar: '#1C1530',
  tabBarActive: '#8B5CF6',
  tabBarInactive: '#9B8FC4',
};

// Per-category emoji + accent colour, mirroring the Figma DesignSystem badge
// config (news = indigo, events = coral, places = emerald, lifestyle = amber).
// Shared by the Feed filter chips, the Feed/PostDetail category badges, and the
// New Post creation chips so every category surface stays in sync.
export const CATEGORY_META: Record<PostCategory, { emoji: string; color: string }> = {
  news: { emoji: '📰', color: '#4F46E5' },
  events: { emoji: '🎉', color: '#FF6B6B' },
  places: { emoji: '📍', color: '#10B981' },
  lifestyle: { emoji: '✨', color: '#F59E0B' },
};
