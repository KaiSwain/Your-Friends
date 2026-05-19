import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import { backOnce, replaceOnce } from '../../../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../../../src/theme/fontProtection';
import { radius, spacing } from '../../../../src/theme/tokens';

export default function MovieReviewResponseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const { currentUser } = useAuth();
  const { completeMovieReviewRequest, getMovieReviewRequestById, getUserById } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const requestId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
  const request = requestId ? getMovieReviewRequestById(requestId) : undefined;
  const requester = request ? getUserById(request.requesterUserId) : undefined;
  const [rating, setRating] = useState(0);
  const [ratingRowWidth, setRatingRowWidth] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const header = (
    <Pressable onPress={() => backOnce(router)} style={styles.backButton}>
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  async function handleSubmit() {
    if (!request || !currentUser) return;
    if (rating < 1) {
      setError('Choose a rating first.');
      return;
    }
    if (!body.trim()) {
      setError('Write a quick review before sending.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await completeMovieReviewRequest(currentUser.id, {
        requestId: request.id,
        rating,
        body,
      });
      replaceOnce(router, `/(app)/wall/${request.requesterUserId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your rating.');
      setBusy(false);
    }
  }

  function updateRatingFromTouch(event: GestureResponderEvent) {
    if (ratingRowWidth <= 0) return;
    const x = Math.max(0, Math.min(ratingRowWidth, event.nativeEvent.locationX));
    const nextRating = Math.max(0.5, Math.min(5, Math.ceil((x / ratingRowWidth) * 10) / 2));
    setRating(nextRating);
  }

  function handleRatingLayout(event: LayoutChangeEvent) {
    setRatingRowWidth(event.nativeEvent.layout.width);
  }

  if (!request) {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Movie request unavailable</Text>
        <Text style={styles.subtitle}>This request could not be opened.</Text>
      </AppScreen>
    );
  }

  if (request.recipientUserId !== currentUser.id) {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Not your request</Text>
        <Text style={styles.subtitle}>This movie rating request belongs to another account.</Text>
      </AppScreen>
    );
  }

  if (request.status !== 'pending') {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Already answered</Text>
        <Text style={styles.subtitle}>This movie request has already been handled.</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={busy ? 'Sending...' : 'Send rating'} onPress={handleSubmit} disabled={busy} />}>
      <Text style={styles.title}>Rate This Movie</Text>
      <Text style={styles.subtitle}>{requester?.displayName ?? 'A friend'} wants your take.</Text>

      <View style={styles.movieCard}>
        {request.movie.posterUrl ? (
          <Image source={{ uri: request.movie.posterUrl }} style={styles.poster} />
        ) : (
          <View style={styles.posterFallback}><Ionicons name="film-outline" size={32} color={colors.inkMuted} /></View>
        )}
        <View style={styles.movieInfo}>
          <Text style={styles.movieTitle}>{request.movie.title}{request.movie.year ? ` (${request.movie.year})` : ''}</Text>
          {request.prompt ? <Text style={styles.promptText}>"{request.prompt}"</Text> : null}
          <Text style={styles.movieOverview} numberOfLines={5}>{request.movie.overview ?? 'No overview available.'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Your rating</Text>
        <View
          style={styles.ratingRow}
          onLayout={handleRatingLayout}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={updateRatingFromTouch}
          onResponderMove={updateRatingFromTouch}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <View key={value} style={styles.starSlot}>
              <Ionicons name={getStarIcon(rating, value)} size={58} color={rating >= value - 0.5 ? colors.accent : colors.inkMuted} />
            </View>
          ))}
        </View>
        <Text style={styles.ratingValue}>{rating > 0 ? `${rating}/5 stars` : 'Tap or drag across the stars'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Review</Text>
        <TextInput
          multiline
          value={body}
          onChangeText={setBody}
          placeholder="What should your friend know before watching?"
          placeholderTextColor={colors.inkMuted}
          style={styles.reviewInput}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) => StyleSheet.create({
  backButton: { paddingVertical: spacing.xs },
  backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  movieCard: { flexDirection: 'row', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md },
  poster: { width: 100, height: 148, borderRadius: radius.md, backgroundColor: colors.canvasAlt },
  posterFallback: { width: 100, height: 148, borderRadius: radius.md, backgroundColor: colors.canvasAlt, alignItems: 'center', justifyContent: 'center' },
  movieInfo: { flex: 1, gap: spacing.xs },
  movieTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 22) },
  promptText: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.accent },
  movieOverview: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  section: { gap: spacing.sm },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
  ratingRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  starSlot: { width: 62, height: 66, alignItems: 'center', justifyContent: 'center' },
  ratingValue: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
  reviewInput: { minHeight: 140, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
});

function getStarIcon(rating: number, starValue: number) {
  if (rating >= starValue) return 'star' as const;
  if (rating >= starValue - 0.5) return 'star-half-outline' as const;
  return 'star-outline' as const;
}
