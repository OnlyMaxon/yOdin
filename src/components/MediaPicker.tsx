import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { optimizeImage } from '../utils/imageOptimize';
import { processVideoAsset, videoPickerOptions, VideoPickError, MAX_VIDEO_DURATION_S } from '../utils/pickVideo';
import PhotoPickerSheet, { PickedAsset } from './PhotoPickerSheet';

export interface AttachedVideo {
  uri: string;
  poster: string;
}

interface Props {
  images: string[];
  onChangeImages: (uris: string[]) => void;
  video: AttachedVideo | null;
  onChangeVideo: (v: AttachedVideo | null) => void;
  maxPhotos: number;
}

export default function MediaPicker({ images, onChangeImages, video, onChangeVideo, maxPhotos }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const canAddPhoto = images.length < maxPhotos;
  const canAddVideo = !video;

  async function handlePhotosDone(picked: PickedAsset[]) {
    setSheetVisible(false);
    if (picked.length === 0) return;
    setBusy(true);
    try {
      const slots = maxPhotos - images.length;
      const toProcess = picked.slice(0, slots);
      const optimized = await Promise.all(
        toProcess.map(a => optimizeImage(a.uri, a.width || undefined, a.height || undefined)),
      );
      onChangeImages([...images, ...optimized].slice(0, maxPhotos));
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function addVideo() {
    if (busy) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      ...videoPickerOptions,
    });
    if (result.canceled || result.assets.length === 0) return;
    setBusy(true);
    try {
      const v = await processVideoAsset(result.assets[0]);
      onChangeVideo({ uri: v.uri, poster: v.poster });
    } catch (e) {
      if (e instanceof VideoPickError) Alert.alert(t(e.key, { count: MAX_VIDEO_DURATION_S }));
      else Alert.alert(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  function removeImageAt(index: number) {
    onChangeImages(images.filter((_, i) => i !== index));
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {images.map((uri, i) => (
          <View key={`${uri}-${i}`} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} />
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => removeImageAt(i)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="close" size={13} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {video ? (
          <View style={styles.thumbWrap}>
            {video.poster ? (
              <Image source={{ uri: video.poster }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.videoFallback]}>
                <Ionicons name="videocam" size={22} color={colors.primary} />
              </View>
            )}
            <View style={styles.playBadge}>
              <Ionicons name="play" size={14} color="#fff" style={{ marginLeft: 2 }} />
            </View>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => onChangeVideo(null)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="close" size={13} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}

        {busy ? (
          <View style={styles.addTile}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {canAddPhoto && (
              <TouchableOpacity style={styles.addTile} onPress={() => setSheetVisible(true)} activeOpacity={0.7}>
                <Ionicons name="images-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
            {canAddVideo && (
              <TouchableOpacity style={styles.addTile} onPress={addVideo} activeOpacity={0.7}>
                <Ionicons name="videocam-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      <PhotoPickerSheet
        visible={sheetVisible}
        maxSelect={maxPhotos - images.length}
        onDone={handlePhotosDone}
        onCancel={() => setSheetVisible(false)}
      />
    </>
  );
}

function makeStyles(c: ColorPalette) {
  const SIZE = 76;
  return StyleSheet.create({
    row: { gap: 10, paddingVertical: 2, alignItems: 'center' },
    thumbWrap: { width: SIZE, height: SIZE },
    thumb: { width: SIZE, height: SIZE, borderRadius: 12, backgroundColor: c.background },
    videoFallback: { alignItems: 'center', justifyContent: 'center' },
    playBadge: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 26,
      height: 26,
      marginTop: -13,
      marginLeft: -13,
      borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    removeBtn: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: c.surface,
    },
    addTile: {
      width: SIZE,
      height: SIZE,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.primary,
      borderStyle: 'dashed',
      backgroundColor: c.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
