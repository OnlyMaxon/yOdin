import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import AppImage from './AppImage';
import PhotoViewer from './PhotoViewer';
import VideoPlayerView from './VideoPlayerView';

interface Props {
  images?: string[];
  videoURL?: string;
  videoPoster?: string;
  // In the detail view the video plays inline; in the feed it shows a poster
  // with a play badge and a tap opens the detail (cheap to scroll).
  videoInline?: boolean;
  onVideoPress?: () => void;
  // When provided, tapping a photo runs this instead of opening the fullscreen
  // viewer (used in the feed so a tap opens the post, like the rest of the card).
  onImagePress?: () => void;
}

type Item = { type: 'image'; uri: string } | { type: 'video'; uri: string; poster?: string };

// Instagram-style swipeable media: photos and an optional video in one card,
// square framed, with page dots + a counter. Photos open a fullscreen viewer.
export default function MediaCarousel({ images, videoURL, videoPoster, videoInline, onVideoPress, onImagePress }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const imgs = images ?? [];
  const items: Item[] = [
    ...imgs.map((uri) => ({ type: 'image' as const, uri })),
    ...(videoURL ? [{ type: 'video' as const, uri: videoURL, poster: videoPoster }] : []),
  ];
  if (items.length === 0) return null;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  function renderItem({ item, index }: { item: Item; index: number }) {
    if (item.type === 'image') {
      return (
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => (onImagePress ? onImagePress() : setViewerIndex(index))}
          style={{ width, height: width }}
        >
          <AppImage source={{ uri: item.uri }} style={styles.media} contentFit="cover" />
        </TouchableOpacity>
      );
    }
    if (videoInline) {
      return (
        <View style={{ width, height: width, backgroundColor: '#000', justifyContent: 'center' }}>
          <VideoPlayerView uri={item.uri} style={{ width, aspectRatio: undefined, height: width, borderRadius: 0 }} />
        </View>
      );
    }
    return (
      <TouchableOpacity activeOpacity={0.95} onPress={onVideoPress} style={{ width, height: width, backgroundColor: '#000' }}>
        {item.poster ? <AppImage source={{ uri: item.poster }} style={styles.media} contentFit="cover" /> : null}
        <View style={styles.playBadge}>
          <Ionicons name="play" size={26} color="#fff" style={{ marginLeft: 3 }} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 && (
        <>
          <FlatList
            key={width}
            data={items}
            keyExtractor={(it, i) => `${it.uri}-${i}`}
            renderItem={renderItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          />

          {items.length > 1 && (
            <>
              <View style={styles.counter}>
                <Text style={styles.counterText}>{page + 1}/{items.length}</Text>
              </View>
              <View style={styles.dots} pointerEvents="none">
                {items.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, { backgroundColor: i === page ? colors.primary : 'rgba(255,255,255,0.6)' }]}
                  />
                ))}
              </View>
            </>
          )}
        </>
      )}

      <PhotoViewer
        visible={viewerIndex !== null}
        images={imgs}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  media: { width: '100%', height: '100%' },
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
  counter: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
