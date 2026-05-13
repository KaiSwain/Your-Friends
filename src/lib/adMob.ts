import Constants from 'expo-constants';

export const IOS_ADMOB_APP_ID = 'ca-app-pub-9302685357703058~8056816546';
export const IOS_STORE_BANNER_AD_UNIT_ID = 'ca-app-pub-9302685357703058/1435567877';
export const USE_TEST_ADS = true;

export function canUseNativeMobileAds() {
	return Constants.executionEnvironment !== 'storeClient';
}