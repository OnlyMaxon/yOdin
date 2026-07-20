import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AppImage from './AppImage';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Discussion } from '../types';

interface Props {
  discussion: Discussion;
  onPress: () => void;
  // Feed shows a small "promo" tag to signal it's a surfaced/promoted item.
  promoted?: boolean;
}

// Branded "Question of the day" card — the most-active forum question. Pinned
// at the top of the forum and surfaced as a promo card in the feed.
export default function QuestionOfDayCard({ discussion, onPress, promoted }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const initials = discussion.authorName?.split(' ').map((w) => w[0]).join('').toUpperCase() ?? '?';

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeEmoji}>🔥</Text>
          <Text style={styles.badgeText}>{t('forum.questionOfDay')}</Text>
        </View>
        {promoted ? (
          <View style={styles.promoTag}>
            <Text style={styles.promoTagText}>{t('forum.promo')}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.question} numberOfLines={3}>{discussion.question}</Text>

      <View style={styles.footer}>
        <View style={styles.avatar}>
          {discussion.authorPhoto ? (
            <AppImage source={{ uri: discussion.authorPhoto }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
        <Text style={styles.author} numberOfLines={1}>{discussion.authorName}</Text>
        <View style={styles.stat}>
          <Ionicons name="chatbubble" size={13} color="rgba(255,255,255,0.9)" />
          <Text style={styles.statText}>{discussion.replyCount ?? 0}</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="flame" size={13} color="rgba(255,255,255,0.9)" />
          <Text style={styles.statText}>{discussion.engagement ?? 0}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.85)" style={{ marginLeft: 'auto' }} />
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.primary,
      borderRadius: 18,
      padding: 16,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    badgeEmoji: { fontSize: 14 },
    badgeText: {
      color: '#fff',
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    promoTag: {
      backgroundColor: 'rgba(255,255,255,0.22)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    promoTagText: { color: '#fff', fontSize: Typography.fontSizeXS, fontWeight: Typography.fontWeightSemiBold },
    question: {
      color: '#fff',
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      lineHeight: 24,
      marginBottom: 14,
    },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    avatar: {
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
    },
    avatarImg: { width: 26, height: 26, borderRadius: 13 },
    avatarText: { color: '#fff', fontSize: Typography.fontSizeXS, fontWeight: Typography.fontWeightBold },
    author: { color: 'rgba(255,255,255,0.95)', fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightMedium, maxWidth: 130 },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    statText: { color: 'rgba(255,255,255,0.95)', fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightSemiBold },
  });
}
