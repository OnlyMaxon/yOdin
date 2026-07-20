import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AppImage from '../components/AppImage';
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

export default function NotificationsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top]);
  // Data comes from the global realtime subscription (set up in TabNavigator);
  // this screen only renders it and marks items read when viewed.
  const notifications = useNotificationStore((s) => s.notifications);
  const loaded = useNotificationStore((s) => s.loaded);
  const removeNotifications = useNotificationStore((s) => s.removeNotifications);
  const [clearingRead, setClearingRead] = useState(false);

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
    if (item.type === 'participant' && item.postId) {
      navigation.navigate('PostDetail', { postId: item.postId });
      return;
    }
    navigation.navigate('DiscussionDetail', {
      discussionId: item.discussionId,
      question: item.discussionQuestion,
    });
  }

  function renderItem({ item }: { item: AppNotification }) {
    const initials = item.fromUserName?.split(' ').map((w) => w[0]).join('').toUpperCase() ?? '?';
    const isModeration = item.type === 'removed' || item.type === 'blocked';

    if (isModeration) {
      return (
        <View style={[styles.item, !item.read && styles.itemUnread]}>
          <View style={[styles.avatar, styles.modAvatar]}>
            <Ionicons name="shield-outline" size={22} color={colors.notification} />
          </View>
          <View style={styles.content}>
            <Text style={styles.text}>
              {item.type === 'blocked'
                ? t('notifications.blocked', { count: item.blockDays ?? 0 })
                : t('notifications.contentRemoved')}
            </Text>
            {item.contentSnippet ? (
              <Text style={styles.question} numberOfLines={2}>"{item.contentSnippet}"</Text>
            ) : null}
            <Text style={styles.time}>{formatTime(item.createdAt, t)}</Text>
          </View>
          {!item.read && <View style={styles.dot} />}
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.item, !item.read && styles.itemUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.75}
      >
        <View style={styles.avatar}>
          {item.fromUserPhoto ? (
            <AppImage source={{ uri: item.fromUserPhoto }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
        <View style={styles.content}>
          <Text style={styles.text}>
            <Text style={styles.bold}>{item.fromUserName}</Text>
            {' '}{t(
              item.type === 'participant'
                ? 'notifications.joinedEvent'
                : item.type === 'accepted'
                  ? 'notifications.accepted'
                  : 'notifications.replied',
            )}
          </Text>
          <Text style={styles.question} numberOfLines={2}>
            "{item.type === 'participant' ? item.postTitle : item.discussionQuestion}"
          </Text>
          <Text style={styles.time}>{formatTime(item.createdAt, t)}</Text>
        </View>
        {!item.read && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
        {loaded && notifications.some((n) => n.read) ? (
          <TouchableOpacity
            onPress={handleClearRead}
            style={styles.clearBtn}
            disabled={clearingRead}
          >
            {clearingRead
              ? <ActivityIndicator size="small" color={colors.textSecondary} />
              : <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            }
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {!loaded ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={notifications.length === 0 ? styles.center : { paddingTop: 8, paddingBottom: 96 }}
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
      paddingTop: topInset + 12,
      paddingBottom: 16,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontSize: Typography.fontSizeXL,
      fontWeight: Typography.fontWeightBold,
      color: c.primary,
    },
    backBtn: { width: 32 },
    clearBtn: { width: 32, alignItems: 'center', justifyContent: 'center' },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginHorizontal: 14,
      marginVertical: 5,
      borderRadius: 18,
      backgroundColor: c.surface,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 2,
    },
    itemUnread: {
      borderLeftWidth: 3,
      borderLeftColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    avatarText: {
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightBold,
      color: c.primary,
    },
    avatarImage: { width: 44, height: 44, borderRadius: 22 },
    modAvatar: { backgroundColor: c.background },
    content: { flex: 1 },
    text: { fontSize: Typography.fontSizeMD, color: c.textPrimary, marginBottom: 4 },
    bold: { fontWeight: Typography.fontWeightSemiBold },
    question: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      fontStyle: 'italic',
      marginBottom: 4,
    },
    time: { fontSize: Typography.fontSizeXS, color: c.textSecondary },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.primary,
      marginTop: 6,
    },
  });
}
