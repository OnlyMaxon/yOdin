import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Text from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Avatar from '../components/Avatar';
import Chip from '../components/Chip';
import { Spacing } from '../theme/spacing';
import { useTranslation } from 'react-i18next';
import { useNotificationStore } from '../store/useNotificationStore';
import { markNotificationsRead, deleteReadNotifications } from '../services/notificationService';
import { AppNotification } from '../types';
import { formatTime } from '../utils/formatTime';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import EmptyState from '../components/EmptyState';
import { isDeletedAuthor } from '../utils/author';
import { useWithoutBlocked } from '../hooks/useWithoutBlocked';

type Filter = 'all' | 'unread' | 'reply' | 'mention' | 'participant';
const FILTERS: { id: Filter; key: string }[] = [
  { id: 'all', key: 'filterAll' },
  { id: 'unread', key: 'filterUnread' },
  { id: 'reply', key: 'filterReplies' },
  { id: 'mention', key: 'filterMentions' },
  { id: 'participant', key: 'filterEvents' },
];

export default function NotificationsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top]);
  // Data comes from the global realtime subscription (set up in TabNavigator);
  // this screen only renders it and marks items read when viewed.
  const notifications = useNotificationStore((s) => s.notifications);
  // Someone you blocked should not reach you through a notification either.
  const loaded = useNotificationStore((s) => s.loaded);
  const removeNotifications = useNotificationStore((s) => s.removeNotifications);
  const [clearingRead, setClearingRead] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      const { notifications: current, markAllRead } = useNotificationStore.getState();
      const unreadIds = current.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length === 0) return;
      markAllRead(); // optimistic; the live listener will confirm
      markNotificationsRead(unreadIds).catch(() => {});
    }, []),
  );

  async function handleClearRead() {
    const readIds = notifications.filter((n) => n.read).map((n) => n.id);
    if (readIds.length === 0) return;
    setClearingRead(true);
    removeNotifications(readIds);
    try {
      await deleteReadNotifications(readIds);
    } catch {
      // realtime listener will reconcile
    } finally {
      setClearingRead(false);
    }
  }

  function handleNotificationPress(item: AppNotification) {
    // Moderation notices (removed/blocked) aren't tappable — the content is gone.
    if (item.type === 'removed' || item.type === 'blocked') return;
    // Route by what the notice points at (a post or a discussion) — covers
    // participant, mention (either), and reply/accepted (discussion).
    if (item.postId) {
      navigation.navigate('PostDetail', { postId: item.postId });
      return;
    }
    if (item.discussionId) {
      navigation.navigate('DiscussionDetail', {
        discussionId: item.discussionId,
        question: item.discussionQuestion,
      });
    }
  }

  // Small per-type glyph that sits on the corner of the sender's avatar so the
  // notification kind reads at a glance (reply / accepted / event / mention).
  const typeBadge = (
    type: AppNotification['type'],
  ): { icon: keyof typeof Ionicons.glyphMap; color: string } | null => {
    switch (type) {
      case 'reply': return { icon: 'chatbubble', color: colors.primary };
      case 'accepted': return { icon: 'checkmark', color: colors.success };
      case 'participant': return { icon: 'calendar', color: colors.accent };
      case 'mention': return { icon: 'at', color: colors.pink };
      default: return null;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filtered = notifications.filter((n) =>
    filter === 'all' ? true : filter === 'unread' ? !n.read : n.type === filter,
  );
  // Someone you blocked should not reach you through a notification either.
  const visible = useWithoutBlocked(filtered, (n) => n.fromUserId);

  function renderItem({ item }: { item: AppNotification }) {
    const isModeration = item.type === 'removed' || item.type === 'blocked';

    if (isModeration) {
      return (
        <View style={[styles.row, !item.read && styles.rowUnread]}>
          <View style={[styles.avatarWrap, styles.modAvatar]}>
            <Ionicons name="shield-outline" size={22} color={colors.notification} />
          </View>
          <View style={styles.content}>
            <Text style={styles.text}>
              {item.type === 'blocked'
                ? t('notifications.blocked', { count: item.blockDays ?? 0 })
                : t('notifications.contentRemoved')}
            </Text>
            {item.contentSnippet ? (
              <Text style={styles.detail} numberOfLines={1}>"{item.contentSnippet}"</Text>
            ) : null}
            <Text style={styles.time}>{formatTime(item.createdAt, t)}</Text>
          </View>
          {!item.read && <View style={styles.dot} />}
        </View>
      );
    }

    const badge = typeBadge(item.type);
    return (
      <TouchableOpacity
        style={[styles.row, !item.read && styles.rowUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          <Avatar photoURL={item.fromUserPhoto} name={item.fromUserName} size={46} />
          {badge && (
            <View style={[styles.typeBadge, { backgroundColor: badge.color }]}>
              <Ionicons name={badge.icon} size={11} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.content}>
          <Text style={styles.text}>
            <Text style={styles.bold}>
              {isDeletedAuthor(item.fromUserId) ? t('common.deletedAccount') : item.fromUserName}
            </Text>
            {' '}{t(
              item.type === 'participant'
                ? 'notifications.joinedEvent'
                : item.type === 'mention'
                  ? 'notifications.mentioned'
                  : item.type === 'accepted'
                    ? 'notifications.accepted'
                    : 'notifications.replied',
            )}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            "{item.postId ? item.postTitle : item.discussionQuestion}"
          </Text>
          <Text style={[styles.time, !item.read && styles.timeUnread]}>{formatTime(item.createdAt, t)}</Text>
        </View>
        {!item.read && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
          {unreadCount > 0 ? (
            <Text style={styles.headerSub}>{t('notifications.unreadCount', { count: unreadCount })}</Text>
          ) : null}
        </View>
        {loaded && notifications.some((n) => n.read) ? (
          <TouchableOpacity onPress={handleClearRead} style={styles.clearBtn} disabled={clearingRead}>
            {clearingRead
              ? <ActivityIndicator size="small" color={colors.textSecondary} />
              : <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            }
          </TouchableOpacity>
        ) : null}
      </View>

      {loaded && notifications.length > 0 ? (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            {FILTERS.map((f) => (
              <Chip
                key={f.id}
                label={t(`notifications.${f.key}`)}
                active={filter === f.id}
                onPress={() => setFilter(f.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          contentContainerStyle={visible.length === 0 ? styles.center : { paddingBottom: 96 }}
          ListEmptyComponent={
            <EmptyState icon="notifications-outline" text={t('notifications.empty')} />
          }
        />
      )}
    </View>
  );
}


function makeStyles(c: ColorPalette, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 20,
      paddingTop: topInset + 10,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontSize: Typography.fontSizeXXL,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
      letterSpacing: -0.4,
    },
    headerSub: { fontSize: Typography.fontSizeSM, color: c.textSecondary, marginTop: 2 },
    clearBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    filterBar: { paddingBottom: 8 },
    filterContent: { gap: 8, paddingHorizontal: 20 },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 78 },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingVertical: 14,
      gap: 12,
      backgroundColor: c.background,
    },
    rowUnread: { backgroundColor: c.primaryLight },
    avatarWrap: { width: 46, height: 46 },
    modAvatar: {
      borderRadius: 23,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeBadge: {
      position: 'absolute',
      right: -3,
      bottom: -3,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.background,
    },
    content: { flex: 1 },
    text: { fontSize: Typography.fontSizeMD, color: c.textPrimary, lineHeight: 20 },
    bold: { fontWeight: Typography.fontWeightSemiBold },
    detail: { fontSize: Typography.fontSizeSM, color: c.textSecondary, marginTop: 2 },
    time: { fontSize: Typography.fontSizeXS, color: c.textSecondary, marginTop: 4 },
    timeUnread: { color: c.primary, fontWeight: Typography.fontWeightMedium },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.primary,
      marginTop: 6,
    },
  });
}
