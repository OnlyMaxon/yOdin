import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { collection, query, where, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Notification } from '../types';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const { notifications, setNotifications } = useNotificationStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.uid) loadNotifications();
  }, [profile?.uid]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'notifications'),
          where('toUserId', '==', profile!.uid),
          orderBy('createdAt', 'desc'),
        ),
      );
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
      setNotifications(data);
      data.filter((n) => !n.read).forEach((n) => {
        updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {});
      });
    } catch {
    } finally {
      setLoading(false);
    }
  }

  function renderItem({ item }: { item: Notification }) {
    const initials = item.fromUserName?.split(' ').map((w) => w[0]).join('').toUpperCase() ?? '?';
    return (
      <View style={[styles.item, !item.read && styles.itemUnread]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.content}>
          <Text style={styles.text}>
            <Text style={styles.bold}>{item.fromUserName}</Text>
            {' '}{t('notifications.replied')}
          </Text>
          <Text style={styles.question} numberOfLines={2}>
            "{item.discussionQuestion}"
          </Text>
          <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={styles.dot} />}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('notifications.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
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

function formatTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.fontSizeXL,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  itemUnread: { backgroundColor: Colors.primaryLight },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightBold,
    color: Colors.primary,
  },
  content: { flex: 1 },
  text: { fontSize: Typography.fontSizeMD, color: Colors.textPrimary, marginBottom: 4 },
  bold: { fontWeight: Typography.fontWeightSemiBold },
  question: {
    fontSize: Typography.fontSizeSM,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  time: { fontSize: Typography.fontSizeXS, color: Colors.textSecondary },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
});
