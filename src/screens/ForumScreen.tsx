import React, { useEffect, useState, useMemo } from 'react';
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
import { useAuthStore } from '../store/useAuthStore';
import { useFeedStore } from '../store/useFeedStore';
import { fetchDiscussions, fetchAllDiscussions, saveDiscussion, unsaveDiscussion, PAGE_SIZE } from '../services/discussionService';
import { getFlagEmoji } from '../utils/flagEmoji';
import { formatTime } from '../utils/formatTime';
import { Discussion } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import NewDiscussionModal from './NewDiscussionModal';

export default function ForumScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top);
  const { profile } = useAuthStore();
  const { discussions, setDiscussions, appendDiscussions, setLoading, isLoading, setHasMore, hasMore, toggleSaved } = useFeedStore();
  const [refreshing, setRefreshing] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [askVisible, setAskVisible] = useState(false);
  // Full question base for the location, lazily loaded the first time the user
  // searches so the search covers the whole DB, not just the paginated feed.
  const [allQuestions, setAllQuestions] = useState<Discussion[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  const isSearching = search.trim().length > 0;

  // Lazily pull the whole nationality forum once a search begins.
  useEffect(() => {
    if (!isSearching || allQuestions !== null || loadingAll || !profile?.countryCode) return;
    setLoadingAll(true);
    fetchAllDiscussions(profile.countryCode)
      .then(setAllQuestions)
      .catch(() => setAllQuestions([]))
      .finally(() => setLoadingAll(false));
  }, [isSearching, allQuestions, loadingAll, profile?.countryCode]);

  // Search pool: the full base once loaded, plus any questions in the store that
  // aren't in it yet (e.g. one just asked via the tab "+"). Falls back to the
  // loaded feed while the full base is still fetching.
  const searchPool = useMemo(() => {
    if (!allQuestions) return discussions;
    const ids = new Set(allQuestions.map((d) => d.id));
    const extra = discussions.filter((d) => !ids.has(d.id));
    return extra.length ? [...extra, ...allQuestions] : allQuestions;
  }, [allQuestions, discussions]);

  // Keyword search: a question matches when it contains every whitespace-separated
  // token of the query (case-insensitive).
  const filteredDiscussions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return discussions;
    const tokens = q.split(/\s+/);
    return searchPool.filter((d) => {
      const text = d.question.toLowerCase();
      return tokens.every((tok) => text.includes(tok));
    });
  }, [discussions, searchPool, search]);

  useEffect(() => {
    loadFeed();
  }, [profile?.countryCode]);

  async function loadFeed() {
    if (!profile?.countryCode) return;
    setError('');
    setLoading(true);
    try {
      const { discussions: data, lastDoc: last } = await fetchDiscussions(profile.countryCode);
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
    if (!hasMore || isLoading || !lastDoc || !profile?.countryCode) return;
    setLoading(true);
    try {
      const { discussions: data, lastDoc: last } = await fetchDiscussions(profile.countryCode, lastDoc);
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
    setAllQuestions(null); // invalidate search cache so it reloads fresh
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
              {getFlagEmoji(profile.countryCode)}  {profile.nationality}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setAskVisible(true)}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
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
      ) : (isLoading && discussions.length === 0) || (isSearching && loadingAll && !allQuestions) ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredDiscussions}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={filteredDiscussions.length === 0 ? styles.center : styles.list}
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

      <NewDiscussionModal
        visible={askVisible}
        onClose={() => {
          setAskVisible(false);
          setAllQuestions(null); // a new question may have been added — refresh search cache
        }}
      />
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
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    },
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
