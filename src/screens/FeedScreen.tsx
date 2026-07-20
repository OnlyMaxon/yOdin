import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { DocumentSnapshot } from 'firebase/firestore';
import { useAuthStore } from '../store/useAuthStore';
import { usePostStore, FeedFilter } from '../store/usePostStore';
import { fetchPosts, deletePost, votePost, savePost, unsavePost, joinEvent, leaveEvent, PAGE_SIZE } from '../services/postService';
import { createParticipantNotification } from '../services/notificationService';
import { createReport } from '../services/reportService';
import ReportSheet from '../components/ReportSheet';
import { fetchTopQuestion } from '../services/discussionService';
import { getFlagEmoji } from '../utils/flagEmoji';
import { formatTime } from '../utils/formatTime';
import { Post, PostCategory, POST_CATEGORIES, Discussion, ReportReason } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScrollToTop } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import PostDetailModal from './PostDetailModal';
import FollowButton from '../components/FollowButton';
import NationFilterDrawer from '../components/NationFilterDrawer';
import AppImage from '../components/AppImage';
import MediaCarousel from '../components/MediaCarousel';
import EventParticipantsModal from '../components/EventParticipantsModal';
import QuestionOfDayCard from '../components/QuestionOfDayCard';
import EmptyState from '../components/EmptyState';
import { weightedSort } from '../utils/weightedSort';
import { COUNTRIES } from '../data/countries';

const FILTERS: FeedFilter[] = ['all', ...POST_CATEGORIES];

