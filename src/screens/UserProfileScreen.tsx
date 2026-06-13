import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/useAuthStore';
import { fetchUser, countFollowers } from '../services/userService';
import { fetchUserPosts } from '../services/postService';
import { fetchUserDiscussions } from '../services/discussionService';
import { User, Post, Discussion } from '../types';
import { getRank } from '../utils/rank';
import { getFlagEmoji } from '../utils/flagEmoji';
import { formatTime } from '../utils/formatTime';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import FollowButton from '../components/FollowButton';
import PostDetailModal from './PostDetailModal';

export default function UserProfileScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top);
  const myProfile = useAuthStore((s) => s.profile);

  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [followers, setFollowers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'posts' | 'discussions'>('posts');
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const followedAtLoad = useRef(false);

  const isMe = myProfile?.uid === userId;

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      // Each fetch is independent: a foreign user's discussions/posts may live in
      // another region, which the security rules deny — that must not crash the
      // whole profile, so we swallow per-query failures and fall back to empties.
      const [u, p, d, fc] = await Promise.all([
        fetchUser(userId).catch(() => null),
        fetchUserPosts(userId).catch(() => []),
        fetchUserDiscussions(userId).catch(() => []),
        countFollowers(userId).catch(() => 0),
      ]);
      if (!active) return;
      setUser(u);
      setPosts(p);
      setDiscussions(d);
      setFollowers(fc);
      followedAtLoad.current = myProfile?.following?.includes(userId) ?? false;
      setLoading(false);
    })();
    return () => { active = false; };
  }, [userId]);

  // Keep the follower count live as the viewer follows/unfollows this user.
  const iFollow = myProfile?.following?.includes(userId) ?? false;
  const displayedFollowers = followers + ((iFollow ? 1 : 0) - (followedAtLoad.current ? 1 : 0));
  const followingCount = user?.following?.length ?? 0;

  function openPostDetail(post: Post) {
    setDetailPost(post);
    setDetailVisible(true);
  }

  function renderPost({ item }: { item: Post }) {
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openPostDetail(item)}>
        {item.imageURL ? (
          <Image source={{ uri: item.imageURL }} style={styles.postImage} resizeMode="cover" />
        ) : null}
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="heart-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaMuted}>{item.likes?.length ?? 0}</Text>
          <Ionicons name="chatbubble-outline" size={13} color={colors.textSecondary} style={{ marginLeft: 12 }} />
          <Text style={styles.metaMuted}>{item.commentCount ?? 0}</Text>
          <Text style={styles.metaTime}>{formatTime(item.createdAt, t)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderDiscussion({ item }: { item: Discussion }) {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('DiscussionDetail', { discussionId: item.id, question: item.question })}
      >
        <Text style={styles.cardQuestion}>{item.question}</Text>
        <Text style={styles.cardMeta}>{t('feed.replies', { count: item.replyCount })}</Text>
      </TouchableOpacity>
    );
  }

  const data: (Post | Discussion)[] = tab === 'posts' ? posts : discussions;
  const flag = user?.countryCode ? getFlagEmoji(user.countryCode) : '🌐';
  const initials = user
    ? `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`.toUpperCase()
    : '?';
  const points = user?.points ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          {user ? `${user.firstName} ${user.lastName}` : ''}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !user ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('errors.generic')}</Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                {user.photoURL ? (
                  <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
              </View>
              <View style={styles.stats}>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{posts.length}</Text>
                  <Text style={styles.statLabel}>{t('profile.posts')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{Math.max(0, displayedFollowers)}</Text>
                  <Text style={styles.statLabel}>{t('profile.followers')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{followingCount}</Text>
                  <Text style={styles.statLabel}>{t('profile.followingCount')}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
            <Text style={styles.nationality}>{flag}  {user.nationality}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Ionicons name="location-sharp" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.location}>{user.location}</Text>
            </View>
            <View style={styles.rankRow}>
              <View style={styles.rankBadge}>
                <Ionicons name="ribbon" size={12} color={colors.primary} />
                <Text style={styles.rankBadgeText}>{t(`rank.${getRank(points)}`)}</Text>
              </View>
              <Text style={styles.rankPoints}>{t('rank.points', { count: points })}</Text>
            </View>

            {!isMe && (
              <View style={styles.followRow}>
                <FollowButton targetUid={userId} large />
              </View>
            )}
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, tab === 'posts' && styles.tabActive]} onPress={() => setTab('posts')}>
              <Text style={[styles.tabText, tab === 'posts' && styles.tabTextActive]}>{t('profile.posts')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === 'discussions' && styles.tabActive]} onPress={() => setTab('discussions')}>
              <Text style={[styles.tabText, tab === 'discussions' && styles.tabTextActive]}>{t('profile.discussions')}</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) =>
              tab === 'posts' ? renderPost({ item: item as Post }) : renderDiscussion({ item: item as Discussion })
            }
            contentContainerStyle={data.length === 0 ? styles.center : { padding: 16, gap: 12 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>{tab === 'posts' ? '📝' : '💬'}</Text>
                <Text style={styles.emptyText}>
                  {tab === 'posts' ? t('profile.noPosts') : t('profile.noDiscussions')}
                </Text>
              </View>
            }
          />
        </>
      )}

      <PostDetailModal
        visible={detailVisible}
        postId={detailPost?.id ?? null}
        fallbackPost={detailPost}
        onClose={() => setDetailVisible(false)}
      />
    </View>
  );
}

