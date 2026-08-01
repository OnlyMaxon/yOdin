import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import AppImage from './AppImage';
import { useTheme } from '../hooks/useTheme';

interface Props {
  photoURL?: string;
  name?: string;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// One avatar for the whole app: shows the photo when present, otherwise the
// person's initials on a soft brand tint. Replaces the per-screen copies.
export default function Avatar({ photoURL, name, size = 44, onPress, style }: Props) {
  const { colors } = useTheme();
  const initials =
    (name ?? '')
      .trim()
      .split(/\s+/)
      .map((w) => w[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';

  const dim = { width: size, height: size, borderRadius: size / 2 } as const;

  const inner = photoURL ? (
    <AppImage source={{ uri: photoURL }} style={dim} contentFit="cover" />
  ) : (
    <View style={[dim, styles.center, { backgroundColor: colors.primaryLight }]}>
      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: Math.round(size * 0.4) }}>
        {initials}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[dim, style]}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={[dim, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
