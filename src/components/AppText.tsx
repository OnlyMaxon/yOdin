import React from 'react';
import { Text as RNText, StyleSheet, TextProps } from 'react-native';

// Custom fonts don't derive their own weights, so each Inter weight is a
// separate family. Map the style's fontWeight to the matching Inter cut.
const FAMILY: Record<string, string> = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  normal: 'Inter_400Regular',
  bold: 'Inter_700Bold',
};

// Body text defaults to Medium, not Regular. Nothing in the app sets a weight
// for ordinary copy -- post bodies, comments, captions all fall through to this
// default -- and Inter Regular is light enough at 13-15px that the UI read as
// thin next to apps like Instagram, whose body face is considerably denser.
// 500 is the closest Inter gets to that without touching the 600/700 tiers
// above it, which still carry the hierarchy.
const DEFAULT_WEIGHT = '500';

// Drop-in replacement for react-native's Text that renders in Inter. Import this
// instead of RN Text; existing `fontWeight` styles keep working and pick the
// right cut. fontWeight is stripped from the flattened style so the platform
// doesn't also synthesize a fake-bold on top of the already-weighted family.
export default function Text({ style, ...props }: TextProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as { fontWeight?: string | number };
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : DEFAULT_WEIGHT;
  const { fontWeight: _drop, ...rest } = flat;
  return <RNText {...props} style={[rest, { fontFamily: FAMILY[weight] ?? FAMILY[DEFAULT_WEIGHT] }]} />;
}
