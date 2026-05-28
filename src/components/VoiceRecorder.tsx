import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import { formatVoiceDuration } from '../lib/voiceWaveform';
import { radius, spacing } from '../theme/tokens';
import type { VoiceAttachment } from '../types/domain';
import { VoiceMemoryCard } from './VoiceMemoryCard';

type RecordingStatus = Awaited<ReturnType<Audio.Recording['getStatusAsync']>>;

interface VoiceRecorderProps {
  value: VoiceAttachment | null;
  onChange: (voice: VoiceAttachment | null) => void;
  maxDurationMs?: number;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  previewAuthorName?: string;
}

export const DEFAULT_VOICE_RECORDING_MAX_MS = 60_000;
const RECORDING_START_DELAYS_MS = [0, 180, 420, 700] as const;
const RECORDING_OPTION_PRESETS = [
  Audio.RecordingOptionsPresets.HIGH_QUALITY,
  Audio.RecordingOptionsPresets.HIGH_QUALITY,
  Audio.RecordingOptionsPresets.LOW_QUALITY,
  Audio.RecordingOptionsPresets.LOW_QUALITY,
] as const;
const MIN_RECORDING_FILE_BYTES = 128;

export function VoiceRecorder({
  value,
  onChange,
  maxDurationMs = DEFAULT_VOICE_RECORDING_MAX_MS,
  disabled,
  label = 'Voice memory',
  helperText = 'Record a short audio note.',
  previewAuthorName,
}: VoiceRecorderProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStopTriggeredRef = useRef(false);
  const stoppingRef = useRef(false);

  const elapsedMs = isRecording ? recordingDurationMs : (value?.durationMs ?? 0);
  const remainingMs = Math.max(0, maxDurationMs - elapsedMs);

  useEffect(() => {
    return () => {
      clearStopTimer();
      recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
      recordingRef.current = null;
      resetAudioMode().catch(() => undefined);
    };
  }, []);

  async function startRecording() {
    if (disabled || busy || isRecording) return;
    setBusy(true);
    setError('');
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission is needed to record a voice memory.');
        return;
      }
      await cleanupRecording();
      await setRecordingAudioMode();
      clearStopTimer();
      autoStopTriggeredRef.current = false;
      setRecordingDurationMs(0);

      const recording = await startRecordingWithRetry();
      recordingRef.current = recording;
      onChange(null);
      setIsRecording(true);
      stopTimerRef.current = setTimeout(() => {
        stopRecording().catch(() => undefined);
      }, maxDurationMs + 250);
    } catch (err) {
      setError(getRecordingErrorMessage(err));
      cleanupRecording().catch(() => undefined);
      setIsRecording(false);
      resetAudioMode().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function stopRecording() {
    if (stoppingRef.current) return;
    const recording = recordingRef.current;
    if (!recording) return;
    stoppingRef.current = true;
    setBusy(true);
    setError('');
    clearStopTimer();
    recordingRef.current = null;
    const fallbackUri = recording.getURI();
    try {
      const status = await recording.stopAndUnloadAsync();
      const uri = recording.getURI() ?? fallbackUri;
      if (!uri) throw new Error('No recording file was created.');
      await finalizeRecording(uri, status.durationMillis || recordingDurationMs || null);
    } catch (err) {
      const uri = recording.getURI() ?? fallbackUri;
      if (uri) {
        try {
          await finalizeRecording(uri, recordingDurationMs || null);
          return;
        } catch {
          // Fall through to a user-facing retry message below.
        }
      }
      setError(getStopRecordingErrorMessage(err));
    } finally {
      stoppingRef.current = false;
      setIsRecording(false);
      setBusy(false);
      resetAudioMode().catch(() => undefined);
    }
  }

  function clearRecording() {
    setError('');
    autoStopTriggeredRef.current = false;
    clearStopTimer();
    onChange(null);
  }

  function clearStopTimer() {
    if (!stopTimerRef.current) return;
    clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  }

  async function cleanupRecording() {
    clearStopTimer();
    const recording = recordingRef.current;
    recordingRef.current = null;
    stoppingRef.current = false;
    if (!recording) return;
    recording.setOnRecordingStatusUpdate(null);
    await recording.stopAndUnloadAsync().catch(() => undefined);
  }

  async function startRecordingWithRetry() {
    let firstError: unknown = null;

    for (let attemptIndex = 0; attemptIndex < RECORDING_START_DELAYS_MS.length; attemptIndex += 1) {
      const delayMs = RECORDING_START_DELAYS_MS[attemptIndex];
      if (delayMs > 0) {
        await resetAudioMode().catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        await setRecordingAudioMode();
      }

      try {
        return await createStartedRecording(RECORDING_OPTION_PRESETS[attemptIndex]);
      } catch (error) {
        firstError ??= error;
      }
    }

    throw firstError;
  }

  async function createStartedRecording(options: Audio.RecordingOptions) {
    const recording = new Audio.Recording();
    recording.setProgressUpdateInterval(250);
    recording.setOnRecordingStatusUpdate(handleRecordingStatus);
    try {
      await recording.prepareToRecordAsync(options);
      await recording.startAsync();
      const status = await recording.getStatusAsync();
      if (!status.isRecording) throw new Error('Recording did not start.');
      return recording;
    } catch (error) {
      recording.setOnRecordingStatusUpdate(null);
      await recording.stopAndUnloadAsync().catch(() => undefined);
      throw error;
    }
  }

  async function finalizeRecording(uri: string, durationMs: number | null) {
    await assertUsableRecordingFile(uri);
    try {
      const stableUri = await persistRecordedVoice(uri);
      onChange({ uri: stableUri, durationMs });
    } catch {
      onChange({ uri, durationMs });
    }
  }

  function handleRecordingStatus(status: RecordingStatus) {
    setRecordingDurationMs(status.durationMillis);
    if (status.isRecording && status.durationMillis >= maxDurationMs && !autoStopTriggeredRef.current) {
      autoStopTriggeredRef.current = true;
      stopRecording().catch(() => undefined);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.helper}>{helperText}</Text>
        </View>
        <View style={styles.limitPill}>
          <Ionicons name="timer-outline" size={13} color={colors.accent} />
          <Text style={styles.limitText}>{formatVoiceDuration(maxDurationMs)}</Text>
        </View>
      </View>

      {value ? (
        <View style={styles.previewWrap}>
          <VoiceMemoryCard key={value.uri} voice={value} postId={`voice-recorder:${value.uri}`} authorName={previewAuthorName} preview compact />
        </View>
      ) : null}

      {isRecording ? (
        <View style={styles.recordingPanel}>
          <View style={styles.recordingDot} />
          <View style={styles.recordingCopy}>
            <Text style={styles.recordingTitle}>Recording...</Text>
            <Text style={styles.recordingMeta}>{formatVoiceDuration(elapsedMs)} recorded • {formatVoiceDuration(remainingMs)} left</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        {isRecording ? (
          <Pressable onPress={stopRecording} disabled={busy} style={[styles.primaryButton, busy && styles.disabledButton]} accessibilityRole="button">
            <Ionicons name="stop" size={16} color={colors.white} />
            <Text style={styles.primaryButtonText}>{busy ? 'Saving...' : 'Stop'}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={startRecording} disabled={disabled || busy} style={[styles.primaryButton, (disabled || busy) && styles.disabledButton]} accessibilityRole="button">
            <Ionicons name={value ? 'refresh' : 'mic'} size={16} color={colors.white} />
            <Text style={styles.primaryButtonText}>{busy ? 'Starting...' : value ? 'Re-record' : 'Record'}</Text>
          </Pressable>
        )}
        {value ? (
          <Pressable onPress={clearRecording} disabled={disabled || isRecording} style={styles.secondaryButton} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) => StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
  },
  limitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  limitText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.accent,
  },
  previewWrap: {
    alignSelf: 'stretch',
  },
  recordingPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.paper,
    padding: spacing.sm,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
  },
  recordingCopy: {
    flex: 1,
  },
  recordingTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  recordingMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.white,
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.inkSoft,
  },
  error: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.error,
  },
});