export default function FeedScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top]);
  const { profile } = useAuthStore();
  const { posts, filter, setFilter, setPosts, appendPosts, setLoading, isLoading, setHasMore, hasMore, removePost, setPostVote, togglePostSaved, toggleParticipant } = usePostStore();
  const [refreshing, setRefreshing] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [error, setError] = useState('');
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailWithComments, setDetailWithComments] = useState(false);
  // Empty = all nationalities; otherwise filter to these (country names).
  const [selectedNations, setSelectedNations] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [topQuestion, setTopQuestion] = useState<Discussion | null>(null);
  // Tapping the Feed tab while already on it scrolls back to the top.
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  const [reportTarget, setReportTarget] = useState<Post | null>(null);
  const [participantsPost, setParticipantsPost] = useState<Post | null>(null);

  const prevScrollY = useRef(0);
  const filterAnim = useRef(new Animated.Value(1)).current;

  // Re-tapping the active tab scrolls the list to top (useScrollToTop); bring the
  // collapsed filter bar back too, as if the user had scrolled up to the top.
  useEffect(() => {
    const unsub = navigation.getParent()?.addListener('tabPress', () => {
      if (!navigation.isFocused()) return;
      prevScrollY.current = 0;
      Animated.timing(filterAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
    });
    return unsub;
  }, [navigation]);

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

  function openDetail(postId: string, withComments: boolean) {
    setDetailPostId(postId);
    setDetailWithComments(withComments);
    setDetailVisible(true);
  }

  async function handleVote(item: Post, vote: 'like' | 'dislike') {
    if (!profile?.uid) return;
    const uid = profile.uid;
    const liked = item.likes?.includes(uid) ?? false;
    const disliked = item.dislikes?.includes(uid) ?? false;
    const likes = (item.likes ?? []).filter((id) => id !== uid);
    const dislikes = (item.dislikes ?? []).filter((id) => id !== uid);
    if (vote === 'like' && !liked) likes.push(uid);
    if (vote === 'dislike' && !disliked) dislikes.push(uid);

    const prevLikes = item.likes ?? [];
    const prevDislikes = item.dislikes ?? [];
    setPostVote(item.id, likes, dislikes);
    try {
      await votePost(item.id, uid, vote, { liked, disliked });
    } catch {
      setPostVote(item.id, prevLikes, prevDislikes);
    }
  }

  async function handleSave(item: Post) {
    if (!profile?.uid) return;
    const uid = profile.uid;
    const isSaved = item.savedBy?.includes(uid) ?? false;
    togglePostSaved(item.id, uid);
    try {
      if (isSaved) await unsavePost(uid, item.id);
      else await savePost(uid, item.id);
    } catch {
      togglePostSaved(item.id, uid); // revert
    }
  }

  useEffect(() => {
    loadFeed();
  }, [profile?.uid, filter, selectedNations]);

  async function loadFeed() {
    if (!profile?.uid) return;
    setError('');
    setLoading(true);
    try {
      const category = filter === 'all' ? undefined : filter;
      const { posts: data, lastDoc: last } = await fetchPosts(category, selectedNations);
      const sorted = selectedNations.length === 0
        ? weightedSort(data, { myNationality: profile.nationality, following: profile.following ?? [] }, (p) => (p.likes?.length ?? 0) + (p.commentCount ?? 0))
        : data;
      setPosts(sorted);
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
      const category = filter === 'all' ? undefined : filter;
      const { posts: data, lastDoc: last } = await fetchPosts(category, selectedNations, lastDoc);
      const sorted = selectedNations.length === 0 && profile?.nationality
        ? weightedSort(data, { myNationality: profile.nationality, following: profile.following ?? [] }, (p) => (p.likes?.length ?? 0) + (p.commentCount ?? 0))
        : data;
      appendPosts(sorted);
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

  function handleReport(item: Post) {
    if (!profile?.uid) return;
    setReportTarget(item);
  }

  async function submitReport(reason: ReportReason) {
    const item = reportTarget;
    setReportTarget(null);
    if (!item || !profile?.uid) return;
    try {
      await createReport({
        targetType: 'post',
        targetId: item.id,
        targetTitle: item.title,
        targetAuthorId: item.authorId,
        reportedBy: profile.uid,
        reason,
      });
      Alert.alert(t('report.sentTitle'), t('report.sentMessage'));
    } catch {
      Alert.alert(t('errors.generic'));
    }
  }

  function handleDelete(postId: string) {
    Alert.alert(
      t('deletePost.title'),
      t('deletePost.message'),
      [
        { text: t('deletePost.cancel'), style: 'cancel' },
        {
          text: t('deletePost.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost(postId);
              removePost(postId);
            } catch {
              Alert.alert(t('errors.generic'));
            }
          },
        },
      ],
    );
  }

  function categoryColor(category: PostCategory): string {
    switch (category) {
      case 'news': return colors.primary;
      case 'events': return colors.accent;
      case 'places': return colors.success;
      case 'lifestyle': return colors.pink;
      default: return colors.textSecondary;
    }
  }

  async function handleJoinEvent(item: Post) {
    if (!profile?.uid) return;
    const uid = profile.uid;
    const participants = item.participants ?? [];
    const isIn = participants.includes(uid);
    const cap = item.participantLimit ?? null;
    if (!isIn && cap != null && participants.length >= cap) {
      Alert.alert(t('post.eventFull'));
      return;
    }
    toggleParticipant(item.id, uid); // optimistic — the card re-renders from the store
    try {
      if (isIn) {
        await leaveEvent(item.id, uid);
      } else {
        await joinEvent(item.id, uid);
        if (item.authorId !== uid) {
          createParticipantNotification({
            toUserId: item.authorId,
            fromUserId: uid,
            fromUserName: `${profile.firstName} ${profile.lastName}`,
            fromUserPhoto: profile.photoURL ?? '',
            postId: item.id,
            postTitle: item.title,
          }).catch(() => {});
        }
      }
    } catch (e) {
      toggleParticipant(item.id, uid); // revert
      Alert.alert(e instanceof Error && e.message === 'event-full' ? t('post.eventFull') : t('errors.generic'));
    }
  }

  function renderCard({ item }: { item: Post }) {
    const badgeColor = categoryColor(item.category);
    const isOwner = item.authorId === profile?.uid;
    const liked = item.likes?.includes(profile?.uid ?? '') ?? false;
    const disliked = item.dislikes?.includes(profile?.uid ?? '') ?? false;
    const likeCount = item.likes?.length ?? 0;
    const dislikeCount = item.dislikes?.length ?? 0;
    const commentCount = item.commentCount ?? 0;
    const isSaved = item.savedBy?.includes(profile?.uid ?? '') ?? false;
    const isParticipant = item.participants?.includes(profile?.uid ?? '') ?? false;
    const eventFull = item.participantLimit != null
      && (item.participants?.length ?? 0) >= item.participantLimit
      && !isParticipant;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => openDetail(item.id, false)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.authorTap}>
            <TouchableOpacity
              style={styles.avatar}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('UserProfile', { userId: item.authorId })}
            >
              {item.authorPhoto ? (
                <AppImage source={{ uri: item.authorPhoto }} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.avatarText}>
                  {item.authorName?.charAt(0).toUpperCase()}
                </Text>
              )}
            </TouchableOpacity>
            <View style={styles.authorInfo}>
              <Text
                style={styles.authorName}
                onPress={() => navigation.navigate('UserProfile', { userId: item.authorId })}
                suppressHighlighting
              >
                {item.authorName}
              </Text>
              <Text style={styles.authorMeta}>
                {getFlagEmoji(item.authorCountryCode)}{'  '}{item.authorNationality}
              </Text>
            </View>
          </View>
          {!isOwner && <FollowButton targetUid={item.authorId} />}
        </View>
        <View style={styles.badgeRow}>
          <View style={[styles.categoryBadge, { backgroundColor: badgeColor + '22' }]}>
            <Text style={[styles.categoryBadgeText, { color: badgeColor }]}>
              {t(`categories.${item.category}`)}
            </Text>
          </View>
        </View>

        {item.videoURL || (item.imageURLs && item.imageURLs.length > 0) ? (
          <View style={styles.photoWrap}>
            <MediaCarousel
              images={item.imageURLs}
              videoURL={item.videoURL}
              videoPoster={item.videoPoster}
              onVideoPress={() => openDetail(item.id, false)}
              onImagePress={() => openDetail(item.id, false)}
            />
          </View>
        ) : null}

        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postDescription}>{item.description}</Text>

        {item.signupEnabled ? (
          <View style={styles.eventRow}>
            <TouchableOpacity
              style={[styles.joinBtn, isParticipant && styles.joinBtnLeave, eventFull && styles.joinBtnDisabled]}
              onPress={() => handleJoinEvent(item)}
              disabled={eventFull}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isParticipant ? 'checkmark-circle' : 'people'}
                size={16}
                color={isParticipant ? colors.primary : '#fff'}
              />
              <Text style={[styles.joinBtnText, isParticipant && styles.joinBtnTextLeave]}>
                {isParticipant ? t('post.leaveEvent') : eventFull ? t('post.eventFull') : t('post.participate')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.participantsBtn}
              onPress={() => setParticipantsPost(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="people-outline" size={16} color={colors.primary} />
              <Text style={styles.participantsBtnText}>
                {item.participants?.length ?? 0}
                {item.participantLimit != null ? `/${item.participantLimit}` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleVote(item, 'like')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? colors.notification : colors.textSecondary} />
              {likeCount > 0 && <Text style={styles.actionCount}>{likeCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleVote(item, 'dislike')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name={disliked ? 'thumbs-down' : 'thumbs-down-outline'} size={18} color={disliked ? colors.primary : colors.textSecondary} />
              {dislikeCount > 0 && <Text style={styles.actionCount}>{dislikeCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openDetail(item.id, true)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
              {commentCount > 0 && <Text style={styles.actionCount}>{commentCount}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleSave(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={isSaved ? colors.primary : colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.time}>{formatTime(item.createdAt, t)}</Text>
          {isOwner ? (
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.notification} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => handleReport(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="flag-outline" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('feed.title')}</Text>
      </View>

      <Animated.View style={[
        styles.filterBar,
        {
          overflow: 'hidden',
          maxHeight: filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }),
          opacity: filterAnim,
        },
      ]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f === 'all' ? t('categories.all') : t(`categories.${f}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.natRow}>
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
              style={[styles.chip, selectedNations.length === 0 && styles.chipActive]}
              onPress={() => setSelectedNations([])}
            >
              <Text style={[styles.chipText, selectedNations.length === 0 && styles.chipTextActive]}>
                🌍 {t('feed.allNations')}
              </Text>
            </TouchableOpacity>
            {selectedNations.map((nation) => (
              <TouchableOpacity
                key={nation}
                style={[styles.chip, styles.chipActive]}
                onPress={() => toggleNation(nation)}
              >
                <Text style={[styles.chipText, styles.chipTextActive]}>
                  {COUNTRIES.find((c) => c.name === nation)?.flag ?? '🏳️'} {nation}  ✕
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Animated.View>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.notification, textAlign: 'center', padding: 24 }}>{error}</Text>
        </View>
      ) : isLoading && posts.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={posts.length === 0 ? styles.center : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          removeClippedSubviews
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={9}
          updateCellsBatchingPeriod={50}
          ListHeaderComponent={
            topQuestion && selectedNations.length === 0 && filter === 'all' ? (
              <View style={styles.qodWrap}>
                <QuestionOfDayCard
                  discussion={topQuestion}
                  promoted
                  onPress={() => navigation.navigate('DiscussionDetail', { discussionId: topQuestion.id, question: topQuestion.question })}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState icon="newspaper-outline" text={t('feed.emptyPosts')} />
          }
          ListFooterComponent={
            isLoading && posts.length > 0
              ? <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
              : null
          }
        />
      )}

      <PostDetailModal
        visible={detailVisible}
        postId={detailPostId}
        startWithComments={detailWithComments}
        onClose={() => setDetailVisible(false)}
        onOpenProfile={(userId) => {
          setDetailVisible(false);
          setTimeout(() => navigation.navigate('UserProfile', { userId }), 250);
        }}
      />

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

      <EventParticipantsModal
        visible={participantsPost !== null}
        participantIds={participantsPost?.participants ?? []}
        onClose={() => setParticipantsPost(null)}
        onOpenProfile={(userId) => {
          setParticipantsPost(null);
          setTimeout(() => navigation.navigate('UserProfile', { userId }), 250);
        }}
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
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontSize: Typography.fontSizeXL,
      fontWeight: Typography.fontWeightBold,
      color: c.primary,
    },
    filterBar: {
      backgroundColor: c.surface,
    },
    filterRow: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      paddingTop: 4,
      gap: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    natRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 8,
      paddingTop: 4,
      gap: 8,
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
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 18,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
    },
    chipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    chipText: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      fontWeight: Typography.fontWeightMedium,
    },
    chipTextActive: { color: '#fff', fontWeight: Typography.fontWeightSemiBold },
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
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    authorTap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
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
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
    categoryBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    categoryBadgeText: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightSemiBold,
    },
    photoWrap: { marginBottom: 12 },
    qodWrap: { marginBottom: 4 },
    postTitle: {
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
      marginBottom: 6,
    },
    postDescription: {
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      lineHeight: 22,
      marginBottom: 12,
    },
    eventRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    joinBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 11,
    },
    joinBtnLeave: { backgroundColor: c.primaryLight },
    joinBtnDisabled: { opacity: 0.5 },
    joinBtnText: { color: '#fff', fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightSemiBold },
    joinBtnTextLeave: { color: c.primary },
    participantsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.primary,
    },
    participantsBtnText: { color: c.primary, fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightSemiBold },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    actionCount: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      fontWeight: Typography.fontWeightMedium,
    },
    time: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
    },
  });
}
