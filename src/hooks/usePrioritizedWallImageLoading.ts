import { useCallback, useEffect, useMemo, useState } from 'react';

import type { WallPost } from '../types/domain';

export function usePrioritizedWallImageLoading(posts: WallPost[], priorityReady: boolean) {
  const imagePostIds = useMemo(
    () => posts.filter((post) => !!post.imageUri).map((post) => post.id),
    [posts],
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

  const nextImagePostId = useMemo(() => {
    if (!priorityReady) return null;
    return imagePostIds.find((postId) => !loadedImagePostIds.has(postId)) ?? null;
  }, [imagePostIds, loadedImagePostIds, priorityReady]);

  const isImageLoadEnabled = useCallback((post: WallPost) => {
    if (!post.imageUri) return true;
    if (!priorityReady) return false;
    return loadedImagePostIds.has(post.id) || post.id === nextImagePostId;
  }, [loadedImagePostIds, nextImagePostId, priorityReady]);

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