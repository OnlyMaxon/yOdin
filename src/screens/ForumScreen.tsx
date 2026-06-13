import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DocumentSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../store/useAuthStore';
import { useFeedStore } from '../store/useFeedStore';
import { fetchDiscussions, saveDiscussion, unsaveDiscussion, PAGE_SIZE } from '../services/discussionService';
import { searchDiscussions, AlgoliaHit } from '../services/algoliaService';
import { getFlagEmoji } from '../utils/flagEmoji';
import { formatTime } from '../utils/formatTime';
import { Discussion } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

export default function ForumScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top);
  const { profile } = useAuthStore();
  const { discussions, setDiscussions, appendDiscussions, setLoading, isLoading, setHasMore, hasMore, toggleSaved } = useFeedStore();
  const [refreshing, setRefreshing] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [algoliaHits, setAlgoliaHits] = useState<AlgoliaHit[]>([]);
  const [searching, setSearching] = useState(false);
  // Tracks saved state for Algolia results not yet loaded into the store.
  // Key = discussionId, value = whether the current user has saved it.
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>({});

  const isSearching = search.trim().length > 0;

  const runSearch = useCallback(async (q: string) => {
    if (!profile?.location) { setSearching(false); return; }
    setSearching(true);
    try {
      const hits = await searchDiscussions(q, profile.location);
      setAlgoliaHits(hits);
    } catch {
      setAlgoliaHits([]);
    } finally {
      setSearching(false);
    }
  }, [profile?.location]);

  // Debounced Algolia search — fires 300ms after the user stops typing
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearching(false);
      setAlgoliaHits([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => runSearch(q), 300);
    return () => clearTimeout(timer);
  }, [search, runSearch]);

  // Map Algolia hits → Discussion objects, merging with store data where available
  // (store version has live savedBy/replyCount; Algolia version used as fallback)
  const searchResults = useMemo(
    () =>
      algoliaHits.map((hit) => {
        const stored = discussions.find((d) => d.id === hit.objectID);
        return (
          stored ?? {
            id: hit.objectID,
            question: hit.question,
            authorId: hit.authorId,
            authorName: hit.authorName,
            authorPhoto: hit.authorPhoto,
            authorNationality: hit.authorNationality,
            authorCountryCode: hit.authorCountryCode,
            location: hit.location,
            replyCount: hit.replyCount,
            createdAt: hit.createdAt,
            acceptedReplyId: hit.acceptedReplyId,
            acceptedReplyText: hit.acceptedReplyText,
            acceptedReplyAuthorName: hit.acceptedReplyAuthorName,
            savedBy: [],
          }
        );
      }),
    [algoliaHits, discussions],
  );

  useEffect(() => {
    loadFeed();
  }, [profile?.uid]);

  async function loadFeed() {
    if (!profile?.uid) return;
    setError('');
    setLoading(true);
    try {
      const { discussions: data, lastDoc: last } = await fetchDiscussions();
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
    if (!hasMore || isLoading || !lastDoc || !profile?.uid) return;
    setLoading(true);
    try {
      const { discussions: data, lastDoc: last } = await fetchDiscussions(undefined, lastDoc);
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
    setAlgoliaHits([]);
    await loadFeed();
    setRefreshing(false);
    // Re-run search after feed refresh because the useEffect won't fire again
    // (search/location haven't changed).
    const q = search.trim();
    if (q) runSearch(q);
  }

  async function handleSave(item: Discussion) {
    if (!profile?.uid) return;
    const inStore = discussions.some((d) => d.id === item.id);
    if (inStore) {
      const isSaved = item.savedBy?.includes(profile.uid) ?? false;
      toggleSaved(item.id, profile.uid);
      try {
        if (isSaved) await unsaveDiscussion(profile.uid, item.id);
        else await saveDiscussion(profile.uid, item.id);
      } catch {
        toggleSaved(item.id, profile.uid);
      }
    } else {
      // Algolia-only result: manage saved state locally since it's not in the store.
      const isSaved = savedOverrides[item.id] ?? false;
      setSavedOverrides((prev) => ({ ...prev, [item.id]: !isSaved }));
      try {
        if (isSaved) await unsaveDiscussion(profile.uid, item.id);
        else await saveDiscussion(profile.uid, item.id);
      } catch {
        setSavedOverrides((prev) => ({ ...prev, [item.id]: isSaved }));
      }
    }
  }

  function renderCard({ item }: { item: Discussion }) {
    const inStore = discussions.some((d) => d.id === item.id);
    const isSaved = inStore
      ? (item.savedBy?.includes(profile?.uid ?? '') ?? false)
      : (savedOverrides[item.id] ?? false);
    const isAnswered = !!item.acceptedReplyId;
    return (
      <TouchableOpacity
        style={[styles.card, isAnswered && styles.cardAnswered]}
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
          {isAnswered && (
            <View style={styles.answeredBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.answeredBadgeText}>{t('forum.answered')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.question}>{item.question}</Text>
        {isAnswered && item.acceptedReplyText ? (
          <View style={styles.answerBox}>
            <View style={styles.answerHeader}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.answerLabel}>{t('discussion.acceptedAnswer')}</Text>
            </View>
            <Text style={styles.answerText} numberOfLines={3}>{item.acceptedReplyText}</Text>
            {item.acceptedReplyAuthorName ? (
              <Text style={styles.answerAuthor}>— {item.acceptedReplyAuthorName}</Text>
            ) : null}
          </View>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={[styles.replies, isAnswered && { color: colors.success }]}>
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
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('forum.title')}</Text>
          {profile && (
            <Text style={styles.headerSub}>
              {getFlagEmoji(profile.countryCode)}  {profile.location}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('forum.search')}
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {isSearching && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.notification, textAlign: 'center', padding: 24 }}>{error}</Text>
        </View>
      ) : (!isSearching && isLoading && discussions.length === 0) || (isSearching && searching) ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={isSearching ? searchResults : discussions}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={(isSearching ? searchResults : discussions).length === 0 ? styles.center : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={isSearching ? undefined : loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{isSearching ? '🔍' : '💬'}</Text>
              <Text style={styles.emptyText}>{isSearching ? t('forum.nothingFound') : t('forum.empty')}</Text>
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
      paddingHorizontal: 16,
      paddingTop: topInset + 12,
      paddingBottom: 16,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backBtn: { padding: 4 },
    backText: { fontSize: 24, color: c.textPrimary },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      paddingHorizontal: 14,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchInput: {
      flex: 1,
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      padding: 0,
    },
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
    list: { padding: 16, gap: 12, paddingBottom: 96 },
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
    cardAnswered: {
      borderColor: c.success,
      borderWidth: 1.5,
      backgroundColor: c.success + '14',
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
    answeredBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.success,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      marginLeft: 8,
    },
    answeredBadgeText: {
      color: '#fff',
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightSemiBold,
    },
    question: {
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      lineHeight: 22,
      marginBottom: 12,
    },
    answerBox: {
      backgroundColor: c.surface,
      borderLeftWidth: 3,
      borderLeftColor: c.success,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    answerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 5,
    },
    answerLabel: {
      fontSize: Typography.fontSizeXS,
      color: c.success,
      fontWeight: Typography.fontWeightSemiBold,
    },
    answerText: {
      fontSize: Typography.fontSizeSM,
      color: c.textPrimary,
      lineHeight: 19,
    },
    answerAuthor: {
      fontSize: Typography.fontSizeXS,
      color: c.textSecondary,
      marginTop: 5,
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
