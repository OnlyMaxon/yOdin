import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import TextInput from '../components/AppTextInput';
import Text from '../components/AppText';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { logoutUser, updateUserProfile } from '../services/authService';
import { uploadAvatar } from '../services/storageService';
import { deleteDiscussion, unsaveDiscussion, fetchUserDiscussions, fetchSavedDiscussions } from '../services/discussionService';
import { deletePost, unsavePost, fetchUserPosts, fetchSavedPosts } from '../services/postService';
import { countFollowers, changeUsername } from '../services/userService';
import { useUsernameCheck } from '../hooks/useUsernameCheck';
import { isValidUsername, normalizeUsername } from '../utils/mentions';
import { subscribeReports } from '../services/reportService';
import { formatTime } from '../utils/formatTime';
import PostDetailModal from './PostDetailModal';
import { setAppLanguage } from '../services/i18n';
import type { AppLang } from '../services/i18n';
import { useThemeStore, ThemePreference } from '../store/useThemeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/useAuthStore';
import { useFeedStore } from '../store/useFeedStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Discussion, Post } from '../types';
import { COUNTRIES, Country } from '../data/countries';
import { getRank } from '../utils/rank';
import { getFlagEmoji } from '../utils/flagEmoji';
import { usePostStore } from '../store/usePostStore';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import AppImage from '../components/AppImage';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MENU_W = Math.min(SCREEN_WIDTH * 0.78, 310);

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'az', label: 'Azərbaycan', flag: '🇦🇿' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'fa', label: 'فارسی', flag: '🇮🇷' },
  { code: 'ro', label: 'Română', flag: '🇷🇴' },
  { code: 'cs', label: 'Čeština', flag: '🇨🇿' },
  { code: 'sv', label: 'Svenska', flag: '🇸🇪' },
  { code: 'he', label: 'עברית', flag: '🇮🇱' },
  { code: 'th', label: 'ภาษาไทย', flag: '🇹🇭' },
  { code: 'ms', label: 'Melayu', flag: '🇲🇾' },
  { code: 'bn', label: 'বাংলা', flag: '🇧🇩' },
] as const;

