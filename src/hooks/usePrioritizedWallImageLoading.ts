import { useCallback, useEffect, useMemo, useState } from 'react';

import { prefetchCachedImages } from '../components/CachedRemoteImage';
import type { WallPost } from '../types/domain';

const ACTIVE_IMAGE_LOAD_LIMIT = 3;
const THUMBNAIL_PREFETCH_LIMIT = 8;

export function usePrioritizedWallImageLoading(posts: WallPost[], priorityReady: boolean) {
  const imagePosts = useMemo(
    () => posts.filter((post) => !!post.imageUri),
    [posts],
  );
  const imagePostIds = useMemo(
    () => imagePosts.map((post) => post.id),
    [imagePosts],
  );
  const [loadedImagePostIds, setLoadedImagePostIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const activeIds = new Set(imagePostIds);
    setLoadedImagePostIds((previousIds) => {
      let changed = false;
      const nextIds = new Set<string>();
      for (const postId of previousIds) {
        if (activeIds.has(postId)) {
          nextIds.add(postId);
        } else {
          changed = true;
        }
      }
      return changed ? nextIds : previousIds;
    });
  }, [imagePostIds]);

  const activeImagePostIds = useMemo(() => {
    if (!priorityReady) return null;
    return new Set(
      imagePostIds
        .filter((postId) => !loadedImagePostIds.has(postId))
        .slice(0, ACTIVE_IMAGE_LOAD_LIMIT),
    );
  }, [imagePostIds, loadedImagePostIds, priorityReady]);

  useEffect(() => {
    if (!priorityReady || imagePosts.length === 0) return;
    const thumbUris = imagePosts.slice(0, THUMBNAIL_PREFETCH_LIMIT).map((post) => post.imageThumbUri ?? post.imageUri);
    const firstFullUris = imagePosts.slice(0, ACTIVE_IMAGE_LOAD_LIMIT).map((post) => post.imageUri);
    prefetchCachedImages([...thumbUris, ...firstFullUris]).catch(() => undefined);
  }, [imagePosts, priorityReady]);

  const isImageLoadEnabled = useCallback((post: WallPost) => {
    if (!post.imageUri) return true;
    if (!priorityReady) return false;
    return loadedImagePostIds.has(post.id) || Boolean(activeImagePostIds?.has(post.id));
  }, [activeImagePostIds, loadedImagePostIds, priorityReady]);

  const markImageReady = useCallback((postId: string) => {
    setLoadedImagePostIds((previousIds) => {
      if (previousIds.has(postId)) return previousIds;
      return new Set(previousIds).add(postId);
    });
  }, []);

  return {
    isImageLoadEnabled,
    markImageReady,
  };
}