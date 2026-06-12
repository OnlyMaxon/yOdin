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
import { PostComment } from '../types';
import { getFlagEmoji } from '../utils/flagEmoji';
import { formatTime } from '../utils/formatTime';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

const SCREEN_H = Dimensions.get('window').height;
const SHEET_H = Math.round(SCREEN_H * 0.5);
const CARD_MAX = SCREEN_H - SHEET_H - 80; // card stays fully above the comments sheet

interface Props {
  visible: boolean;
  postId: string | null;
  startWithComments?: boolean;
  onClose: () => void;
}

export default function PostDetailModal({ visible, postId, startWithComments, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.bottom);
  const { profile } = useAuthStore();
  const post = usePostStore((s) => (postId ? s.posts.find((p) => p.id === postId) : undefined));
  const setPostVote = usePostStore((s) => s.setPostVote);
  const incrementCommentCount = usePostStore((s) => s.incrementCommentCount);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const cardAnim = useRef(new Animated.Value(0)).current; // 0 hidden → 1 shown
  // Shared post+comments column offset: SHEET_H = comments hidden (post sits low),
  // 0 = comments slid up (and the post pushed up above them).
  const stackAnim = useRef(new Animated.Value(SHEET_H)).current;
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible && postId) {
      cardAnim.setValue(0);
      Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }).start();
      setText('');
      setComments([]);
      loadComments(postId);
      setCommentsOpen(!!startWithComments);
    }
  }, [visible, postId]);

  // Slide the comments up, which pushes the post up so they never overlap it.
  useEffect(() => {
    Animated.timing(stackAnim, {
      toValue: commentsOpen ? 0 : SHEET_H,
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
        <View style={styles.commentAvatar}>
          {item.authorPhoto ? (
            <Image source={{ uri: item.authorPhoto }} style={styles.commentAvatarImg} />
          ) : (
            <Text style={styles.commentAvatarText}>{initials}</Text>
          )}
        </View>
        <View style={styles.commentBody}>
          <Text style={styles.commentAuthor}>
            {item.authorName}  {getFlagEmoji(item.authorCountryCode)}
          </Text>
          <Text style={styles.commentText}>{item.text}</Text>
          <Text style={styles.commentTime}>{formatTime(item.createdAt, t)}</Text>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[styles.stack, { transform: [{ translateY: stackAnim }] }]}>
        {post && (
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardAnim,
                transform: [
                  { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                ],
              },
            ]}
          >
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={styles.cardHeader}>
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
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {post.imageURL ? (
                <Image source={{ uri: post.imageURL }} style={styles.postImage} resizeMode="cover" />
              ) : null}

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

          {/* Comments share the bottom column with the post, pushing it up */}
          <View style={styles.sheet}>
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
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ColorPalette, bottomInset: number) {
  return StyleSheet.create({
    overlay: { flex: 1 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    stack: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    card: {
      marginHorizontal: 16,
      marginBottom: 12,
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
    avatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center',
    },
    avatarImg: { width: 44, height: 44, borderRadius: 22 },
    avatarText: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: c.primary },
    authorName: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemiBold, color: c.textPrimary },
    authorMeta: { fontSize: Typography.fontSizeSM, color: c.textSecondary, marginTop: 2 },
    postImage: { width: '100%', height: 160, borderRadius: 12, marginBottom: 12, backgroundColor: c.background },
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