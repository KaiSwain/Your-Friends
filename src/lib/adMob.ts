import Constants from 'expo-constants';

export const IOS_ADMOB_APP_ID = 'ca-app-pub-9302685357703058~8056816546';
export const IOS_STORE_BANNER_AD_UNIT_ID = 'ca-app-pub-9302685357703058/1435567877';
// Serve Google's test ads only in development. Production/TestFlight builds
// (`__DEV__ === false`) must use the real ad units to earn revenue and stay
// within AdMob policy. Override via EXPO_PUBLIC_USE_TEST_ADS if ever needed.
export const USE_TEST_ADS =
  process.env.EXPO_PUBLIC_USE_TEST_ADS === 'true'
    ? true
    : process.env.EXPO_PUBLIC_USE_TEST_ADS === 'false'
      ? false
      : __DEV__;

export function canUseNativeMobileAds() {
	return Constants.executionEnvironment !== 'storeClient';
}