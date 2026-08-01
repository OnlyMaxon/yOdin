import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Typography } from '../theme/typography';
import { Spacing, Radius } from '../theme/spacing';

interface Props {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

// Filter / selector pill. Active = filled brand; inactive = quiet outlined.
export default function Chip({ label, active, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.background,
          borderColor: active ? colors.primary : colors.border,
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
        {label}
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
