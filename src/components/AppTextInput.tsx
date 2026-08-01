import React from 'react';
import { TextInput as RNTextInput, StyleSheet, TextInputProps } from 'react-native';

// Same Inter weight→family map as AppText, for input fields so typed text and
// placeholders match the rest of the app instead of falling back to the system
// font. Import this instead of RN TextInput. forwardRef so callers can still
// focus the field (e.g. reply/comment composers).
const FAMILY: Record<string, string> = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  normal: 'Inter_400Regular',
  bold: 'Inter_700Bold',
};

const AppTextInput = React.forwardRef<RNTextInput, TextInputProps>(({ style, ...props }, ref) => {
  const flat = (StyleSheet.flatten(style) ?? {}) as { fontWeight?: string | number };
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  const { fontWeight: _drop, ...rest } = flat;
  return <RNTextInput ref={ref} {...props} style={[rest, { fontFamily: FAMILY[weight] ?? 'Inter_400Regular' }]} />;
});
AppTextInput.displayName = 'AppTextInput';

export default AppTextInput;
