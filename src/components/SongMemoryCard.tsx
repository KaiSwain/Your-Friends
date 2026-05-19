import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useCallback, useEffect, useMemo, type ReactNode, type RefObject } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { safePauseAudioPlayer, safePlayAudioPlayer, safeSeekAudioPlayer } from '../lib/audioPlayerControls';
import { useMusicPreference } from '../features/music/MusicPreferenceContext';
import { getMusicServiceLabel, openSongInPreferredService } from '../lib/musicLinks';
import { announceActiveSongPreview, subscribeActiveSongPreview } from '../lib/songPreviewPlayback';
import { buildSongWaveform } from '../lib/songWaveform';
import { shareMemoryWithSong } from '../lib/shareMemoryWithSong';
import { spacing } from '../theme/tokens';
import { protectTextFromFontClipping } from '../theme/fontProtection';
import type { FontSet } from '../theme/typography';
import type { SongAttachment } from '../types/domain';

interface SongMemoryCardProps {
  song: SongAttachment;
  postId: string;
  body?: string;
  authorName: string;
  createdAt: string;
  themeColors?: ColorTokens;
  preview?: boolean;
  editing?: boolean;
  autoPlayKey?: string | number | null;
  onPress?: () => void;
  promptContent?: ReactNode;
  children?: ReactNode;
  shareable?: boolean;
  shareMemoryRef?: RefObject<any>;
}

