import { Platform } from 'react-native';

const DISABLED_GOOGLE_CLIENT_ID = 'disabled-google-client-id.apps.googleusercontent.com';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

export const googleAuthRequestConfig = {
  clientId: googleWebClientId || DISABLED_GOOGLE_CLIENT_ID,
  iosClientId: googleIosClientId || DISABLED_GOOGLE_CLIENT_ID,
  androidClientId: googleAndroidClientId || DISABLED_GOOGLE_CLIENT_ID,
};

export function isGoogleAuthConfigured() {
  if (Platform.OS === 'ios') return Boolean(googleIosClientId);
  if (Platform.OS === 'android') return Boolean(googleAndroidClientId);
  return Boolean(googleWebClientId);
}

export function getGoogleAuthMissingMessage() {
  if (Platform.OS === 'ios') return 'Google sign-in needs EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID set for this build.';
  if (Platform.OS === 'android') return 'Google sign-in needs EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID set for this build.';
  return 'Google sign-in needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID set for this build.';
}
