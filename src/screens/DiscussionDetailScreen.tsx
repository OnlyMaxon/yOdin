import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
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
import { TAB_BAR_HEIGHT } from '../constants/layout';

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
  const [sendError, setSendError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [replyingTo, setReplyingTo] = useState<Reply | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadAll();
  }, []);

  // KeyboardAvoidingView misreads its frame inside the material-top-tabs pager,
  // so we lift the composer manually. The bar sits above the bottom tab bar, so
  // the lift is the keyboard height minus the tab bar it already clears.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) =>
      setKeyboardHeight(e.endCoordinates?.height ?? 0),
    );
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const keyboardLift =
    keyboardHeight > 0 ? Math.max(keyboardHeight - TAB_BAR_HEIGHT - insets.bottom, 0) : 0;

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

  // Telegram-style chat: messages stay in a flat chronological stream. A reply
  // to a specific message just references it (parentReplyId) and shows a quote;
  // this map lets a bubble render the quoted message and jump to it.
  const replyById = useMemo(() => {
    const m = new Map<string, Reply>();
    for (const r of replies) m.set(r.id, r);
    return m;
  }, [replies]);

  const isAnswered = !!discussion?.acceptedReplyId;
  const isQuestionAuthor = discussion?.authorId === profile?.uid;

  async function sendReply() {
    if (!text.trim() || !profile || !discussion) return;
    setSending(true);
    setSendError('');
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
        parentReplyId: replyingTo?.id ?? null,
      };

      const replyId = await addReply(discussionId, replyData);

      // Notify whoever is being answered: the parent reply's author for a
      // threaded reply, otherwise the question author.
      const recipientId = replyingTo?.authorId ?? discussion.authorId;
      if (recipientId !== profile.uid) {
        await createNotification({
          toUserId: recipientId,
          fromUserId: profile.uid,
          fromUserName: `${profile.firstName} ${profile.lastName}`,
          fromUserPhoto: profile.photoURL ?? '',
          discussionId,
          discussionQuestion: discussion.question,
        });
      }

      setReplies((prev) => [
        ...prev,
        { id: replyId, ...replyData, createdAt: Date.now() },
      ]);
      incrementReplyCount(discussionId);
      setText('');
      setReplyingTo(null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setSendError(e?.message ?? t('errors.generic'));
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

  function confirmAccept(reply: Reply) {
    Alert.alert(
      t('discussion.confirmAcceptTitle'),
      t('discussion.confirmAccept'),
      [
        { text: t('discussion.no'), style: 'cancel' },
        { text: t('discussion.yes'), onPress: () => handleAccept(reply) },
      ],
    );
  }

  async function handleAccept(reply: Reply) {
    if (!profile || !discussion || accepting || discussion.acceptedReplyId) return;
    setAccepting(true);
    const prevDiscussion = discussion;
    setDiscussion({
      ...discussion,
      acceptedReplyId: reply.id,
      acceptedReplyText: reply.text,
      acceptedReplyAuthorName: reply.authorName,
    });
    try {
      await acceptReply(discussionId, reply.id, reply.authorId, reply.text, reply.authorName);
      setAcceptedReply(discussionId, reply.id, reply.text, reply.authorName);
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
    } catch (e: any) {
      setDiscussion(prevDiscussion);
      Alert.alert(t('errors.generic'), e?.message ?? '');
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

  function startReplyTo(reply: Reply) {
    setReplyingTo(reply);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // Jump to a quoted message and briefly flash it (Telegram-style).
  function scrollToMessage(id: string) {
    const idx = replies.findIndex((r) => r.id === id);
    if (idx < 0) return;
    listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.4, animated: true });
    setHighlightedId(id);
    setTimeout(() => setHighlightedId((cur) => (cur === id ? null : cur)), 1500);
  }

  function renderReply({ item }: { item: Reply }) {
    const isMe = item.authorId === profile?.uid;
    const isAccepted = item.id === discussion?.acceptedReplyId;
    const isHighlighted = item.id === highlightedId;
    const initials = item.authorName?.split(' ').map((w) => w[0]).join('').toUpperCase() ?? '?';
    const liked = item.likes?.includes(profile?.uid ?? '') ?? false;
    const disliked = item.dislikes?.includes(profile?.uid ?? '') ?? false;
    const likeCount = item.likes?.length ?? 0;
    const dislikeCount = item.dislikes?.length ?? 0;
    const canAccept = isQuestionAuthor && !isAnswered && !isMe;
    const parent = item.parentReplyId ? replyById.get(item.parentReplyId) : undefined;

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        {!isMe && (
          <View style={styles.msgAvatar}>
            {item.authorPhoto ? (
              <Image source={{ uri: item.authorPhoto }} style={styles.msgAvatarImage} />
            ) : (
              <Text style={styles.msgAvatarText}>{initials}</Text>
            )}
          </View>
        )}
        <View style={styles.msgContent}>
          <View
            style={[
              styles.bubble,
              isMe ? styles.bubbleMe : styles.bubbleOther,
              isAccepted && styles.bubbleAccepted,
              isHighlighted && styles.bubbleHighlight,
            ]}
          >
            {isAccepted && (
              <View style={styles.acceptedHeader}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.acceptedHeaderText}>{t('discussion.acceptedAnswer')}</Text>
              </View>
            )}
            {!isMe && (
              <Text style={styles.bubbleAuthor} numberOfLines={1}>
                {item.authorName}  {flag(item.authorCountryCode)}
              </Text>
            )}
            {parent && (
              <TouchableOpacity
                style={[styles.quote, isMe && styles.quoteMe]}
                onPress={() => scrollToMessage(parent.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quoteAuthor, isMe && styles.quoteTextMe]} numberOfLines={1}>
                  {parent.authorName}
                </Text>
                <Text style={[styles.quoteText, isMe && styles.quoteTextMe]} numberOfLines={1}>
                  {parent.text}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.text}</Text>
          </View>

          <View style={[styles.msgActions, isMe ? styles.msgActionsMe : styles.msgActionsOther]}>
            <TouchableOpacity
              style={styles.voteBtn}
              onPress={() => handleVote(item, 'like')}
              disabled={isMe}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name={liked ? 'thumbs-up' : 'thumbs-up-outline'}
                size={15}
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
                size={15}
                color={disliked ? colors.notification : colors.textSecondary}
              />
              {dislikeCount > 0 && (
                <Text style={[styles.voteCount, disliked && { color: colors.notification }]}>{dislikeCount}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.voteBtn}
              onPress={() => startReplyTo(item)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="arrow-undo-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.voteCount}>{t('discussion.reply')}</Text>
            </TouchableOpacity>
            {canAccept && (
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => confirmAccept(item)}
                disabled={accepting}
              >
                <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
                <Text style={styles.acceptBtnText}>{t('discussion.markHelped')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
            data={replies}
            keyExtractor={(item) => item.id}
            renderItem={renderReply}
            contentContainerStyle={styles.repliesList}
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: Math.max(0, info.averageItemLength * info.index),
                animated: true,
              });
              setTimeout(
                () => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.4 }),
                300,
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyReplies}>
                <Text style={styles.emptyText}>{t('discussion.firstReply')}</Text>
              </View>
            }
          />
        </>
      )}

      {sendError ? (
        <Text style={styles.sendErrorText}>{sendError}</Text>
      ) : null}
      {replyingTo ? (
        <View style={styles.replyingToBar}>
          <Ionicons name="arrow-undo-outline" size={14} color={colors.primary} />
          <Text style={styles.replyingToText} numberOfLines={1}>
            {t('discussion.replyingTo', { name: replyingTo.authorName })}
          </Text>
          <TouchableOpacity
            onPress={() => setReplyingTo(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : null}
      <View
        style={[
          styles.inputBar,
          {
            marginBottom: keyboardLift,
            paddingBottom: keyboardHeight > 0 ? 12 : undefined,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={t('discussion.replyPlaceholder')}
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={(v) => { setText(v); if (sendError) setSendError(''); }}
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
    </View>
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
    msgAvatarImage: { width: 30, height: 30, borderRadius: 15 },
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
    repliesList: { padding: 16, gap: 10, flexGrow: 1 },
    emptyReplies: { alignItems: 'center', paddingTop: 40 },
    emptyText: { fontSize: Typography.fontSizeMD, color: c.textSecondary },
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    msgRowMe: { justifyContent: 'flex-end' },
    msgRowOther: { justifyContent: 'flex-start' },
    msgAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    msgAvatarText: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightBold,
      color: c.primary,
    },
    msgContent: { maxWidth: '82%' },
    bubble: {
      borderRadius: 16,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    bubbleOther: {
      backgroundColor: c.surface,
      borderBottomLeftRadius: 4,
      borderWidth: 1,
      borderColor: c.border,
      alignSelf: 'flex-start',
    },
    bubbleMe: {
      backgroundColor: c.primary,
      borderBottomRightRadius: 4,
      alignSelf: 'flex-end',
    },
    bubbleAccepted: {
      borderColor: c.success,
      borderWidth: 1.5,
    },
    bubbleHighlight: {
      borderColor: c.accent,
      borderWidth: 2,
    },
    acceptedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 6,
    },
    acceptedHeaderText: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.success,
    },
    bubbleAuthor: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.primary,
      marginBottom: 4,
    },
    quote: {
      borderLeftWidth: 3,
      borderLeftColor: c.primary,
      backgroundColor: c.primaryLight,
      borderRadius: 6,
      paddingVertical: 5,
      paddingHorizontal: 8,
      marginBottom: 6,
      gap: 2,
    },
    quoteMe: {
      borderLeftColor: '#fff',
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    quoteAuthor: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.primary,
    },
    quoteText: {
      fontSize: Typography.fontSizeXS,
      color: c.textSecondary,
    },
    quoteTextMe: { color: 'rgba(255,255,255,0.92)' },
    msgText: { fontSize: Typography.fontSizeMD, color: c.textPrimary, lineHeight: 21 },
    msgTextMe: { color: '#fff' },
    msgActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginTop: 5,
      paddingHorizontal: 4,
    },
    msgActionsMe: { justifyContent: 'flex-end' },
    msgActionsOther: { justifyContent: 'flex-start' },
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
    replyingToBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: c.primaryLight,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    replyingToText: {
      flex: 1,
      fontSize: Typography.fontSizeSM,
      color: c.primary,
      fontWeight: Typography.fontWeightMedium,
    },
    sendErrorText: {
      fontSize: Typography.fontSizeSM,
      color: c.notification,
      paddingHorizontal: 20,
      paddingVertical: 6,
      backgroundColor: c.surface,
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
