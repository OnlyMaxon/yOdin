import React from 'react';
import { Image, ImageProps } from 'expo-image';

// Thin wrapper over expo-image so every remote image in the app shares the same
// caching + decode behaviour. expo-image decodes off the main thread and keeps a
// memory+disk cache, which is what keeps media-heavy lists smooth (RN's built-in
// Image decodes on the UI thread and janks scrolling on ProMotion displays).
export default function AppImage(props: ImageProps) {
  return <Image cachePolicy="memory-disk" transition={120} {...props} />;
}
