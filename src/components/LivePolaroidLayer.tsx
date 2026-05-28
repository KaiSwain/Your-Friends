import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

import type { ColorTokens } from '../features/theme/themes';

const LIVE_VISIBILITY_CHECK_MS = 350;

type LivePlaybackPhase = 'cover' | 'playing' | 'paused';
type LivePolaroidVisibilityEntry = { visible: boolean; distanceFromCenter: number; scope: string };

let livePolaroidsMuted = true;
const livePolaroidMuteListeners = new Set<(muted: boolean) => void>();
let activeLivePolaroidId: string | null = null;
const livePolaroidVisibility = new Map<string, LivePolaroidVisibilityEntry>();
const livePolaroidActiveListeners = new Set<(activeId: string | null) => void>();
const disabledLivePolaroidScopes = new Set<string>();

function setLivePolaroidsMuted(muted: boolean) {
  livePolaroidsMuted = muted;
  livePolaroidMuteListeners.forEach((listener) => listener(muted));
}

function subscribeLivePolaroidMuted(listener: (muted: boolean) => void) {
  livePolaroidMuteListeners.add(listener);
  return () => {
    livePolaroidMuteListeners.delete(listener);
  };
}

function updateLivePolaroidVisibility(id: string, visible: boolean, distanceFromCenter: number, scope: string) {
  livePolaroidVisibility.set(id, { visible, distanceFromCenter, scope });
  recomputeActiveLivePolaroid();
}

function removeLivePolaroid(id: string) {
  livePolaroidVisibility.delete(id);
  recomputeActiveLivePolaroid();
}

function recomputeActiveLivePolaroid() {
  let nextActiveId: string | null = null;
  let nextDistance = Number.POSITIVE_INFINITY;

  livePolaroidVisibility.forEach((entry, id) => {
    if (!entry.visible) return;
    if (disabledLivePolaroidScopes.has(entry.scope)) return;
    if (entry.distanceFromCenter < nextDistance) {
      nextActiveId = id;
      nextDistance = entry.distanceFromCenter;
    }
  });

  if (activeLivePolaroidId === nextActiveId) return;
  activeLivePolaroidId = nextActiveId;
  livePolaroidActiveListeners.forEach((listener) => listener(nextActiveId));
}

function subscribeActiveLivePolaroid(listener: (activeId: string | null) => void) {
  livePolaroidActiveListeners.add(listener);
  return () => {
    livePolaroidActiveListeners.delete(listener);
  };
}

export function stopAllLivePolaroids() {
  livePolaroidVisibility.clear();
  if (activeLivePolaroidId === null) return;
  activeLivePolaroidId = null;
  livePolaroidActiveListeners.forEach((listener) => listener(null));
}

export function setLivePolaroidScopeEnabled(scope: string, enabled: boolean) {
  if (enabled) {
    disabledLivePolaroidScopes.delete(scope);
  } else {
    disabledLivePolaroidScopes.add(scope);
  }
  recomputeActiveLivePolaroid();
}

