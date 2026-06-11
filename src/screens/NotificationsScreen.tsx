import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { fetchNotifications, markNotificationsRead } from '../services/notificationService';
import { AppNotification } from '../types';
import { formatTime } from '../utils/formatTime';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

export default function NotificationsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top);
  const { profile } = useAuthStore();
  const { notifications, setNotifications, markAllRead } = useNotificationStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.uid) loadNotifications();
  }, [profile?.uid]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await fetchNotifications(profile!.uid);
      setNotifications(data);
      const unreadIds = data.filter((n) => !n.read).map((n) => n.id);
      if (unreadIds.length > 0) {
        await markNotificationsRead(unreadIds);
        markAllRead();
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  function handleNotificationPress(item: AppNotification) {
    navigation.navigate('DiscussionDetail', {
      discussionId: item.discussionId,
      question: item.discussionQuestion,
    });
  }

  function renderItem({ item }: { item: AppNotification }) {
    const initials = item.fromUserName?.split(' ').map((w) => w[0]).join('').toUpperCase() ?? '?';
    return (
      <TouchableOpacity
        style={[styles.item, !item.read && styles.itemUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.75}
      >
        <View style={styles.avatar}>
          {item.fromUserPhoto ? (
            <Image source={{ uri: item.fromUserPhoto }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
        <View style={styles.content}>
          <Text style={styles.text}>
            <Text style={styles.bold}>{item.fromUserName}</Text>
            {' '}{t(item.type === 'accepted' ? 'notifications.accepted' : 'notifications.replied')}
          </Text>
          <Text style={styles.question} numberOfLines={2}>
            "{item.discussionQuestion}"
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={notifications.length === 0 ? styles.center : undefined}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
            </View>
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
      color: c.textPrimary,
    },
    backBtn: { width: 32 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: Typography.fontSizeMD, color: c.textSecondary },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    itemUnread: { backgroundColor: c.primaryLight },
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
