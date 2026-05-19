import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { searchSongPreviews } from '../lib/songSearch';
import { spacing } from '../theme/tokens';
import type { FontSet } from '../theme/typography';
import type { SongAttachment } from '../types/domain';

interface SongSearchPickerProps {
  selectedSong: SongAttachment | null;
  onSelect: (song: SongAttachment) => void;
  onRemove: () => void;
}

export function SongSearchPicker({ selectedSong, onSelect, onRemove }: SongSearchPickerProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SongAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setError('');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setLoading(true);
      setError('');
      searchSongPreviews(trimmedQuery)
        .then((songs) => {
          if (cancelled) return;
          setResults(songs);
          setError(songs.length === 0 ? 'No playable previews found.' : '');
        })
        .catch((searchError) => {
          if (cancelled) return;
          setResults([]);
          setError(searchError instanceof Error ? searchError.message : 'Could not search songs right now.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [query]);

  function handleSelectSong(song: SongAttachment) {
    onSelect(song);
  }

  function handleRemoveSong() {
    onRemove();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Song</Text>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.inkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a song or artist"
          placeholderTextColor={colors.inkMuted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {selectedSong ? (
        <View style={styles.selectedRow}>
          <SongThumb song={selectedSong} colors={colors} />
          <View style={styles.resultText}>
            <Text style={styles.resultTitle} numberOfLines={1}>{selectedSong.title}</Text>
            <Text style={styles.resultArtist} numberOfLines={1}>{selectedSong.artist}</Text>
          </View>
          <Pressable onPress={handleRemoveSong} style={styles.removeButton} accessibilityRole="button" accessibilityLabel="Remove selected song">
            <Ionicons name="close" size={18} color={colors.inkSoft} />
          </Pressable>
        </View>
      ) : null}

      {loading ? <Text style={styles.helperText}>Searching...</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.resultsList}>
        {results.map((song) => {
          const selected = selectedSong?.provider === song.provider && selectedSong.providerTrackId === song.providerTrackId;
          return (
            <Pressable
              key={`${song.provider}-${song.providerTrackId}`}
              onPress={() => handleSelectSong(song)}
              style={[styles.resultRow, selected && styles.activeResultRow]}
              accessibilityRole="button"
              accessibilityLabel={`Select ${song.title} by ${song.artist}`}
            >
              <SongThumb song={song} colors={colors} />
              <View style={styles.resultText}>
                <Text style={styles.resultTitle} numberOfLines={1}>{song.title}</Text>
                <Text style={styles.resultArtist} numberOfLines={1}>{song.artist}</Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SongThumb({ song, colors }: { song: SongAttachment; colors: ColorTokens }) {
  if (song.artworkUrl) return <Image source={{ uri: song.artworkUrl }} style={thumbStyles.artwork} />;
  return (
    <View style={[thumbStyles.fallback, { backgroundColor: colors.paperMuted }]}>
      <Ionicons name="musical-notes" size={18} color={colors.accent} />
    </View>
  );
}

const thumbStyles = StyleSheet.create({
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  fallback: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const makeStyles = (colors: ColorTokens, fonts: FontSet) => StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  searchBox: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  selectedRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.paperMuted,
    padding: spacing.sm,
  },
  resultText: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    color: colors.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  resultArtist: {
    marginTop: 2,
    color: colors.inkSoft,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
  helperText: {
    color: colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  errorText: {
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  resultsList: {
    gap: spacing.xs,
  },
  resultRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.sm,
  },
  activeResultRow: {
    borderColor: colors.accent,
  },
});