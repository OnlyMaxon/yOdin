import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
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
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { logoutUser, updateUserProfile } from '../services/authService';
import { uploadAvatar } from '../services/storageService';
import { deleteDiscussion, unsaveDiscussion, fetchUserDiscussions, fetchSavedDiscussions } from '../services/discussionService';
import { setAppLanguage } from '../services/i18n';
import type { AppLang } from '../services/i18n';
import { useThemeStore, ThemePreference } from '../store/useThemeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/useAuthStore';
import { useFeedStore } from '../store/useFeedStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Discussion } from '../types';
import { COUNTRIES, Country } from '../data/countries';
import { getRank } from '../utils/rank';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

const SCREEN_WIDTH = Dimensions.get('window').width;

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
  const styles = makeStyles(colors, insets.top);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const { profile, setProfile, reset } = useAuthStore();
  const { removeDiscussion, toggleSaved } = useFeedStore();
  const [tab, setTab] = useState<'mine' | 'saved'>('mine');
  const [myDiscussions, setMyDiscussions] = useState<Discussion[]>([]);
  const [savedDiscussions, setSavedDiscussions] = useState<Discussion[]>([]);
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
  const [editNationality, setEditNationality] = useState<Country | null>(null);
  const [editLocation, setEditLocation] = useState<Country | null>(null);
  const [editPickerFor, setEditPickerFor] = useState<'nationality' | 'location' | null>(null);
  const [editSearch, setEditSearch] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const menuAnim = useState(new Animated.Value(-SCREEN_WIDTH * 0.7))[0];

  useFocusEffect(
    useCallback(() => {
      if (profile?.uid) loadDiscussions();
    }, [profile?.uid]),
  );

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
      const [mine, saved] = await Promise.all([
        fetchUserDiscussions(profile.uid),
        fetchSavedDiscussions(profile.uid),
      ]);
      setMyDiscussions(mine);
      setSavedDiscussions(saved);
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

  function handleDelete(id: string) {
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
              await deleteDiscussion(id);
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
    setEditNationality(COUNTRIES.find((c) => c.code === profile?.countryCode) ?? null);
    setEditLocation(COUNTRIES.find((c) => c.name === profile?.location) ?? null);
    setEditPickerFor(null);
    setEditSearch('');
    setEditVisible(true);
  }

  async function handleSaveProfile() {
    if (!profile?.uid || !editFirstName.trim() || !editLastName.trim() || !editNationality || !editLocation) return;
    setEditSaving(true);
    try {
      const updated = {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        nationality: editNationality.name,
        countryCode: editNationality.code,
        location: editLocation.name,
      };
      await updateUserProfile(profile.uid, updated);
      setProfile({ ...profile, ...updated });
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

  async function handleLogout() {
    setMenuVisible(false);
    await logoutUser();
    reset();
    useFeedStore.setState({ discussions: [], hasMore: true, isLoading: false });
    useNotificationStore.getState().setNotifications([]);
  }

  const flag = profile?.countryCode
    ? profile.countryCode.toUpperCase().split('').map((c: string) =>
        String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
    : '🌐';

  const initials = profile
    ? `${profile.firstName?.charAt(0) ?? ''}${profile.lastName?.charAt(0) ?? ''}`.toUpperCase()
    : '?';

  const points = profile?.points ?? 0;
  const rankKey = getRank(points);

  const data = tab === 'mine' ? myDiscussions : savedDiscussions;

  const themeOptions: { value: ThemePreference; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { value: 'system', label: t('settings.themeSystem'), icon: 'phone-portrait-outline' },
    { value: 'light', label: t('settings.themeLight'), icon: 'sunny-outline' },
    { value: 'dark', label: t('settings.themeDark'), icon: 'moon-outline' },
  ];

  function renderDiscussion({ item }: { item: Discussion }) {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('DiscussionDetail', { discussionId: item.id, question: item.question })}
      >
        <Text style={styles.cardQuestion}>{item.question}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardMeta}>
            {t('feed.replies', { count: item.replyCount })}
          </Text>
          {tab === 'mine' && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); handleDelete(item.id); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.notification} />
            </TouchableOpacity>
          )}
          {tab === 'saved' && (
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto}>
            <View style={styles.avatar}>
              {profile?.photoURL ? (
                <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} />
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
          <View style={styles.info}>
            <Text style={styles.name}>{profile?.firstName} {profile?.lastName}</Text>
            <Text style={styles.nationality}>{flag}  {profile?.nationality}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
        <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textPrimary} />
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
          <ActivityIndicator color={colors.primary} />
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
                {tab === 'mine' ? t('profile.noDiscussions') : t('profile.noSaved')}
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

        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem} onPress={openEditProfile}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
            <Text style={styles.menuItemText}>{t('settings.editProfile')}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setLangModal(true); }}>
            <Ionicons name="globe-outline" size={20} color={colors.primary} />
            <Text style={styles.menuItemText}>{t('settings.language')}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setThemeModal(true); }}>
            <Ionicons name="contrast-outline" size={20} color={colors.primary} />
            <Text style={styles.menuItemText}>{t('settings.theme')}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={() => { setMenuVisible(false); setPrivacyModal(true); }}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <Text style={styles.menuItemText}>{t('settings.privacy')}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.menuGroup}>
          <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.notification} />
            <Text style={[styles.menuItemText, { color: colors.notification }]}>
              {t('profile.logout')}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Edit Profile */}
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

              <View style={styles.editBody}>
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
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, (editSaving || !editFirstName.trim() || !editLastName.trim() || !editNationality || !editLocation) && styles.saveBtnDisabled]}
                onPress={handleSaveProfile}
                disabled={editSaving || !editFirstName.trim() || !editLastName.trim() || !editNationality || !editLocation}
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
    </View>
  );
}

function makeStyles(c: ColorPalette, topInset: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      paddingHorizontal: 20,
      paddingTop: topInset + 12,
      paddingBottom: 20,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    profileRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    avatarText: {
      fontSize: Typography.fontSizeXL,
      fontWeight: Typography.fontWeightBold,
      color: c.primary,
    },
    info: { flex: 1 },
    name: {
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
      marginBottom: 4,
    },
    nationality: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      marginBottom: 2,
    },
    location: { fontSize: Typography.fontSizeSM, color: c.textSecondary },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
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
    menuBtn: { padding: 8 },
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
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyEmoji: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: Typography.fontSizeMD, color: c.textSecondary },
    avatarImage: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    avatarOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: c.primary,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
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
      backgroundColor: c.surface,
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
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
      marginBottom: 20,
    },
    menuGroup: {
      backgroundColor: c.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 12,
      overflow: 'hidden',
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 14,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuItemText: {
      flex: 1,
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      fontWeight: Typography.fontWeightMedium,
    },
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
    },
    editTitle: {
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
    },
    editBody: {
      padding: 24,
      flex: 1,
    },
    editLabel: {
      fontSize: Typography.fontSizeSM,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
