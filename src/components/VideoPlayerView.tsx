import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface Props {
  uri: string;
  autoPlay?: boolean;
  style?: ViewStyle;
}

// Inline player used in the detail views. Native controls + fullscreen come for
// free from expo-video; we only manage autoplay.
export default function VideoPlayerView({ uri, autoPlay, style }: Props) {
  const player = useVideoPlayer(uri, (p: ReturnType<typeof useVideoPlayer>) => {
    p.loop = false;
    if (autoPlay) p.play();
  });

  return (
    <View style={[styles.wrap, style]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls
        fullscreenOptions={{ enable: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
});
