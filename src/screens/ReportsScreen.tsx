import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/useAuthStore';
import { subscribeReports, resolveReport, removeReportedContent } from '../services/reportService';
import { fetchPostById } from '../services/postService';
import { Report, Post, ReportTargetType } from '../types';
import { formatTime } from '../utils/formatTime';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import PostDetailModal from './PostDetailModal';

// Per-target-type badge styling. Each report can target a post, forum question,
// comment or reply.
const TYPE_META: Record<ReportTargetType, { icon: any; labelKey: string; color: (c: ColorPalette) => string }> = {
  post: { icon: 'newspaper-outline', labelKey: 'moderation.typePost', color: (c) => c.primary },
  discussion: { icon: 'chatbubbles-outline', labelKey: 'moderation.typeDiscussion', color: (c) => c.accent },
  comment: { icon: 'chatbubble-outline', labelKey: 'moderation.typeComment', color: (c) => c.success },
  reply: { icon: 'arrow-undo-outline', labelKey: 'moderation.typeReply', color: (c) => c.notification },
};

export default function ReportsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top);
  const isModerator = useAuthStore((s) => s.isModerator);

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    if (!isModerator) return;
    const unsub = subscribeReports((all) => {
      setReports(all.filter((r) => r.status === 'pending'));
      setLoading(false);
    });
    return unsub;
  }, [isModerator]);

  // Defensive: this screen is only reachable by moderators, but never render
  // moderation tools to a non-moderator even if the route is somehow opened.
  if (!isModerator) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('moderation.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('errors.generic')}</Text>
        </View>
      </View>
    );
  }

  async function openTarget(report: Report) {
    // Forum question, or a reply under one → open the discussion thread.
    if (report.targetType === 'discussion' || report.targetType === 'reply') {
      const discussionId = report.targetType === 'reply'
        ? report.targetPath?.split('/')[1]
        : report.targetId;
      if (!discussionId) { Alert.alert(t('moderation.alreadyGone')); return; }
      navigation.navigate('DiscussionDetail', { discussionId, question: report.targetType === 'discussion' ? report.targetTitle : '' });
      return;
    }
    // Post, or a comment under one → open the post detail.
    const postId = report.targetType === 'comment' ? report.targetPath?.split('/')[1] : report.targetId;
    const post = postId ? await fetchPostById(postId).catch(() => null) : null;
    if (!post) {
      Alert.alert(t('moderation.alreadyGone'));
      return;
    }
    setDetailPost(post);
    setDetailVisible(true);
  }

  function confirmRemove(report: Report) {
    Alert.alert(
      t('moderation.removeTitle'),
      t('moderation.removeMessage'),
      [
        { text: t('report.cancel'), style: 'cancel' },
        {
          text: t('moderation.remove'),
          style: 'destructive',
          onPress: () => doRemove(report),
        },
      ],
    );
  }

  async function doRemove(report: Report) {
    setBusyId(report.id);
    try {
      // Delete the content; the onReportUpdated Cloud Function then notifies the
      // author and applies a moderation strike (→ comment ban after 5).
      await removeReportedContent(report);
      await resolveReport(report.id, 'removed');
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setBusyId(null);
    }
  }

  async function doKeep(report: Report) {
    setBusyId(report.id);
    try {
      await resolveReport(report.id, 'kept');
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setBusyId(null);
    }
  }

  function renderReport({ item }: { item: Report }) {
    const meta = TYPE_META[item.targetType];
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.typeBadge, { backgroundColor: meta.color(colors) }]}>
            <Ionicons name={meta.icon} size={12} color="#fff" />
            <Text style={styles.typeBadgeText}>{t(meta.labelKey)}</Text>
          </View>
          <Text style={styles.time}>{formatTime(item.createdAt, t)}</Text>
        </View>

        {item.reason ? (
          <Text style={styles.reason}>{t(`report.reasons.${item.reason}`, { defaultValue: item.reason })}</Text>
        ) : null}
        <Text style={styles.targetTitle} numberOfLines={3}>{item.targetTitle}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.viewBtn]} onPress={() => openTarget(item)} disabled={busyId === item.id}>
            <Ionicons name="eye-outline" size={16} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>{t('moderation.view')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.keepBtn]} onPress={() => doKeep(item)} disabled={busyId === item.id}>
            <Ionicons name="checkmark" size={16} color={colors.success} />
            <Text style={[styles.actionText, { color: colors.success }]}>{t('moderation.keep')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.removeBtn]} onPress={() => confirmRemove(item)} disabled={busyId === item.id}>
            <Ionicons name="trash-outline" size={16} color={colors.notification} />
            <Text style={[styles.actionText, { color: colors.notification }]}>{t('moderation.remove')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('moderation.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={renderReport}
        contentContainerStyle={reports.length === 0 ? styles.center : { padding: 16, gap: 12 }}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>✅</Text>
              <Text style={styles.emptyText}>{t('moderation.empty')}</Text>
            </View>
          )
        }
      />

      <PostDetailModal
        visible={detailVisible}
        postId={detailPost?.id ?? null}
        fallbackPost={detailPost}
        onClose={() => setDetailVisible(false)}
        onOpenProfile={(userId) => {
          setDetailVisible(false);
          setTimeout(() => navigation.navigate('UserProfile', { userId }), 250);
        }}
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
    title: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: c.textPrimary },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyText: { fontSize: Typography.fontSizeMD, color: c.textSecondary, textAlign: 'center' },
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    typeBadgeText: { color: '#fff', fontSize: Typography.fontSizeXS, fontWeight: Typography.fontWeightSemiBold },
    time: { fontSize: Typography.fontSizeXS, color: c.textSecondary },
    reason: { fontSize: Typography.fontSizeSM, color: c.notification, fontWeight: Typography.fontWeightSemiBold, marginBottom: 4 },
    targetTitle: { fontSize: Typography.fontSizeMD, color: c.textPrimary, lineHeight: 21, marginBottom: 14 },
    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
    },
    viewBtn: { borderColor: c.primary },
    keepBtn: { borderColor: c.success },
    removeBtn: { borderColor: c.notification },
    actionText: { fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightSemiBold },
  });
}
