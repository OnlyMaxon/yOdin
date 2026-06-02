import React, { useEffect, useState, useRef } from 'react';
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
  const { incrementReplyCount, toggleSaved } = useFeedStore();
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
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
    const initials = item.authorName?.split(' ').map((w) => w[0]).join('').toUpperCase() ?? '?';
    return (
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
        <View style={[styles.replyBubble, isMe && styles.replyBubbleMe]}>
          {!isMe && (
            <Text style={styles.replyAuthor}>
              {item.authorName}  {flag(item.authorCountryCode)}
            </Text>
          )}
          <Text style={[styles.replyText, isMe && styles.replyTextMe]}>{item.text}</Text>
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
            <View style={styles.questionBlock}>
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
                <View>
                  <Text style={styles.qAuthorName}>{discussion.authorName}</Text>
                  <Text style={styles.qAuthorMeta}>
                    {flag(discussion.authorCountryCode)}  {discussion.authorNationality}
                  </Text>
                </View>
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
    questionText: {
      fontSize: Typography.fontSizeLG,
      color: c.textPrimary,
      lineHeight: 26,
      fontWeight: Typography.fontWeightMedium,
    },
    repliesList: { padding: 16, gap: 12, flexGrow: 1 },
    emptyReplies: { alignItems: 'center', paddingTop: 40 },
    emptyText: { fontSize: Typography.fontSizeMD, color: c.textSecondary },
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
    replyAuthor: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.primary,
      marginBottom: 4,
    },
    replyText: { fontSize: Typography.fontSizeMD, color: c.textPrimary, lineHeight: 20 },
    replyTextMe: { color: '#fff' },
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
