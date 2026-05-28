import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEVELOPED_MEMORY_START_AT,
  getCachedIncomingMemoryDeveloped,
  getCachedIncomingMemoryStarts,
  loadIncomingMemoryDevelopState,
  markIncomingMemoryDeveloped,
  saveIncomingMemoryStarts,
} from '../lib/incomingMemoryDevelopState';
import { getCureProgress } from '../lib/polaroidCure';
import type { WallPost } from '../types/domain';

export function useIncomingMemoryDevelopStarts(posts: WallPost[], viewerUserId: string | null | undefined, enabled: boolean) {
  const [storedStarts, setStoredStarts] = useState<Record<string, string>>(() => viewerUserId ? getCachedIncomingMemoryStarts(viewerUserId) : {});
  const [developedStarts, setDevelopedStarts] = useState<Record<string, string>>(() => viewerUserId ? getCachedIncomingMemoryDeveloped(viewerUserId) : {});
  const [stateLoaded, setStateLoaded] = useState(!viewerUserId);
  const sessionStartsRef = useRef<Record<string, string>>({});

  const incomingPostIds = useMemo(
    () => posts.filter((post) => shouldUseViewerDevelopStart(post, viewerUserId, enabled)).map((post) => post.id),
    [enabled, posts, viewerUserId],
  );
  const incomingPostSignature = incomingPostIds.join('|');

  useEffect(() => {
    sessionStartsRef.current = {};
    if (!viewerUserId) {
      setStoredStarts({});
      setDevelopedStarts({});
      setStateLoaded(true);
      return;
    }

    setStoredStarts(getCachedIncomingMemoryStarts(viewerUserId));
    setDevelopedStarts(getCachedIncomingMemoryDeveloped(viewerUserId));
    setStateLoaded(false);

    let active = true;
    loadIncomingMemoryDevelopState(viewerUserId)
      .then(({ starts, developed }) => {
        if (!active) return;
        setStoredStarts(starts);
        setDevelopedStarts(developed);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setStateLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [viewerUserId]);

  useEffect(() => {
    if (!viewerUserId || !stateLoaded || incomingPostIds.length === 0) return;

    const completedIds = incomingPostIds.filter((postId) => !developedStarts[postId] && storedStarts[postId] && getCureProgress(storedStarts[postId]) >= 1);
    if (completedIds.length > 0) {
      const nextDeveloped = { ...developedStarts };
      for (const postId of completedIds) {
        nextDeveloped[postId] = new Date().toISOString();
        markIncomingMemoryDeveloped(viewerUserId, postId).catch(() => undefined);
      }
      setDevelopedStarts(nextDeveloped);
      return;
    }

    const additions: Record<string, string> = {};
    for (const postId of incomingPostIds) {
      if (developedStarts[postId]) continue;
      if (storedStarts[postId]) continue;
      additions[postId] = sessionStartsRef.current[postId] ?? new Date().toISOString();
      sessionStartsRef.current[postId] = additions[postId];
    }
    if (Object.keys(additions).length === 0) return;

    const next = { ...storedStarts, ...additions };
    setStoredStarts(next);
    saveIncomingMemoryStarts(viewerUserId, next).catch(() => undefined);
  }, [developedStarts, incomingPostSignature, incomingPostIds, stateLoaded, storedStarts, viewerUserId]);

  return useCallback((post: WallPost) => {
    if (!shouldUseViewerDevelopStart(post, viewerUserId, enabled)) return null;
    if (developedStarts[post.id]) return DEVELOPED_MEMORY_START_AT;
    if (storedStarts[post.id]) return storedStarts[post.id];
    if (!sessionStartsRef.current[post.id]) {
      sessionStartsRef.current[post.id] = new Date().toISOString();
    }
    return sessionStartsRef.current[post.id];
  }, [developedStarts, enabled, storedStarts, viewerUserId]);
}

function shouldUseViewerDevelopStart(post: WallPost, viewerUserId: string | null | undefined, enabled: boolean) {
  return enabled
    && !!viewerUserId
    && post.postType === 'polaroid'
    && !!post.imageUri
    && post.authorUserId !== viewerUserId
    && post.subjectUserId === viewerUserId
    && post.visibility === 'visible_to_subject';
}
