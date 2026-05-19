import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMusicPreference } from '../features/music/MusicPreferenceContext';
import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { safePauseAudioPlayer, safePlayAudioPlayer, safeSeekAudioPlayer } from '../lib/audioPlayerControls';
import { openSongInPreferredService } from '../lib/musicLinks';
import { announceActiveSongPreview, subscribeActiveSongPreview } from '../lib/songPreviewPlayback';
import { buildSongWaveform } from '../lib/songWaveform';
import type { FontSet } from '../theme/typography';
import { spacing } from '../theme/tokens';
import type { SongAttachment } from '../types/domain';

interface SongAttachmentStripProps {
  song: SongAttachment;
  postId: string;
  themeColors?: ColorTokens;
  autoPlayKey?: string | number | null;
}

export function SongAttachmentStrip({ song, postId, themeColors, autoPlayKey }: SongAttachmentStripProps) {
  const { colors: appColors, fonts } = useTheme();
  const { musicOpenPreference } = useMusicPreference();
  const colors = themeColors ?? appColors;
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const previewId = `${postId}:song-attachment`;
  const player = useAudioPlayer(song.previewUrl ?? null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const waveform = useMemo(() => buildSongWaveform(`${song.provider}:${song.providerTrackId}:${song.title}:${song.artist}`, 16), [song]);
  const progress = status.duration > 0 ? Math.min(1, Math.max(0, status.currentTime / status.duration)) : 0;
  const activeBars = Math.round(waveform.length * progress);

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
    if (activePreviewId !== previewId) safePauseAudioPlayer(player);
  }), [player, previewId]);

  useEffect(() => {
    if (autoPlayKey == null || !song.previewUrl) return;
    let cancelled = false;

    announceActiveSongPreview(previewId);
    const playPreview = async () => {
      await safeSeekAudioPlayer(player, 0);
      if (!cancelled) safePlayAudioPlayer(player);
    };

    void playPreview();
    return () => {
      cancelled = true;
    };
  }, [autoPlayKey, player, previewId, song.previewUrl]);

  const handlePress = async () => {
    if (!song.previewUrl) {
      await openSongInPreferredService(song, musicOpenPreference);
      return;
    }
    if (status.playing) {
      safePauseAudioPlayer(player);
      return;
    }
    announceActiveSongPreview(previewId);
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.25)) {
      await safeSeekAudioPlayer(player, 0);
    }
    safePlayAudioPlayer(player);
  };

  return (
    <View style={styles.strip}>
      <Pressable
        onPress={handlePress}
        style={styles.playButton}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause attached song preview' : 'Play attached song preview'}
      >
        <Ionicons name={status.playing ? 'pause' : 'play'} size={15} color={colors.white} />
      </Pressable>
      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>{song.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{song.artist}</Text>
      </View>
      <View style={styles.waveform} pointerEvents="none">
        {waveform.map((height, index) => (
          <View
            key={`${height}-${index}`}
            style={[
              styles.waveBar,
              {
                height: Math.max(8, Math.round(height * 0.42)),
                backgroundColor: index < activeBars ? colors.accent : colors.line,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) => StyleSheet.create({
  strip: {
    width: 248,
    minHeight: 52,
    marginTop: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  playButtonDisabled: {
    backgroundColor: colors.inkMuted,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  artist: {
    marginTop: 1,
    color: colors.inkSoft,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  waveform: {
    width: 58,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  waveBar: {
    flex: 1,
    minWidth: 2,
    maxWidth: 4,
    borderRadius: 2,
  },
});
