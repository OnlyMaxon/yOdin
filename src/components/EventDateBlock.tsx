import React from 'react';
import { View, StyleSheet } from 'react-native';
import Text from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

interface Props {
  // Event start, as a millisecond timestamp.
  date: number;
  location?: string;
}

// Compact "day / month" block + a locale-formatted when/where line, shared by the
// feed card and the post detail so events read as events at a glance.
export default function EventDateBlock({ date, location }: Props) {
  const { i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const d = new Date(date);
  const day = String(d.getDate());
  const month = d.toLocaleDateString(i18n.language, { month: 'short' }).toUpperCase();
  const when = d.toLocaleString(i18n.language, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={styles.row}>
      <View style={styles.block}>
        <Text style={styles.day}>{day}</Text>
        <Text style={styles.month}>{month}</Text>
      </View>
      <View style={styles.meta}>
        <Text style={styles.when}>{when}</Text>
        {location ? (
          <View style={styles.whereRow}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.where} numberOfLines={1}>{location}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    block: {
      width: 54,
      borderRadius: 14,
      backgroundColor: c.primaryLight,
      paddingVertical: 8,
      alignItems: 'center',
    },
    day: { fontSize: 22, fontWeight: Typography.fontWeightBold, color: c.secondaryText, lineHeight: 24 },
    month: {
      fontSize: 11,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.secondaryText,
      letterSpacing: 0.5,
    },
    meta: { flex: 1 },
    when: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemiBold, color: c.textPrimary },
    whereRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    where: { flex: 1, fontSize: Typography.fontSizeSM, color: c.textSecondary },
  });
}
