import { canUseNativeMobileAds } from './adMob';

export function initializeMobileAds() {
  if (!canUseNativeMobileAds()) return;

  try {
    const mobileAds = require('react-native-google-mobile-ads').default as typeof import('react-native-google-mobile-ads').default;
    mobileAds().initialize().catch(() => undefined);
  } catch {
    return;
  }
}