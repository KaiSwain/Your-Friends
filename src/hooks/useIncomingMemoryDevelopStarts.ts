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

  const developingPosts = useMemo(
    () => posts.filter((post) => shouldUseViewerDevelopStart(post, viewerUserId, enabled)),
    [enabled, posts, viewerUserId],
  );
  const developingPostSignature = developingPosts.map((post) => post.id).join('|');

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
    if (!viewerUserId || !stateLoaded || developingPosts.length === 0) return;

    // Mark anything whose develop window has fully elapsed as developed so it
    // never restarts: a stored start that ran out, or a self-authored post whose
    // own timeline already passed (e.g. posts created before we tracked author
    // develop, so they shouldn't suddenly re-develop).
    const completedIds = developingPosts
      .filter((post) => {
        if (developedStarts[post.id]) return false;
        if (storedStarts[post.id]) return getCureProgress(storedStarts[post.id]) >= 1;
        return post.authorUserId === viewerUserId && getCureProgress(post.createdAt) >= 1;
      })
      .map((post) => post.id);
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
    for (const post of developingPosts) {
      if (developedStarts[post.id]) continue;
      if (storedStarts[post.id]) continue;
      const start = sessionStartsRef.current[post.id] ?? new Date().toISOString();
      additions[post.id] = start;
      sessionStartsRef.current[post.id] = start;
    }
    if (Object.keys(additions).length === 0) return;

    const next = { ...storedStarts, ...additions };
    setStoredStarts(next);
    saveIncomingMemoryStarts(viewerUserId, next).catch(() => undefined);
  }, [developedStarts, developingPostSignature, developingPosts, stateLoaded, storedStarts, viewerUserId]);

  return useCallback((post: WallPost) => {
    if (!shouldUseViewerDevelopStart(post, viewerUserId, enabled)) return null;
    if (developedStarts[post.id]) return DEVELOPED_MEMORY_START_AT;
    if (storedStarts[post.id]) return storedStarts[post.id];
    // Persisted develop state hasn't loaded yet (e.g. cold start after the app
    // was killed for a while). We can't tell an already-developed card apart
    // from a brand-new one, so don't start a fresh develop — fall back to the
    // post's own timeline so old cards stay developed instead of restarting.
    if (!stateLoaded) return null;
    // A self-authored polaroid whose own timeline already elapsed is treated as
    // already developed, so older posts don't restart developing when this
    // viewer-develop path first starts tracking them.
    if (post.authorUserId === viewerUserId && getCureProgress(post.createdAt) >= 1) {
      return DEVELOPED_MEMORY_START_AT;
    }
    if (!sessionStartsRef.current[post.id]) {
      sessionStartsRef.current[post.id] = new Date().toISOString();
    }
    return sessionStartsRef.current[post.id];
  }, [developedStarts, enabled, stateLoaded, storedStarts, viewerUserId]);
}

function shouldUseViewerDevelopStart(post: WallPost, viewerUserId: string | null | undefined, enabled: boolean) {
  if (!enabled || !viewerUserId) return false;
  if (post.postType !== 'polaroid' || !post.imageUri) return false;
  // You develop your own polaroids after posting them.
  if (post.authorUserId === viewerUserId) return true;
  // Polaroids sent to you develop on your device when you view them.
  return post.subjectUserId === viewerUserId && post.visibility === 'visible_to_subject';
}
