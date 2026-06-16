import AsyncStorage from '@react-native-async-storage/async-storage';

/** How long a dismissed ad stays hidden before it can appear again. */
export const AD_DISMISS_TTL_MS = 6 * 60 * 60 * 1000;

export type AdPlacement = 'store';

function dismissalKey(userId: string, placement: AdPlacement) {
  return `yourfriends:adDismissedUntil:${placement}:${userId}`;
}

export async function isAdDismissed(userId: string, placement: AdPlacement, now = Date.now()) {
  const raw = await AsyncStorage.getItem(dismissalKey(userId, placement));
  if (!raw) return false;
  const dismissedUntil = Number(raw);
  if (!Number.isFinite(dismissedUntil) || dismissedUntil <= now) {
    await AsyncStorage.removeItem(dismissalKey(userId, placement));
    return false;
  }
  return true;
}

export async function dismissAd(
  userId: string,
  placement: AdPlacement,
  ttlMs = AD_DISMISS_TTL_MS,
  now = Date.now(),
) {
  const dismissedUntil = now + ttlMs;
  await AsyncStorage.setItem(dismissalKey(userId, placement), String(dismissedUntil));
  return dismissedUntil;
}
