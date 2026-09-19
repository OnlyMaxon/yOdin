export type ColorPalette = typeof LightColors;

// Palette locked to the Figma design kit (yOdin Social App UI Kit) 1:1.
// Light = index.css :root, Dark = index.css .dark. Brand accents: violet
// (primary), coral (accent), emerald (success).
export const LightColors = {
  primary: '#6C35DE',
  // Figma --secondary: the soft violet tint used for active / highlighted rows.
  primaryLight: '#EDE8F9',
  // Figma --muted: the quiet grey-violet fill behind inactive chips / pills.
  muted: '#E8E3F5',
  accent: '#FF6B6B',
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
  tabBarInactive: '#9CA3AF',
};

export const DarkColors: ColorPalette = {
  primary: '#8B5CF6',
  primaryLight: '#2A2040',
  muted: '#231A3A',
  accent: '#FF6B6B',
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
  tabBarInactive: '#6B7280',
};
