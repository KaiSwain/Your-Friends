type VoicePlaybackListener = (activeVoiceId: string) => void;

const listeners = new Set<VoicePlaybackListener>();

export function announceActiveVoicePlayback(activeVoiceId: string) {
  listeners.forEach((listener) => listener(activeVoiceId));
}

export function stopAllVoicePlayback() {
  announceActiveVoicePlayback('__stop_all_voice_playback__');
}

export function subscribeActiveVoicePlayback(listener: VoicePlaybackListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
