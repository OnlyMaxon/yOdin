import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Cap the longest side so full-resolution camera shots (often 3000–4000px) are
// scaled down to a screen-friendly size, then JPEG-compress.
//
// The cap is on the *longest* side, but the feed crops photos into a square at
// full card width — and a square crop is limited by the *shortest* side. At the
// old cap of 1280 a normal 4:3 photo stored 1280×960, so 960px was stretched
// into a container around 1140px wide on a 3x phone, and worse on a 1440p one.
// 1600 puts that short side at 1200px: no upscaling, and the fullscreen viewer
// (which shows the whole frame, not a crop) has something to work with too.
//
// Quality went 0.6 → 0.8 because 0.6 blocks visibly on skies and skin, and the
// extra bytes are modest next to the resolution change.
//
// Cost: a stored photo goes from roughly 80–250 KB to 250–600 KB, so Storage
// and egress roughly triple — and egress is the first Firebase free-tier limit
// to bite. Lower these two numbers if that starts to hurt before it pays off.
const MAX_DIMENSION = 1600;
const COMPRESS = 0.8;

export async function optimizeImage(uri: string, width?: number, height?: number): Promise<string> {
  const manipulator = ImageManipulator.manipulate(uri);
  const longest = Math.max(width ?? 0, height ?? 0);
  if (longest > MAX_DIMENSION) {
    // Scale the longer edge down to MAX_DIMENSION; the other is auto-computed.
    if ((width ?? 0) >= (height ?? 0)) manipulator.resize({ width: MAX_DIMENSION });
    else manipulator.resize({ height: MAX_DIMENSION });
  }
  const rendered = await manipulator.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: COMPRESS });
  return result.uri;
}
