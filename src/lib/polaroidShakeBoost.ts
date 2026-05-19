import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'yourfriends:polaroidShakeBoost:';

type BoostListener = (boostMs: number) => void;

const boostCache = new Map<string, number>();
const lastBoostAtByPostId = new Map<string, number>();
const listenersByPostId = new Map<string, Set<BoostListener>>();

function storageKey(postId: string) {
  return `${STORAGE_PREFIX}${postId}`;
}

function normalizeBoost(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.floor(numeric);
}

function notify(postId: string, boostMs: number) {
  const listeners = listenersByPostId.get(postId);
  if (!listeners) return;
  for (const listener of listeners) listener(boostMs);
}

export function getCachedPolaroidShakeBoost(postId: string): number {
  return boostCache.get(postId) ?? 0;
}

export async function loadPolaroidShakeBoost(postId: string): Promise<number> {
  const cached = boostCache.get(postId);
  if (cached !== undefined) return cached;

  try {
    const raw = await AsyncStorage.getItem(storageKey(postId));
    const boostMs = normalizeBoost(raw);
    boostCache.set(postId, boostMs);
    notify(postId, boostMs);
    return boostMs;
  } catch {
    return 0;
  }
}

export async function setPolaroidShakeBoost(postId: string, boostMs: number): Promise<void> {
  const normalized = normalizeBoost(boostMs);
  boostCache.set(postId, normalized);
  notify(postId, normalized);

  try {
    if (normalized === 0) await AsyncStorage.removeItem(storageKey(postId));
    else await AsyncStorage.setItem(storageKey(postId), String(normalized));
  } catch {
    // The in-memory cache still keeps screens in sync for the current session.
  }
}

export function addPolaroidShakeBoost(
  postId: string,
  amountMs: number,
  maxBoostMs: number,
  cooldownMs: number,
  timestamp: number = Date.now(),
): number | null {
  const lastBoostAt = lastBoostAtByPostId.get(postId) ?? 0;
  if (timestamp - lastBoostAt < cooldownMs) return null;

  const currentBoostMs = getCachedPolaroidShakeBoost(postId);
  if (currentBoostMs >= maxBoostMs) return null;

  const nextBoostMs = Math.min(maxBoostMs, currentBoostMs + amountMs);
  lastBoostAtByPostId.set(postId, timestamp);
  void setPolaroidShakeBoost(postId, nextBoostMs);
  return nextBoostMs;
}

export function subscribePolaroidShakeBoost(postId: string, listener: BoostListener): () => void {
  let listeners = listenersByPostId.get(postId);
  if (!listeners) {
    listeners = new Set<BoostListener>();
    listenersByPostId.set(postId, listeners);
  }
  listeners.add(listener);

  return () => {
    const currentListeners = listenersByPostId.get(postId);
    currentListeners?.delete(listener);
    if (currentListeners?.size === 0) listenersByPostId.delete(postId);
  };
}
