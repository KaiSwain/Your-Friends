import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import { TextOrVoiceComposer } from '../../../../src/components/TextOrVoiceComposer';
import { VoiceMemoryCard } from '../../../../src/components/VoiceMemoryCard';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import { backOnce, replaceOnce } from '../../../../src/lib/navigationGuard';
import { uploadMemoryAudio } from '../../../../src/lib/memoryMediaUpload';
import { getPromptExpirationLabel, isPromptExpired } from '../../../../src/lib/promptExpiration';
import { protectTextFromFontClipping } from '../../../../src/theme/fontProtection';
import { radius, semanticColors, spacing } from '../../../../src/theme/tokens';
import type { VoiceAttachment } from '../../../../src/types/domain';

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
  const expired = request ? isPromptExpired(request) : false;
  const [rating, setRating] = useState(0);
  const [ratingRowWidth, setRatingRowWidth] = useState(0);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [body, setBody] = useState('');
  const [reviewVoice, setReviewVoice] = useState<VoiceAttachment | null>(null);
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
    setBusy(true);
    setError('');
    try {
      const uploadedVoice = reviewVoice
        ? {
          ...reviewVoice,
          uri: await uploadMemoryAudio(reviewVoice.uri, { prefix: `${currentUser.id}/voice-movies` }),
        }
        : null;
      await completeMovieReviewRequest(currentUser.id, {
        requestId: request.id,
        rating,
        body,
        voice: uploadedVoice,
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
    setError('');
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

  if (expired) {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Movie request expired</Text>
        <Text style={styles.subtitle}>This movie prompt was available for 7 days and can no longer be answered.</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      header={header}
      floatingHeaderOnScroll
      scrollEnabled={scrollEnabled}
      footer={<ActionButton label={busy ? 'Sending...' : 'Send rating'} onPress={handleSubmit} disabled={busy} />}
    >
      <Text style={styles.title}>Rate This Movie</Text>
      <Text style={styles.subtitle}>{requester?.displayName ?? 'A friend'} wants your take.</Text>

      <View style={styles.movieCard}>
        {request.movie.posterUrl ? (
          <Image source={{ uri: request.movie.posterUrl }} style={styles.poster} />
        ) : (
          <View style={styles.posterFallback}><Ionicons name="film-outline" size={32} color={colors.ink} /></View>
        )}
        <View style={styles.movieInfo}>
          <Text style={styles.movieTitle}>{request.movie.title}{request.movie.year ? ` (${request.movie.year})` : ''}</Text>
          <Text style={styles.expirationText}>{getPromptExpirationLabel(request.expiresAt)}</Text>
          {request.prompt ? <Text style={styles.promptText}>"{request.prompt}"</Text> : null}
          {request.promptVoice ? (
            <VoiceMemoryCard
              voice={request.promptVoice}
              postId={`movie-prompt:${request.id}`}
              authorName={requester?.displayName ?? 'A friend'}
              themeColors={colors}
              variant="embedded"
              label="Voice prompt"
              preview
            />
          ) : null}
          <Text style={styles.movieOverview} numberOfLines={5}>{request.movie.overview ?? 'No overview available.'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Your rating</Text>
        <View
          style={styles.ratingRow}
          onLayout={handleRatingLayout}
          onStartShouldSetResponder={() => false}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => {
            setScrollEnabled(false);
            updateRatingFromTouch(event);
          }}
          onResponderMove={updateRatingFromTouch}
          onResponderRelease={() => setScrollEnabled(true)}
          onResponderTerminate={() => setScrollEnabled(true)}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              onPress={() => {
                setError('');
                setRating(value);
              }}
              onPressIn={() => setScrollEnabled(false)}
              onPressOut={() => setScrollEnabled(true)}
              style={styles.starSlot}
              accessibilityRole="button"
              accessibilityLabel={`Rate ${value} out of 5 stars`}
            >
              <Ionicons name={getStarIcon(rating, value)} size={58} color={semanticColors.movieGold} />
            </Pressable>
          ))}
        </View>
        <Text style={styles.ratingValue}>{rating > 0 ? `${rating}/5 stars` : 'Tap or drag across the stars'}</Text>
      </View>

      <View style={styles.section}>
        <TextOrVoiceComposer
          label="Review"
          text={body}
          onTextChange={setBody}
          voice={reviewVoice}
          onVoiceChange={(voice) => {
            setReviewVoice(voice);
            setError('');
          }}
          previewAuthorName={currentUser.displayName}
          placeholder="What should your friend know before watching?"
          voiceLabel="Voice review"
          voiceHelperText="Record your review instead of typing."
          textInputStyle={styles.reviewInput}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) => StyleSheet.create({
  backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
  backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  movieCard: { flexDirection: 'row', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md },
  poster: { width: 100, height: 148, borderRadius: radius.md, backgroundColor: colors.canvasAlt },
  posterFallback: { width: 100, height: 148, borderRadius: radius.md, backgroundColor: colors.canvasAlt, alignItems: 'center', justifyContent: 'center' },
  movieInfo: { flex: 1, gap: spacing.xs },
  movieTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 22) },
  expirationText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.6 },
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