export function SongMemoryCard({ song, postId, body, authorName, createdAt, themeColors, preview, editing, autoPlayKey, onPress, promptContent, children, shareable, shareMemoryRef }: SongMemoryCardProps) {
  const { colors: appColors, fonts, resolvedMode } = useTheme();
  const { musicOpenPreference } = useMusicPreference();
  const colors = themeColors ?? appColors;
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const source = song.previewUrl ?? null;
  const player = useAudioPlayer(source, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const waveform = useMemo(() => buildSongWaveform(`${song.provider}:${song.providerTrackId}:${song.title}:${song.artist}`), [song]);
  const progress = status.duration > 0 ? Math.min(1, Math.max(0, status.currentTime / status.duration)) : 0;
  const activeBars = Math.round(waveform.length * progress);
  const dateLabel = useMemo(() => {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [createdAt]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      allowsRecording: false,
      allowsBackgroundRecording: false,
      interruptionMode: 'mixWithOthers',
    }).catch(() => undefined);
  }, []);

  useEffect(() => subscribeActiveSongPreview((activePreviewId) => {
    if (activePreviewId !== postId) safePauseAudioPlayer(player);
  }), [player, postId]);

  useEffect(() => {
    if (autoPlayKey == null || !song.previewUrl) return;
    let cancelled = false;

    announceActiveSongPreview(postId);
    const playPreview = async () => {
      await safeSeekAudioPlayer(player, 0);
      if (!cancelled) safePlayAudioPlayer(player);
    };

    void playPreview();
    return () => {
      cancelled = true;
    };
  }, [autoPlayKey, player, postId, song.previewUrl]);

  const handlePreviewPress = async () => {
    if (editing && onPress) {
      onPress();
      return;
    }
    if (!song.previewUrl) {
      await openSongInPreferredService(song, musicOpenPreference);
      return;
    }
    if (status.playing) {
      safePauseAudioPlayer(player);
      return;
    }
    announceActiveSongPreview(postId);
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.25)) {
      await safeSeekAudioPlayer(player, 0);
    }
    safePlayAudioPlayer(player);
  };

  const openExternal = async () => {
    if (editing && onPress) {
      onPress();
      return;
    }
    await openSongInPreferredService(song, musicOpenPreference);
  };
  const handleShareMemoryWithSong = useCallback(() => {
    if (!shareMemoryRef) return;
    shareMemoryWithSong(shareMemoryRef, { song, preference: musicOpenPreference }).catch(() => undefined);
  }, [musicOpenPreference, shareMemoryRef, song]);
  const serviceLabel = getMusicServiceLabel(musicOpenPreference);

  const playerControls = (
    <View style={styles.playerRow}>
      <Pressable
        onPress={handlePreviewPress}
        style={styles.playButton}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause song preview' : 'Play song preview'}
      >
        <Ionicons name={status.playing ? 'pause' : 'play'} size={20} color={colors.white} />
      </Pressable>
      <View style={styles.waveform}>
        {waveform.map((height, index) => (
          <View
            key={`${height}-${index}`}
            style={[
              styles.waveBar,
              {
                height,
                backgroundColor: index < activeBars ? colors.accent : colors.line,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );

  const standaloneSong = !children;

  const card = (
    <View style={[styles.card, editing && styles.editingCard]}>
      <BlurView intensity={42} tint={resolvedMode === 'dark' ? 'dark' : 'light'} style={styles.cardBlur}>
      {promptContent}

      {standaloneSong ? (
        <View style={styles.standaloneHeader}>
          <View style={styles.bigArtworkWrap}>
            {song.artworkUrl ? (
              <Image source={{ uri: song.artworkUrl }} style={styles.bigArtwork} />
            ) : (
              <View style={styles.bigArtworkFallback}>
                <Ionicons name="musical-notes" size={72} color={colors.accent} />
              </View>
            )}
            <Pressable
              onPress={openExternal}
              style={styles.bigArtworkAction}
              accessibilityRole="button"
              accessibilityLabel={`Open song in ${serviceLabel}`}
            >
              <Ionicons name="open-outline" size={18} color={colors.white} />
            </Pressable>
          </View>
          <View style={styles.standaloneTitleBlock}>
            <Text style={styles.bigTitle} numberOfLines={2}>{song.title}</Text>
            <Text style={styles.bigArtist} numberOfLines={1}>{song.artist}</Text>
            <Text style={styles.meta} numberOfLines={1}>{authorName}{dateLabel ? ` - ${dateLabel}` : ''}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.headerRow}>
          <View style={styles.artworkWrap}>
            {song.artworkUrl ? (
              <Image source={{ uri: song.artworkUrl }} style={styles.artwork} />
            ) : (
              <View style={styles.artworkFallback}>
                <Ionicons name="musical-notes" size={28} color={colors.accent} />
              </View>
            )}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={2}>{song.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{song.artist}</Text>
            <Text style={styles.meta} numberOfLines={1}>{authorName}{dateLabel ? ` - ${dateLabel}` : ''}</Text>
          </View>
          <Pressable onPress={openExternal} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={`Open song in ${serviceLabel}`}>
            <Ionicons name="open-outline" size={18} color={colors.inkSoft} />
          </Pressable>
        </View>
      )}

      {children ? (
        <>
          <View style={styles.attachedContent}>{children}</View>
          {playerControls}
        </>
      ) : (
        <>
          {playerControls}
          {body?.trim() ? <Text style={styles.body}>{body.trim()}</Text> : null}
        </>
      )}
      {!song.previewUrl ? <Text style={styles.unavailable}>Preview unavailable</Text> : null}
      {preview ? <Text style={styles.previewLabel}>Preview</Text> : null}
      </BlurView>
    </View>
  );

  const shareControls = shareable && shareMemoryRef ? (
    <View style={styles.shareActions}>
      <Pressable onPress={handleShareMemoryWithSong} style={[styles.shareActionButton, styles.shareActionPrimary]} accessibilityRole="button" accessibilityLabel="Share memory and song link">
        <Ionicons name="share-outline" size={17} color={colors.white} />
        <Text style={[styles.shareActionLabel, styles.shareActionPrimaryLabel]}>Memory + Song</Text>
      </Pressable>
    </View>
  ) : null;

  if (!onPress) return <>{card}{shareControls}</>;
  return (
    <>
      <Pressable onPress={onPress} accessibilityRole="button" style={styles.pressable}>
        {card}
      </Pressable>
      {shareControls}
    </>
  );
}

function withAlpha(color: string, alpha: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) => StyleSheet.create({
  pressable: {
    width: '100%',
  },
  card: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: withAlpha(colors.line, 0.72),
    backgroundColor: 'transparent',
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardBlur: {
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: 'transparent',
  },
  editingCard: {
    borderColor: colors.accent,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  standaloneHeader: {
    gap: spacing.sm,
  },
  bigArtworkWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.paperMuted,
    position: 'relative',
  },
  bigArtwork: {
    width: '100%',
    height: '100%',
  },
  bigArtworkFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigArtworkAction: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withAlpha(colors.black, 0.55),
    alignItems: 'center',
    justifyContent: 'center',
  },
  standaloneTitleBlock: {
    paddingHorizontal: 2,
  },
  bigTitle: {
    color: colors.ink,
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 26,
    ...protectTextFromFontClipping(fonts.heading, 22),
  },
  bigArtist: {
    marginTop: 4,
    color: colors.inkSoft,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  artworkWrap: {
    width: 62,
    height: 62,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.paperMuted,
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  artworkFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.heading,
    fontSize: 18,
    lineHeight: 22,
    ...protectTextFromFontClipping(fonts.heading, 18),
  },
  artist: {
    marginTop: 2,
    color: colors.inkSoft,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  meta: {
    marginTop: 5,
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperMuted,
  },
  playerRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  disabledPlayButton: {
    backgroundColor: colors.inkMuted,
  },
  waveform: {
    flex: 1,
    minWidth: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
  },
  waveBar: {
    flex: 1,
    minWidth: 2,
    maxWidth: 6,
    borderRadius: 3,
  },
  body: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
  },
  attachedContent: {
    alignItems: 'center',
  },
  shareActions: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  shareActionButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: withAlpha(colors.line, 0.8),
    backgroundColor: withAlpha(colors.paper, 0.58),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  shareActionPrimary: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  shareActionLabel: {
    color: colors.inkSoft,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  shareActionPrimaryLabel: {
    color: colors.white,
  },
  unavailable: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  previewLabel: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    color: colors.accent,
    backgroundColor: colors.paperMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
});