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
} from 'react-native';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useFeedStore } from '../store/useFeedStore';
import { Reply, Discussion } from '../types';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

export default function DiscussionDetailScreen({ route, navigation }: any) {
  const { discussionId } = route.params;
  const { profile } = useAuthStore();
  const { incrementReplyCount } = useFeedStore();
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const discSnap = await getDoc(doc(db, 'discussions', discussionId));
      if (discSnap.exists()) setDiscussion({ id: discSnap.id, ...discSnap.data() } as Discussion);

      const repSnap = await getDocs(
        query(collection(db, 'discussions', discussionId, 'replies'), orderBy('createdAt', 'asc')),
      );
      setReplies(repSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Reply)));
    } finally {
      setLoading(false);
    }
  }

  async function sendReply() {
    if (!text.trim() || !profile || !discussion) return;
    setSending(true);
    try {
      const replyData = {
        discussionId,
        authorId: profile.uid,
        authorName: `${profile.firstName} ${profile.lastName}`,
        authorPhoto: profile.photoURL ?? '',
        authorNationality: profile.nationality,
        authorCountryCode: profile.countryCode,
        text: text.trim(),
        createdAt: serverTimestamp(),
      };

      const ref = await addDoc(
        collection(db, 'discussions', discussionId, 'replies'),
        replyData,
      );

      await updateDoc(doc(db, 'discussions', discussionId), {
        replyCount: increment(1),
      });

      // Уведомление автору дискуссии (если это не сам автор)
      if (discussion.authorId !== profile.uid) {
        await addDoc(collection(db, 'notifications'), {
          toUserId: discussion.authorId,
          type: 'reply',
          fromUserId: profile.uid,
          fromUserName: `${profile.firstName} ${profile.lastName}`,
          fromUserPhoto: profile.photoURL ?? '',
          discussionId,
          discussionQuestion: discussion.question,
          createdAt: serverTimestamp(),
          read: false,
        });
      }

      setReplies((prev) => [
        ...prev,
        { id: ref.id, ...replyData, createdAt: Date.now() as any },
      ]);
      incrementReplyCount(discussionId);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  }

  const flag = (code: string) =>
    code?.toUpperCase().split('').map((c) =>
      String.fromCodePoint(c.charCodeAt(0) + 127397)).join('') ?? '🌐';

  function renderReply({ item }: { item: Reply }) {
    const isMe = item.authorId === profile?.uid;
    const initials = item.authorName?.split(' ').map((w) => w[0]).join('').toUpperCase() ?? '?';
    return (
      <View style={[styles.replyRow, isMe && styles.replyRowMe]}>
        {!isMe && (
          <View style={styles.replyAvatar}>
            <Text style={styles.replyAvatarText}>{initials}</Text>
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
            <Text style={[styles.replyAvatarText, styles.replyAvatarTextMe]}>
              {`${profile?.firstName?.charAt(0) ?? ''}${profile?.lastName?.charAt(0) ?? ''}`.toUpperCase()}
            </Text>
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
        <Text style={styles.headerTitle} numberOfLines={1}>Discussion</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <>
          {discussion && (
            <View style={styles.questionBlock}>
              <View style={styles.questionAuthorRow}>
                <View style={styles.qAvatar}>
                  <Text style={styles.qAvatarText}>
                    {discussion.authorName?.charAt(0).toUpperCase()}
                  </Text>
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
                <Text style={styles.emptyText}>Be the first to reply 💬</Text>
              </View>
            }
          />
        </>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Write a reply..."
          placeholderTextColor={Colors.textSecondary}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 24, color: Colors.textPrimary },
  headerTitle: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
    flex: 1,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  questionBlock: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  questionAuthorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  qAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qAvatarText: {
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightBold,
    color: Colors.primary,
  },
  qAuthorName: {
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightSemiBold,
    color: Colors.textPrimary,
  },
  qAuthorMeta: { fontSize: Typography.fontSizeSM, color: Colors.textSecondary },
  questionText: {
    fontSize: Typography.fontSizeLG,
    color: Colors.textPrimary,
    lineHeight: 26,
    fontWeight: Typography.fontWeightMedium,
  },
  repliesList: { padding: 16, gap: 12, flexGrow: 1 },
  emptyReplies: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  replyRowMe: { justifyContent: 'flex-end' },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyAvatarMe: { backgroundColor: Colors.primary },
  replyAvatarText: {
    fontSize: Typography.fontSizeXS,
    fontWeight: Typography.fontWeightBold,
    color: Colors.primary,
  },
  replyAvatarTextMe: { color: '#fff' },
  replyBubble: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: '75%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  replyBubbleMe: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
    borderWidth: 0,
  },
  replyAuthor: {
    fontSize: Typography.fontSizeXS,
    fontWeight: Typography.fontWeightSemiBold,
    color: Colors.primary,
    marginBottom: 4,
  },
  replyText: { fontSize: Typography.fontSizeMD, color: Colors.textPrimary, lineHeight: 20 },
  replyTextMe: { color: '#fff' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: Typography.fontSizeMD,
    color: Colors.textPrimary,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#fff', fontSize: 20, fontWeight: Typography.fontWeightBold },
});
