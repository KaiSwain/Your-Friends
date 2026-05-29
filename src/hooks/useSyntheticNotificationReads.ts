import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = '@yourfriends:synthetic-notification-reads:';

const cacheByUserId = new Map<string, Set<string>>();
const listenersByUserId = new Map<string, Set<(readIds: Set<string>) => void>>();

function getListeners(userId: string) {
  let listeners = listenersByUserId.get(userId);
  if (!listeners) {
    listeners = new Set();
    listenersByUserId.set(userId, listeners);
  }
  return listeners;
}

function emit(userId: string, readIds: Set<string>) {
  for (const listener of getListeners(userId)) listener(new Set(readIds));
}

async function loadReadIds(userId: string) {
  const cached = cacheByUserId.get(userId);
  if (cached) return new Set(cached);

  const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${userId}`);
  const parsed = raw ? JSON.parse(raw) : [];
  const readIds = new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  cacheByUserId.set(userId, readIds);
  return new Set(readIds);
}

async function saveReadIds(userId: string, readIds: Set<string>) {
  cacheByUserId.set(userId, new Set(readIds));
  await AsyncStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify([...readIds]));
  emit(userId, readIds);
}

export function isSyntheticNotificationId(notificationId: string) {
  return notificationId.startsWith('friend-request-fallback:')
    || notificationId.startsWith('calendar-share-fallback:')
    || notificationId.startsWith('wall-post-fallback:')
    || notificationId.startsWith('memory-prompt-request-fallback:')
    || notificationId.startsWith('movie-review-request-fallback:');
}

export function useSyntheticNotificationReads(userId: string | null) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      setReadIds(new Set());
      return;
    }

    let active = true;
    loadReadIds(userId).then((loaded) => {
      if (active) setReadIds(loaded);
    }).catch(() => {
      if (active) setReadIds(new Set());
    });

    const listeners = getListeners(userId);
    const listener = (nextReadIds: Set<string>) => setReadIds(new Set(nextReadIds));
    listeners.add(listener);
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, [userId]);

  const markSyntheticRead = useCallback(async (notificationId: string) => {
    if (!userId || !isSyntheticNotificationId(notificationId)) return;
    const current = await loadReadIds(userId);
    if (current.has(notificationId)) return;
    current.add(notificationId);
    await saveReadIds(userId, current);
  }, [userId]);

  const markSyntheticManyRead = useCallback(async (notificationIds: string[]) => {
    if (!userId) return;
    const syntheticIds = notificationIds.filter(isSyntheticNotificationId);
    if (syntheticIds.length === 0) return;
    const current = await loadReadIds(userId);
    let changed = false;
    for (const notificationId of syntheticIds) {
      if (current.has(notificationId)) continue;
      current.add(notificationId);
      changed = true;
    }
    if (changed) await saveReadIds(userId, current);
  }, [userId]);

  return { readIds, markSyntheticRead, markSyntheticManyRead };
}
