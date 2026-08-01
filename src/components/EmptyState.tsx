import React from 'react';
import { View, StyleSheet } from 'react-native';
import Text from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  // Top padding — tune per context (full-screen lists vs. bottom sheets).
  topOffset?: number;
}

// Shared empty-state block: a soft tinted circle with a brand-colored icon and
// a caption. Replaces the ad-hoc emoji placeholders across the app for a
// consistent, on-palette look.
export default function EmptyState({ icon, text, topOffset = 80 }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={[styles.wrap, { paddingTop: topOffset }]}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={38} color={colors.primary} />
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', paddingHorizontal: 32 },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    text: {
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightMedium,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
    },
  });
}
