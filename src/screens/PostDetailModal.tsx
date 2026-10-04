import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Keyboard,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import TextInput from '../components/AppTextInput';
import Text from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { usePostStore } from '../store/usePostStore';
import { votePost, addComment, fetchComments, joinEvent, leaveEvent } from '../services/postService';
import { Post, PostComment, ReportReason } from '../types';
import { getFlagEmoji } from '../utils/flagEmoji';
import { formatTime } from '../utils/formatTime';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import Avatar from '../components/Avatar';
import MediaCarousel from '../components/MediaCarousel';
import EventParticipantsModal from '../components/EventParticipantsModal';
import EventDateBlock from '../components/EventDateBlock';
import ReportSheet from '../components/ReportSheet';
import { createParticipantNotification, notifyMentions } from '../services/notificationService';
import { createReport } from '../services/reportService';
import { isDeletedAuthor } from '../utils/author';
import { useWithoutBlocked } from '../hooks/useWithoutBlocked';

const SCREEN_H = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  postId: string | null;
  startWithComments?: boolean;
  onClose: () => void;
  // Used when the post isn't in the feed store (e.g. opened from the profile).
  fallbackPost?: Post | null;
  // Navigate to a user's profile (parent closes the modal then navigates).
  onOpenProfile?: (userId: string) => void;
}

