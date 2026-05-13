import { Alert } from 'react-native';

/**
 * Show a paywall prompt explaining that picking photos from the gallery is a
 * premium feature. Calls `onUpgrade` if the user taps "Unlock". Returns
 * nothing — call sites should bail out after invoking this.
 */
export function showGalleryPaywall(onUpgrade: () => void) {
  Alert.alert(
    'Premium feature',
    'Choosing photos from your gallery is part of the premium unlock. Take a fresh polaroid, or unlock everything to add photos from your camera roll.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Unlock', onPress: onUpgrade },
    ],
  );
}

export function showAiCaptionPaywall(onUpgrade: () => void) {
  Alert.alert(
    'Premium feature',
    'AI captions are part of Premium. Unlock everything to generate captions from your photo and relationship context.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Unlock', onPress: onUpgrade },
    ],
  );
}

export function showCalendarPaywall(onUpgrade: () => void) {
  Alert.alert(
    'Premium feature',
    'Premium unlocks birthdays, events, and reminders so you never miss a friendship moment.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Unlock', onPress: onUpgrade },
    ],
  );
}
