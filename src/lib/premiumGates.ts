import { Alert } from 'react-native';

/**
 * Show a paywall prompt explaining that picking photos from the gallery is a
 * premium feature. Calls `onUpgrade` if the user taps "Unlock". Returns
 * nothing — call sites should bail out after invoking this.
 */
export function showGalleryPaywall(onUpgrade: () => void) {
  Alert.alert(
    'Premium feature',
    'Choosing photos from your gallery is part of the premium unlock. Take a fresh memory card, or unlock everything to add photos from your camera roll.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Unlock', onPress: onUpgrade },
    ],
  );
}

export function showMediaMemoryPaywall(onUpgrade: () => void) {
  Alert.alert(
    'Premium feature',
    'Regular media memories are part of Premium. You can still make Memory Cards for free, or unlock Premium to add clean photo/video media cards.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Unlock Premium', onPress: onUpgrade },
    ],
  );
}

export function showGiftNotePaywall(onUpgrade: () => void) {
  Alert.alert(
    'Premium feature',
    'Gift notes are part of Premium. Unlock Premium to lock surprise notes that become memories later.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Unlock Premium', onPress: onUpgrade },
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

export function showPromptPaywall(onUpgrade: () => void) {
  Alert.alert(
    'Premium feature',
    'Sending memory prompts is part of Premium. Unlock Premium to ask friends for songs, photo memories, voice memories, and notes.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Unlock Premium', onPress: onUpgrade },
    ],
  );
}

export function showVoiceMemoryPaywall(onUpgrade: () => void) {
  Alert.alert(
    'Premium feature',
    'Voice memories are part of Premium. Unlock Premium to record short audio memories and answer voice prompts.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Unlock Premium', onPress: onUpgrade },
    ],
  );
}

export function showShakeDevelopPaywall(onUpgrade: () => void) {
  Alert.alert(
    'Premium feature',
    'Shake-to-develop is a Premium memory-card trick. Unlock Premium to shake fresh photos and help them come to life faster.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Unlock Premium', onPress: onUpgrade },
    ],
  );
}

export function showProfileBackgroundPaywall(onUpgrade: () => void) {
  Alert.alert(
    'Premium feature',
    'Custom profile backgrounds are part of Premium. Unlock everything to use gallery photos as full profile backdrops.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Unlock Premium', onPress: onUpgrade },
    ],
  );
}