export default function PostDetailModal({ visible, postId, startWithComments, onClose, fallbackPost, onOpenProfile }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top, insets.bottom);
  const { profile } = useAuthStore();
  const storePost = usePostStore((s) => (postId ? s.posts.find((p) => p.id === postId) : undefined));
  const post = storePost ?? (fallbackPost && fallbackPost.id === postId ? fallbackPost : undefined);
  const setPostVote = usePostStore((s) => s.setPostVote);
  const incrementCommentCount = usePostStore((s) => s.incrementCommentCount);
  const toggleParticipant = usePostStore((s) => s.toggleParticipant);

  const [comments, setComments] = useState<PostComment[]>([]);
  const visibleComments = useWithoutBlocked(comments, (c) => c.authorId);
  const [loadingComments, setLoadingComments] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // Local optimistic copy of the attendee list (post may be a fallback that
  // isn't in the feed store, so we can't rely on the store alone).
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantsVisible, setParticipantsVisible] = useState(false);
  const [joining, setJoining] = useState(false);
  const [reportComment, setReportComment] = useState<PostComment | null>(null);
  const commentBlocked = (profile?.commentBlockedUntil ?? 0) > Date.now();

  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  // Entrance: the whole sheet springs up from the bottom.
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  // Manual keyboard handling: KeyboardAvoidingView is unreliable inside a Modal,
  // so we track the keyboard height and (a) lift the input bar above it and
  // (b) pad the comment list's tail by the same amount so nothing hides behind
  // it. Driven on the JS thread (non-native) because it animates layout height.
  const kbLift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && postId) {
      slideAnim.setValue(SCREEN_H);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
      setText('');
      setComments([]);
      setParticipantsVisible(false);
      setParticipants(post?.participants ?? []);
      loadComments(postId, !!startWithComments);
    }
  }, [visible, postId]);

  // Track the keyboard height (see kbLift above).
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: any) => {
      Animated.timing(kbLift, {
        toValue: e.endCoordinates?.height ?? 0,
        duration: e.duration || 220,
        useNativeDriver: false,
      }).start();
    };
    const onHide = (e: any) => {
      Animated.timing(kbLift, { toValue: 0, duration: e?.duration || 200, useNativeDriver: false }).start();
    };
    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => { s.remove(); h.remove(); };
  }, [kbLift]);

  async function loadComments(id: string, scrollToComments: boolean) {
    setLoadingComments(true);
    try {
      const data = await fetchComments(id);
      setComments(data);
      // Opened via the comment affordance — drop the user straight at the thread.
      if (scrollToComments && data.length > 0) {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 120);
      }
    } catch {
      // keep empty on failure
    } finally {
      setLoadingComments(false);
    }
  }

  if (!post && visible) {
    // Post left the store (e.g. deleted) — nothing to show.
    return null;
  }

  const liked = post?.likes?.includes(profile?.uid ?? '') ?? false;
  const disliked = post?.dislikes?.includes(profile?.uid ?? '') ?? false;
  const likeCount = post?.likes?.length ?? 0;
  const dislikeCount = post?.dislikes?.length ?? 0;
  const commentCount = post?.commentCount ?? 0;

  const participantCap = post?.participantLimit ?? null;
  const isParticipant = participants.includes(profile?.uid ?? '');
  const eventFull = participantCap != null && participants.length >= participantCap && !isParticipant;

  async function toggleJoin() {
    if (!profile?.uid || !post || joining) return;
    const uid = profile.uid;
    if (eventFull) {
      Alert.alert(t('post.eventFull'));
      return;
    }
    setJoining(true);
    const prev = participants;
    setParticipants(isParticipant ? participants.filter((id) => id !== uid) : [...participants, uid]);
    toggleParticipant(post.id, uid); // keep the feed card in sync
    try {
      if (isParticipant) {
        await leaveEvent(post.id, uid);
      } else {
        await joinEvent(post.id, uid);
        // Let the event's author know someone signed up (best-effort).
        if (post.authorId !== uid) {
          createParticipantNotification({
            toUserId: post.authorId,
            fromUserId: uid,
            fromUserName: `${profile.firstName} ${profile.lastName}`,
            fromUserPhoto: profile.photoURL ?? '',
            postId: post.id,
            postTitle: post.title,
          }).catch(() => {});
        }
      }
    } catch (e) {
      setParticipants(prev);
      toggleParticipant(post.id, uid); // revert the store too
      Alert.alert(e instanceof Error && e.message === 'event-full' ? t('post.eventFull') : t('errors.generic'));
    } finally {
      setJoining(false);
    }
  }

  async function handleVote(vote: 'like' | 'dislike') {
    if (!profile?.uid || !post) return;
    const uid = profile.uid;
    const curLikes = (post.likes ?? []).filter((id) => id !== uid);
    const curDislikes = (post.dislikes ?? []).filter((id) => id !== uid);
    let likes = curLikes;
    let dislikes = curDislikes;
    if (vote === 'like' && !liked) likes = [...curLikes, uid];
    if (vote === 'dislike' && !disliked) dislikes = [...curDislikes, uid];

    const prevLikes = post.likes ?? [];
    const prevDislikes = post.dislikes ?? [];
    setPostVote(post.id, likes, dislikes);
    try {
      await votePost(post.id, uid, vote, { liked, disliked });
    } catch {
      setPostVote(post.id, prevLikes, prevDislikes);
    }
  }

  async function sendComment() {
    if (!text.trim() || !profile || !post) return;
    setSending(true);
    try {
      const data: Omit<PostComment, 'id' | 'createdAt'> = {
        postId: post.id,
        authorId: profile.uid,
        authorName: `${profile.firstName} ${profile.lastName}`,
        authorPhoto: profile.photoURL ?? '',
        authorNationality: profile.nationality,
        authorCountryCode: profile.countryCode,
        text: text.trim(),
      };
      const id = await addComment(post.id, data);
      notifyMentions({
        text: data.text,
        from: { uid: profile.uid, name: `${profile.firstName} ${profile.lastName}`, photo: profile.photoURL ?? '' },
        post: { id: post.id, title: post.title },
      }).catch(() => {});
      setComments((prev) => [...prev, { id, ...data, createdAt: Date.now() }]);
      incrementCommentCount(post.id);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setSending(false);
    }
  }

  async function submitCommentReport(reason: ReportReason) {
    const c = reportComment;
    setReportComment(null);
    if (!c || !profile?.uid || !post) return;
    try {
      await createReport({
        targetType: 'comment',
        targetId: c.id,
        targetPath: `posts/${post.id}/comments/${c.id}`,
        targetTitle: c.text,
        targetAuthorId: c.authorId,
        reportedBy: profile.uid,
        reason,
      });
      Alert.alert(t('report.sentTitle'), t('report.sentMessage'));
    } catch {
      Alert.alert(t('errors.generic'));
    }
  }

  function renderComment({ item }: { item: PostComment }) {
    const isMine = item.authorId === profile?.uid;
    return (
      <TouchableOpacity
        style={styles.commentRow}
        activeOpacity={1}
        delayLongPress={300}
        onLongPress={!isMine ? () => setReportComment(item) : undefined}
      >
        <Avatar
          photoURL={item.authorPhoto}
          name={item.authorName}
          size={36}
          onPress={
            onOpenProfile && !isDeletedAuthor(item.authorId)
              ? () => item.authorId && onOpenProfile(item.authorId)
              : undefined
          }
        />
        <View style={styles.commentBody}>
          <Text
            style={styles.commentAuthor}
            onPress={isDeletedAuthor(item.authorId) ? undefined : () => item.authorId && onOpenProfile?.(item.authorId)}
            suppressHighlighting
          >
            {isDeletedAuthor(item.authorId)
              ? t('common.deletedAccount')
              : `${item.authorName}  ${getFlagEmoji(item.authorCountryCode)}`}
          </Text>
          <Text style={styles.commentText}>{item.text}</Text>
          <Text style={styles.commentTime}>{formatTime(item.createdAt, t)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // The post itself is the list header, so it scrolls together with the comments
  // in one continuous sheet (no more floating card + half-sheet split).
  const postHeader = post ? (
    <View>
      {post.videoURL || (post.imageURLs && post.imageURLs.length > 0) ? (
        <View style={styles.photoWrap}>
          <MediaCarousel
            images={post.imageURLs}
            videoURL={post.videoURL}
            videoPoster={post.videoPoster}
            videoInline
            onImagePress={() => {}}
          />
        </View>
      ) : null}

      <View style={styles.authorRow}>
        <TouchableOpacity
          style={styles.authorTap}
          activeOpacity={onOpenProfile ? 0.7 : 1}
          disabled={!onOpenProfile}
          onPress={() => post.authorId && onOpenProfile?.(post.authorId)}
        >
          <Avatar photoURL={post.authorPhoto} name={post.authorName} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{post.authorName}</Text>
            <Text style={styles.authorMeta}>
              {getFlagEmoji(post.authorCountryCode)}  {post.authorNationality}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.postTitle}>{post.title}</Text>
      <Text style={styles.postDescription}>{post.description}</Text>

      {post.category === 'events' && post.eventDate ? (
        <EventDateBlock date={post.eventDate} location={post.location} />
      ) : null}

      {post.signupEnabled ? (
        <View style={styles.signupBox}>
          <TouchableOpacity
            style={styles.participantsRow}
            activeOpacity={0.7}
            onPress={() => setParticipantsVisible(true)}
          >
            <Ionicons name="people" size={18} color={colors.primary} />
            <Text style={styles.participantsText}>
              {participantCap != null ? `${participants.length} / ${participantCap}` : `${participants.length}`}
              {'  '}{t('post.participants')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.joinBtn,
              isParticipant && styles.joinBtnLeave,
              eventFull && styles.joinBtnDisabled,
            ]}
            onPress={toggleJoin}
            disabled={joining || eventFull}
          >
            {joining ? (
              <ActivityIndicator color={isParticipant ? colors.secondaryText : '#fff'} size="small" />
            ) : (
              <Text style={[styles.joinBtnText, isParticipant && styles.joinBtnTextLeave]}>
                {isParticipant ? t('post.leaveEvent') : eventFull ? t('post.eventFull') : t('post.participate')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleVote('like')}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={22}
            color={liked ? colors.notification : colors.textSecondary}
          />
          {likeCount > 0 && <Text style={styles.actionCount}>{likeCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleVote('dislike')}>
          <Ionicons
            name={disliked ? 'thumbs-down' : 'thumbs-down-outline'}
            size={20}
            color={disliked ? colors.primary : colors.textSecondary}
          />
          {dislikeCount > 0 && <Text style={styles.actionCount}>{dislikeCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => inputRef.current?.focus()}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
          {commentCount > 0 && <Text style={styles.actionCount}>{commentCount}</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.commentsLabel}>{t('comments.title')}</Text>
    </View>
  ) : null;

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

          <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.grabberRow}>
              <View style={styles.grabber} />
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              ref={listRef}
              style={styles.list}
              data={visibleComments}
              keyExtractor={(item) => item.id}
              renderItem={renderComment}
              ListHeaderComponent={postHeader}
              ListEmptyComponent={
                loadingComments
                  ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
                  : <Text style={styles.emptyComments}>{t('comments.empty')}</Text>
              }
              ListFooterComponent={<Animated.View style={{ height: kbLift }} />}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />

            {commentBlocked ? (
              <View style={styles.blockedBar}>
                <Ionicons name="lock-closed" size={16} color={colors.notification} />
                <Text style={styles.blockedText}>{t('moderation.blockedBanner')}</Text>
              </View>
            ) : (
              <Animated.View style={[styles.inputBar, { transform: [{ translateY: Animated.multiply(kbLift, -1) }] }]}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder={t('comments.placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={text}
                  onChangeText={setText}
                  multiline
                  maxLength={1000}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                  onPress={sendComment}
                  disabled={!text.trim() || sending}
                >
                  {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={22} color="#fff" />}
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>
        </View>
      </Modal>

      <EventParticipantsModal
        visible={participantsVisible}
        participantIds={participants}
        onClose={() => setParticipantsVisible(false)}
        onOpenProfile={onOpenProfile ? (uid) => { setParticipantsVisible(false); onOpenProfile(uid); } : undefined}
      />

      <ReportSheet
        visible={reportComment !== null}
        onClose={() => setReportComment(null)}
        onSubmit={submitCommentReport}
      />
    </>
  );
}

function makeStyles(c: ColorPalette, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    overlay: { flex: 1 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      top: topInset + 12,
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.18,
      shadowRadius: 20,
      elevation: 24,
    },
    grabberRow: {
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border },
    // Circular button, sized and vertically centred inside the 44px header so it
    // never spills below the row and gets covered by the post photo underneath.
    closeBtn: {
      position: 'absolute',
      right: 12,
      top: 6,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16 },
    photoWrap: { marginBottom: 14, borderRadius: 16, overflow: 'hidden' },
    authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    authorTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    authorName: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemiBold, color: c.textPrimary },
    authorMeta: { fontSize: Typography.fontSizeSM, color: c.textSecondary, marginTop: 2 },
    postTitle: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: c.textPrimary, letterSpacing: -0.3, marginBottom: 6 },
    postDescription: { fontSize: Typography.fontSizeMD, color: c.textPrimary, lineHeight: 22, marginBottom: 12 },
    signupBox: {
      backgroundColor: c.background,
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
      gap: 10,
    },
    participantsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    participantsText: { fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightSemiBold, color: c.textPrimary },
    joinBtn: {
      backgroundColor: c.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    joinBtnLeave: { backgroundColor: c.primaryLight },
    joinBtnDisabled: { opacity: 0.5 },
    joinBtnText: { color: '#fff', fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemiBold },
    joinBtnTextLeave: { color: c.secondaryText },
    actionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionCount: { fontSize: Typography.fontSizeSM, color: c.textSecondary, fontWeight: Typography.fontWeightMedium },
    commentsLabel: {
      fontSize: Typography.fontSizeSM,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 8,
      marginBottom: 4,
    },
    emptyComments: { fontSize: Typography.fontSizeMD, color: c.textSecondary, textAlign: 'center', paddingVertical: 24 },
    commentRow: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
    commentBody: { flex: 1 },
    commentAuthor: { fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightSemiBold, color: c.textPrimary },
    commentText: { fontSize: Typography.fontSizeMD, color: c.textPrimary, lineHeight: 20, marginTop: 2 },
    commentTime: { fontSize: Typography.fontSizeXS, color: c.textSecondary, marginTop: 4 },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: Math.max(bottomInset, 12) + 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surface,
      gap: 10,
    },
    input: {
      flex: 1,
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      maxHeight: 100,
    },
    sendBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
    blockedBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      paddingBottom: Math.max(bottomInset, 12) + 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    blockedText: { flex: 1, color: c.notification, fontSize: Typography.fontSizeSM },
  });
}