export function LivePolaroidLayer({
  videoUri,
  colors,
  scope = 'global',
  playbackEnabled = true,
  forceMuted = false,
  forcePlayback = false,
}: {
  videoUri: string;
  colors: ColorTokens;
  scope?: string;
  playbackEnabled?: boolean;
  forceMuted?: boolean;
  forcePlayback?: boolean;
}) {
  const layerRef = useRef<View>(null);
  const instanceId = useRef(`live-polaroid:${Math.random().toString(36).slice(2)}`).current;
  const [activeId, setActiveId] = useState(activeLivePolaroidId);
  const [playbackPhase, setPlaybackPhase] = useState<LivePlaybackPhase>('cover');
  const [muted, setMuted] = useState(livePolaroidsMuted);
  const isManualPlayback = !forcePlayback;
  const isActive = forcePlayback || activeId === instanceId || (isManualPlayback && playbackPhase !== 'cover');
  const showingVideo = playbackEnabled && (forcePlayback ? isActive : playbackPhase !== 'cover');
  const effectiveMuted = forceMuted || muted;
  const player = useVideoPlayer(videoUri, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = forceMuted || livePolaroidsMuted;
  });

  useEffect(() => subscribeLivePolaroidMuted(setMuted), []);
  useEffect(() => subscribeActiveLivePolaroid(setActiveId), []);

  useEffect(() => () => removeLivePolaroid(instanceId), [instanceId]);

  useEffect(() => {
    player.muted = effectiveMuted;
  }, [effectiveMuted, player]);

  useEffect(() => {
    if (showingVideo && playbackPhase === 'playing') {
      player.play();
    } else if (showingVideo && playbackPhase === 'paused') {
      player.pause();
    } else if (forcePlayback && showingVideo) {
      player.currentTime = 0;
      player.play();
    } else {
      player.pause();
      if (playbackPhase === 'cover') player.currentTime = 0;
    }
  }, [forcePlayback, playbackPhase, player, showingVideo]);

  useEffect(() => {
    if (!playbackEnabled || (!isManualPlayback && !isActive)) {
      setPlaybackPhase('cover');
      return;
    }

    if (forcePlayback && playbackPhase === 'cover') {
      setPlaybackPhase('playing');
    }
  }, [forcePlayback, isActive, isManualPlayback, playbackEnabled, playbackPhase]);

  useEffect(() => {
    const subscription = player.addListener('playToEnd', () => {
      setPlaybackPhase('cover');
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') updateLivePolaroidVisibility(instanceId, false, Number.POSITIVE_INFINITY, scope);
    });
    return () => subscription.remove();
  }, [instanceId, scope]);

  useEffect(() => {
    if (playbackEnabled) return;
    updateLivePolaroidVisibility(instanceId, false, Number.POSITIVE_INFINITY, scope);
    setPlaybackPhase('cover');
  }, [instanceId, playbackEnabled, scope]);

  const togglePlayback = useCallback(() => {
    if (!playbackEnabled || !isManualPlayback) return;
    if (playbackPhase === 'cover') {
      player.currentTime = 0;
      setPlaybackPhase('playing');
      return;
    }
    setPlaybackPhase((phase) => (phase === 'playing' ? 'paused' : 'playing'));
  }, [isManualPlayback, playbackEnabled, playbackPhase, player]);

  useEffect(() => {
    const id = setInterval(() => {
      layerRef.current?.measureInWindow((x, y, width, height) => {
        const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const visible = playbackEnabled && x + width > 40 && x < windowWidth - 40 && y + height > 80 && y < windowHeight - 80;
        updateLivePolaroidVisibility(instanceId, visible, Math.hypot(centerX - windowWidth / 2, centerY - windowHeight / 2), scope);
      });
    }, LIVE_VISIBILITY_CHECK_MS);
    return () => clearInterval(id);
  }, [instanceId, playbackEnabled, scope]);

  return (
    <Pressable
      ref={layerRef}
      onPress={(event) => {
        event.stopPropagation();
        togglePlayback();
      }}
      disabled={!playbackEnabled || !isManualPlayback}
      style={styles.layer}
      accessibilityRole={isManualPlayback ? 'button' : undefined}
      accessibilityLabel={playbackPhase === 'playing' ? 'Pause Live Memory Card' : 'Play Live Memory Card'}
    >
      {showingVideo ? (
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="cover"
          fullscreenOptions={{ enable: false }}
          allowsPictureInPicture={false}
        />
      ) : null}
      {isActive && !forceMuted ? (
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            setLivePolaroidsMuted(!livePolaroidsMuted);
          }}
          style={styles.soundButton}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Turn Live Memory Card sound on' : 'Mute Live Memory Card sound'}
        >
          <Ionicons name={effectiveMuted ? 'volume-mute' : 'volume-high'} size={14} color="#fff" />
        </Pressable>
      ) : null}
      {playbackEnabled && isManualPlayback && playbackPhase !== 'playing' ? (
        <View pointerEvents="none" style={styles.playHint}>
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
  video: {
    position: 'absolute',
    top: -3,
    right: -3,
    bottom: -3,
    left: -3,
    transform: [{ scale: 1.05 }],
  },
  soundButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  playHint: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
});
