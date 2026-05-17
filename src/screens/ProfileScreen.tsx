import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { logoutUser } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import { Discussion } from '../types';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { profile, reset } = useAuthStore();
  const [tab, setTab] = useState<'mine' | 'saved'>('mine');
  const [myDiscussions, setMyDiscussions] = useState<Discussion[]>([]);
  const [savedDiscussions, setSavedDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuAnim = useState(new Animated.Value(-SCREEN_WIDTH * 0.7))[0];

  useEffect(() => {
    if (profile?.uid) loadDiscussions();
  }, [profile?.uid]);

  useEffect(() => {
    Animated.timing(menuAnim, {
      toValue: menuVisible ? 0 : -SCREEN_WIDTH * 0.7,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [menuVisible]);

  async function loadDiscussions() {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      const mySnap = await getDocs(
        query(
          collection(db, 'discussions'),
          where('authorId', '==', profile.uid),
          orderBy('createdAt', 'desc'),
        ),
      );
      setMyDiscussions(mySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Discussion)));

      const savedSnap = await getDocs(
        query(
          collection(db, 'discussions'),
          where('savedBy', 'array-contains', profile.uid),
        ),
      );
      setSavedDiscussions(savedSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Discussion)));
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setMenuVisible(false);
    await logoutUser();
    reset();
  }

  const flag = profile?.countryCode
    ? profile.countryCode.toUpperCase().split('').map((c: string) =>
        String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
    : '🌐';

  const initials = profile
    ? `${profile.firstName?.charAt(0) ?? ''}${profile.lastName?.charAt(0) ?? ''}`.toUpperCase()
    : '?';

  const data = tab === 'mine' ? myDiscussions : savedDiscussions;

  function renderDiscussion({ item }: { item: Discussion }) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardQuestion}>{item.question}</Text>
        <Text style={styles.cardMeta}>
          {item.replyCount} {item.replyCount === 1 ? 'reply' : 'replies'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{profile?.firstName} {profile?.lastName}</Text>
            <Text style={styles.nationality}>{flag}  {profile?.nationality}</Text>
            <Text style={styles.location}>📍 {profile?.location}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
          <Text style={styles.menuBtnText}>⋯</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'mine' && styles.tabActive]}
          onPress={() => setTab('mine')}
        >
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
            {t('profile.myDiscussions')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'saved' && styles.tabActive]}
          onPress={() => setTab('saved')}
        >
          <Text style={[styles.tabText, tab === 'saved' && styles.tabTextActive]}>
            {t('profile.saved')}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderDiscussion}
          contentContainerStyle={data.length === 0 ? styles.center : { padding: 16, gap: 12 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{tab === 'mine' ? '💬' : '🔖'}</Text>
              <Text style={styles.emptyText}>
                {tab === 'mine' ? 'No discussions yet' : 'No saved discussions'}
              </Text>
            </View>
          }
        />
      )}

      {menuVisible && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        />
      )}

      <Animated.View style={[styles.menu, { transform: [{ translateX: menuAnim }] }]}>
        <Text style={styles.menuTitle}>{t('settings.title')}</Text>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemEmoji}>🌐</Text>
          <Text style={styles.menuItemText}>{t('settings.language')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemEmoji}>🔔</Text>
          <Text style={styles.menuItemText}>{t('settings.notifications')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemEmoji}>🔒</Text>
          <Text style={styles.menuItemText}>{t('settings.privacy')}</Text>
        </TouchableOpacity>

        <View style={styles.menuDivider} />

        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <Text style={styles.menuItemEmoji}>🚪</Text>
          <Text style={[styles.menuItemText, { color: Colors.notification }]}>
            {t('profile.logout')}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: Typography.fontSizeXL,
    fontWeight: Typography.fontWeightBold,
    color: Colors.primary,
  },
  info: { flex: 1 },
  name: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  nationality: {
    fontSize: Typography.fontSizeSM,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  location: { fontSize: Typography.fontSizeSM, color: Colors.textSecondary },
  menuBtn: { padding: 8 },
  menuBtnText: { fontSize: 22, color: Colors.textPrimary, letterSpacing: 1 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: {
    fontSize: Typography.fontSizeSM,
    fontWeight: Typography.fontWeightMedium,
    color: Colors.textSecondary,
  },
  tabTextActive: { color: Colors.primary, fontWeight: Typography.fontWeightSemiBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardQuestion: {
    fontSize: Typography.fontSizeMD,
    color: Colors.textPrimary,
    marginBottom: 8,
    lineHeight: 22,
  },
  cardMeta: { fontSize: Typography.fontSizeSM, color: Colors.primary },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  menu: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.7,
    backgroundColor: Colors.surface,
    paddingTop: 80,
    paddingHorizontal: 24,
    zIndex: 11,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuTitle: {
    fontSize: Typography.fontSizeXL,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  menuItemEmoji: { fontSize: 20 },
  menuItemText: {
    fontSize: Typography.fontSizeMD,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeightMedium,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
});
