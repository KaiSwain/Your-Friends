import { Image as ExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';

type CachedRemoteImageProps = Omit<ExpoImageProps, 'source' | 'placeholder' | 'cachePolicy' | 'transition'> & {
  uri: string;
  placeholderUri?: string | null;
  cachePolicy?: ExpoImageProps['cachePolicy'];
  transition?: ExpoImageProps['transition'];
};

export function CachedRemoteImage({
  uri,
  placeholderUri,
  cachePolicy = 'memory-disk',
  contentFit = 'cover',
  transition = 120,
  ...props
}: CachedRemoteImageProps) {
  return (
    <ExpoImage
      {...props}
      source={{ uri }}
      placeholder={placeholderUri ? { uri: placeholderUri } : undefined}
      cachePolicy={cachePolicy}
      contentFit={contentFit}
      transition={transition}
    />
  );
}

export async function prefetchCachedImages(uris: readonly (string | null | undefined)[]) {
  const uniqueUris = Array.from(new Set(uris.filter((uri): uri is string => Boolean(uri))));
  if (uniqueUris.length === 0) return;
  await Promise.all(uniqueUris.map((uri) => ExpoImage.prefetch(uri, 'memory-disk')));
}
