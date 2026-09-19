import React, { useState, useRef, useEffect } from 'react';
import {
  View,
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
import TextInput from '../components/AppTextInput';
import Text from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { usePostStore } from '../store/usePostStore';
import { useToastStore } from '../store/useToastStore';
import { createPost, newPostId } from '../services/postService';
import { notifyMentions } from '../services/notificationService';
import { uploadPostImages, uploadPostVideo } from '../services/storageService';
import MediaPicker, { AttachedVideo } from '../components/MediaPicker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { getErrorMessage } from '../services/errorHandler';
import { PostCategory, POST_CATEGORIES } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette, CATEGORY_META } from '../theme/colors';
import { Typography } from '../theme/typography';

const MAX_PHOTOS = 10;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function NewPostModal({ visible, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, insets.bottom);
  const { profile } = useAuthStore();
  const { prependPost, filter } = usePostStore();
  const showToast = useToastStore((s) => s.show);
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
  // Optional event start; the picker state drives the native date/time picker.
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [picker, setPicker] = useState<null | 'date' | 'time'>(null);
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
      setEventDate(null);
      setPicker(null);
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

  // Android shows date then time as two sequential dialogs; iOS uses one inline
  // datetime spinner (rendered below in a small sheet). This drives the Android chain.
  function onAndroidPicker(event: DateTimePickerEvent, selected?: Date) {
    const step = picker;
    if (event.type === 'dismissed' || !selected) { setPicker(null); return; }
    setEventDate((prev) => {
      const d = new Date(prev ?? selected);
      if (step === 'date') d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      else d.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      return d;
    });
    setPicker(step === 'date' ? 'time' : null);
  }

  function formatEventDateTime(d: Date) {
    return d.toLocaleString(i18n.language, {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

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
          const up = await uploadPostVideo(profile.uid, id, video.uri, video.poster);
          videoURL = up.videoURL;
          videoPoster = up.videoPoster;
        } catch {
          Alert.alert(t('errors.videoUploadFailed'));
        }
      }
      if (images.length > 0) {
        try {
          imageURLs = await uploadPostImages(profile.uid, id, images);
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
        ...(category === 'events' && eventDate ? { eventDate: eventDate.getTime() } : {}),
        ...signup,
      };
      await createPost(data, id);
      notifyMentions({
        text: `${title} ${description}`,
        from: { uid: profile.uid, name: `${profile.firstName} ${profile.lastName}`, photo: profile.photoURL ?? '' },
        post: { id, title: title.trim() },
      }).catch(() => {});
      if (filter === 'all' || filter === category) {
        prependPost({ id, ...data, createdAt: Date.now() });
      }
      onClose();
      showToast(t('newPost.published'));
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

          {/* Header: Cancel · New Post · Publish (Figma) */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}>
              <Text style={styles.cancelText}>{t('newPost.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('newPost.title')}</Text>
            <TouchableOpacity
              style={[styles.publishPill, !canPost && styles.publishPillDisabled]}
              onPress={handlePost}
              disabled={!canPost}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.publishPillText}>{t('newPost.post')}</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.notification} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.scrollArea}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>{t('newPost.category')}</Text>
            <View style={styles.categoryRow}>
              {POST_CATEGORIES.map((cat) => {
                const active = category === cat;
                const meta = CATEGORY_META[cat];
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, active && { backgroundColor: meta.color, borderColor: meta.color }]}
                    onPress={() => setCategory(cat)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.categoryEmoji}>{meta.emoji}</Text>
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                      {t(`categories.${cat}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

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

            {category === 'events' ? (
              <View style={[styles.signupBlock, signupEnabled && styles.signupBlockActive]}>
                <TouchableOpacity style={styles.dateRow} onPress={() => setPicker('date')} activeOpacity={0.7}>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  <Text style={[styles.dateText, !eventDate && styles.datePlaceholder]} numberOfLines={1}>
                    {eventDate ? formatEventDateTime(eventDate) : t('newPost.eventDate')}
                  </Text>
                  {eventDate ? (
                    <TouchableOpacity onPress={() => setEventDate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>

                {picker && Platform.OS === 'android' ? (
                  <DateTimePicker
                    value={eventDate ?? new Date()}
                    mode={picker}
                    onChange={onAndroidPicker}
                    minimumDate={new Date()}
                  />
                ) : null}

                {Platform.OS === 'ios' ? (
                  <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
                    <TouchableOpacity style={styles.iosPickerBackdrop} activeOpacity={1} onPress={() => setPicker(null)}>
                      <View style={styles.iosPickerCard}>
                        <DateTimePicker
                          value={eventDate ?? new Date()}
                          mode="datetime"
                          display="spinner"
                          onChange={(_e: DateTimePickerEvent, d?: Date) => d && setEventDate(d)}
                          minimumDate={new Date()}
                        />
                        <TouchableOpacity style={styles.iosPickerDone} onPress={() => setPicker(null)}>
                          <Text style={styles.iosPickerDoneText}>{t('newPost.done')}</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  </Modal>
                ) : null}

                <View style={styles.dateDivider} />

                <View style={styles.signupToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.signupTitle}>🎉  {t('newPost.signup')}</Text>
                    <Text style={styles.signupHint}>{t('newPost.signupHint')}</Text>
                  </View>
                  <Switch
                    value={signupEnabled}
                    onValueChange={setSignupEnabled}
                    trackColor={{ false: colors.border, true: colors.accent }}
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

            <Text style={styles.sectionLabel}>{t('newPost.media')}</Text>
            <View style={styles.photoWrapper}>
              <MediaPicker
                images={images}
                onChangeImages={setImages}
                video={video}
                onChangeVideo={setVideo}
                maxPhotos={MAX_PHOTOS}
              />
            </View>

            <View style={{ height: 8 }} />
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
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingBottom: Math.max(bottomInset, 16) + 20,
      paddingTop: 12,
      maxHeight: '90%',
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: c.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 14,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 14,
    },
    cancelText: { fontSize: Typography.fontSizeMD, color: c.textSecondary, fontWeight: Typography.fontWeightMedium },
    headerTitle: {
      fontSize: Typography.fontSizeMD,
      fontWeight: Typography.fontWeightBold,
      color: c.textPrimary,
    },
    publishPill: {
      minWidth: 84,
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    publishPillDisabled: { backgroundColor: c.border },
    publishPillText: { color: '#fff', fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightBold },
    divider: {
      height: 1,
      backgroundColor: c.border,
      marginBottom: 16,
    },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
    },
    error: {
      color: c.notification,
      fontSize: Typography.fontSizeSM,
      flex: 1,
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.border,
    },
    categoryEmoji: { fontSize: 14 },
    categoryChipText: {
      fontSize: Typography.fontSizeSM,
      color: c.textSecondary,
      fontWeight: Typography.fontWeightMedium,
    },
    categoryChipTextActive: { color: '#fff', fontWeight: Typography.fontWeightSemiBold },
    signupBlock: {
      backgroundColor: c.background,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 18,
    },
    signupBlockActive: { borderColor: c.accent },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dateText: { flex: 1, fontSize: Typography.fontSizeMD, color: c.textPrimary, fontWeight: Typography.fontWeightMedium },
    datePlaceholder: { color: c.textSecondary },
    dateDivider: { height: 1, backgroundColor: c.border, marginVertical: 14 },
    iosPickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    iosPickerCard: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 8 },
    iosPickerDone: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingVertical: 12 },
    iosPickerDoneText: { color: c.primary, fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemiBold },
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
  });
}