function makeStyles(c: ColorPalette, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: topInset + 12,
      paddingBottom: 12,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    backBtn: { padding: 2 },
    topTitle: { flex: 1, textAlign: 'center', fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: c.textPrimary },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    profileRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center',
      marginRight: 20,
    },
    avatarImage: { width: 72, height: 72, borderRadius: 36 },
    avatarText: { fontSize: Typography.fontSizeXXL, fontWeight: Typography.fontWeightBold, color: c.primary },
    stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statNum: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: c.textPrimary },
    statLabel: { fontSize: Typography.fontSizeXS, color: c.textSecondary, marginTop: 2 },
    name: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: c.textPrimary, marginTop: 14 },
    nationality: { fontSize: Typography.fontSizeSM, color: c.textSecondary, marginTop: 2 },
    location: { fontSize: Typography.fontSizeSM, color: c.textSecondary },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    rankBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: c.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    },
    rankBadgeText: { fontSize: Typography.fontSizeXS, fontWeight: Typography.fontWeightSemiBold, color: c.primary },
    rankPoints: { fontSize: Typography.fontSizeXS, color: c.textSecondary },
    followRow: { marginTop: 16, flexDirection: 'row' },
    tabs: { flexDirection: 'row', backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
    tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: c.primary },
    tabText: { fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightMedium, color: c.textSecondary },
    tabTextActive: { color: c.primary, fontWeight: Typography.fontWeightSemiBold },
    card: { backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.border },
    cardTitle: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemiBold, color: c.textPrimary, marginBottom: 4 },
    cardDesc: { fontSize: Typography.fontSizeSM, color: c.textSecondary, lineHeight: 20 },
    postImage: { width: '100%', height: 140, borderRadius: 10, marginBottom: 10, backgroundColor: c.background },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
    metaMuted: { fontSize: Typography.fontSizeXS, color: c.textSecondary },
    metaTime: { fontSize: Typography.fontSizeXS, color: c.textSecondary, marginLeft: 'auto' },
    cardQuestion: { fontSize: Typography.fontSizeMD, color: c.textPrimary, lineHeight: 22, marginBottom: 8 },
    cardMeta: { fontSize: Typography.fontSizeSM, color: c.primary },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyEmoji: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: Typography.fontSizeMD, color: c.textSecondary },
  });
}