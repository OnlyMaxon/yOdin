export const Typography = {
  fontSizeXS: 11,
  fontSizeSM: 13,
  fontSizeMD: 15,
  fontSizeLG: 18,
  fontSizeXL: 22,
  fontSizeXXL: 28,

  // Body weight is 500, not 400 — see the comment in AppText for why. The token
  // keeps the name it had; what changed is the value behind it, so the two
  // stay in step. 400 is still a loaded cut and still reachable by writing
  // `fontWeight: '400'` directly, for anything that genuinely wants it light.
  fontWeightRegular: '500' as const,
  fontWeightMedium: '500' as const,
  fontWeightSemiBold: '600' as const,
  fontWeightBold: '700' as const,

  lineHeightNormal: 1.4,
};
