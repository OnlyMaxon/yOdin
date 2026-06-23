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
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { usePostStore } from '../store/usePostStore';
import { createPost, newPostId } from '../services/postService';
import { uploadPostImages } from '../services/storageService';
import PhotoPicker from '../components/PhotoPicker';

const MAX_PHOTOS = 10;
import { getErrorMessage } from '../services/errorHandler';
import { PostCategory, POST_CATEGORIES } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

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
  const [category, setCategory] = useState<PostCategory>('news');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setCategory('news');
      setImages([]);
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
      if (images.length > 0) {
        try {
          imageURLs = await uploadPostImages(id, images);
        } catch {
          Alert.alert(t('errors.photoUploadFailed'));
        }
      }
      const data = {
        authorId: profile.uid,
        authorName: `${profile.firstName} ${profile.lastName}`,
        authorPhoto: profile.photoURL ?? '',
        authorNationality: profile.nationality,
        authorCountryCode: profile.countryCode,
        title: title.trim(),
        description: description.trim(),
        category,
        imageURL: imageURLs[0] ?? '',
        imageURLs,
        location: profile.location,
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

  const canPost = title.trim().length > 0 && description.trim().length > 0 && !loading;

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
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TextInput
              style={styles.titleInput}
              placeholder={t('newPost.topicPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

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

            <Text style={styles.photoLabel}>{t('newPost.photos', { count: MAX_PHOTOS })}</Text>
            <PhotoPicker images={images} onChange={setImages} max={MAX_PHOTOS} />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
              onPress={handlePost}
              disabled={!canPost}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.postBtnText}>{t('newPost.post')}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
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
      marginBottom: 16,
    },
    headerTitle: {
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
    },
    closeBtn: { padding: 4 },
    closeText: { fontSize: 18, color: c.textSecondary },
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
      marginBottom: 12,
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
    },
    charCount: {
      fontSize: Typography.fontSizeXS,
      color: c.textSecondary,
      textAlign: 'right',
      marginTop: 4,
      marginBottom: 12,
    },
    sectionLabel: {
      fontSize: Typography.fontSizeSM,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.textSecondary,
      marginBottom: 8,
    },
    photoLabel: {
      fontSize: Typography.fontSizeSM,
      fontWeight: Typography.fontWeightSemiBold,
      color: c.textSecondary,
      marginBottom: 10,
    },
    categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
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
    addPhotoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.border,
      borderStyle: 'dashed',
      marginBottom: 16,
    },
    addPhotoText: {
      fontSize: Typography.fontSizeMD,
      color: c.primary,
      fontWeight: Typography.fontWeightMedium,
    },
    imagePreviewWrap: { marginBottom: 16, position: 'relative' },
    imagePreview: {
      width: '100%',
      height: 160,
      borderRadius: 14,
      backgroundColor: c.background,
    },
    removeImageBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    error: {
      color: c.notification,
      fontSize: Typography.fontSizeSM,
      marginBottom: 12,
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
