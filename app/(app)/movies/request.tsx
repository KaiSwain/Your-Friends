import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import { backOnce, replaceOnce } from '../../../src/lib/navigationGuard';
import { fetchPopularMovies, searchMovies } from '../../../src/lib/movieSearch';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import { radius, spacing } from '../../../src/theme/tokens';
import type { MovieAttachment, PeopleListItem } from '../../../src/types/domain';

export default function MovieRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId?: string | string[]; subjectType?: string | string[]; backTo?: string | string[] }>();
  const { currentUser } = useAuth();
  const { createMovieReviewRequest, getPeopleListForUser } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const subjectType = Array.isArray(params.subjectType) ? params.subjectType[0] : params.subjectType;
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;

  const movieTargets = useMemo(() => {
    if (!currentUser) return [];
    return getPeopleListForUser(currentUser.id).filter((person) => getRecipientUserId(person));
  }, [currentUser?.id, getPeopleListForUser]);
  const initialTarget = movieTargets.find((target) => target.id === subjectId && target.entityType === subjectType) ?? movieTargets[0] ?? null;
  const initialTargetKey = initialTarget ? targetKey(initialTarget) : '';
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<string[]>(() => initialTargetKey ? [initialTargetKey] : []);
  const selectedTargets = useMemo(
    () => movieTargets.filter((target) => selectedTargetKeys.includes(targetKey(target))),
    [movieTargets, selectedTargetKeys],
  );
  const selectedRecipientIds = useMemo(() => {
    const ids = selectedTargets.map(getRecipientUserId).filter((id): id is string => Boolean(id));
    return Array.from(new Set(ids));
  }, [selectedTargets]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieAttachment[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<MovieAttachment | null>(null);
  const [prompt, setPrompt] = useState('');
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resultsVisible, setResultsVisible] = useState(true);
  const searchRequestSeq = useRef(0);
  const skipNextQuerySearch = useRef(false);

  function handleBack() {
    if (backTo) {
      replaceOnce(router, backTo as any);
      return;
    }
    backOnce(router);
  }

  async function loadMovieResults(rawQuery: string, requestId: number) {
    const trimmed = rawQuery.trim();
    setSearching(true);
    setError('');
    setResultsVisible(true);
    try {
      const movies = trimmed ? await searchMovies(trimmed) : await fetchPopularMovies();
      if (requestId !== searchRequestSeq.current) return;
      setResults(movies);
      if (trimmed && movies.length === 0) setError('No movies found. Try another title.');
      if (!trimmed && movies.length === 0) setError('Popular movies are still loading. Try tapping search again.');
    } catch (err) {
      if (requestId !== searchRequestSeq.current) return;
      setError(err instanceof Error ? err.message : 'Could not load movies.');
    } finally {
      if (requestId === searchRequestSeq.current) setSearching(false);
    }
  }

  useEffect(() => {
    if (selectedTargetKeys.length > 0 || !initialTargetKey) return;
    setSelectedTargetKeys([initialTargetKey]);
  }, [initialTargetKey, selectedTargetKeys.length]);

  useEffect(() => {
    if (skipNextQuerySearch.current) {
      skipNextQuerySearch.current = false;
      return;
    }

    let cancelled = false;
    const requestId = searchRequestSeq.current + 1;
    searchRequestSeq.current = requestId;
    const trimmed = query.trim();
    const timer = setTimeout(() => {
      if (!cancelled) void loadMovieResults(trimmed, requestId);
    }, trimmed ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function handleSearch() {
    const requestId = searchRequestSeq.current + 1;
    searchRequestSeq.current = requestId;
    await loadMovieResults(query, requestId);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedMovie(null);
    setResultsVisible(true);
  }

  function handleSearchFocus() {
    setResultsVisible(true);
    if (!query.trim() && results.length === 0 && !searching) {
      const requestId = searchRequestSeq.current + 1;
      searchRequestSeq.current = requestId;
      void loadMovieResults('', requestId);
    }
  }

  function handleSelectMovie(movie: MovieAttachment) {
    searchRequestSeq.current += 1;
    skipNextQuerySearch.current = true;
    setSelectedMovie(movie);
    setResults([movie]);
    setQuery(movie.year ? `${movie.title} (${movie.year})` : movie.title);
    setResultsVisible(false);
    setError('');
    setSearching(false);
  }

  function toggleTarget(target: PeopleListItem) {
    const key = targetKey(target);
    setSelectedTargetKeys((prev) => (
      prev.includes(key)
        ? prev.filter((targetKeyValue) => targetKeyValue !== key)
        : [...prev, key]
    ));
  }

  async function handleSend() {
    if (!currentUser) return;
    if (selectedRecipientIds.length === 0) {
      setError('Choose at least one friend with a real account.');
      return;
    }
    if (!selectedMovie) {
      setError('Choose a movie first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await Promise.all(selectedRecipientIds.map((recipientUserId) =>
        createMovieReviewRequest(currentUser.id, {
          recipientUserId,
          movie: selectedMovie,
          prompt,
        }),
      ));
      replaceOnce(router, backTo ? (backTo as any) : '/friends');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send movie request.');
      setBusy(false);
    }
  }

  const header = (
    <Pressable onPress={handleBack} style={styles.backButton}>
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={busy ? 'Sending...' : selectedRecipientIds.length > 1 ? `Send to ${selectedRecipientIds.length} friends` : 'Send movie request'} onPress={handleSend} disabled={busy || !selectedMovie || selectedRecipientIds.length === 0} />}>
      <Text style={styles.title}>Ask for a Movie Rating</Text>
      <Text style={styles.subtitle}>Send a movie to one friend or a group, and each review becomes a shared memory card.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Ask {selectedRecipientIds.length > 0 ? `(${selectedRecipientIds.length} selected)` : ''}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetScroll}>
          {movieTargets.map((target) => {
            const active = selectedTargetKeys.includes(targetKey(target));
            return (
              <Pressable key={targetKey(target)} onPress={() => toggleTarget(target)} style={[styles.targetChip, active && styles.targetChipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <View style={[styles.targetAvatar, { backgroundColor: target.avatarColor }]}>
                  {target.imageUri ? <Image source={{ uri: target.imageUri }} style={styles.targetAvatarImage} /> : <Text style={styles.targetInitials}>{getInitials(target.title)}</Text>}
                  {active ? (
                    <View style={styles.targetCheck}>
                      <Ionicons name="checkmark" size={12} color={colors.white} />
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.targetChipText, active && styles.targetChipTextActive]} numberOfLines={1}>{target.title}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Movie</Text>
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            onFocus={handleSearchFocus}
            placeholder="Search a movie..."
            placeholderTextColor={colors.inkMuted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <Pressable onPress={handleSearch} disabled={searching} style={styles.searchButton} accessibilityRole="button">
            <Ionicons name="search" size={18} color={colors.white} />
          </Pressable>
        </View>
        {selectedMovie ? (
          <View style={styles.selectedMovieCard}>
            <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
            <Text style={styles.selectedMovieText} numberOfLines={1}>
              Selected: {selectedMovie.title}{selectedMovie.year ? ` (${selectedMovie.year})` : ''}
            </Text>
          </View>
        ) : null}
        <View style={styles.movieList}>
          {resultsVisible ? (
            <>
              <Text style={styles.movieListLabel}>{query.trim() ? 'Matches' : 'Popular now'}</Text>
              {searching ? <Text style={styles.searchingText}>Loading movies...</Text> : null}
              {results.map((movie) => {
                const active = selectedMovie?.tmdbId === movie.tmdbId;
                return (
                  <Pressable key={movie.tmdbId} onPress={() => handleSelectMovie(movie)} style={[styles.movieRow, active && styles.movieRowActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                    {movie.posterUrl ? (
                      <Image source={{ uri: movie.posterUrl }} style={styles.poster} />
                    ) : (
                      <View style={styles.posterFallback}><Ionicons name="film-outline" size={22} color={colors.inkMuted} /></View>
                    )}
                    <View style={styles.movieInfo}>
                      <Text style={styles.movieTitle}>{movie.title}{movie.year ? ` (${movie.year})` : ''}</Text>
                      <Text style={styles.movieOverview} numberOfLines={2}>{movie.overview ?? 'No overview available.'}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Prompt</Text>
        <TextInput
          multiline
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Optional: tell them why you want their take..."
          placeholderTextColor={colors.inkMuted}
          style={styles.promptInput}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

function getRecipientUserId(target: PeopleListItem) {
  return target.entityType === 'user' ? target.id : target.linkedUserId ?? null;
}

function targetKey(target: PeopleListItem) {
  return `${target.entityType}:${target.id}`;
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) => StyleSheet.create({
  backButton: { paddingVertical: spacing.xs },
  backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  section: { gap: spacing.sm },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
  targetScroll: { gap: spacing.sm, paddingRight: spacing.md },
  targetChip: { width: 104, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.sm, alignItems: 'center', gap: spacing.xs },
  targetChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '14' },
  targetAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  targetAvatarImage: { width: '100%', height: '100%' },
  targetCheck: { position: 'absolute', right: 0, bottom: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.paper },
  targetInitials: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  targetChipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
  targetChipTextActive: { color: colors.accent },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchInput: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  searchButton: { width: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  selectedMovieCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent + '55', backgroundColor: colors.accent + '10', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selectedMovieText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent },
  movieList: { gap: spacing.sm },
  movieListLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  searchingText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
  movieRow: { flexDirection: 'row', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.sm },
  movieRowActive: { borderColor: colors.accent, backgroundColor: colors.accent + '10' },
  poster: { width: 54, height: 80, borderRadius: radius.sm, backgroundColor: colors.canvasAlt },
  posterFallback: { width: 54, height: 80, borderRadius: radius.sm, backgroundColor: colors.canvasAlt, alignItems: 'center', justifyContent: 'center' },
  movieInfo: { flex: 1, gap: 3 },
  movieTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  movieOverview: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
  promptInput: { minHeight: 96, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
});
