import { type RefObject } from 'react';
import { Alert, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

/**
 * Capture a React Native View ref as a PNG and open the native share sheet.
 * Works for sharing via Messages / SMS, AirDrop, social apps, etc.
 */
export async function sharePolaroid(viewRef: RefObject<any>): Promise<void> {
  try {
    if (!viewRef.current) return;

    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
    });

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing is not available on this device.');
      return;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share this polaroid',
      UTI: 'public.png',
    });
  } catch (error) {
    if (Platform.OS !== 'web') {
      Alert.alert('Oops', 'Could not share this polaroid.');
    }
  }
}
