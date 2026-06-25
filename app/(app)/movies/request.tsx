import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { TextOrVoiceComposer } from '../../../src/components/TextOrVoiceComposer';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { usePremium } from '../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import { backOnce, pushOnce, replaceOnce, shouldPopForBackTarget } from '../../../src/lib/navigationGuard';
import { showPromptPaywall } from '../../../src/lib/premiumGates';
import { uploadMemoryAudio } from '../../../src/lib/memoryMediaUpload';
import { fetchPopularMovies, normalizeMovieSearchQuery, searchMovies } from '../../../src/lib/movieSearch';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import { radius, semanticColors, spacing } from '../../../src/theme/tokens';
import type { MovieAttachment, PeopleListItem, VoiceAttachment } from '../../../src/types/domain';

export default function MovieRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId?: string | string[]; subjectType?: string | string[]; backTo?: string | string[] }>();
  const { currentUser } = useAuth();
  const { isPremium } = usePremium();
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
  const [promptVoice, setPromptVoice] = useState<VoiceAttachment | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resultsHint, setResultsHint] = useState('');
  const [resultsVisible, setResultsVisible] = useState(true);
  const searchRequestSeq = useRef(0);
  const selectionLockedRef = useRef(false);
  const lastNonEmptyResultsRef = useRef<MovieAttachment[]>([]);
  const popularMoviesRef = useRef<MovieAttachment[]>([]);

  function handleBack() {
    if (backTo) {
      if (shouldPopForBackTarget(backTo)) {
        backOnce(router);
        return;
      }
      replaceOnce(router, backTo as any);
      return;
    }
    backOnce(router);
  }

  async function loadMovieResults(rawQuery: string, requestId: number) {
    const searchTerm = normalizeMovieSearchQuery(rawQuery);
    setSearching(true);
    setResultsHint('');
    setError('');
    setResultsVisible(true);
    try {
      let movies: MovieAttachment[];
      if (!searchTerm) {
        movies = await fetchPopularMovies();
        if (movies.length > 0) {
          popularMoviesRef.current = movies;
          lastNonEmptyResultsRef.current = movies;
        }
      } else {
        movies = await searchMovies(searchTerm);
      }

      if (requestId !== searchRequestSeq.current) return;

      if (movies.length > 0) {
        lastNonEmptyResultsRef.current = movies;
        setResults(movies);
        return;
      }

      if (!searchTerm) {
        setResults([]);
        setError('Popular movies are still loading. Try tapping search again.');
        return;
      }

      let fallback = lastNonEmptyResultsRef.current;
      let hint = 'No exact match — showing similar titles.';
      if (fallback.length === 0) {
        fallback = popularMoviesRef.current;
        hint = 'No exact match — showing popular movies.';
      }
      if (fallback.length === 0) {
        const popular = await fetchPopularMovies();
        if (requestId !== searchRequestSeq.current) return;
        popularMoviesRef.current = popular;
        fallback = popular;
        hint = popular.length > 0 ? 'No exact match — showing popular movies.' : '';
      }

      if (fallback.length > 0) {
        setResults(fallback);
        setResultsHint(hint);
        return;
      }

      setResults([]);
    } catch (err) {
      if (requestId !== searchRequestSeq.current) return;
      const message = err instanceof Error ? err.message : 'Could not load movies.';
      const fallback = lastNonEmptyResultsRef.current.length > 0
        ? lastNonEmptyResultsRef.current
        : popularMoviesRef.current;
      if (fallback.length > 0) {
        setResults(fallback);
        setResultsHint('Could not refresh — showing earlier results.');
        return;
      }
      setError(message);
    } finally {
      if (requestId === searchRequestSeq.current) setSearching(false);
    }
  }

  useEffect(() => {
    if (selectedTargetKeys.length > 0 || !initialTargetKey) return;
    setSelectedTargetKeys([initialTargetKey]);
  }, [initialTargetKey, selectedTargetKeys.length]);

  useEffect(() => {
    if (selectionLockedRef.current) return;

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
    if (selectionLockedRef.current) {
      setResultsVisible(true);
      return;
    }
    const requestId = searchRequestSeq.current + 1;
    searchRequestSeq.current = requestId;
    await loadMovieResults(query, requestId);
  }

  function handleQueryChange(value: string) {
    selectionLockedRef.current = false;
    setQuery(value);
    setSelectedMovie(null);
    setResultsVisible(true);
    setResultsHint('');
  }

  function handleSearchFocus() {
    setResultsVisible(true);
    if (selectionLockedRef.current) return;
    if (!query.trim() && results.length === 0 && !searching) {
      const requestId = searchRequestSeq.current + 1;
      searchRequestSeq.current = requestId;
      void loadMovieResults('', requestId);
    }
  }

  function handleSelectMovie(movie: MovieAttachment) {
    searchRequestSeq.current += 1;
    selectionLockedRef.current = true;
    setSelectedMovie(movie);
    setResults((current) => mergeMovieIntoResults(current, movie));
    setQuery(formatMovieDisplay(movie));
    setResultsVisible(false);
    setResultsHint('');
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
    if (!isPremium) {
      showPromptPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
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
      const uploadedPromptVoice = promptVoice
        ? {
          ...promptVoice,
          uri: await uploadMemoryAudio(promptVoice.uri, { prefix: `${currentUser.id}/voice-movies` }),
        }
        : null;
      await Promise.all(selectedRecipientIds.map((recipientUserId) =>
        createMovieReviewRequest(currentUser.id, {
          recipientUserId,
          movie: selectedMovie,
          prompt,
          promptVoice: uploadedPromptVoice,
        }),
      ));
      if (shouldPopForBackTarget(backTo)) {
        backOnce(router);
        return;
      }
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
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton accentColor={!isPremium ? semanticColors.movieGold : undefined} label={!isPremium ? 'Unlock Premium to send prompts' : busy ? 'Sending...' : selectedRecipientIds.length > 1 ? `Send to ${selectedRecipientIds.length} friends` : 'Send movie request'} onPress={handleSend} disabled={busy || (isPremium && (!selectedMovie || selectedRecipientIds.length === 0))} />}>
      <Text style={styles.title}>Ask for a Movie Rating</Text>
      <Text style={styles.subtitle}>Send a movie to one friend or a group, and each review becomes a shared memory card.</Text>
      {!isPremium ? (
        <View style={styles.premiumNotice}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.accent} />
          <Text style={styles.premiumNoticeText}>Sending movie prompts is a Premium feature. You can still answer movie prompts friends send you.</Text>
        </View>
      ) : null}

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
            placeholderTextColor={colors.ink}
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
              {!searching && resultsHint ? <Text style={styles.resultsHint}>{resultsHint}</Text> : null}
              {results.map((movie) => {
                const active = selectedMovie?.tmdbId === movie.tmdbId;
                return (
                  <Pressable key={movie.tmdbId} onPress={() => handleSelectMovie(movie)} style={[styles.movieRow, active && styles.movieRowActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                    {movie.posterUrl ? (
                      <Image source={{ uri: movie.posterUrl }} style={styles.poster} />
                    ) : (
                      <View style={styles.posterFallback}><Ionicons name="film-outline" size={22} color={colors.ink} /></View>
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
        <TextOrVoiceComposer
          text={prompt}
          onTextChange={setPrompt}
          voice={promptVoice}
          onVoiceChange={(voice) => {
            setPromptVoice(voice);
            setError('');
          }}
          previewAuthorName={currentUser.displayName}
          placeholder="Optional: tell them why you want their take..."
          voiceLabel="Record ask"
          voiceHelperText="Say why you want their take on this movie."
          textInputStyle={styles.promptInput}
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

function formatMovieDisplay(movie: MovieAttachment) {
  return movie.year ? `${movie.title} (${movie.year})` : movie.title;
}

function mergeMovieIntoResults(current: MovieAttachment[], movie: MovieAttachment) {
  const without = current.filter((entry) => entry.tmdbId !== movie.tmdbId);
  return [movie, ...without];
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) => StyleSheet.create({
  backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
  backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  premiumNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.paper, padding: spacing.md },
  premiumNoticeText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.ink },
  section: { gap: spacing.sm },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
  targetScroll: { gap: spacing.sm, paddingRight: spacing.md },
  targetChip: { width: 104, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.sm, alignItems: 'center', gap: spacing.xs },
  targetChipActive: { borderColor: colors.accent, backgroundColor: colors.paper },
  targetAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  targetAvatarImage: { width: '100%', height: '100%' },
  targetCheck: { position: 'absolute', right: 0, bottom: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.paper },
  targetInitials: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  targetChipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
  targetChipTextActive: { color: colors.accent },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchInput: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  searchButton: { width: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  selectedMovieCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selectedMovieText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent },
  movieList: { gap: spacing.sm },
  movieListLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  searchingText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
  resultsHint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkMuted },
  movieRow: { flexDirection: 'row', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.sm },
  movieRowActive: { borderColor: colors.accent, backgroundColor: colors.paper },
  poster: { width: 54, height: 80, borderRadius: radius.sm, backgroundColor: colors.canvasAlt },
  posterFallback: { width: 54, height: 80, borderRadius: radius.sm, backgroundColor: colors.canvasAlt, alignItems: 'center', justifyContent: 'center' },
  movieInfo: { flex: 1, gap: 3 },
  movieTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  movieOverview: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.ink },
  promptInput: { minHeight: 96, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
});
