import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Text from './AppText';
import { useTheme } from '../hooks/useTheme';
import { Typography } from '../theme/typography';
import { Spacing, Radius } from '../theme/spacing';

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
  // Optional leading emoji (Figma category chips).
  emoji?: string;
  // Active-state fill; defaults to the brand primary when omitted.
  color?: string;
}

// Filter / selector pill. Active = filled accent; inactive = quiet muted fill
// (Figma --muted), no border, matching the design kit.
export default function Chip({ label, active, onPress, emoji, color }: Props) {
  const { colors } = useTheme();
  const activeColor = color ?? colors.primary;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? activeColor : colors.muted,
          borderColor: active ? activeColor : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          styles.txt,
          {
            color: active ? '#fff' : colors.textSecondary,
            fontWeight: active ? Typography.fontWeightSemiBold : Typography.fontWeightMedium,
          },
        ]}
      >
        {emoji ? `${emoji} ` : ''}{label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.lg - 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  txt: { fontSize: Typography.fontSizeSM },
});
