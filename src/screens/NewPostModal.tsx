import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { usePostStore } from '../store/usePostStore';
import { createPost, newPostId } from '../services/postService';
import { uploadPostImages, uploadPostVideo } from '../services/storageService';
import PhotoPicker from '../components/PhotoPicker';
import VideoAttach, { AttachedVideo } from '../components/VideoAttach';
import { getErrorMessage } from '../services/errorHandler';
import { PostCategory, POST_CATEGORIES } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

const MAX_PHOTOS = 10;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NewPostModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.bottom);
  const { profile } = useAuthStore();
  const { prependPost, filter } = usePostStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // No category is preselected — the author must pick one to publish.
  const [category, setCategory] = useState<PostCategory | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [video, setVideo] = useState<AttachedVideo | null>(null);
  // Event sign-up sheet (only offered for the "events" category).
  const [signupEnabled, setSignupEnabled] = useState(false);
  const [limited, setLimited] = useState(false);
  const [limitText, setLimitText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setCategory(null);
      setImages([]);
      setVideo(null);
      setSignupEnabled(false);
      setLimited(false);
      setLimitText('');
      setError('');
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  async function handlePost() {
    if (!title.trim() || !description.trim()) {
      setError(t('errors.fillTitleAndDescription'));
      return;
    }
    if (!category) {
      setError(t('errors.selectCategory'));
      return;
    }
    if (!profile) return;
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    try {
      // Upload photos first so their URLs are saved with the post document.
      // (The posts security rules don't allow updating image fields after
      // creation, so they must be present at create time.)
      const id = newPostId();
      let imageURLs: string[] = [];
      let videoURL = '';
      let videoPoster = '';
      if (video) {
        try {
          const up = await uploadPostVideo(id, video.uri, video.poster);
          videoURL = up.videoURL;
          videoPoster = up.videoPoster;
        } catch {
          Alert.alert(t('errors.videoUploadFailed'));
        }
      }
      if (images.length > 0) {
        try {
          imageURLs = await uploadPostImages(id, images);
        } catch {
          Alert.alert(t('errors.photoUploadFailed'));
        }
      }
      // Sign-up sheet is only attached to events. A limit of 0/blank while
      // "limited" is on is treated as unlimited.
      const cap = limited ? (parseInt(limitText, 10) || 0) : 0;
      const signup =
        category === 'events' && signupEnabled
          ? { signupEnabled: true, participantLimit: cap > 0 ? cap : null }
          : {};
      const data = {
        authorId: profile.uid,
        authorName: `${profile.firstName} ${profile.lastName}`,
        authorPhoto: profile.photoURL ?? '',
        authorNationality: profile.nationality,
        authorCountryCode: profile.countryCode,
        title: title.trim(),
        description: description.trim(),
        category,
        imageURLs,
        ...(videoURL ? { videoURL, videoPoster } : {}),
        location: profile.location,
        ...signup,
      };
      await createPost(data, id);
      if (filter === 'all' || filter === category) {
        prependPost({ id, ...data, createdAt: Date.now() });
      }
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, t));
    } finally {
      setLoading(false);
    }
  }

  const canPost = title.trim().length > 0 && description.trim().length > 0 && category !== null && !loading;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('newPost.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <ScrollView
            style={styles.scrollArea}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              style={styles.titleInput}
              placeholder={t('newPost.topicPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Text style={styles.charCount}>{title.length}/100</Text>

            <TextInput
              style={styles.descriptionInput}
              placeholder={t('newPost.descriptionPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/1000</Text>

            <Text style={styles.sectionLabel}>{t('newPost.category')}</Text>
            <View style={styles.categoryRow}>
              {POST_CATEGORIES.map((cat) => {
                const active = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                      {t(`categories.${cat}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {category === 'events' ? (
              <View style={styles.signupBlock}>
                <View style={styles.signupToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.signupTitle}>{t('newPost.signup')}</Text>
                    <Text style={styles.signupHint}>{t('newPost.signupHint')}</Text>
                  </View>
                  <Switch
                    value={signupEnabled}
                    onValueChange={setSignupEnabled}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>

                {signupEnabled ? (
                  <View style={styles.limitRow}>
                    <TouchableOpacity
                      style={[styles.limitChip, !limited && styles.limitChipActive]}
                      onPress={() => setLimited(false)}
                    >
                      <Text style={[styles.limitChipText, !limited && styles.limitChipTextActive]}>
                        {t('newPost.noLimit')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.limitChip, limited && styles.limitChipActive]}
                      onPress={() => setLimited(true)}
                    >
                      <Text style={[styles.limitChipText, limited && styles.limitChipTextActive]}>
                        {t('newPost.withLimit')}
                      </Text>
                    </TouchableOpacity>
                    {limited ? (
                      <TextInput
                        style={styles.limitInput}
                        placeholder={t('newPost.limitPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        value={limitText}
                        onChangeText={(v) => setLimitText(v.replace(/[^0-9]/g, '').slice(0, 4))}
                        keyboardType="number-pad"
                        maxLength={4}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>{t('newPost.photos', { count: MAX_PHOTOS })}</Text>
            <View style={styles.photoWrapper}>
              <PhotoPicker images={images} onChange={setImages} max={MAX_PHOTOS} />
            </View>
            <View style={styles.videoWrapper}>
              <VideoAttach value={video} onChange={setVideo} />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.notification} />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
              onPress={handlePost}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.postBtnText}>{t('newPost.post')}</Text>
              }
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c: ColorPalette, bottomInset: number) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingBottom: Math.max(bottomInset, 16) + 24,
      paddingTop: 12,
      maxHeight: '88%',
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: c.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 16,
    },
    headerTitle: {
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: c.border,
      marginBottom: 16,
    },
    scrollArea: { flexShrink: 1 },
    titleInput: {
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.textPrimary,
      marginBottom: 4,
    },
    descriptionInput: {
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      minHeight: 100,
      maxHeight: 160,
      marginBottom: 4,
    },
    charCount: {
      fontSize: Typography.fontSizeXS,
      color: c.textSecondary,
      textAlign: 'right',
      marginBottom: 14,
    },
    sectionLabel: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
    },
    categoryChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    categoryChipText: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      fontWeight: Typography.fontWeightMedium,
    },
    categoryChipTextActive: { color: '#fff', fontWeight: Typography.fontWeightSemiBold },
    signupBlock: {
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      padding: 14,
      marginBottom: 18,
    },
    signupToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    signupTitle: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemiBold, color: c.textPrimary },
    signupHint: { fontSize: Typography.fontSizeXS, color: c.textSecondary, marginTop: 2 },
    limitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
    limitChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    limitChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    limitChipText: { fontSize: Typography.fontSizeSM, color: c.textSecondary, fontWeight: Typography.fontWeightMedium },
    limitChipTextActive: { color: '#fff', fontWeight: Typography.fontWeightSemiBold },
    limitInput: {
      width: 80,
      backgroundColor: c.surface,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      textAlign: 'center',
    },
    photoWrapper: { marginBottom: 8 },
    videoWrapper: { marginBottom: 8, alignSelf: 'flex-start' },
    footer: {
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: 10,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    error: {
      color: c.notification,
      fontSize: Typography.fontSizeSM,
      flex: 1,
    },
    postBtn: {
      backgroundColor: c.primary,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    postBtnDisabled: { opacity: 0.4 },
    postBtnText: {
      color: '#fff',
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightSemiBold,
    },
  });
}
