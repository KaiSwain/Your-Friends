import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { fetchPopularMovies, searchMovies } from '../lib/movieSearch';
import { radius, spacing } from '../theme/tokens';
import type { FontSet } from '../theme/typography';
import type { MovieAttachment } from '../types/domain';

interface MovieSearchPickerProps {
  selectedMovie: MovieAttachment | null;
  onSelect: (movie: MovieAttachment) => void;
  onRemove: () => void;
}

export function MovieSearchPicker({ selectedMovie, onSelect, onRemove }: MovieSearchPickerProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loadedPopular = useRef(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setLoading(false);
      if (!loadedPopular.current) {
        loadedPopular.current = true;
        fetchPopularMovies()
          .then((movies) => setResults((prev) => (query.trim().length < 2 ? movies : prev)))
          .catch(() => undefined);
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    const handle = setTimeout(() => {
      searchMovies(trimmed)
        .then((movies) => {
          if (cancelled) return;
          setResults(movies);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Could not search movies.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  if (selectedMovie) {
    return (
      <View style={styles.selectedCard}>
        {selectedMovie.posterUrl ? (
          <Image source={{ uri: selectedMovie.posterUrl }} style={styles.selectedPoster} />
        ) : (
          <View style={styles.selectedPosterFallback}>
            <Ionicons name="film-outline" size={26} color={colors.accent} />
          </View>
        )}
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedTitle} numberOfLines={2}>
            {selectedMovie.title}{selectedMovie.year ? ` (${selectedMovie.year})` : ''}
          </Text>
          {selectedMovie.overview ? (
            <Text style={styles.selectedOverview} numberOfLines={3}>{selectedMovie.overview}</Text>
          ) : null}
        </View>
        <Pressable onPress={onRemove} hitSlop={10} style={styles.removeButton} accessibilityRole="button" accessibilityLabel="Remove movie">
          <Ionicons name="close" size={18} color={colors.inkSoft} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.inkSoft} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a movie..."
          placeholderTextColor={colors.inkMuted}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.listLabel}>{query.trim().length >= 2 ? 'Matches' : 'Popular now'}</Text>
      {loading ? <Text style={styles.helperText}>Searching movies...</Text> : null}
      {results.map((movie) => (
        <Pressable key={movie.tmdbId} onPress={() => onSelect(movie)} style={styles.row} accessibilityRole="button">
          {movie.posterUrl ? (
            <Image source={{ uri: movie.posterUrl }} style={styles.poster} />
          ) : (
            <View style={styles.posterFallback}><Ionicons name="film-outline" size={20} color={colors.accent} /></View>
          )}
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle} numberOfLines={2}>{movie.title}{movie.year ? ` (${movie.year})` : ''}</Text>
            <Text style={styles.rowOverview} numberOfLines={2}>{movie.overview ?? 'No overview available.'}</Text>
          </View>
        </Pressable>
      ))}
      {!loading && results.length === 0 ? <Text style={styles.helperText}>No movies found. Try another title.</Text> : null}
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) => StyleSheet.create({
  container: { gap: spacing.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, minHeight: 48 },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, paddingVertical: spacing.sm },
  listLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7 },
  helperText: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
  row: { flexDirection: 'row', gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.sm },
  poster: { width: 46, height: 68, borderRadius: radius.sm, backgroundColor: colors.canvas },
  posterFallback: { width: 46, height: 68, borderRadius: radius.sm, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1, gap: 2, justifyContent: 'center' },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  rowOverview: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
  selectedCard: { flexDirection: 'row', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.paper, padding: spacing.md, alignItems: 'center' },
  selectedPoster: { width: 56, height: 82, borderRadius: radius.sm, backgroundColor: colors.canvas },
  selectedPosterFallback: { width: 56, height: 82, borderRadius: radius.sm, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  selectedInfo: { flex: 1, gap: spacing.xs },
  selectedTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  selectedOverview: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
  removeButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
});
