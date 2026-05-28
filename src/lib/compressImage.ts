import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const DEFAULT_MAX_DIMENSION = 1080;
const DEFAULT_QUALITY = 0.68;

interface CompressImageOptions {
  maxDimension?: number;
  quality?: number;
}

/**
 * Compress a local image URI, resizing to fit within MAX_DIMENSION and
 * applying JPEG quality reduction. Returns the path of the compressed image.
 */
export async function compressImage(uri: string, options: CompressImageOptions = {}): Promise<string> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: maxDimension } }],
    { compress: quality, format: SaveFormat.JPEG },
  );
  return result.uri;
}
