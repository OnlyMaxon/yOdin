import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Cap the longest side so full-resolution camera shots (often 3000–4000px) are
// scaled down to a screen-friendly size, then JPEG-compress. This keeps each
// stored photo at roughly 80–250 KB — small on the server and fast to load.
const MAX_DIMENSION = 1280;
const COMPRESS = 0.6;

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
