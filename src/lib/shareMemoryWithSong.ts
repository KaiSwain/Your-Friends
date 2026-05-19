import type { RefObject } from 'react';
import { Alert, Platform, Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import type { MusicOpenPreference } from '../features/music/MusicPreferenceContext';
import type { SongAttachment } from '../types/domain';
import { resolveSongExternalUrl } from './musicLinks';

interface ShareMemoryWithSongOptions {
  song: SongAttachment;
  preference: MusicOpenPreference;
}

export async function shareMemoryWithSong(viewRef: RefObject<any>, { song, preference }: ShareMemoryWithSongOptions) {
  try {
    if (!viewRef.current) return;

    const memoryUri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
    });
    const songUrl = await resolveSongExternalUrl(song, preference);

    if (Platform.OS === 'ios') {
      await Share.share(
        { message: songUrl, url: memoryUri },
      );
      return;
    }

    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(memoryUri, {
        mimeType: 'image/png',
        dialogTitle: 'Share memory photo',
        UTI: 'public.png',
      });
    }
    await Share.share({ message: songUrl }, { dialogTitle: 'Share song link' });
  } catch {
    if (Platform.OS !== 'web') Alert.alert('Oops', 'Could not share this memory and song.');
  }
}