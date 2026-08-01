// Design tokens shared across the app so screens stop using ad-hoc magic numbers.
// Spacing is a 4-based scale; use these for padding / margin / gap.
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Corner radii. `pill` is an arbitrarily large value for fully-rounded shapes.
export const Radius = {
  sm: 10,
  md: 14,
  lg: 22,
  pill: 999,
} as const;
