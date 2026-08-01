export type ColorPalette = typeof LightColors;

export const LightColors = {
  primary: '#6C35DE',
  primaryLight: '#F0E9FF',
  accent: '#FF6B6B',
  pink: '#EC4899',
  // Airier ground: a faint lavender-neutral instead of the heavy #EDE4FF, so the
  // white cards and the purple accent breathe.
  background: '#F3F0FB',
  surface: '#FFFFFF',
  textPrimary: '#191627',
  // Secondary text is a chosen lavender-biased grey (not a default cool grey).
  textSecondary: '#6C6684',
  border: '#E7E1F5',
  success: '#10B981',
  successTint: '#ECFDF5',
  notification: '#EF4444',
  tabBar: '#FFFFFF',
  tabBarActive: '#6C35DE',
  tabBarInactive: '#9CA3AF',
};

export const DarkColors: ColorPalette = {
  primary: '#8B6EF5',
  primaryLight: '#2A1F5C',
  accent: '#FF6B6B',
  pink: '#F472B6',
  background: '#100E24',
  surface: '#1C1840',
  textPrimary: '#F0EEFF',
  textSecondary: '#9B99C0',
  border: '#2E2860',
  success: '#10B981',
  successTint: '#17251F',
  notification: '#EF4444',
  tabBar: '#1C1840',
  tabBarActive: '#8B6EF5',
  tabBarInactive: '#6B7280',
};
