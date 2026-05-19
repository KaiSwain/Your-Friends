type SongPreviewListener = (activePreviewId: string) => void;

const listeners = new Set<SongPreviewListener>();

export function announceActiveSongPreview(activePreviewId: string) {
  listeners.forEach((listener) => listener(activePreviewId));
}

export function stopAllSongPreviews() {
  announceActiveSongPreview('__stop_all_song_previews__');
}

export function subscribeActiveSongPreview(listener: SongPreviewListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}