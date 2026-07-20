import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import AppImage from './AppImage';
import PhotoViewer from './PhotoViewer';

const GAP = 3;
const RADIUS = 12;
const BLOCK_H = 230; // total height for multi-photo collages

interface Props {
  images: string[];
  // When provided, tapping any tile runs this instead of opening the fullscreen
  // viewer (used in the forum card so photos are attachments — openable only
  // after tapping through to the question).
  onPress?: () => void;
}

// Adaptive photo collage (1–4+ tiles, Telegram/Instagram style). Tapping any
// tile opens a fullscreen swipeable viewer of the full set.
export default function PhotoGrid({ images, onPress }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  function Tile({ uri, index, style, extra }: { uri: string; index: number; style: any; extra?: number }) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => (onPress ? onPress() : setViewerIndex(index))}
        style={style}
      >
        <AppImage source={{ uri }} style={styles.img} contentFit="cover" />
        {extra ? (
          <View style={styles.moreOverlay}>
            <Text style={styles.moreText}>+{extra}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  const n = images.length;
  const half = (width - GAP) / 2;
  const tileBg = { backgroundColor: colors.background };

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 && (
        <>
          {n === 1 && (
            <Tile uri={images[0]} index={0} style={[styles.tile, tileBg, { width, height: Math.round(width * 0.62) }]} />
          )}

          {n === 2 && (
            <View style={styles.row}>
              <Tile uri={images[0]} index={0} style={[styles.tile, tileBg, { width: half, height: 200 }]} />
              <Tile uri={images[1]} index={1} style={[styles.tile, tileBg, { width: half, height: 200 }]} />
            </View>
          )}

          {n === 3 && (
            <View style={styles.row}>
              <Tile uri={images[0]} index={0} style={[styles.tile, tileBg, { width: half, height: BLOCK_H }]} />
              <View style={{ gap: GAP }}>
                <Tile uri={images[1]} index={1} style={[styles.tile, tileBg, { width: half, height: (BLOCK_H - GAP) / 2 }]} />
                <Tile uri={images[2]} index={2} style={[styles.tile, tileBg, { width: half, height: (BLOCK_H - GAP) / 2 }]} />
              </View>
            </View>
          )}

          {n >= 4 && (
            <View style={{ gap: GAP }}>
              <View style={styles.row}>
                <Tile uri={images[0]} index={0} style={[styles.tile, tileBg, { width: half, height: (BLOCK_H - GAP) / 2 }]} />
                <Tile uri={images[1]} index={1} style={[styles.tile, tileBg, { width: half, height: (BLOCK_H - GAP) / 2 }]} />
              </View>
              <View style={styles.row}>
                <Tile uri={images[2]} index={2} style={[styles.tile, tileBg, { width: half, height: (BLOCK_H - GAP) / 2 }]} />
                <Tile
                  uri={images[3]}
                  index={3}
                  extra={n > 4 ? n - 4 : 0}
                  style={[styles.tile, tileBg, { width: half, height: (BLOCK_H - GAP) / 2 }]}
                />
              </View>
            </View>
          )}
        </>
      )}

      <PhotoViewer
        visible={viewerIndex !== null}
        images={images}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  row: { flexDirection: 'row', gap: GAP },
  tile: { borderRadius: RADIUS, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { color: '#fff', fontSize: 24, fontWeight: '700' },
});
