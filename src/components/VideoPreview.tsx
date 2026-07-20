import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import AppImage from './AppImage';

interface Props {
  poster?: string;
  onPress: () => void;
}

// Lightweight feed/card representation of a video: just the poster still plus a
// play badge. The actual video is never loaded here — tapping opens the detail
// view where it plays. This keeps the feed cheap to scroll.
export default function VideoPreview({ poster, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.wrap}>
      {poster ? (
        <AppImage source={{ uri: poster }} style={styles.img} contentFit="cover" />
      ) : (
        <View style={[styles.img, { backgroundColor: colors.textPrimary }]} />
      )}
      <View style={styles.playBadge}>
        <Ionicons name="play" size={24} color="#fff" style={{ marginLeft: 3 }} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 56,
    height: 56,
    marginTop: -28,
    marginLeft: -28,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
