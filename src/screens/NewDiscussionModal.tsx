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
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { useFeedStore } from '../store/useFeedStore';
import { createDiscussion, newDiscussionId } from '../services/discussionService';
import { uploadDiscussionImages } from '../services/storageService';
import { getFlagEmoji } from '../utils/flagEmoji';
import { getErrorMessage } from '../services/errorHandler';
import PhotoPicker from '../components/PhotoPicker';

const MAX_PHOTOS = 5;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NewDiscussionModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.bottom);
  const { profile } = useAuthStore();
  const { prependDiscussion } = useFeedStore();
  const [question, setQuestion] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setQuestion('');
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
    if (!question.trim()) { setError(t('errors.writeQuestion')); return; }
    if (!profile) return;
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    try {
      const id = newDiscussionId();
      let imageURLs: string[] = [];
      if (images.length > 0) {
        try {
          imageURLs = await uploadDiscussionImages(id, images);
        } catch {
          // Photo upload failed — post the question without images rather than blocking.
        }
      }
      const data = {
        authorId: profile.uid,
        authorName: `${profile.firstName} ${profile.lastName}`,
        authorPhoto: profile.photoURL ?? '',
        authorNationality: profile.nationality,
        authorCountryCode: profile.countryCode,
        location: profile.location,
        question: question.trim(),
        imageURLs,
      };
      await createDiscussion(data, id);
      prependDiscussion({ id, ...data, createdAt: Date.now(), replyCount: 0 });
      onClose();
    } catch (e) {
      setError(getErrorMessage(e, t));
    } finally {
      setLoading(false);
    }
  }

  const initials = profile
    ? `${profile.firstName?.charAt(0) ?? ''}${profile.lastName?.charAt(0) ?? ''}`
    : '?';

  const flag = getFlagEmoji(profile?.countryCode ?? '');

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
            <Text style={styles.headerTitle}>{t('newDiscussion.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.authorCol}>
              <View style={styles.avatar}>
                {profile?.photoURL ? (
                  <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{initials.toUpperCase()}</Text>
                )}
              </View>
              <Text style={styles.authorName} numberOfLines={1}>
                {profile?.firstName}
              </Text>
              <Text style={styles.authorFlag}>{flag}</Text>
            </View>

            <View style={styles.inputCol}>
              <TextInput
                style={styles.input}
                placeholder={t('newDiscussion.placeholder')}
                placeholderTextColor={colors.textSecondary}
                value={question}
                onChangeText={setQuestion}
                multiline
                maxLength={500}
                autoFocus
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{question.length}/500</Text>
            </View>
          </View>

          <View style={styles.photoSection}>
            <PhotoPicker images={images} onChange={setImages} max={MAX_PHOTOS} />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.postBtn, (!question.trim() || loading) && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={!question.trim() || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.postBtnText}>{t('newDiscussion.post')}</Text>
            }
          </TouchableOpacity>
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
      minHeight: 320,
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
      marginBottom: 20,
    },
    headerTitle: {
      fontSize: Typography.fontSizeLG,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
    },
    closeBtn: { padding: 4 },
    closeText: { fontSize: 18, color: c.textSecondary },
    body: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    photoSection: { marginBottom: 16 },
    authorCol: { alignItems: 'center', width: 64 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    avatarText: {
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightBold,
      color: c.primary,
    },
    avatarImage: { width: 48, height: 48, borderRadius: 24 },
    authorName: {
      fontSize: Typography.fontSizeXS,
      fontWeight: Typography.fontWeightMedium,
      color: c.textPrimary,
      textAlign: 'center',
    },
    authorFlag: { fontSize: 18, marginTop: 4 },
    inputCol: { flex: 1 },
    input: {
      fontSize: Typography.fontSizeMD,
      color: c.textPrimary,
      lineHeight: 22,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    charCount: {
      fontSize: Typography.fontSizeXS,
      color: c.textSecondary,
      textAlign: 'right',
      marginTop: 4,
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
