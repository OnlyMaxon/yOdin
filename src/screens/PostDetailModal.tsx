import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { usePostStore } from '../store/usePostStore';
import { votePost, addComment, fetchComments } from '../services/postService';
import { Post, PostComment } from '../types';
import { getFlagEmoji } from '../utils/flagEmoji';
import { formatTime } from '../utils/formatTime';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import PhotoGrid from '../components/PhotoGrid';

const SCREEN_H = Dimensions.get('window').height;
const SHEET_H = Math.round(SCREEN_H * 0.5);
const CARD_MAX = SCREEN_H - SHEET_H - 80; // card stays fully above the comments sheet

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
  const styles = makeStyles(colors, insets.bottom);
  const { profile } = useAuthStore();
  const storePost = usePostStore((s) => (postId ? s.posts.find((p) => p.id === postId) : undefined));
  const post = storePost ?? (fallbackPost && fallbackPost.id === postId ? fallbackPost : undefined);
  const setPostVote = usePostStore((s) => s.setPostVote);
  const incrementCommentCount = usePostStore((s) => s.incrementCommentCount);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const cardAnim = useRef(new Animated.Value(0)).current; // 0 hidden → 1 shown
  // 0 = comments closed (card centered, sheet hidden below); 1 = comments open
  // (sheet slid up from the bottom, card lifted above it).
  const commentsAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible && postId) {
      cardAnim.setValue(0);
      commentsAnim.setValue(startWithComments ? 1 : 0);
      Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }).start();
      setText('');
      setComments([]);
      loadComments(postId);
      setCommentsOpen(!!startWithComments);
    }
  }, [visible, postId]);

  // Slide the comments up, which lifts the centered post above them.
  useEffect(() => {
    Animated.timing(commentsAnim, {
      toValue: commentsOpen ? 1 : 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [commentsOpen]);

  async function loadComments(id: string) {
    setLoadingComments(true);
    try {
      setComments(await fetchComments(id));
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
      setComments((prev) => [...prev, { id, ...data, createdAt: Date.now() }]);
      incrementCommentCount(post.id);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  }

  function renderComment({ item }: { item: PostComment }) {
    const initials = item.authorName?.split(' ').map((w) => w[0]).join('').toUpperCase() ?? '?';
    return (
      <View style={styles.commentRow}>
        <TouchableOpacity
          style={styles.commentAvatar}
          activeOpacity={onOpenProfile ? 0.7 : 1}
          disabled={!onOpenProfile}
          onPress={() => item.authorId && onOpenProfile?.(item.authorId)}
        >
          {item.authorPhoto ? (
            <Image source={{ uri: item.authorPhoto }} style={styles.commentAvatarImg} />
          ) : (
            <Text style={styles.commentAvatarText}>{initials}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.commentBody}>
          <Text
            style={styles.commentAuthor}
            onPress={() => item.authorId && onOpenProfile?.(item.authorId)}
            suppressHighlighting
          >
            {item.authorName}  {getFlagEmoji(item.authorCountryCode)}
          </Text>
          <Text style={styles.commentText}>{item.text}</Text>
          <Text style={styles.commentTime}>{formatTime(item.createdAt, t)}</Text>
        </View>
      </View>
    );
  }

  // Lift the centered card into the upper half when the comments sheet is open.
  const cardShift = commentsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -Math.round(SHEET_H / 2)],
  });
  const sheetTranslate = commentsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_H, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.centerWrap} pointerEvents="box-none">
        {post && (
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardAnim,
                transform: [
                  { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                  { translateY: cardShift },
                ],
              },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={styles.cardHeader}>
                <TouchableOpacity
                  style={styles.authorTap}
                  activeOpacity={onOpenProfile ? 0.7 : 1}
                  disabled={!onOpenProfile}
                  onPress={() => post.authorId && onOpenProfile?.(post.authorId)}
                >
                  <View style={styles.avatar}>
                    {post.authorPhoto ? (
                      <Image source={{ uri: post.authorPhoto }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarText}>{post.authorName?.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.authorName}>{post.authorName}</Text>
                    <Text style={styles.authorMeta}>
                      {getFlagEmoji(post.authorCountryCode)}  {post.authorNationality}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {(() => {
                const imgs = post.imageURLs?.length ? post.imageURLs : (post.imageURL ? [post.imageURL] : []);
                return imgs.length ? (
                  <View style={styles.photoWrap}>
                    <PhotoGrid images={imgs} />
                  </View>
                ) : null;
              })()}

              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postDescription}>{post.description}</Text>
            </ScrollView>

            {/* Action bar — bottom-left like / dislike / comment */}
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
              <TouchableOpacity style={styles.actionBtn} onPress={() => setCommentsOpen((v) => !v)}>
                <Ionicons name="chatbubble-outline" size={20} color={commentsOpen ? colors.primary : colors.textSecondary} />
                {commentCount > 0 && <Text style={styles.actionCount}>{commentCount}</Text>}
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
        </View>

          {/* Comments slide up from the bottom; the centered card lifts above them */}
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslate }] }]}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.sheetHandleRow}>
              <View style={styles.sheetHandle} />
            </View>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('comments.title')}</Text>
              <TouchableOpacity onPress={() => setCommentsOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-down" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <View style={styles.sheetCenter}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={renderComment}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={comments.length === 0 ? styles.sheetCenter : styles.commentsList}
                ListEmptyComponent={
                  <Text style={styles.emptyComments}>{t('comments.empty')}</Text>
                }
              />
            )}

            <View style={styles.inputBar}>
              <TextInput
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
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendText}>↑</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
          </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ColorPalette, bottomInset: number) {
  return StyleSheet.create({
    overlay: { flex: 1 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    centerWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center' },
    card: {
      marginHorizontal: 16,
      maxHeight: CARD_MAX,
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.3,
      shadowRadius: 24,
      elevation: 24,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
    authorTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center',
    },
    avatarImg: { width: 44, height: 44, borderRadius: 22 },
    avatarText: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: c.primary },
    authorName: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemiBold, color: c.textPrimary },
    authorMeta: { fontSize: Typography.fontSizeSM, color: c.textSecondary, marginTop: 2 },
    postImage: { width: '100%', height: 160, borderRadius: 12, marginBottom: 12, backgroundColor: c.background },
    photoWrap: { marginBottom: 12 },
    postTitle: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: c.textPrimary, marginBottom: 6 },
    postDescription: { fontSize: Typography.fontSizeMD, color: c.textPrimary, lineHeight: 22, marginBottom: 8 },
    actionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      paddingTop: 12,
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionCount: { fontSize: Typography.fontSizeSM, color: c.textSecondary, fontWeight: Typography.fontWeightMedium },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: SHEET_H,
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 20,
    },
    sheetHandleRow: { alignItems: 'center', paddingTop: 10 },
    sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    sheetTitle: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: c.textPrimary },
    sheetCenter: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyComments: { fontSize: Typography.fontSizeMD, color: c.textSecondary, textAlign: 'center' },
    commentsList: { padding: 16, gap: 16 },
    commentRow: { flexDirection: 'row', gap: 10 },
    commentAvatar: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center',
    },
    commentAvatarImg: { width: 36, height: 36, borderRadius: 18 },
    commentAvatarText: { fontSize: Typography.fontSizeXS, fontWeight: Typography.fontWeightBold, color: c.primary },
    commentBody: { flex: 1 },
    commentAuthor: { fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightSemiBold, color: c.textPrimary },
    commentText: { fontSize: Typography.fontSizeMD, color: c.textPrimary, lineHeight: 20, marginTop: 2 },
    commentTime: { fontSize: Typography.fontSizeXS, color: c.textSecondary, marginTop: 4 },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingBottom: Math.max(bottomInset, 12) + 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
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
    sendText: { color: '#fff', fontSize: 20, fontWeight: Typography.fontWeightBold },
  });
}