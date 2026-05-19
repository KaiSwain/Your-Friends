import type { AudioPlayer } from 'expo-audio';

export function safePauseAudioPlayer(player: AudioPlayer) {
  try {
    player.pause();
  } catch {
    // Expo Audio can dispose native shared objects before React-side callbacks finish.
  }
}

export function safePlayAudioPlayer(player: AudioPlayer) {
  try {
    player.play();
  } catch {
    // Ignore stale native player handles during screen transitions or source swaps.
  }
}

export async function safeSeekAudioPlayer(player: AudioPlayer, seconds: number) {
  try {
    await player.seekTo(seconds);
  } catch {
    // Source may still be settling; playback can continue from the loaded position.
  }
}