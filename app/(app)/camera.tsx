import { Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType, CameraMode, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { postCapturedUri } from '../../src/lib/cameraHandoff';
import { backOnce, replaceOnce } from '../../src/lib/navigationGuard';

const POLAROID_FRAME = '#F5F2EA';
const LIVE_POLAROID_MAX_SECONDS = 30;
const LIVE_POLAROID_START_DELAY_MS = 300;
const LIVE_POLAROID_MIN_DURATION_MS = 850;

const ULTRA_WIDE = 'Back Ultra Wide Camera';
const WIDE = 'Back Camera';
const TELEPHOTO = 'Back Telephoto Camera';

type ZoomPreset = { label: string; lens: string; zoom: number };
type LiveCapturePhase = 'idle' | 'recording';

export default function PolaroidCameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    subjectId: string;
    subjectType: string;
    targetKeys: string;
    returnTo: string;
    backTo: string;
    handoff: string;
    liveHandoff: string;
    avatarHandoff: string;
    capturedVideoUri: string;
    thumbnailOnly: string;
  }>();
  // Handoff mode: emit the captured URI on a side channel and pop, so callers
  // can take a profile photo without losing their form state.
  const isHandoff = params.handoff === '1';
  const liveHandoff = params.liveHandoff === '1';
  const avatarHandoff = params.avatarHandoff === '1';
  const thumbnailOnly = params.thumbnailOnly === '1';
  const [permission, requestPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>(avatarHandoff ? 'front' : 'back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('picture');
  const [cameraReady, setCameraReady] = useState(false);
  const [liveCapturePhase, setLiveCapturePhase] = useState<LiveCapturePhase>('idle');
  const [liveSecondsRemaining, setLiveSecondsRemaining] = useState(LIVE_POLAROID_MAX_SECONDS);
  const [zoom, setZoom] = useState(0);
  const [selectedLens, setSelectedLens] = useState(WIDE);
  const [lenses, setLenses] = useState<string[]>([]);
  const cameraRef = useRef<CameraView>(null);
  const didStartLiveCaptureRef = useRef(false);
  const liveCaptureActiveRef = useRef(false);
  const recordingRef = useRef(false);
  const stopRecordingRequestedRef = useRef(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const cameraModeRef = useRef<CameraMode>('picture');
  const cameraReadyWaitersRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  // Detect available lenses once camera is ready
  const onCameraReady = useCallback(async () => {
    setCameraReady(true);
    cameraReadyWaitersRef.current.forEach((resolve) => resolve());
    cameraReadyWaitersRef.current = [];
    if (Platform.OS !== 'ios' || !cameraRef.current) return;
    try {
      const available = await cameraRef.current.getAvailableLensesAsync();
      if (available?.length) setLenses(available);
    } catch {
      // Fallback: assume just wide
    }
  }, []);

  // Backup: also listen for lens change events
  const onLensesChanged = useCallback((event: { lenses: string[] }) => {
    if (event.lenses?.length) setLenses(event.lenses);
  }, []);

  // Build presets based on available hardware
  const presets = useMemo<ZoomPreset[]>(() => {
    const hasUltraWide = lenses.includes(ULTRA_WIDE);
    const hasTelephoto = lenses.includes(TELEPHOTO);

    const list: ZoomPreset[] = [];
    if (hasUltraWide) list.push({ label: '.5', lens: ULTRA_WIDE, zoom: 0 });
    list.push({ label: '1', lens: WIDE, zoom: 0 });
    list.push({ label: '2', lens: hasTelephoto ? TELEPHOTO : WIDE, zoom: hasTelephoto ? 0 : 0.04 });
    list.push({ label: '5', lens: hasTelephoto ? TELEPHOTO : WIDE, zoom: hasTelephoto ? 0.15 : 0.12 });
    list.push({ label: '10', lens: hasTelephoto ? TELEPHOTO : WIDE, zoom: hasTelephoto ? 0.35 : 0.28 });

    return list;
  }, [lenses]);

  // Default active preset index — 1× is at index 0 or 1 depending on ultra-wide
  const defaultIdx = presets.findIndex((p) => p.label === '1');
  const [activePreset, setActivePreset] = useState(-1);
  const currentPreset = activePreset >= 0 ? activePreset : (defaultIdx >= 0 ? defaultIdx : 0);

  const selectPreset = useCallback((p: ZoomPreset, index: number) => {
    setSelectedLens(p.lens);
    setZoom(p.zoom);
    setActivePreset(index);
  }, []);

  const toggleFacing = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  const cycleFlash = useCallback(() => {
    setFlash((f) => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'));
  }, []);

  const flashIcon = flash === 'off' ? 'flash-off' : flash === 'on' ? 'flash' : 'flash-outline';

  const waitForNextCameraReady = useCallback(async (timeoutMs = 2200) => {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        cameraReadyWaitersRef.current = cameraReadyWaitersRef.current.filter((waiter) => waiter !== finish);
        resolve();
      }, timeoutMs);
      const finish = () => {
        clearTimeout(timeout);
        resolve();
      };
      cameraReadyWaitersRef.current.push(finish);
    });
  }, []);

  const switchCameraMode = useCallback(async (nextMode: CameraMode) => {
    if (cameraModeRef.current === nextMode && cameraReady) return;
    setCameraReady(false);
    cameraModeRef.current = nextMode;
    setCameraMode(nextMode);
    await waitForNextCameraReady();
    await sleep(250);
  }, [cameraReady, waitForNextCameraReady]);

  useEffect(() => {
    if (liveCapturePhase !== 'recording') return undefined;
    const id = setInterval(() => {
      if (!recordingRef.current) {
        setLiveSecondsRemaining(LIVE_POLAROID_MAX_SECONDS);
        return;
      }
      const elapsedSeconds = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
      setLiveSecondsRemaining(Math.max(0, LIVE_POLAROID_MAX_SECONDS - elapsedSeconds));
    }, 200);
    return () => clearInterval(id);
  }, [liveCapturePhase]);

  const forwardCapture = useCallback((capturedUri: string, capturedVideoUri?: string | null) => {
    if (isHandoff) {
      // Emit the URI to the screen that opened the camera and pop back so
      // its form state survives. The caller subscribes via onCapturedUri().
      postCapturedUri(capturedUri, capturedVideoUri);
      backOnce(router);
      return;
    }

    // Memory-creation flow: route forward to the add-memory composer.
    const returnTo = params.returnTo || '/(app)/memories/add';
    const { returnTo: _discard, handoff: _h, ...forwardParams } = params;
    replaceOnce(router, {
      pathname: returnTo as any,
      params: {
        ...forwardParams,
        capturedUri,
        ...(capturedVideoUri ? { capturedVideoUri } : {}),
      },
    });
  }, [isHandoff, params, router]);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    if (didStartLiveCaptureRef.current) {
      didStartLiveCaptureRef.current = false;
      return;
    }
    setCapturing(true);
    try {
      await switchCameraMode('picture');
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        forwardCapture(photo.uri);
      }
    } catch {
      // Ignore capture errors
    }
    setCapturing(false);
  }, [capturing, forwardCapture]);

  const startLivePolaroid = useCallback(async () => {
    didStartLiveCaptureRef.current = true;
    if (avatarHandoff || (isHandoff && !liveHandoff) || thumbnailOnly || capturing || recording || !cameraRef.current) return;

    let nextMicrophonePermission = microphonePermission;
    if (!nextMicrophonePermission?.granted) {
      nextMicrophonePermission = await requestMicrophonePermission();
    }
    if (!nextMicrophonePermission.granted) {
      Alert.alert('Microphone Access', 'Live Memory Cards need microphone access to record sound.');
      return;
    }

    setCapturing(true);
    setRecording(true);
    liveCaptureActiveRef.current = true;
    recordingRef.current = false;
    stopRecordingRequestedRef.current = false;
    setLiveCapturePhase('recording');
    setLiveSecondsRemaining(LIVE_POLAROID_MAX_SECONDS);

    try {
      await switchCameraMode('picture');
      const coverPhoto = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (!coverPhoto?.uri) throw new Error('Could not capture thumbnail.');

      await switchCameraMode('video');
      recordingStartedAtRef.current = Date.now();
      recordingRef.current = true;
      const recordingPromise = cameraRef.current?.recordAsync({ maxDuration: LIVE_POLAROID_MAX_SECONDS });
      if (stopRecordingRequestedRef.current) {
        setTimeout(() => cameraRef.current?.stopRecording(), LIVE_POLAROID_MIN_DURATION_MS);
      }
      const video = await recordingPromise;
      recordingRef.current = false;
      setRecording(false);
      if (video?.uri) {
        forwardCapture(coverPhoto.uri, video.uri);
      }
    } catch (error) {
      console.warn('[camera] live polaroid capture failed:', error);
      if (!stopRecordingRequestedRef.current) {
        Alert.alert('Could not save Live Memory Card', 'Try holding the shutter again.');
      }
    } finally {
      recordingRef.current = false;
      setRecording(false);
      setCapturing(false);
      liveCaptureActiveRef.current = false;
      await switchCameraMode('picture');
      setLiveCapturePhase('idle');
      setTimeout(() => {
        didStartLiveCaptureRef.current = false;
      }, 250);
    }
  }, [
    capturing,
    avatarHandoff,
    forwardCapture,
    isHandoff,
    liveHandoff,
    microphonePermission,
    recording,
    requestMicrophonePermission,
    switchCameraMode,
    thumbnailOnly,
  ]);

  const stopLivePolaroid = useCallback(() => {
    if (!liveCaptureActiveRef.current && !recordingRef.current) return;
    stopRecordingRequestedRef.current = true;
    if (!recordingRef.current) return;
    const elapsed = Date.now() - recordingStartedAtRef.current;
    const remaining = Math.max(0, LIVE_POLAROID_MIN_DURATION_MS - elapsed);
    setTimeout(() => cameraRef.current?.stopRecording(), remaining);
  }, []);

  const handleShutterPressIn = useCallback(() => {
    if (avatarHandoff || (isHandoff && !liveHandoff) || thumbnailOnly || capturing || recording) return;
    didStartLiveCaptureRef.current = false;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      void startLivePolaroid();
    }, LIVE_POLAROID_START_DELAY_MS);
  }, [avatarHandoff, capturing, isHandoff, liveHandoff, recording, startLivePolaroid, thumbnailOnly]);

  const handleShutterPressOut = useCallback(() => {
    if (avatarHandoff || (isHandoff && !liveHandoff) || thumbnailOnly) {
      void takePicture();
      return;
    }
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
      void takePicture();
      return;
    }
    stopLivePolaroid();
  }, [avatarHandoff, isHandoff, liveHandoff, stopLivePolaroid, takePicture, thumbnailOnly]);

  useEffect(() => () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  }, []);

  // Permissions loading
  if (!permission) {
    return <View style={styles.container} />;
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <Ionicons name="camera" size={48} color="#333" />
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>{avatarHandoff ? 'We need camera access to take your profile photo' : 'We need camera access to capture memory cards'}</Text>
          <Pressable onPress={requestPermission} style={styles.permissionButton}>
            <Text style={styles.permissionButtonLabel}>Grant Permission</Text>
          </Pressable>
          <Pressable onPress={() => backOnce(router)} style={styles.cancelButton}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={avatarHandoff ? styles.avatarCameraFrame : styles.polaroidFrame}>
        {!avatarHandoff ? <View style={styles.tape} /> : null}

        <View style={[styles.viewfinderContainer, avatarHandoff && styles.avatarViewfinderContainer]}>
          <CameraView
            key={`${cameraMode}-${facing}`}
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            flash={flash}
            zoom={zoom}
            onCameraReady={onCameraReady}
            {...(Platform.OS === 'ios' ? { selectedLens, onAvailableLensesChanged: onLensesChanged } : {})}
            mode={cameraMode}
            mute={false}
          />
          {avatarHandoff ? (
            <View pointerEvents="none" style={styles.avatarGuideRing} />
          ) : (
            <>
              <View style={styles.insetShadowTop} />
              <View style={styles.insetShadowLeft} />
            </>
          )}
          {liveCapturePhase !== 'idle' ? (
            <View pointerEvents="none" style={styles.liveCaptureOverlay}>
              <>
                <View style={styles.liveRecordingTopRow}>
                  <View style={styles.liveRecordingBadge}>
                    <View style={styles.liveRecordingDot} />
                    <Text style={styles.liveRecordingText}>REC</Text>
                  </View>
                  <Text style={styles.liveCountdownPill}>{liveSecondsRemaining}s</Text>
                </View>
                <View style={styles.liveCaptureBottomCard}>
                  <Text style={styles.liveCaptureTitle}>Cover captured</Text>
                  <Text style={styles.liveCaptureSubtitle}>Keep holding to record your Live Memory Card.</Text>
                </View>
              </>
            </View>
          ) : null}
        </View>

        {avatarHandoff ? (
          <Text style={styles.avatarHint}>Fit your face in the circle</Text>
        ) : (
          <View style={styles.bottomStrip}>
            <Text style={styles.brandText}>{thumbnailOnly ? 'Retake cover photo' : liveHandoff ? 'Take Memory' : 'Your Friends'}</Text>
          </View>
        )}
      </View>

      {/* Zoom presets */}
      <View style={styles.zoomRow}>
        {presets.map((p, i) => (
          <Pressable
            key={p.label}
            onPress={() => selectPreset(p, i)}
            style={[styles.zoomPill, i === currentPreset && styles.zoomPillActive]}
          >
            <Text style={[styles.zoomLabel, i === currentPreset && styles.zoomLabelActive]}>
              {p.label}×
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable onPress={cycleFlash} style={styles.controlButton}>
          <Ionicons name={flashIcon} size={24} color="#fff" />
          <Text style={styles.controlLabel}>{flash === 'auto' ? 'Auto' : flash === 'on' ? 'On' : 'Off'}</Text>
        </Pressable>

        <Pressable
          onPressIn={handleShutterPressIn}
          onPressOut={handleShutterPressOut}
          disabled={capturing && !recording}
          style={styles.shutterOuter}
        >
          <View style={[styles.shutterInner, capturing && styles.shutterCapturing, recording && styles.shutterRecording]} />
        </Pressable>

        <Pressable onPress={toggleFacing} style={styles.controlButton}>
          <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
          <Text style={styles.controlLabel}>Flip</Text>
        </Pressable>
      </View>

      {/* Close button */}
      <Pressable onPress={() => backOnce(router)} style={styles.closeButton}>
        <Ionicons name="close" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Polaroid frame ── */
  polaroidFrame: {
    backgroundColor: POLAROID_FRAME,
    borderRadius: 4,
    padding: 12,
    paddingBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    alignItems: 'center',
    transform: [{ rotate: '-1.5deg' }],
  },
  avatarCameraFrame: {
    alignItems: 'center',
    gap: 16,
  },
  tape: {
    position: 'absolute',
    top: -7,
    alignSelf: 'center',
    width: 48,
    height: 14,
    backgroundColor: 'rgba(255,255,220,0.55)',
    borderRadius: 2,
    zIndex: 10,
  },
  viewfinderContainer: {
    width: 280,
    height: 280,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  avatarViewfinderContainer: {
    width: 292,
    height: 292,
    borderRadius: 146,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: '#111',
  },
  avatarGuideRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 146,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  camera: {
    flex: 1,
  },
  insetShadowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.15)',
  },
  insetShadowLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 20,
    backgroundColor: 'transparent',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(0,0,0,0.1)',
  },
  liveCaptureOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'space-between',
    padding: 12,
  },
  liveRecordingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveRecordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveRecordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF453A',
  },
  liveRecordingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  liveCountdownPill: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.9)',
    color: '#2A2218',
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveCaptureBottomCard: {
    alignSelf: 'stretch',
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  liveCaptureTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  liveCaptureSubtitle: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomStrip: {
    marginTop: 8,
    alignItems: 'center',
  },
  brandText: {
    fontFamily: 'Caveat_400Regular',
    fontSize: 18,
    color: '#6B6052',
  },
  avatarHint: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* ── Zoom ── */
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  zoomPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomPillActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  zoomLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  zoomLabelActive: {
    color: '#fff',
  },

  /* ── Controls ── */
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
    marginTop: 24,
  },
  controlButton: {
    alignItems: 'center',
    gap: 4,
  },
  controlLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  shutterCapturing: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    transform: [{ scale: 0.9 }],
  },
  shutterRecording: {
    backgroundColor: '#FF453A',
    borderRadius: 12,
    transform: [{ scale: 0.72 }],
  },

  /* ── Close ── */
  closeButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Permission screen ── */
  permissionCard: {
    backgroundColor: POLAROID_FRAME,
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 40,
  },
  permissionTitle: {
    fontFamily: 'Caveat_400Regular',
    fontSize: 24,
    color: '#2A2218',
  },
  permissionText: {
    fontSize: 14,
    color: '#6B6052',
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#2A2218',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  permissionButtonLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelLabel: {
    color: '#6B6052',
    fontSize: 14,
  },
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
