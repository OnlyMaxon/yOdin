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

// Drop-in replacement for react-native's Text that renders in Inter. Import this
// instead of RN Text; existing `fontWeight` styles keep working and pick the
// right cut. fontWeight is stripped from the flattened style so the platform
// doesn't also synthesize a fake-bold on top of the already-weighted family.
export default function Text({ style, ...props }: TextProps) {
  const flat = (StyleSheet.flatten(style) ?? {}) as { fontWeight?: string | number };
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  const { fontWeight: _drop, ...rest } = flat;
  return <RNText {...props} style={[rest, { fontFamily: FAMILY[weight] ?? 'Inter_400Regular' }]} />;
}
