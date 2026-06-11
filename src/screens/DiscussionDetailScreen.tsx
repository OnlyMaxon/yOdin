import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { useFeedStore } from '../store/useFeedStore';
import {
  fetchDiscussionById,
  fetchReplies,
  addReply,
  saveDiscussion,
  unsaveDiscussion,
  voteReply,
  acceptReply,
} from '../services/discussionService';
import { createNotification } from '../services/notificationService';
import { Reply, Discussion } from '../types';
import { getFlagEmoji } from '../utils/flagEmoji';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

export default function DiscussionDetailScreen({ route, navigation }: any) {
  const { discussionId, question: questionParam } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top);
  const { profile } = useAuthStore();
  const { incrementReplyCount, toggleSaved, setAcceptedReply } = useFeedStore();
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const disc = await fetchDiscussionById(discussionId);
      if (disc) setDiscussion(disc);
      const reps = await fetchReplies(discussionId);
      setReplies(reps);
    } catch (e: any) {
      setError(e.message ?? t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  // Accepted answer is pinned to the top of the list
  const sortedReplies = useMemo(() => {
    const acceptedId = discussion?.acceptedReplyId;
    if (!acceptedId) return replies;
    const accepted = replies.find((r) => r.id === acceptedId);
    if (!accepted) return replies;
    return [accepted, ...replies.filter((r) => r.id !== acceptedId)];
  }, [replies, discussion?.acceptedReplyId]);

  const isAnswered = !!discussion?.acceptedReplyId;
  const isQuestionAuthor = discussion?.authorId === profile?.uid;

  async function sendReply() {
    if (!text.trim() || !profile || !discussion) return;
    setSending(true);
    try {
      const replyData: Omit<Reply, 'id' | 'createdAt'> = {
        discussionId,
        authorId: profile.uid,
        authorName: `${profile.firstName} ${profile.lastName}`,
        authorPhoto: profile.photoURL ?? '',
        authorNationality: profile.nationality,
        authorCountryCode: profile.countryCode,
        text: text.trim(),
        likes: [],
        dislikes: [],
      };

      const replyId = await addReply(discussionId, replyData);

      if (discussion.authorId !== profile.uid) {
        await createNotification({
          toUserId: discussion.authorId,
          fromUserId: profile.uid,
          fromUserName: `${profile.firstName} ${profile.lastName}`,
          fromUserPhoto: profile.photoURL ?? '',
          discussionId,
          discussionQuestion: discussion.question,
        });
      }

      setReplies((prev) => [
        ...prev,
        { id: replyId, ...replyData, createdAt: Date.now() as any },
      ]);
      incrementReplyCount(discussionId);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  }

  async function handleVote(reply: Reply, vote: 'like' | 'dislike') {
    if (!profile?.uid || reply.authorId === profile.uid) return;
    const uid = profile.uid;
    const liked = reply.likes?.includes(uid) ?? false;
    const disliked = reply.dislikes?.includes(uid) ?? false;

    function applyVote(r: Reply): Reply {
      let likes = (r.likes ?? []).filter((id) => id !== uid);
      let dislikes = (r.dislikes ?? []).filter((id) => id !== uid);
      if (vote === 'like' && !liked) likes = [...likes, uid];
      if (vote === 'dislike' && !disliked) dislikes = [...dislikes, uid];
      return { ...r, likes, dislikes };
    }

    const prevReplies = replies;
    setReplies((prev) => prev.map((r) => (r.id === reply.id ? applyVote(r) : r)));
    try {
      await voteReply(discussionId, reply.id, uid, vote, { liked, disliked });
    } catch {
      setReplies(prevReplies);
    }
  }

  async function handleAccept(reply: Reply) {
    if (!profile || !discussion || accepting || discussion.acceptedReplyId) return;
    setAccepting(true);
    const prevDiscussion = discussion;
    setDiscussion({ ...discussion, acceptedReplyId: reply.id });
    try {
      await acceptReply(discussionId, reply.id, reply.authorId);
      setAcceptedReply(discussionId, reply.id);
      if (reply.authorId !== profile.uid) {
        await createNotification(
          {
            toUserId: reply.authorId,
            fromUserId: profile.uid,
            fromUserName: `${profile.firstName} ${profile.lastName}`,
            fromUserPhoto: profile.photoURL ?? '',
            discussionId,
            discussionQuestion: discussion.question,
          },
          'accepted',
        );
      }
      setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
    } catch {
      setDiscussion(prevDiscussion);
    } finally {
      setAccepting(false);
    }
  }

  const isSaved = discussion?.savedBy?.includes(profile?.uid ?? '') ?? false;

  async function handleSave() {
    if (!profile?.uid || !discussion) return;
    const saved = discussion.savedBy?.includes(profile.uid) ?? false;
    setDiscussion((prev) => {
      if (!prev) return prev;
      const savedBy = prev.savedBy ?? [];
      return {
        ...prev,
        savedBy: saved ? savedBy.filter((id) => id !== profile.uid) : [...savedBy, profile.uid],
      };
    });
    toggleSaved(discussion.id, profile.uid);
    try {
      if (saved) await unsaveDiscussion(profile.uid, discussion.id);
      else await saveDiscussion(profile.uid, discussion.id);
    } catch {
      setDiscussion((prev) => {
        if (!prev) return prev;
        const savedBy = prev.savedBy ?? [];
        return {
          ...prev,
          savedBy: saved ? [...savedBy, profile.uid] : savedBy.filter((id) => id !== profile.uid),
        };
      });
      toggleSaved(discussion.id, profile.uid);
    }
  }

  const flag = getFlagEmoji;

  function renderReply({ item }: { item: Reply }) {
    const isMe = item.authorId === profile?.uid;
    const isAccepted = item.id === discussion?.acceptedReplyId;
    const initials = item.authorName?.split(' ').map((w) => w[0]).join('').toUpperCase() ?? '?';
    const liked = item.likes?.includes(profile?.uid ?? '') ?? false;
    const disliked = item.dislikes?.includes(profile?.uid ?? '') ?? false;
    const likeCount = item.likes?.length ?? 0;
    const dislikeCount = item.dislikes?.length ?? 0;
    const canAccept = isQuestionAuthor && !isAnswered && !isMe;

    return (
      <View style={[styles.replyWrap, isAccepted && styles.replyWrapAccepted]}>
        {isAccepted && (
          <View style={styles.acceptedHeader}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.acceptedHeaderText}>{t('discussion.acceptedAnswer')}</Text>
          </View>
        )}
        <View style={[styles.replyRow, isMe && styles.replyRowMe]}>
          {!isMe && (
            <View style={styles.replyAvatar}>
              {item.authorPhoto ? (
                <Image source={{ uri: item.authorPhoto }} style={styles.replyAvatarImage} />
              ) : (
                <Text style={styles.replyAvatarText}>{initials}</Text>
              )}
            </View>
          )}
          <View style={[styles.replyBubble, isMe && styles.replyBubbleMe, isAccepted && styles.replyBubbleAccepted]}>
            {!isMe && (
              <Text style={styles.replyAuthor}>
                {item.authorName}  {flag(item.authorCountryCode)}
              </Text>
            )}
            <Text style={[styles.replyText, isMe && !isAccepted && styles.replyTextMe]}>{item.text}</Text>
          </View>
          {isMe && (
            <View style={[styles.replyAvatar, styles.replyAvatarMe]}>
              {profile?.photoURL ? (
                <Image source={{ uri: profile.photoURL }} style={styles.replyAvatarImage} />
              ) : (
                <Text style={[styles.replyAvatarText, styles.replyAvatarTextMe]}>
                  {`${profile?.firstName?.charAt(0) ?? ''}${profile?.lastName?.charAt(0) ?? ''}`.toUpperCase()}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={[styles.replyActions, isMe && styles.replyActionsMe]}>
          <TouchableOpacity
            style={styles.voteBtn}
            onPress={() => handleVote(item, 'like')}
            disabled={isMe}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={liked ? 'thumbs-up' : 'thumbs-up-outline'}
              size={16}
              color={liked ? colors.primary : colors.textSecondary}
            />
            {likeCount > 0 && (
              <Text style={[styles.voteCount, liked && { color: colors.primary }]}>{likeCount}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.voteBtn}
            onPress={() => handleVote(item, 'dislike')}
            disabled={isMe}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons
              name={disliked ? 'thumbs-down' : 'thumbs-down-outline'}
              size={16}
              color={disliked ? colors.notification : colors.textSecondary}
            />
            {dislikeCount > 0 && (
              <Text style={[styles.voteCount, disliked && { color: colors.notification }]}>{dislikeCount}</Text>
            )}
          </TouchableOpacity>
          {canAccept && (
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => handleAccept(item)}
              disabled={accepting}
            >
              <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
              <Text style={styles.acceptBtnText}>{t('discussion.markHelped')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{t('discussion.title')}</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={isSaved ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <>
          <View style={styles.questionBlock}>
            <Text style={styles.questionText}>{questionParam}</Text>
          </View>
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        </>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.notification, textAlign: 'center', padding: 24 }}>{error}</Text>
        </View>
      ) : (
        <>
          {discussion && (
            <View style={[styles.questionBlock, isAnswered && styles.questionBlockAnswered]}>
              <View style={styles.questionAuthorRow}>
                <View style={styles.qAvatar}>
                  {discussion.authorPhoto ? (
                    <Image source={{ uri: discussion.authorPhoto }} style={styles.qAvatarImage} />
                  ) : (
                    <Text style={styles.qAvatarText}>
                      {discussion.authorName?.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.qAuthorName}>{discussion.authorName}</Text>
                  <Text style={styles.qAuthorMeta}>
                    {flag(discussion.authorCountryCode)}  {discussion.authorNationality}
                  </Text>
                </View>
                {isAnswered && (
                  <View style={styles.answeredBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#fff" />
                    <Text style={styles.answeredBadgeText}>{t('forum.answered')}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.questionText}>{discussion.question}</Text>
            </View>
          )}

          <FlatList
            ref={listRef}
            data={sortedReplies}
            keyExtractor={(item) => item.id}
            renderItem={renderReply}
            contentContainerStyle={styles.repliesList}
            ListEmptyComponent={
              <View style={styles.emptyReplies}>
                <Text style={styles.emptyText}>{t('discussion.firstReply')}</Text>
              </View>
            }
          />
        </>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder={t('discussion.replyPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendReply}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.sendText}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ColorPalette, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: topInset + 12,
      paddingBottom: 12,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: 12,
    },
    backBtn: { padding: 4 },
    backText: { fontSize: 24, color: c.textPrimary },
    headerTitle: {
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
      flex: 1,
    },
    saveBtn: { padding: 4 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    questionBlock: {
      backgroundColor: c.surface,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    questionBlockAnswered: {
      backgroundColor: c.success + '18',
      borderBottomColor: c.success,
      borderBottomWidth: 1.5,
    },
    questionAuthorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
    qAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qAvatarText: {
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightBold,
      color: c.primary,
    },
    qAvatarImage: { width: 40, height: 40, borderRadius: 20 },
    replyAvatarImage: { width: 32, height: 32, borderRadius: 16 },
    qAuthorName: {
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.textPrimary,
    },
    qAuthorMeta: { fontSize: Typography.fontSizeSM, color: c.textSecondary },
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
    questionText: {
      fontSize: Typography.fontSizeLG,
      color: c.textPrimary,
      lineHeight: 26,
      fontWeight: Typography.fontWeightMedium,
    },
    repliesList: { padding: 16, gap: 16, flexGrow: 1 },
    emptyReplies: { alignItems: 'center', paddingTop: 40 },
    emptyText: { fontSize: Typography.fontSizeMD, color: c.textSecondary },
    replyWrap: {},
    replyWrapAccepted: {
      backgroundColor: c.success + '14',
      borderWidth: 1.5,
      borderColor: c.success,
      borderRadius: 16,
      padding: 10,
    },
    acceptedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    acceptedHeaderText: {
      fontSize: Typography.fontSizeSM,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.success,
    },
    replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    replyRowMe: { justifyContent: 'flex-end' },
    replyAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    replyAvatarMe: { backgroundColor: c.primary },
    replyAvatarText: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightBold,
      color: c.primary,
    },
    replyAvatarTextMe: { color: '#fff' },
    replyBubble: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderBottomLeftRadius: 4,
      padding: 12,
      maxWidth: '75%',
      borderWidth: 1,
      borderColor: c.border,
    },
    replyBubbleMe: {
      backgroundColor: c.primary,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 4,
      borderWidth: 0,
    },
    replyBubbleAccepted: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.success,
    },
    replyAuthor: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.primary,
      marginBottom: 4,
    },
    replyText: { fontSize: Typography.fontSizeMD, color: c.textPrimary, lineHeight: 20 },
    replyTextMe: { color: '#fff' },
    replyActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginTop: 6,
      marginLeft: 44,
    },
    replyActionsMe: {
      justifyContent: 'flex-end',
      marginLeft: 0,
      marginRight: 44,
    },
    voteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    voteCount: {
      fontSize: Typography.fontSizeXS,
      color: c.textSecondary,
      fontWeight: Typography.fontWeightMedium,
    },
    acceptBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.success,
    },
    acceptBtnText: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.success,
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingBottom: Platform.OS === 'ios' ? 28 : 12,
      backgroundColor: c.surface,
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
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendText: { color: '#fff', fontSize: 20, fontWeight: Typography.fontWeightBold },
  });
}
