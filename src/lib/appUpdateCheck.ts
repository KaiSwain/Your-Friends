import Constants from 'expo-constants';
import { Platform } from 'react-native';

// We look the app up by bundle id so we never have to hardcode the numeric
// App Store id, and we read the *live* store version from Apple's iTunes
// lookup endpoint. That endpoint always reflects the version currently
// available to download, so an "update available" result is real (the only
// rare edge is brief store-propagation lag right after a release).
const IOS_BUNDLE_ID = 'com.yourfriends.app';
const APP_STORE_FALLBACK_URL = 'https://apps.apple.com/app/id6764458556';

export interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion: string | null;
  storeUrl: string;
}

export function getInstalledAppVersion(): string | null {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' ? version : null;
}

// Numeric, segment-by-segment compare. Returns 1 if a > b, -1 if a < b, 0 if equal.
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((part) => parseInt(part, 10) || 0);
  const pb = b.split('.').map((part) => parseInt(part, 10) || 0);
  const length = Math.max(pa.length, pb.length);
  for (let i = 0; i < length; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult | null> {
  // iTunes lookup is iOS-only. (Android would need a different mechanism.)
  if (Platform.OS !== 'ios') return null;
  const installed = getInstalledAppVersion();
  if (!installed) return null;

  try {
    // Cache-bust so we don't get a stale CDN copy right after a release.
    const response = await fetch(`https://itunes.apple.com/lookup?bundleId=${IOS_BUNDLE_ID}&t=${Date.now()}`);
    if (!response.ok) return null;
    const data = await response.json();
    const entry = Array.isArray(data?.results) ? data.results[0] : null;
    const latestVersion: string | null = typeof entry?.version === 'string' ? entry.version : null;
    if (!latestVersion) return null;
    const storeUrl: string = typeof entry?.trackViewUrl === 'string' ? entry.trackViewUrl : APP_STORE_FALLBACK_URL;
    return {
      updateAvailable: compareVersions(latestVersion, installed) > 0,
      latestVersion,
      storeUrl,
    };
  } catch {
    // Network errors should never block the app — just skip the check.
    return null;
  }
}
