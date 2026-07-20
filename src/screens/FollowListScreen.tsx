import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AppImage from '../components/AppImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { fetchFollowers, fetchFollowing } from '../services/userService';
import { User } from '../types';
import { getFlagEmoji } from '../utils/flagEmoji';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import EmptyState from '../components/EmptyState';
import FollowButton from '../components/FollowButton';

type Tab = 'followers' | 'following';

export default function FollowListScreen({ route, navigation }: any) {
  const { userId, initialTab } = route.params as { userId: string; initialTab: Tab };
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.top);

  const [tab, setTab] = useState<Tab>(initialTab ?? 'followers');
  const [followers, setFollowers] = useState<User[] | null>(null);
  const [following, setFollowing] = useState<User[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [fwers, fwing] = await Promise.all([
        fetchFollowers(userId).catch(() => []),
        fetchFollowing(userId).catch(() => []),
      ]);
      if (!active) return;
      setFollowers(fwers);
      setFollowing(fwing);
    })();
    return () => { active = false; };
  }, [userId]);

  const data = tab === 'followers' ? followers : following;
  const loading = data === null;

  function renderRow({ item }: { item: User }) {
    const initials = `${item.firstName?.charAt(0) ?? ''}${item.lastName?.charAt(0) ?? ''}`.toUpperCase();
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => navigation.push('UserProfile', { userId: item.uid })}
      >
        <View style={styles.avatar}>
          {item.photoURL ? (
            <AppImage source={{ uri: item.photoURL }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {getFlagEmoji(item.countryCode)}  {item.nationality}
          </Text>
        </View>
        <FollowButton targetUid={item.uid} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ width: 24 }} />
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'followers' && styles.tabActive]} onPress={() => setTab('followers')}>
          <Text style={[styles.tabText, tab === 'followers' && styles.tabTextActive]}>
            {t('profile.followers')}{followers ? `  ${followers.length}` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'following' && styles.tabActive]} onPress={() => setTab('following')}>
          <Text style={[styles.tabText, tab === 'following' && styles.tabTextActive]}>
            {t('profile.followingCount')}{following ? `  ${following.length}` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.uid}
          renderItem={renderRow}
          contentContainerStyle={data.length === 0 ? styles.center : { paddingVertical: 8 }}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              text={tab === 'followers' ? t('profile.noFollowers') : t('profile.noFollowing')}
              topOffset={60}
            />
          }
        />
      )}
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
    },
    backBtn: { padding: 2 },
    tabs: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: c.primary },
    tabText: { fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightMedium, color: c.textSecondary },
    tabTextActive: { color: c.primary, fontWeight: Typography.fontWeightSemiBold },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    avatar: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center',
    },
    avatarImage: { width: 48, height: 48, borderRadius: 24 },
    avatarText: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightBold, color: c.primary },
    info: { flex: 1 },
    name: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemiBold, color: c.textPrimary },
    meta: { fontSize: Typography.fontSizeSM, color: c.textSecondary, marginTop: 2 },
  });
}