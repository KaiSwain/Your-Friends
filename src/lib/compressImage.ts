import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MAX_DIMENSION = 1200;
const QUALITY = 0.7;

/**
 * Compress a local image URI, resizing to fit within MAX_DIMENSION and
 * applying JPEG quality reduction. Returns the path of the compressed image.
 */
export async function compressImage(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    { compress: QUALITY, format: SaveFormat.JPEG },
  );
  return result.uri;
}
