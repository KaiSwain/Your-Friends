import AsyncStorage from '@react-native-async-storage/async-storage';

const STARTS_STORAGE_PREFIX = 'yourfriends.incomingMemoryDevelopStarts.v1';
const DEVELOPED_STORAGE_PREFIX = 'yourfriends.incomingMemoryDeveloped.v1';

export const DEVELOPED_MEMORY_START_AT = '1970-01-01T00:00:00.000Z';

const startsCache: Record<string, Record<string, string>> = {};
const developedCache: Record<string, Record<string, string>> = {};

export function getCachedIncomingMemoryStarts(viewerUserId: string) {
  return startsCache[viewerUserId] ?? {};
}

export function getCachedIncomingMemoryDeveloped(viewerUserId: string) {
  return developedCache[viewerUserId] ?? {};
}

export async function loadIncomingMemoryDevelopState(viewerUserId: string) {
  const [starts, developed] = await Promise.all([
    readMap(startsStorageKey(viewerUserId)),
    readMap(developedStorageKey(viewerUserId)),
  ]);
  startsCache[viewerUserId] = starts;
  developedCache[viewerUserId] = developed;
  return { starts, developed };
}

export async function saveIncomingMemoryStarts(viewerUserId: string, starts: Record<string, string>) {
  startsCache[viewerUserId] = starts;
  await AsyncStorage.setItem(startsStorageKey(viewerUserId), JSON.stringify(starts));
}

export async function markIncomingMemoryDeveloped(viewerUserId: string, postId: string) {
  const current = developedCache[viewerUserId] ?? await readMap(developedStorageKey(viewerUserId));
  if (current[postId]) return;
  const next = { ...current, [postId]: new Date().toISOString() };
  developedCache[viewerUserId] = next;
  await AsyncStorage.setItem(developedStorageKey(viewerUserId), JSON.stringify(next));
}

function startsStorageKey(viewerUserId: string) {
  return `${STARTS_STORAGE_PREFIX}:${viewerUserId}`;
}

function developedStorageKey(viewerUserId: string) {
  return `${DEVELOPED_STORAGE_PREFIX}:${viewerUserId}`;
}

async function readMap(key: string) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}
