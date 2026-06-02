import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { useFeedStore } from '../store/useFeedStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { fetchDiscussions, saveDiscussion, unsaveDiscussion, PAGE_SIZE } from '../services/discussionService';
import { getFlagEmoji } from '../utils/flagEmoji';
import { formatTime } from '../utils/formatTime';
import { Discussion } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

export default function FeedScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top);
  const { profile } = useAuthStore();
  const { discussions, setDiscussions, appendDiscussions, setLoading, isLoading, setHasMore, hasMore, toggleSaved } = useFeedStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const [refreshing, setRefreshing] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFeed();
  }, [profile?.location]);

  async function loadFeed() {
    if (!profile?.location) return;
    setError('');
    setLoading(true);
    try {
      const { discussions: data, lastDoc: last } = await fetchDiscussions(profile.location);
      setDiscussions(data);
      setLastDoc(last);
      setHasMore(data.length === PAGE_SIZE);
    } catch (e: any) {
      setError(e.message ?? t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore || isLoading || !lastDoc || !profile?.location) return;
    setLoading(true);
    try {
      const { discussions: data, lastDoc: last } = await fetchDiscussions(profile.location, lastDoc);
      appendDiscussions(data);
      setLastDoc(last);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // silent — pagination failure shouldn't disrupt existing content
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }

  async function handleSave(item: Discussion) {
    if (!profile?.uid) return;
    const isSaved = item.savedBy?.includes(profile.uid) ?? false;
    toggleSaved(item.id, profile.uid);
    try {
      if (isSaved) await unsaveDiscussion(profile.uid, item.id);
      else await saveDiscussion(profile.uid, item.id);
    } catch {
      toggleSaved(item.id, profile.uid);
    }
  }

  function renderCard({ item }: { item: Discussion }) {
    const isSaved = item.savedBy?.includes(profile?.uid ?? '') ?? false;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('DiscussionDetail', { discussionId: item.id, question: item.question })}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            {item.authorPhoto ? (
              <Image source={{ uri: item.authorPhoto }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {item.authorName?.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{item.authorName}</Text>
            <Text style={styles.authorMeta}>
              {getFlagEmoji(item.authorCountryCode)}  {item.authorNationality}
            </Text>
          </View>
        </View>
        <Text style={styles.question}>{item.question}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.replies}>
            {t('feed.replies', { count: item.replyCount })}
          </Text>
          <View style={styles.cardFooterRight}>
            <Text style={styles.time}>{formatTime(item.createdAt, t)}</Text>
            <TouchableOpacity onPress={() => handleSave(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={isSaved ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('feed.title')}</Text>
          {profile && (
            <Text style={styles.headerSub}>
              {getFlagEmoji(profile.countryCode)}  {profile.location}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('Notifications')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
            size={24}
            color={colors.textPrimary}
          />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.notification, textAlign: 'center', padding: 24 }}>{error}</Text>
        </View>
      ) : isLoading && discussions.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={discussions}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={discussions.length === 0 ? styles.center : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyText}>{t('feed.empty')}</Text>
            </View>
          }
          ListFooterComponent={
            isLoading && discussions.length > 0
              ? <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
              : null
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
    bellBtn: { position: 'relative', padding: 4 },
    bellBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: c.notification,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700', lineHeight: 11 },
    headerTitle: {
      fontSize: Typography.fontSizeXL,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
    },
    headerSub: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      marginTop: 2,
    },
    list: { padding: 16, gap: 12 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: {
      fontSize: Typography.fontSizeMD,
      color: c.textSecondary,
      textAlign: 'center',
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
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
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.primary,
    },
    avatarImage: { width: 44, height: 44, borderRadius: 22 },
    authorInfo: { flex: 1 },
    authorName: {
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.textPrimary,
    },
    authorMeta: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      marginTop: 2,
    },
    question: {
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      lineHeight: 22,
      marginBottom: 12,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardFooterRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    replies: {
      fontSize: Typography.fontSizeSM,
      color: c.primary,
      fontWeight: Typography.fontWeightMedium,
    },
    time: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
    },
  });
}