export default function ProfileScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, insets.top), [colors, insets.top]);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const { profile, setProfile, reset, isModerator } = useAuthStore();
  const { removeDiscussion, toggleSaved } = useFeedStore();
  const { removePost, togglePostSaved } = usePostStore();
  const [tab, setTab] = useState<'posts' | 'discussions'>('posts');
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [myDiscussions, setMyDiscussions] = useState<Discussion[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedDiscussions, setSavedDiscussions] = useState<Discussion[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [pendingReports, setPendingReports] = useState(0);
  const [savedVisible, setSavedVisible] = useState(false);
  const [savedTab, setSavedTab] = useState<'posts' | 'discussions'>('posts');
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [langModal, setLangModal] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [themeModal, setThemeModal] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editNationality, setEditNationality] = useState<Country | null>(null);
  const [editLocation, setEditLocation] = useState<Country | null>(null);
  const [editPickerFor, setEditPickerFor] = useState<'nationality' | 'location' | null>(null);
  const [editSearch, setEditSearch] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const menuAnim = useState(new Animated.Value(-MENU_W))[0];
  const editUsernameStatus = useUsernameCheck(editUsername, profile?.username);

  useFocusEffect(
    useCallback(() => {
      if (profile?.uid) loadContent();
    }, [profile?.uid]),
  );

  useEffect(() => {
    Animated.timing(menuAnim, {
      toValue: menuVisible ? 0 : -MENU_W,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [menuVisible]);

  // Moderators get a live count of pending reports (the in-app "notification").
  useEffect(() => {
    if (!isModerator) return;
    const unsub = subscribeReports((all) =>
      setPendingReports(all.filter((r) => r.status === 'pending').length),
    );
    return unsub;
  }, [isModerator]);

  async function loadContent() {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      const [mineD, savedD, mineP, savedP, followers] = await Promise.all([
        fetchUserDiscussions(profile.uid),
        fetchSavedDiscussions(profile.uid),
        fetchUserPosts(profile.uid),
        fetchSavedPosts(profile.uid),
        countFollowers(profile.uid),
      ]);
      setMyDiscussions(mineD);
      setSavedDiscussions(savedD);
      setMyPosts(mineP);
      setSavedPosts(savedP);
      setFollowersCount(followers);
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;
    if (!profile?.uid) return;

    setUploadingPhoto(true);
    setPhotoError('');
    try {
      const url = await uploadAvatar(profile.uid, result.assets[0].uri);
      await updateUserProfile(profile.uid, { photoURL: url });
      setProfile({ ...profile, photoURL: url });
    } catch {
      setPhotoError(t('errors.photoUploadFailed'));
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleDelete(id: string, authorId: string) {
    Alert.alert(
      t('deleteDiscussion.title'),
      t('deleteDiscussion.message'),
      [
        { text: t('deleteDiscussion.cancel'), style: 'cancel' },
        {
          text: t('deleteDiscussion.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDiscussion(id, authorId);
              removeDiscussion(id);
              setMyDiscussions((prev) => prev.filter((d) => d.id !== id));
            } catch {
              Alert.alert(t('errors.generic'));
            }
          },
        },
      ],
    );
  }

  function openEditProfile() {
    setMenuVisible(false);
    setEditFirstName(profile?.firstName ?? '');
    setEditLastName(profile?.lastName ?? '');
    setEditUsername(profile?.username ?? '');
    setEditNationality(COUNTRIES.find((c) => c.code === profile?.countryCode) ?? null);
    setEditLocation(COUNTRIES.find((c) => c.name === profile?.location) ?? null);
    setEditPickerFor(null);
    setEditSearch('');
    setEditVisible(true);
  }

  async function handleSaveProfile() {
    if (!profile?.uid || !editFirstName.trim() || !editLastName.trim() || !editNationality || !editLocation) return;
    const newUsername = normalizeUsername(editUsername);
    const usernameChanged = newUsername !== (profile.username ?? '');
    if (usernameChanged && !isValidUsername(newUsername)) { Alert.alert(t('auth.usernameInvalid')); return; }
    if (usernameChanged && editUsernameStatus === 'taken') { Alert.alert(t('auth.usernameTaken')); return; }
    setEditSaving(true);
    try {
      // Claim the new @handle first (atomic release-old + claim-new). If it was
      // just taken in the race, the batch fails → abort, nothing else changes.
      if (usernameChanged) {
        try {
          await changeUsername(profile.uid, profile.username, newUsername);
        } catch {
          Alert.alert(t('auth.usernameTaken'));
          setEditSaving(false);
          return;
        }
      }
      const updated = {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        nationality: editNationality.name,
        countryCode: editNationality.code,
        location: editLocation.name,
      };
      await updateUserProfile(profile.uid, updated);
      setProfile({ ...profile, ...updated, ...(usernameChanged ? { username: newUsername } : {}) });
      setEditVisible(false);
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleUnsave(id: string) {
    if (!profile?.uid) return;
    try {
      await unsaveDiscussion(profile.uid, id);
      setSavedDiscussions((prev) => prev.filter((d) => d.id !== id));
      toggleSaved(id, profile.uid);
    } catch {
      Alert.alert(t('errors.generic'));
    }
  }

  function handleDeletePost(id: string, authorId: string) {
    Alert.alert(
      t('deletePost.title'),
      t('deletePost.message'),
      [
        { text: t('deletePost.cancel'), style: 'cancel' },
        {
          text: t('deletePost.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost(id, authorId);
              removePost(id);
              setMyPosts((prev) => prev.filter((p) => p.id !== id));
              setSavedPosts((prev) => prev.filter((p) => p.id !== id));
            } catch {
              Alert.alert(t('errors.generic'));
            }
          },
        },
      ],
    );
  }

  async function handleUnsavePost(id: string) {
    if (!profile?.uid) return;
    try {
      await unsavePost(profile.uid, id);
      setSavedPosts((prev) => prev.filter((p) => p.id !== id));
      togglePostSaved(id, profile.uid);
    } catch {
      Alert.alert(t('errors.generic'));
    }
  }

  function openPostDetail(post: Post) {
    setDetailPost(post);
    if (savedVisible) {
      setSavedVisible(false);
      setTimeout(() => setDetailVisible(true), 350);
    } else {
      setDetailVisible(true);
    }
  }

  async function handleLogout() {
    setMenuVisible(false);
    await logoutUser();
    reset();
    useFeedStore.setState({ discussions: [], hasMore: true, isLoading: false });
    usePostStore.setState({ posts: [], hasMore: true, isLoading: false, filter: 'all' });
    useNotificationStore.getState().setNotifications([]);
  }

  const flag = profile?.countryCode ? getFlagEmoji(profile.countryCode) : '🌐';

  const initials = profile
    ? `${profile.firstName?.charAt(0) ?? ''}${profile.lastName?.charAt(0) ?? ''}`.toUpperCase()
    : '?';

  const points = profile?.points ?? 0;
  const rankKey = getRank(points);

  const mainData: (Post | Discussion)[] = tab === 'posts' ? myPosts : myDiscussions;

  const themeOptions: { value: ThemePreference; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { value: 'system', label: t('settings.themeSystem'), icon: 'phone-portrait-outline' },
    { value: 'light', label: t('settings.themeLight'), icon: 'sunny-outline' },
    { value: 'dark', label: t('settings.themeDark'), icon: 'moon-outline' },
  ];

  function renderDiscussionCard(item: Discussion, variant: 'mine' | 'saved') {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => {
          if (variant === 'saved') setSavedVisible(false);
          navigation.navigate('DiscussionDetail', { discussionId: item.id, question: item.question });
        }}
      >
        <Text style={styles.cardQuestion}>{item.question}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardMeta}>
            {t('feed.replies', { count: item.replyCount })}
          </Text>
          {variant === 'mine' ? (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); handleDelete(item.id, item.authorId); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.notification} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); handleUnsave(item.id); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="bookmark" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  function renderPostCard(item: Post, variant: 'mine' | 'saved') {
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openPostDetail(item)}>
        {item.imageURLs && item.imageURLs.length > 0 ? (
          <AppImage source={{ uri: item.imageURLs[0] }} style={styles.postCardImage} contentFit="cover" />
        ) : null}
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.cardFooter}>
          <View style={styles.postMetaRow}>
            <Ionicons name="heart-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.cardMetaMuted}>{item.likes?.length ?? 0}</Text>
            <Ionicons name="chatbubble-outline" size={13} color={colors.textSecondary} style={{ marginLeft: 12 }} />
            <Text style={styles.cardMetaMuted}>{item.commentCount ?? 0}</Text>
            <Text style={styles.cardTime}>{formatTime(item.createdAt, t)}</Text>
          </View>
          {variant === 'mine' ? (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); handleDeletePost(item.id, item.authorId); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.notification} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); handleUnsavePost(item.id); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="bookmark" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Cover banner */}
        <View style={styles.coverBanner}>
          <View style={styles.bannerGlow} />
          <TouchableOpacity style={styles.menuBtnBanner} onPress={() => setMenuVisible(true)}>
            <Ionicons name="menu-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileContent}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto}>
              <View style={styles.avatar}>
                {profile?.photoURL ? (
                  <AppImage source={{ uri: profile.photoURL }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarText}>{initials}</Text>
                )}
                {uploadingPhoto && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={11} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
            <View style={styles.stats}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{myPosts.length}</Text>
                <Text style={styles.statLabel}>{t('profile.posts')}</Text>
              </View>
              <TouchableOpacity
                style={styles.statItem}
                activeOpacity={0.7}
                onPress={() => profile?.uid && navigation.navigate('FollowList', { userId: profile.uid, initialTab: 'followers' })}
              >
                <Text style={styles.statNum}>{followersCount}</Text>
                <Text style={styles.statLabel}>{t('profile.followers')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.statItem}
                activeOpacity={0.7}
                onPress={() => profile?.uid && navigation.navigate('FollowList', { userId: profile.uid, initialTab: 'following' })}
              >
                <Text style={styles.statNum}>{profile?.following?.length ?? 0}</Text>
                <Text style={styles.statLabel}>{t('profile.followingCount')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.name}>{profile?.firstName} {profile?.lastName}</Text>
          <Text style={styles.nationality}>{flag}  {profile?.nationality}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Ionicons name="location-sharp" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={styles.location}>{profile?.location}</Text>
          </View>
          <View style={styles.rankRow}>
            <View style={styles.rankBadge}>
              <Ionicons name="ribbon" size={12} color={colors.primary} />
              <Text style={styles.rankBadgeText}>{t(`rank.${rankKey}`)}</Text>
            </View>
            <Text style={styles.rankPoints}>{t('rank.points', { count: points })}</Text>
          </View>
          {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'posts' && styles.tabActive]}
          onPress={() => setTab('posts')}
        >
          <Text style={[styles.tabText, tab === 'posts' && styles.tabTextActive]}>
            {t('profile.myPosts')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'discussions' && styles.tabActive]}
          onPress={() => setTab('discussions')}
        >
          <Text style={[styles.tabText, tab === 'discussions' && styles.tabTextActive]}>
            {t('profile.myDiscussions')}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={mainData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            tab === 'posts'
              ? renderPostCard(item as Post, 'mine')
              : renderDiscussionCard(item as Discussion, 'mine')
          }
          contentContainerStyle={mainData.length === 0 ? styles.center : { padding: 16, gap: 12, paddingBottom: 96 }}
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'posts' ? 'document-text-outline' : 'chatbubbles-outline'}
              text={tab === 'posts' ? t('profile.noPosts') : t('profile.noDiscussions')}
              topOffset={60}
            />
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

      {/* ─── Side Menu ─── */}
      <Animated.View style={[styles.menu, { transform: [{ translateX: menuAnim }] }]}>
        {/* Brand header */}
        <View style={styles.menuBrand}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.menuLogoImg}
            resizeMode="contain"
          />
          <Text style={styles.menuAppName}>yOdin</Text>
          <TouchableOpacity style={styles.menuCloseBtn} onPress={() => setMenuVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* User card — tap to open Edit Profile */}
        <TouchableOpacity style={styles.menuUserCard} onPress={openEditProfile} activeOpacity={0.82}>
          <Avatar
            photoURL={profile?.photoURL}
            name={profile ? `${profile.firstName} ${profile.lastName}` : ''}
            size={48}
          />
          <View style={styles.menuUserInfo}>
            <Text style={styles.menuUserName} numberOfLines={1}>
              {profile?.firstName} {profile?.lastName}
            </Text>
            <Text style={styles.menuUserNation} numberOfLines={1}>{flag} {profile?.nationality}</Text>
            <View style={styles.menuUserRankRow}>
              <Ionicons name="ribbon" size={11} color={colors.primary} />
              <Text style={styles.menuUserRankText}> {t(`rank.${rankKey}`)}</Text>
              <Text style={styles.menuUserPts}> · {t('rank.points', { count: points })}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Account group */}
        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem} onPress={openEditProfile}>
            <View style={[styles.menuIconWrap, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="person-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.menuItemText}>{t('settings.editProfile')}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={() => { setMenuVisible(false); setSavedTab('posts'); setSavedVisible(true); }}>
            <View style={[styles.menuIconWrap, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="bookmark-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.menuItemText}>{t('profile.saved')}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Moderation group — only for users with the moderator claim */}
        {isModerator && (
          <View style={styles.menuGroup}>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => { setMenuVisible(false); navigation.navigate('Reports'); }}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: colors.notification + '18' }]}>
                <Ionicons name="shield-half-outline" size={18} color={colors.notification} />
              </View>
              <Text style={styles.menuItemText}>{t('moderation.title')}</Text>
              {pendingReports > 0 && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{pendingReports}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Preferences group */}
        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setLangModal(true); }}>
            <View style={[styles.menuIconWrap, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="globe-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.menuItemText}>{t('settings.language')}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setThemeModal(true); }}>
            <View style={[styles.menuIconWrap, { backgroundColor: colors.accent + '18' }]}>
              <Ionicons name="contrast-outline" size={18} color={colors.accent} />
            </View>
            <Text style={styles.menuItemText}>{t('settings.theme')}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={() => { setMenuVisible(false); setPrivacyModal(true); }}>
            <View style={[styles.menuIconWrap, { backgroundColor: colors.success + '18' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
            </View>
            <Text style={styles.menuItemText}>{t('settings.privacy')}</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }} />

        {/* Logout */}
        <View style={[styles.menuGroup, { marginBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={handleLogout}>
            <View style={[styles.menuIconWrap, { backgroundColor: colors.notification + '18' }]}>
              <Ionicons name="log-out-outline" size={18} color={colors.notification} />
            </View>
            <Text style={[styles.menuItemText, { color: colors.notification }]}>
              {t('profile.logout')}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ─── Edit Profile ─── */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.editSheet}>
          {editPickerFor === null ? (
            <>
              <View style={styles.editHeader}>
                <TouchableOpacity onPress={() => setEditVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.editTitle}>{t('editProfile.title')}</Text>
                <View style={{ width: 24 }} />
              </View>

              {/* Avatar */}
              <View style={styles.editAvatarSection}>
                <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto} activeOpacity={0.8}>
                  <View style={styles.editAvatarWrap}>
                    {profile?.photoURL
                      ? <AppImage source={{ uri: profile.photoURL }} style={styles.editAvatarImg} contentFit="cover" />
                      : <Text style={styles.editAvatarInitials}>{initials}</Text>
                    }
                    {uploadingPhoto && (
                      <View style={styles.avatarOverlay}>
                        <ActivityIndicator color="#fff" size="small" />
                      </View>
                    )}
                    <View style={styles.editAvatarCamera}>
                      <Ionicons name="camera" size={15} color="#fff" />
                    </View>
                  </View>
                </TouchableOpacity>
                <Text style={styles.editAvatarHint}>{t('settings.editProfile')}</Text>
                {photoError ? <Text style={[styles.photoError, { marginTop: 4 }]}>{photoError}</Text> : null}
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.editBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.editLabel}>{t('auth.firstName')}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editFirstName}
                  onChangeText={setEditFirstName}
                  placeholder={t('auth.firstName')}
                  placeholderTextColor={colors.textSecondary}
                  autoCorrect={false}
                />

                <Text style={styles.editLabel}>{t('auth.lastName')}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editLastName}
                  onChangeText={setEditLastName}
                  placeholder={t('auth.lastName')}
                  placeholderTextColor={colors.textSecondary}
                  autoCorrect={false}
                />

                <Text style={styles.editLabel}>{t('auth.username')}</Text>
                <TextInput
                  style={styles.editInput}
                  value={editUsername}
                  onChangeText={(v) => setEditUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                  placeholder={t('auth.username')}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {(editUsernameStatus === 'available' || editUsernameStatus === 'taken' || editUsernameStatus === 'invalid') && (
                  <Text style={[styles.usernameHint, {
                    color: editUsernameStatus === 'available' ? colors.success : colors.notification,
                  }]}>
                    {editUsernameStatus === 'available'
                      ? t('auth.usernameAvailable')
                      : editUsernameStatus === 'taken'
                        ? t('auth.usernameTaken')
                        : t('auth.usernameInvalid')}
                  </Text>
                )}

                <Text style={styles.editLabel}>{t('editProfile.nationality')}</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => { setEditSearch(''); setEditPickerFor('nationality'); }}>
                  {editNationality
                    ? <Text style={styles.pickerValue}>{editNationality.flag}  {editNationality.name}</Text>
                    : <Text style={styles.pickerPlaceholder}>{t('auth.selectNationality')}</Text>
                  }
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                <Text style={styles.editLabel}>{t('editProfile.location')}</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => { setEditSearch(''); setEditPickerFor('location'); }}>
                  {editLocation
                    ? <Text style={styles.pickerValue}>{editLocation.flag}  {editLocation.name}</Text>
                    : <Text style={styles.pickerPlaceholder}>{t('auth.selectLocation')}</Text>
                  }
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </ScrollView>

              <TouchableOpacity
                style={[styles.saveBtn, (editSaving || !editFirstName.trim() || !editLastName.trim() || !editNationality || !editLocation || editUsernameStatus === 'taken' || editUsernameStatus === 'invalid') && styles.saveBtnDisabled]}
                onPress={handleSaveProfile}
                disabled={editSaving || !editFirstName.trim() || !editLastName.trim() || !editNationality || !editLocation || editUsernameStatus === 'taken' || editUsernameStatus === 'invalid'}
              >
                {editSaving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>{t('editProfile.save')}</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.editHeader}>
                <TouchableOpacity onPress={() => setEditPickerFor(null)}>
                  <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.editTitle}>
                  {editPickerFor === 'nationality' ? t('auth.selectNationalityTitle') : t('auth.selectLocationTitle')}
                </Text>
                <View style={{ width: 24 }} />
              </View>
              <TextInput
                style={styles.editSearch}
                placeholder={t('auth.search')}
                placeholderTextColor={colors.textSecondary}
                value={editSearch}
                onChangeText={setEditSearch}
                autoCorrect={false}
                autoFocus
              />
              <FlatList
                data={COUNTRIES.filter((c) => c.name.toLowerCase().includes(editSearch.toLowerCase()))}
                keyExtractor={(item) => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.countryItem}
                    onPress={() => {
                      if (editPickerFor === 'nationality') setEditNationality(item);
                      else setEditLocation(item);
                      setEditPickerFor(null);
                    }}
                  >
                    <Text style={styles.countryFlag}>{item.flag}</Text>
                    <Text style={styles.countryName}>{item.name}</Text>
                    {((editPickerFor === 'nationality' && editNationality?.code === item.code) ||
                      (editPickerFor === 'location' && editLocation?.name === item.name)) && (
                      <Ionicons name="checkmark" size={20} color={colors.primary} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </>
          )}
        </View>
      </Modal>

      {/* Language picker */}
      <Modal
        visible={langModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setLangModal(false); setLangSearch(''); }}
      >
        <View style={styles.editSheet}>
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={() => { setLangModal(false); setLangSearch(''); }}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.editTitle}>{t('settings.language')}</Text>
            <View style={{ width: 24 }} />
          </View>
          <TextInput
            style={styles.editSearch}
            placeholder={t('auth.search')}
            placeholderTextColor={colors.textSecondary}
            value={langSearch}
            onChangeText={setLangSearch}
            autoCorrect={false}
          />
          <FlatList
            data={LANGUAGES.filter((l) => l.label.toLowerCase().includes(langSearch.toLowerCase()))}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.countryItem}
                onPress={async () => {
                const restartRequired = await setAppLanguage(item.code as AppLang);
                setLangModal(false);
                setLangSearch('');
                if (restartRequired) {
                  Alert.alert(t('settings.restartTitle'), t('settings.restartMessage'));
                }
              }}
              >
                <Text style={styles.countryFlag}>{item.flag}</Text>
                <Text style={styles.countryName}>{item.label}</Text>
                {i18n.language === item.code && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Theme picker */}
      <Modal visible={themeModal} transparent animationType="fade" onRequestClose={() => setThemeModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setThemeModal(false)}>
          <View style={styles.langSheet}>
            <Text style={styles.langTitle}>{t('settings.theme')}</Text>
            {themeOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={styles.langItem}
                onPress={() => { setPreference(opt.value); setThemeModal(false); }}
              >
                <Ionicons name={opt.icon} size={22} color={colors.primary} />
                <Text style={styles.langLabel}>{opt.label}</Text>
                {preference === opt.value && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Privacy */}
      <Modal visible={privacyModal} transparent animationType="slide" onRequestClose={() => setPrivacyModal(false)}>
        <View style={styles.privacySheet}>
          <View style={styles.privacyHeader}>
            <Text style={styles.privacyTitle}>{t('settings.privacy')}</Text>
            <TouchableOpacity onPress={() => setPrivacyModal(false)}>
              <Text style={styles.privacyClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.privacyBody}>
            <Text style={styles.privacyText}>{t('settings.privacyText')}</Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Saved */}
      <Modal visible={savedVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSavedVisible(false)}>
        <View style={styles.editSheet}>
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={() => setSavedVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.editTitle}>{t('profile.saved')}</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, savedTab === 'posts' && styles.tabActive]}
              onPress={() => setSavedTab('posts')}
            >
              <Text style={[styles.tabText, savedTab === 'posts' && styles.tabTextActive]}>
                {t('profile.posts')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, savedTab === 'discussions' && styles.tabActive]}
              onPress={() => setSavedTab('discussions')}
            >
              <Text style={[styles.tabText, savedTab === 'discussions' && styles.tabTextActive]}>
                {t('profile.discussions')}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={(savedTab === 'posts' ? savedPosts : savedDiscussions) as (Post | Discussion)[]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) =>
              savedTab === 'posts'
                ? renderPostCard(item as Post, 'saved')
                : renderDiscussionCard(item as Discussion, 'saved')
            }
            contentContainerStyle={
              (savedTab === 'posts' ? savedPosts : savedDiscussions).length === 0
                ? styles.center
                : { padding: 16, gap: 12 }
            }
            ListEmptyComponent={
              <EmptyState
                icon="bookmark-outline"
                text={savedTab === 'posts' ? t('profile.noSavedPosts') : t('profile.noSaved')}
                topOffset={60}
              />
            }
          />
        </View>
      </Modal>

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
    header: {
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    coverBanner: {
      height: topInset + 88,
      backgroundColor: c.primary,
      overflow: 'hidden',
      justifyContent: 'flex-end',
      alignItems: 'flex-end',
      paddingTop: topInset,
      paddingRight: 16,
      paddingBottom: 12,
    },
    bannerGlow: {
      position: 'absolute',
      width: 260,
      height: 260,
      borderRadius: 130,
      backgroundColor: 'rgba(255,255,255,0.09)',
      left: -60,
      top: -60,
    },
    menuBtnBanner: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileContent: {
      paddingHorizontal: 20,
      paddingBottom: 18,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 12,
    },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 20,
      marginTop: -32,
      borderWidth: 3,
      borderColor: c.surface,
    },
    avatarText: {
      fontSize: Typography.fontSizeXXL,
      fontWeight: Typography.fontWeightBold,
      color: c.primary,
    },
    stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statNum: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: c.textPrimary },
    statLabel: { fontSize: Typography.fontSizeXS, color: c.textSecondary, marginTop: 2 },
    name: {
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
      marginBottom: 2,
    },
    nationality: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      marginBottom: 2,
    },
    location: { fontSize: Typography.fontSizeSM, color: c.textSecondary },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    rankBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.primaryLight,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    rankBadgeText: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.primary,
    },
    rankPoints: { fontSize: Typography.fontSizeXS, color: c.textSecondary },
    photoError: {
      fontSize: Typography.fontSizeXS,
      color: c.notification,
      marginTop: 4,
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: c.primary },
    tabText: {
      fontSize: Typography.fontSizeSM,
      fontWeight: Typography.fontWeightMedium,
      color: c.textSecondary,
    },
    tabTextActive: { color: c.primary, fontWeight: Typography.fontWeightSemiBold },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
    avatarImage: {
      width: 80,
      height: 80,
      borderRadius: 40,
    },
    avatarOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: c.primary,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 16,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 2,
    },
    cardQuestion: {
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      marginBottom: 8,
      lineHeight: 22,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    cardMeta: { fontSize: Typography.fontSizeSM, color: c.primary },
    cardTitle: {
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.textPrimary,
      marginBottom: 4,
    },
    cardDesc: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      lineHeight: 20,
    },
    postCardImage: {
      width: '100%',
      height: 140,
      borderRadius: 10,
      marginBottom: 10,
      backgroundColor: c.background,
    },
    postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardMetaMuted: { fontSize: Typography.fontSizeXS, color: c.textSecondary },
    cardTime: { fontSize: Typography.fontSizeXS, color: c.textSecondary, marginLeft: 12 },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
      zIndex: 10,
    },

    // ─── Side Menu ───
    menu: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: MENU_W,
      backgroundColor: c.surface,
      zIndex: 11,
      shadowColor: '#000',
      shadowOffset: { width: 6, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 10,
      flexDirection: 'column',
    },
    menuBrand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: topInset + 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    menuLogoImg: {
      width: 36,
      height: 36,
      borderRadius: 9,
    },
    menuAppName: {
      flex: 1,
      fontSize: Typography.fontSizeXL,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
    },
    menuCloseBtn: {
      padding: 4,
    },
    menuUserCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 4,
      padding: 14,
      backgroundColor: c.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
    },
    menuUserInfo: {
      flex: 1,
      marginLeft: 12,
      marginRight: 6,
    },
    menuUserName: {
      fontSize: Typography.fontSizeSM,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
      marginBottom: 2,
    },
    menuUserNation: {
      fontSize: Typography.fontSizeXS,
      color: c.textSecondary,
      marginBottom: 3,
    },
    menuUserRankRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    menuUserRankText: {
      fontSize: Typography.fontSizeXS,
      color: c.primary,
      fontWeight: Typography.fontWeightSemiBold,
    },
    menuUserPts: {
      fontSize: Typography.fontSizeXS,
      color: c.textSecondary,
    },
    menuGroup: {
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: c.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 14,
      gap: 12,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuItemText: {
      flex: 1,
      fontSize: Typography.fontSizeSM,
      color: c.textPrimary,
      fontWeight: Typography.fontWeightMedium,
    },
    menuBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      marginRight: 6,
      backgroundColor: c.notification,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuBadgeText: { color: '#fff', fontSize: Typography.fontSizeXS, fontWeight: Typography.fontWeightBold },

    // ─── Edit Profile ───
    editAvatarSection: {
      alignItems: 'center',
      paddingVertical: 24,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    editAvatarWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editAvatarImg: {
      width: 96,
      height: 96,
      borderRadius: 48,
    },
    editAvatarInitials: {
      fontSize: 32,
      fontWeight: Typography.fontWeightBold,
      color: c.primary,
    },
    editAvatarCamera: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      backgroundColor: c.primary,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: c.surface,
    },
    editAvatarHint: {
      marginTop: 10,
      fontSize: Typography.fontSizeXS,
      color: c.primary,
      fontWeight: Typography.fontWeightMedium,
    },

    // ─── Modals shared ───
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    langSheet: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 24,
      width: SCREEN_WIDTH * 0.8,
    },
    langTitle: {
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
      marginBottom: 20,
      textAlign: 'center',
    },
    langItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    langLabel: {
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      fontWeight: Typography.fontWeightMedium,
    },
    privacySheet: {
      flex: 1,
      backgroundColor: c.background,
      marginTop: 80,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    privacyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    privacyTitle: {
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
    },
    privacyClose: { fontSize: 20, color: c.textSecondary, padding: 4 },
    privacyBody: { padding: 24 },
    privacyText: {
      fontSize: Typography.fontSizeMD,
      color: c.textSecondary,
      lineHeight: 24,
    },
    editSheet: {
      flex: 1,
      backgroundColor: c.background,
    },
    editHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    editTitle: {
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
    },
    editBody: {
      padding: 24,
      paddingBottom: 32,
    },
    editLabel: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    editInput: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 24,
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
    },
    usernameHint: {
      fontSize: Typography.fontSizeSM,
      marginTop: -18,
      marginBottom: 18,
      marginLeft: 4,
    },
    pickerBtn: {
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
      marginBottom: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pickerValue: { fontSize: Typography.fontSizeMD, color: c.textPrimary, flex: 1 },
    pickerPlaceholder: { fontSize: Typography.fontSizeMD, color: c.textSecondary, flex: 1 },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      margin: 24,
      marginTop: 0,
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: {
      color: '#fff',
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
    },
    editSearch: {
      marginHorizontal: 16,
      marginVertical: 12,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
    },
    countryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    countryFlag: { fontSize: 24, marginRight: 12 },
    countryName: { fontSize: Typography.fontSizeMD, color: c.textPrimary, flex: 1 },
  });
}
