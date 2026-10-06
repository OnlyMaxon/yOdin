import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { optimizeImage } from './imageOptimize';

// Keep clips short — this is the single biggest lever on stored size and load
// time. 60s at the medium export preset lands around 5–15 MB; the hard ceiling
// below rejects anything heavier so storage stays predictable.
// Download bandwidth, not storage, is what a video actually costs: the feed only
// fetches the poster, but every tap on play pulls the whole clip. Halving the
// ceiling halves the worst case, and 30s is ample for a community post.
// `storage.rules` enforces the same byte ceiling server-side — change both.
export const MAX_VIDEO_DURATION_S = 30;
export const MAX_VIDEO_MB = 20;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

export interface PickedVideo {
  uri: string;
  poster: string;
  durationMs: number;
}

// Raised with a translation key so the caller can show a localized message.
// Carries its own interpolation values: the two messages quote different
// numbers (seconds vs megabytes), so a single shared `count` at the call site
// would put the duration into the size message.
export class VideoPickError extends Error {
  constructor(public key: string, public params?: Record<string, unknown>) {
    super(key);
  }
}

// Picker options to pass when a video may be selected — re-encode to a smaller
// resolution/bitrate at pick time. iOS honours the export preset.
export const videoPickerOptions = {
  videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
  videoMaxDuration: MAX_VIDEO_DURATION_S,
} as const;

// Validate a picked video asset and generate a compact poster still. Throws a
// VideoPickError (with a translation key) if it's too long or too large.
export async function processVideoAsset(
  asset: ImagePicker.ImagePickerAsset,
): Promise<PickedVideo> {
  const durationMs = asset.duration ?? 0;

  // videoMaxDuration only caps in-app recording, not library picks — enforce it.
  if (durationMs > (MAX_VIDEO_DURATION_S + 1) * 1000) {
    throw new VideoPickError('errors.videoTooLong', { count: MAX_VIDEO_DURATION_S });
  }
  if ((asset.fileSize ?? 0) > MAX_VIDEO_BYTES) {
    throw new VideoPickError('errors.videoTooLarge', { count: MAX_VIDEO_MB });
  }

  // A small still from the first frame — shown in the feed so the video bytes
  // are only fetched when the user actually taps play.
  let poster = '';
  try {
    const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 0, quality: 0.6 });
    poster = await optimizeImage(thumb.uri, thumb.width, thumb.height);
  } catch {
    // Poster generation can fail on some codecs — fall back to no poster.
    poster = '';
  }

  return { uri: asset.uri, poster, durationMs };
}
