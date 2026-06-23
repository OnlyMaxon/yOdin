import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../hooks/useTheme';
import { ColorPalette } from '../theme/colors';
import { Typography } from '../theme/typography';
import { optimizeImage } from '../utils/imageOptimize';

interface Props {
  images: string[];
  onChange: (uris: string[]) => void;
  max: number;
}

// Horizontal multi-photo picker: thumbnails with a remove button + an "add"
// tile. Picked images are downscaled & compressed before they ever leave the
// device, so uploads are small and fast.
export default function PhotoPicker({ images, onChange, max }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [busy, setBusy] = useState(false);

  async function addPhotos() {
    if (busy || images.length >= max) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: max - images.length,
      quality: 1,
    });
    if (result.canceled || result.assets.length === 0) return;

    setBusy(true);
    try {
      const optimized = await Promise.all(
        result.assets.map((a) => optimizeImage(a.uri, a.width, a.height)),
      );
      onChange([...images, ...optimized].slice(0, max));
    } finally {
      setBusy(false);
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {images.map((uri, i) => (
        <View key={`${uri}-${i}`} style={styles.thumbWrap}>
          <Image source={{ uri }} style={styles.thumb} />
          <TouchableOpacity style={styles.removeBtn} onPress={() => removeAt(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close" size={13} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}

      {images.length < max && (
        <TouchableOpacity style={styles.addTile} onPress={addPhotos} disabled={busy} activeOpacity={0.7}>
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Ionicons name="camera-outline" size={22} color={colors.primary} />
              <Text style={styles.addCount}>{images.length}/{max}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function makeStyles(c: ColorPalette) {
  const SIZE = 76;
  return StyleSheet.create({
    row: { gap: 10, paddingVertical: 2, alignItems: 'center' },
    thumbWrap: { width: SIZE, height: SIZE },
    thumb: { width: SIZE, height: SIZE, borderRadius: 12, backgroundColor: c.background },
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
      gap: 3,
    },
    addCount: { fontSize: Typography.fontSizeXS, color: c.primary, fontWeight: Typography.fontWeightSemiBold },
  });
}
