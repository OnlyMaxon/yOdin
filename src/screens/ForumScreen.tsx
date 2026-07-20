import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Animated,
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DocumentSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../store/useAuthStore';
import { useFeedStore } from '../store/useFeedStore';
import { fetchDiscussions, fetchTopQuestion, saveDiscussion, unsaveDiscussion, PAGE_SIZE } from '../services/discussionService';
import { searchDiscussions, AlgoliaHit } from '../services/algoliaService';
import { createReport } from '../services/reportService';
import ReportSheet from '../components/ReportSheet';
import { Alert } from 'react-native';
import { getFlagEmoji } from '../utils/flagEmoji';
import { formatTime } from '../utils/formatTime';
import { Discussion, ReportReason } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScrollToTop } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import { weightedSort } from '../utils/weightedSort';
import FollowButton from '../components/FollowButton';
import NationFilterDrawer from '../components/NationFilterDrawer';
import AppImage from '../components/AppImage';
import PhotoGrid from '../components/PhotoGrid';
import VideoPreview from '../components/VideoPreview';
import QuestionOfDayCard from '../components/QuestionOfDayCard';
import EmptyState from '../components/EmptyState';
import { COUNTRIES } from '../data/countries';

// Enable the expand/collapse animation for the attachments panel on old-arch Android.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ForumScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top]);
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
  // Empty = all nationalities; otherwise filter to these (country names).
  const [selectedNations, setSelectedNations] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [topQuestion, setTopQuestion] = useState<Discussion | null>(null);
  const [reportTarget, setReportTarget] = useState<Discussion | null>(null);
  // Client-side filter over the loaded questions by whether they're solved.
  const [answerFilter, setAnswerFilter] = useState<'all' | 'answered' | 'unanswered'>('all');
  // Which cards have their attachments panel expanded (keyed by discussion id).
  const [expandedAttach, setExpandedAttach] = useState<Record<string, boolean>>({});

  function toggleAttach(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedAttach((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const prevScrollY = useRef(0);
  const filterAnim = useRef(new Animated.Value(1)).current;
  // Tapping the Forum tab while already on it scrolls back to the top.
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);

  // Re-tapping the active tab scrolls the list to top; bring the collapsed
  // filter bar back too, as if the user had scrolled up to the top.
  useEffect(() => {
    const unsub = navigation.getParent()?.addListener('tabPress', () => {
      if (!navigation.isFocused()) return;
      prevScrollY.current = 0;
      Animated.timing(filterAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    });
    return unsub;
  }, [navigation]);

  const CYCLE: Array<typeof answerFilter> = ['all', 'answered', 'unanswered'];
  const cycleIcon = answerFilter === 'answered' ? 'checkmark-circle' as const
    : answerFilter === 'unanswered' ? 'help-circle-outline' as const
    : 'apps-outline' as const;
  const cycleColor = answerFilter === 'answered' ? colors.success
    : answerFilter === 'unanswered' ? colors.primary
    : colors.textSecondary;

  function cycleAnswerFilter() {
    const idx = CYCLE.indexOf(answerFilter);
    setAnswerFilter(CYCLE[(idx + 1) % CYCLE.length]);
  }

  function handleScroll(e: any) {
    const y = e.nativeEvent.contentOffset.y;
    const diff = y - prevScrollY.current;
    if (diff > 8 && y > 40) {
      Animated.timing(filterAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    } else if (diff < -8) {
      Animated.timing(filterAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    }
    prevScrollY.current = y;
  }

  function toggleNation(name: string) {
    setSelectedNations((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  const isSearching = search.trim().length > 0;

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const hits = await searchDiscussions(q, selectedNations, answerFilter);
      setAlgoliaHits(hits);
    } catch {
      setAlgoliaHits([]);
    } finally {
      setSearching(false);
    }
  }, [selectedNations, answerFilter]);

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
    setDiscussions([]);
    loadFeed();
  }, [profile?.uid, selectedNations, answerFilter]);

  async function loadFeed() {
    if (!profile?.uid) return;
    setError('');
    setLoading(true);
    try {
      const { discussions: data, lastDoc: last } = await fetchDiscussions(selectedNations, answerFilter);
      const useRecommendations = selectedNations.length === 0 && answerFilter === 'all';
      const sorted = useRecommendations
        ? weightedSort(data, { myNationality: profile.nationality, following: profile.following ?? [] }, (d) => d.replyCount ?? 0)
        : data;
      setDiscussions(sorted);
      setLastDoc(last);
      setHasMore(data.length === PAGE_SIZE);
      fetchTopQuestion().then(setTopQuestion).catch(() => {});
    } catch (e: any) {
      setError(e.message ?? t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!hasMore || isLoading || !lastDoc) return;
    setLoading(true);
    try {
      const { discussions: data, lastDoc: last } = await fetchDiscussions(selectedNations, answerFilter, lastDoc);
      const useRecommendations = selectedNations.length === 0 && answerFilter === 'all' && !!profile?.nationality;
      const sorted = useRecommendations
        ? weightedSort(data, { myNationality: profile!.nationality, following: profile!.following ?? [] }, (d) => d.replyCount ?? 0)
        : data;
      appendDiscussions(sorted);
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

  function handleReport(item: Discussion) {
    if (!profile?.uid) return;
    setReportTarget(item);
  }

  async function submitReport(reason: ReportReason) {
    const item = reportTarget;
    setReportTarget(null);
    if (!item || !profile?.uid) return;
    try {
      await createReport({
        targetType: 'discussion',
        targetId: item.id,
        targetTitle: item.question,
        targetAuthorId: item.authorId,
        reportedBy: profile.uid,
        reason,
      });
      Alert.alert(t('report.sentTitle'), t('report.sentMessage'));
    } catch {
      Alert.alert(t('errors.generic'));
    }
  }

  // O(1) membership test per card instead of a per-row discussions.some() scan
  // (that was O(n²) across the whole list on every render).
  const storeIdSet = useMemo(() => new Set(discussions.map((d) => d.id)), [discussions]);

  function renderCard({ item }: { item: Discussion }) {
    const inStore = storeIdSet.has(item.id);
    const isSaved = inStore
      ? (item.savedBy?.includes(profile?.uid ?? '') ?? false)
      : (savedOverrides[item.id] ?? false);
    const isAnswered = !!item.acceptedReplyId;
    const isOwner = item.authorId === profile?.uid;
    const attachCount = (item.imageURLs?.length ?? 0) + (item.videoURL ? 1 : 0);
    const attachExpanded = !!expandedAttach[item.id];
    return (
      <TouchableOpacity
        style={[styles.card, isAnswered && styles.cardAnswered]}
        onPress={() => navigation.navigate('DiscussionDetail', { discussionId: item.id, question: item.question })}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <TouchableOpacity
            style={styles.authorTap}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('UserProfile', { userId: item.authorId })}
          >
            <View style={styles.avatar}>
              {item.authorPhoto ? (
                <AppImage source={{ uri: item.authorPhoto }} style={styles.avatarImage} contentFit="cover" />
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
          </TouchableOpacity>
          <View style={styles.headerRight}>
            {isAnswered && (
              <View style={styles.answeredBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#fff" />
                <Text style={styles.answeredBadgeText}>{t('forum.answered')}</Text>
              </View>
            )}
            {!isOwner && <FollowButton targetUid={item.authorId} />}
          </View>
        </View>
        <Text style={styles.question}>{item.question}</Text>
        {attachCount > 0 ? (
          <View style={styles.attachBlock}>
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={() => toggleAttach(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="attach" size={16} color={colors.primary} />
              <Text style={styles.attachBtnText}>
                {t('forum.attachments')} · {attachCount}
              </Text>
              <Ionicons
                name={attachExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.primary}
              />
            </TouchableOpacity>
            {attachExpanded ? (
              <View style={styles.attachMedia}>
                {item.videoURL ? (
                  <VideoPreview
                    poster={item.videoPoster}
                    onPress={() => navigation.navigate('DiscussionDetail', { discussionId: item.id, question: item.question })}
                  />
                ) : null}
                {item.imageURLs && item.imageURLs.length > 0 ? (
                  <PhotoGrid
                    images={item.imageURLs}
                    onPress={() => navigation.navigate('DiscussionDetail', { discussionId: item.id, question: item.question })}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
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
            {!isOwner && (
              <TouchableOpacity onPress={() => handleReport(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
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

  const visibleList = isSearching ? searchResults : discussions;


  return (
    <View style={styles.container}>
      {/* Header with inline search */}
      <View style={styles.headerBlock}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('forum.title')}</Text>
        <View style={styles.headerSearch}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.headerSearchInput}
            placeholder={t('forum.search')}
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {isSearching && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Collapsible filter bar — slides up on scroll down, returns on scroll up */}
      <Animated.View style={[
        styles.filterBar,
        {
          overflow: 'hidden',
          maxHeight: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 100] }),
          opacity: filterAnim,
        },
      ]}>
        <View style={styles.natBar}>
          <TouchableOpacity
            style={[styles.drawerBtn, selectedNations.length > 0 && styles.drawerBtnActive]}
            onPress={() => setDrawerOpen(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="menu" size={22} color={selectedNations.length > 0 ? colors.primary : colors.textPrimary} />
            {selectedNations.length > 0 && (
              <View style={styles.drawerBadge}>
                <Text style={styles.drawerBadgeText}>{selectedNations.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.natChips}
          >
            <TouchableOpacity
              style={[styles.natChip, selectedNations.length === 0 && styles.natChipActive]}
              onPress={() => setSelectedNations([])}
            >
              <Text style={[styles.natChipText, selectedNations.length === 0 && styles.natChipTextActive]}>
                🌍 {t('feed.allNations')}
              </Text>
            </TouchableOpacity>
            {selectedNations.map((nation) => (
              <TouchableOpacity
                key={nation}
                style={[styles.natChip, styles.natChipActive]}
                onPress={() => toggleNation(nation)}
              >
                <Text style={[styles.natChipText, styles.natChipTextActive]}>
                  {COUNTRIES.find((c) => c.name === nation)?.flag ?? '🏳️'} {nation}  ✕
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.cycleBtn, answerFilter !== 'all' && styles.cycleBtnActive]}
            onPress={cycleAnswerFilter}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={cycleIcon} size={18} color={cycleColor} />
          </TouchableOpacity>
        </View>
      </Animated.View>
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
          ref={listRef}
          data={visibleList}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={visibleList.length === 0 ? styles.center : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={isSearching ? undefined : loadMore}
          onEndReachedThreshold={0.3}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          removeClippedSubviews
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={9}
          updateCellsBatchingPeriod={50}
          ListHeaderComponent={
            !isSearching && topQuestion && selectedNations.length === 0 && answerFilter === 'all' ? (
              <View style={styles.qodWrap}>
                <QuestionOfDayCard
                  discussion={topQuestion}
                  onPress={() => navigation.navigate('DiscussionDetail', { discussionId: topQuestion.id, question: topQuestion.question })}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={isSearching || answerFilter !== 'all' ? 'search-outline' : 'chatbubbles-outline'}
              text={isSearching || answerFilter !== 'all' ? t('forum.nothingFound') : t('forum.empty')}
            />
          }
          ListFooterComponent={
            isLoading && discussions.length > 0
              ? <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
              : null
          }
        />
      )}

      <NationFilterDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selected={selectedNations}
        onToggle={toggleNation}
        onClear={() => setSelectedNations([])}
        myNationality={profile?.nationality}
      />

      <ReportSheet
        visible={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        onSubmit={submitReport}
      />
    </View>
  );
}


function makeStyles(c: ColorPalette, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    headerBlock: {
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: topInset + 12,
      paddingBottom: 16,
      backgroundColor: c.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    filterBar: {
      backgroundColor: c.surface,
    },
    headerTitle: {
      fontSize: Typography.fontSizeXL,
      fontWeight: Typography.fontWeightBold,
      color: c.primary,
    },
    headerSearch: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
    },
    headerSearchInput: {
      flex: 1,
      fontSize: Typography.fontSizeSM,
      color: c.textPrimary,
      padding: 0,
    },
    natBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    cycleBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cycleBtnActive: {
      borderColor: c.primary,
      backgroundColor: c.primaryLight,
    },
    drawerBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    drawerBtnActive: { borderColor: c.primary, backgroundColor: c.primaryLight },
    drawerBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    drawerBadgeText: { color: '#fff', fontSize: 10, fontWeight: Typography.fontWeightBold },
    natChips: { gap: 8, alignItems: 'center', paddingRight: 8 },
    qodWrap: { marginBottom: 4 },
    natChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 18,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
    },
    natChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    natChipText: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      fontWeight: Typography.fontWeightMedium,
    },
    natChipTextActive: { color: '#fff', fontWeight: Typography.fontWeightSemiBold },
    list: { padding: 14, gap: 14, paddingBottom: 96 },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
    card: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 16,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    cardAnswered: {
      borderWidth: 1.5,
      borderColor: c.success,
      backgroundColor: c.successTint,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    authorTap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerRight: { flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
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
    attachBlock: { marginBottom: 12 },
    attachBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: c.primaryLight,
      borderWidth: 1,
      borderColor: c.border,
    },
    attachBtnText: {
      fontSize: Typography.fontSizeSM,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.primary,
    },
    attachMedia: { marginTop: 10, gap: 8 },
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
