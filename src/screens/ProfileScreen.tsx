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
import { deleteDiscussion, fetchUserDiscussions, fetchSavedDiscussions } from '../services/discussionService';
import { setAppLanguage, AppLang } from '../services/i18n';
import { useAuthStore } from '../store/useAuthStore';
import { useFeedStore } from '../store/useFeedStore';
import { Discussion } from '../types';
import { COUNTRIES, Country } from '../data/countries';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { profile, setProfile, reset } = useAuthStore();
  const { removeDiscussion } = useFeedStore();
  const [tab, setTab] = useState<'mine' | 'saved'>('mine');
  const [myDiscussions, setMyDiscussions] = useState<Discussion[]>([]);
  const [savedDiscussions, setSavedDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [langModal, setLangModal] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
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
    } catch (e) {
      console.error('loadDiscussions error:', e);
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
            } catch (e) {
              console.error('Delete failed:', e);
            }
          },
        },
      ],
    );
  }

  function openEditProfile() {
    setMenuVisible(false);
    const nat = COUNTRIES.find((c) => c.code === profile?.countryCode) ?? null;
    const loc = COUNTRIES.find((c) => c.name === profile?.location) ?? null;
    setEditNationality(nat);
    setEditLocation(loc);
    setEditPickerFor(null);
    setEditSearch('');
    setEditVisible(true);
  }

  async function handleSaveProfile() {
    if (!editNationality || !editLocation || !profile?.uid) return;
    setEditSaving(true);
    try {
      const updated = {
        nationality: editNationality.name,
        countryCode: editNationality.code,
        location: editLocation.name,
      };
      await updateUserProfile(profile.uid, updated);
      setProfile({ ...profile, ...updated });
      setEditVisible(false);
    } catch (e) {
      console.error('Save profile error:', e);
    } finally {
      setEditSaving(false);
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
        <View style={styles.cardFooter}>
          <Text style={styles.cardMeta}>
            {t('feed.replies', { count: item.replyCount })}
          </Text>
          {tab === 'mine' && (
            <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={18} color={Colors.notification} />
            </TouchableOpacity>
          )}
        </View>
      </View>
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
                <Text style={styles.avatarEditText}>📷</Text>
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.info}>
            <Text style={styles.name}>{profile?.firstName} {profile?.lastName}</Text>
            <Text style={styles.nationality}>{flag}  {profile?.nationality}</Text>
            <Text style={styles.location}>📍 {profile?.location}</Text>
            {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
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

        <TouchableOpacity style={styles.menuItem} onPress={openEditProfile}>
          <Text style={styles.menuItemEmoji}>✏️</Text>
          <Text style={styles.menuItemText}>{t('settings.editProfile')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setLangModal(true); }}>
          <Text style={styles.menuItemEmoji}>🌐</Text>
          <Text style={styles.menuItemText}>{t('settings.language')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setPrivacyModal(true); }}>
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

      {/* Edit Profile */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.editSheet}>
          {editPickerFor === null ? (
            <>
              <View style={styles.editHeader}>
                <TouchableOpacity onPress={() => setEditVisible(false)}>
                  <Ionicons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.editTitle}>{t('editProfile.title')}</Text>
                <View style={{ width: 24 }} />
              </View>

              <View style={styles.editBody}>
                <Text style={styles.editLabel}>{t('editProfile.nationality')}</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => { setEditSearch(''); setEditPickerFor('nationality'); }}>
                  {editNationality
                    ? <Text style={styles.pickerValue}>{editNationality.flag}  {editNationality.name}</Text>
                    : <Text style={styles.pickerPlaceholder}>{t('auth.selectNationality')}</Text>
                  }
                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>

                <Text style={styles.editLabel}>{t('editProfile.location')}</Text>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => { setEditSearch(''); setEditPickerFor('location'); }}>
                  {editLocation
                    ? <Text style={styles.pickerValue}>📍  {editLocation.name}</Text>
                    : <Text style={styles.pickerPlaceholder}>{t('auth.selectLocation')}</Text>
                  }
                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, (editSaving || !editNationality || !editLocation) && styles.saveBtnDisabled]}
                onPress={handleSaveProfile}
                disabled={editSaving || !editNationality || !editLocation}
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
                  <Ionicons name="arrow-back" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.editTitle}>
                  {editPickerFor === 'nationality' ? t('auth.selectNationalityTitle') : t('auth.selectLocationTitle')}
                </Text>
                <View style={{ width: 24 }} />
              </View>
              <TextInput
                style={styles.editSearch}
                placeholder={t('auth.search')}
                placeholderTextColor={Colors.textSecondary}
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
                      <Ionicons name="checkmark" size={20} color={Colors.primary} style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </>
          )}
        </View>
      </Modal>

      {/* Language picker */}
      <Modal visible={langModal} transparent animationType="fade" onRequestClose={() => setLangModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLangModal(false)}>
          <View style={styles.langSheet}>
            <Text style={styles.langTitle}>{t('settings.language')}</Text>
            {([
              { code: 'en', label: 'English', flag: '🇬🇧' },
              { code: 'ru', label: 'Русский', flag: '🇷🇺' },
              { code: 'az', label: 'Azərbaycan', flag: '🇦🇿' },
            ] as { code: AppLang; label: string; flag: string }[]).map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={styles.langItem}
                onPress={() => { setAppLanguage(lang.code); setLangModal(false); }}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={styles.langLabel}>{lang.label}</Text>
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
            <Text style={styles.privacyText}>
              yOdin collects only the data you provide: your name, nationality, location, and profile photo. This information is used solely to personalise your feed and show your identity in discussions.{'\n\n'}
              Your data is stored securely in Firebase and is never sold or shared with third parties.{'\n\n'}
              You can delete your account and all associated data at any time by contacting support.
            </Text>
          </ScrollView>
        </View>
      </Modal>
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
  photoError: {
    fontSize: Typography.fontSizeXS,
    color: Colors.notification,
    marginTop: 4,
  },
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
    backgroundColor: Colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditText: { fontSize: 11 },
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langSheet: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: SCREEN_WIDTH * 0.8,
  },
  langTitle: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  langFlag: { fontSize: 24 },
  langLabel: {
    fontSize: Typography.fontSizeMD,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeightMedium,
  },
  privacySheet: {
    flex: 1,
    backgroundColor: Colors.background,
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
    borderBottomColor: Colors.border,
  },
  privacyTitle: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
  },
  privacyClose: { fontSize: 20, color: Colors.textSecondary, padding: 4 },
  privacyBody: { padding: 24 },
  privacyText: {
    fontSize: Typography.fontSizeMD,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  editSheet: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  editTitle: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
  },
  editBody: {
    padding: 24,
    flex: 1,
  },
  editLabel: {
    fontSize: Typography.fontSizeSM,
    fontWeight: Typography.fontWeightSemiBold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  pickerBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerValue: { fontSize: Typography.fontSizeMD, color: Colors.textPrimary, flex: 1 },
  pickerPlaceholder: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, flex: 1 },
  saveBtn: {
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: Typography.fontSizeMD,
    color: Colors.textPrimary,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  countryFlag: { fontSize: 24, marginRight: 12 },
  countryName: { fontSize: Typography.fontSizeMD, color: Colors.textPrimary, flex: 1 },
});
