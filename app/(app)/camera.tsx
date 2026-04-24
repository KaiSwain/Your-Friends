import { Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const POLAROID_FRAME = '#F5F2EA';

const ULTRA_WIDE = 'Back Ultra Wide Camera';
const WIDE = 'Back Camera';
const TELEPHOTO = 'Back Telephoto Camera';

type ZoomPreset = { label: string; lens: string; zoom: number };

export default function PolaroidCameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId: string; subjectType: string; returnTo: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [capturing, setCapturing] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [selectedLens, setSelectedLens] = useState(WIDE);
  const [lenses, setLenses] = useState<string[]>([]);
  const cameraRef = useRef<CameraView>(null);

  // Detect available lenses once camera is ready
  const onCameraReady = useCallback(async () => {
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

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        // Navigate back to the calling screen with the captured URI
        const returnTo = params.returnTo || '/(app)/memories/add';
        const { returnTo: _discard, ...forwardParams } = params;
        router.replace({
          pathname: returnTo as any,
          params: {
            ...forwardParams,
            capturedUri: photo.uri,
          },
        });
      }
    } catch {
      // Ignore capture errors
    }
    setCapturing(false);
  }, [capturing, router]);

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
          <Text style={styles.permissionText}>We need camera access to take Polaroid photos</Text>
          <Pressable onPress={requestPermission} style={styles.permissionButton}>
            <Text style={styles.permissionButtonLabel}>Grant Permission</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.cancelButton}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Polaroid frame wrapping the viewfinder */}
      <View style={styles.polaroidFrame}>
        {/* Tape decoration */}
        <View style={styles.tape} />

        <View style={styles.viewfinderContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            flash={flash}
            zoom={zoom}
            onCameraReady={onCameraReady}
            {...(Platform.OS === 'ios' ? { selectedLens, onAvailableLensesChanged: onLensesChanged } : {})}
            mode="picture"
          />
          {/* Subtle inner shadow on the viewfinder */}
          <View style={styles.insetShadowTop} />
          <View style={styles.insetShadowLeft} />
        </View>

        {/* Bottom strip — mimics the Polaroid writing area */}
        <View style={styles.bottomStrip}>
          <Text style={styles.brandText}>Your Friends</Text>
        </View>
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

        <Pressable onPress={takePicture} disabled={capturing} style={styles.shutterOuter}>
          <View style={[styles.shutterInner, capturing && styles.shutterCapturing]} />
        </Pressable>

        <Pressable onPress={toggleFacing} style={styles.controlButton}>
          <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
          <Text style={styles.controlLabel}>Flip</Text>
        </Pressable>
      </View>

      {/* Close button */}
      <Pressable onPress={() => router.back()} style={styles.closeButton}>
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
  bottomStrip: {
    marginTop: 8,
    alignItems: 'center',
  },
  brandText: {
    fontFamily: 'Caveat_400Regular',
    fontSize: 18,
    color: '#6B6052',
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