async function persistRecordedVoice(uri: string) {
  const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!baseDir) return uri;

  const dir = `${baseDir}voice-previews`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const ext = getAudioExtension(uri);
  const targetUri = `${dir}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: targetUri });
  await assertUsableRecordingFile(targetUri);
  return targetUri;
}

async function assertUsableRecordingFile(uri: string) {
  if (/^https?:\/\//i.test(uri)) return;
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error('The voice recording was not saved. Please record it again.');
  if (typeof info.size === 'number' && info.size < MIN_RECORDING_FILE_BYTES) {
    throw new Error('That recording was too short to save. Please record it again.');
  }
}

function getAudioExtension(uri: string) {
  const clean = uri.split('?')[0]?.toLowerCase() ?? '';
  const match = /\.([a-z0-9]+)$/.exec(clean);
  return match?.[1] ?? 'm4a';
}

function getRecordingErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/recording not started|recording did not start|recorder not prepared|prepare|start/i.test(message)) {
    return 'Could not start recording yet. Wait a second, then tap Record again.';
  }
  return message || 'Could not start recording.';
}

function getStopRecordingErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/too short|empty|not saved|no recording file/i.test(message)) return message;
  return 'Could not save that recording. Please record it again.';
}

function setRecordingAudioMode() {
  return Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

function resetAudioMode() {
  return Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}
