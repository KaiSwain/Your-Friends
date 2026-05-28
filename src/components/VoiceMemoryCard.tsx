import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { announceActiveVoicePlayback, subscribeActiveVoicePlayback } from '../lib/voicePlayback';
import { buildVoiceWaveform, formatVoiceDuration } from '../lib/voiceWaveform';
import { protectTextFromFontClipping } from '../theme/fontProtection';
import type { FontSet } from '../theme/typography';
import { radius, semanticColors, spacing } from '../theme/tokens';
import type { VoiceAttachment } from '../types/domain';

interface VoiceMemoryCardProps {
  voice: VoiceAttachment;
  postId: string;
  body?: string | null;
  authorName?: string;
  createdAt?: string;
  themeColors?: ColorTokens;
  displayMode?: 'timeline' | 'grid';
  preview?: boolean;
  compact?: boolean;
  variant?: 'card' | 'embedded';
  emphasis?: 'primary' | 'secondary';
  label?: string;
  labelColor?: string;
  promptContent?: ReactNode;
  onPress?: () => void;
  editing?: boolean;
  editingAccentColor?: string;
}

const VOICE_LOAD_TIMEOUT_MS = 10_000;
const VOICE_PLAY_TIMEOUT_MS = 5_000;

export function VoiceMemoryCard({ voice, postId, body, authorName, createdAt, themeColors, displayMode = 'timeline', preview, compact, variant = 'card', emphasis = 'primary', label, labelColor, promptContent, onPress, editing, editingAccentColor }: VoiceMemoryCardProps) {
  const { colors: appColors, fonts, resolvedMode } = useTheme();
  const colors = themeColors ?? appColors;
  const editBorderColor = editingAccentColor ?? semanticColors.voiceRed;
  const styles = useMemo(() => makeStyles(colors, fonts, editBorderColor), [colors, editBorderColor, fonts]);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [positionMs, setPositionMs] = useState(0);
  const [playbackDurationMs, setPlaybackDurationMs] = useState<number | null>(voice.durationMs ?? null);
  const isEmbedded = variant === 'embedded';
  const isSecondary = emphasis === 'secondary';
  const isCompact = !!compact || isEmbedded;
  const waveform = useMemo(() => buildVoiceWaveform(`${postId}:${voice.uri}`, isCompact ? 24 : displayMode === 'grid' ? 26 : 34), [displayMode, isCompact, postId, voice.uri]);
  const durationMs = playbackDurationMs ?? voice.durationMs ?? null;
  const progress = durationMs && durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
  const activeBars = Math.round(waveform.length * progress);
  const title = label ?? (isSecondary ? null : authorName ? `${authorName}'s voice` : 'Voice note');
  const dateLabel = useMemo(() => {
    if (!createdAt) return '';
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [createdAt]);

  const applyPlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setPlaying(false);
      if (status.error) setPlaybackError(status.error);
      return;
    }
    setPlaying(status.isPlaying);
    setPositionMs(status.didJustFinish ? 0 : status.positionMillis);
    if (typeof status.durationMillis === 'number' && status.durationMillis > 0) {
      setPlaybackDurationMs(status.durationMillis);
    }
    if (status.didJustFinish) {
      soundRef.current?.setPositionAsync(0).catch(() => undefined);
    }
  }, []);

  const unloadSound = useCallback(async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    if (!sound) return;
    sound.setOnPlaybackStatusUpdate(null);
    try {
      await sound.unloadAsync();
    } catch {
      // Native audio handles may already be disposed during fast wall transitions.
    }
  }, []);

  const ensureSound = useCallback(async () => {
    if (soundRef.current) return soundRef.current;
    setLoading(true);
    setPlaybackError('');
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound, status } = await withTimeout(
        Audio.Sound.createAsync(
          { uri: voice.uri, overrideFileExtensionAndroid: getAudioExtension(voice.uri) },
          {
            shouldPlay: false,
            progressUpdateIntervalMillis: 150,
            volume: 1,
          },
          applyPlaybackStatus,
          false,
        ),
        VOICE_LOAD_TIMEOUT_MS,
        'Voice took too long to load.',
      );
      soundRef.current = sound;
      applyPlaybackStatus(status);
      return sound;
    } finally {
      setLoading(false);
    }
  }, [applyPlaybackStatus, voice.uri]);

  useEffect(() => subscribeActiveVoicePlayback((activeVoiceId) => {
    if (activeVoiceId !== postId) {
      soundRef.current?.pauseAsync().catch(() => undefined);
      setPlaying(false);
    }
  }), [postId]);

  useEffect(() => {
    setPlaying(false);
    setLoading(false);
    setPlaybackError('');
    setPositionMs(0);
    setPlaybackDurationMs(voice.durationMs ?? null);
    unloadSound();
  }, [unloadSound, voice.durationMs, voice.uri]);

  useEffect(() => () => {
    unloadSound();
  }, [unloadSound]);

  async function handlePlayPress() {
    if (loading) return;
    const sound = await ensureSound().catch((err) => {
      setPlaybackError(getPlaybackErrorMessage(err));
      setPlaying(false);
      return null;
    });
    if (!sound) return;

    if (playing) {
      await sound.pauseAsync().catch(() => undefined);
      setPlaying(false);
      return;
    }
    announceActiveVoicePlayback(postId);
    try {
      await playSoundFromCurrentPosition(sound);
      setPlaying(true);
    } catch (err) {
      await unloadSound();
      const retrySound = await ensureSound().catch(() => null);
      if (!retrySound) {
        setPlaybackError(getPlaybackErrorMessage(err));
        setPlaying(false);
        return;
      }
      try {
        await playSoundFromCurrentPosition(retrySound);
        setPlaying(true);
      } catch (retryError) {
        await unloadSound();
        setPlaybackError(getPlaybackErrorMessage(retryError));
        setPlaying(false);
      }
    }
  }

  async function playSoundFromCurrentPosition(sound: Audio.Sound) {
    const status = await withTimeout(sound.getStatusAsync(), VOICE_PLAY_TIMEOUT_MS, 'Voice took too long to start.');
    if (status.isLoaded && status.durationMillis && status.positionMillis >= status.durationMillis - 100) {
      await sound.setPositionAsync(0);
    }
    await withTimeout(sound.playAsync(), VOICE_PLAY_TIMEOUT_MS, 'Voice took too long to start.');
  }

  const embeddedCard = (
    <View style={[styles.embeddedCard, isSecondary && styles.embeddedCardSecondary, preview && styles.embeddedPreviewCard]}>
      {promptContent}
      <View style={[styles.embeddedRow, isSecondary && styles.embeddedRowSecondary]}>
        <Pressable
          onPress={handlePlayPress}
          disabled={loading}
          style={[styles.embeddedPlayButton, isSecondary && styles.embeddedPlayButtonSecondary, loading && styles.playButtonDisabled]}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}
        >
          <Ionicons name={loading ? 'hourglass-outline' : playing ? 'pause' : 'play'} size={isSecondary ? 12 : 15} color={colors.white} />
        </Pressable>
        <View style={styles.embeddedBody}>
          {title ? <Text style={[styles.embeddedTitle, isSecondary && styles.embeddedTitleSecondary, labelColor ? { color: labelColor } : null]} numberOfLines={1}>{title}</Text> : null}
          {!isSecondary || playing ? (
          <View style={[styles.embeddedWaveform, isSecondary && styles.embeddedWaveformSecondary]} pointerEvents="none">
            {waveform.map((height, index) => (
              <View
                key={`${height}-${index}`}
                style={[
                  styles.waveBar,
                  {
                    height: Math.max(5, Math.round(height * 0.38)),
                    backgroundColor: index < activeBars ? semanticColors.voiceRed : colors.line + '99',
                  },
                ]}
              />
            ))}
          </View>
          ) : null}
        </View>
        <Text style={[styles.embeddedDuration, isSecondary && styles.embeddedDurationSecondary]}>{formatVoiceDuration(durationMs)}</Text>
      </View>
      {playbackError ? <Text style={styles.embeddedError}>Could not play.</Text> : null}
      {body ? <Text style={styles.embeddedText} numberOfLines={2}>{body}</Text> : null}
    </View>
  );

  const card = isEmbedded ? embeddedCard : (
    <View style={[styles.card, displayMode === 'grid' && styles.cardGrid, isCompact && styles.cardCompact, preview && styles.previewCard, editing && styles.editingCard]}>
      <BlurView intensity={isCompact ? 28 : 42} tint={resolvedMode === 'dark' ? 'dark' : 'light'} style={[styles.cardBlur, isCompact && styles.cardBlurCompact]}>
        <View pointerEvents="none" style={styles.memoryGlassTint} />
        <View pointerEvents="none" style={styles.memoryGlassHighlight} />
        {promptContent}
        <View style={[styles.headerRow, isCompact && styles.headerRowCompact]}>
          <View style={[styles.iconBadge, (displayMode === 'grid' || isCompact) && styles.iconBadgeSmall]}>
            <Ionicons name="mic" size={displayMode === 'grid' || isCompact ? 17 : 20} color={colors.white} />
          </View>
          <View style={styles.titleBlock}>
            {!isCompact ? <Text style={[styles.eyebrow, displayMode === 'grid' && styles.eyebrowGrid]}>Voice memory</Text> : null}
            <Text style={[styles.title, displayMode === 'grid' && styles.titleGrid, isCompact && styles.titleCompact]} numberOfLines={isCompact || displayMode === 'grid' ? 1 : 2}>
              {title}
            </Text>
            {dateLabel && !isCompact ? <Text style={styles.meta} numberOfLines={1}>{dateLabel}</Text> : null}
          </View>
        </View>

        <View style={[styles.playerRow, isCompact && styles.playerRowCompact]}>
          <Pressable
            onPress={handlePlayPress}
            disabled={loading}
            style={[styles.playButton, isCompact && styles.playButtonCompact, loading && styles.playButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause voice memory' : 'Play voice memory'}
          >
            <Ionicons name={loading ? 'hourglass-outline' : playing ? 'pause' : 'play'} size={displayMode === 'grid' || isCompact ? 17 : 20} color={colors.white} />
          </Pressable>
          <View style={[styles.waveform, isCompact && styles.waveformCompact]} pointerEvents="none">
            {waveform.map((height, index) => (
              <View
                key={`${height}-${index}`}
                style={[
                  styles.waveBar,
                  {
                    height: Math.max(8, isCompact ? Math.round(height * 0.52) : displayMode === 'grid' ? Math.round(height * 0.58) : height),
                    backgroundColor: index < activeBars ? semanticColors.voiceRed : colors.line,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.duration, isCompact && styles.durationCompact]}>{formatVoiceDuration(durationMs)}</Text>
        </View>

        {playbackError && !isCompact ? <Text style={styles.error}>Could not play this voice memory.</Text> : null}

        {body && !isCompact ? <Text style={[styles.body, displayMode === 'grid' && styles.bodyGrid]} numberOfLines={displayMode === 'grid' ? 3 : undefined}>{body}</Text> : null}
      </BlurView>
    </View>
  );

  if (!onPress) return card;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {card}
    </Pressable>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet, editBorderColor: string) => StyleSheet.create({
  embeddedCard: {
    width: '100%',
    alignSelf: 'stretch',
    gap: spacing.xs,
  },
  embeddedCardSecondary: {
    gap: 2,
  },
  embeddedPreviewCard: {
    opacity: 0.98,
  },
  embeddedRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  embeddedRowSecondary: {
    minHeight: 30,
    gap: spacing.xs,
  },
  embeddedPlayButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.voiceRed,
  },
  embeddedPlayButtonSecondary: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: semanticColors.voiceRed,
  },
  embeddedBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: 'center',
  },
  embeddedTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
  },
  embeddedTitleSecondary: {
    fontSize: 11,
    color: colors.inkSoft,
  },
  embeddedWaveform: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  embeddedWaveformSecondary: {
    height: 12,
    opacity: 0.72,
  },
  embeddedDuration: {
    minWidth: 30,
    textAlign: 'right',
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.inkMuted,
  },
  embeddedDurationSecondary: {
    minWidth: 28,
    fontSize: 10,
  },
  embeddedError: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.error,
  },
  embeddedText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkSoft,
  },
  card: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: withAlpha(colors.white, 0.18),
    backgroundColor: withAlpha(colors.paper, 0.56),
    alignSelf: 'stretch',
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardGrid: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 18,
  },
  cardCompact: {
    maxWidth: '100%',
    borderRadius: radius.lg,
    shadowOpacity: 0,
    elevation: 0,
  },
  cardBlur: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  cardBlurCompact: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  previewCard: {
    shadowOpacity: 0.08,
  },
  editingCard: {
    borderColor: editBorderColor,
  },
  memoryGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.paper, 0.12),
  },
  memoryGlassHighlight: {
    position: 'absolute',
    top: 1,
    left: 18,
    right: 18,
    height: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(colors.white, 0.72),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerRowCompact: {
    gap: spacing.sm,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.voiceRed,
    borderWidth: 1,
    borderColor: semanticColors.voiceRed,
  },
  iconBadgeSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: semanticColors.voiceRed,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  eyebrowGrid: {
    fontSize: 10,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.ink,
    ...protectTextFromFontClipping(fonts.heading, 22),
  },
  titleGrid: {
    fontSize: 18,
    ...protectTextFromFontClipping(fonts.heading, 18),
  },
  titleCompact: {
    fontSize: 18,
    ...protectTextFromFontClipping(fonts.heading, 18),
  },
  meta: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
  },
  playerRow: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  playerRowCompact: {
    minHeight: 42,
    borderRadius: radius.pill,
    gap: spacing.sm,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.voiceRed,
  },
  playButtonCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  playButtonDisabled: {
    backgroundColor: semanticColors.voiceRed,
  },
  waveform: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  waveformCompact: {
    height: 30,
  },
  waveBar: {
    flex: 1,
    minWidth: 2,
    borderRadius: 999,
  },
  duration: {
    minWidth: 38,
    textAlign: 'right',
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.inkSoft,
  },
  durationCompact: {
    minWidth: 32,
    fontSize: 11,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
  },
  bodyGrid: {
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.error,
  },
  pressed: {
    opacity: 0.9,
  },
});

function withAlpha(color: string, alpha: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getAudioExtension(uri: string) {
  const clean = uri.split('?')[0]?.toLowerCase() ?? '';
  const match = /\.([a-z0-9]+)$/.exec(clean);
  return match?.[1] ?? 'm4a';
}

function getPlaybackErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/network|timed out|too long|load|download|source/i.test(message)) {
    return 'Voice could not load. Check your connection and try again.';
  }
  return 'Could not play this voice memory. Try again.';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
