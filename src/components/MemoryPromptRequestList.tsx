import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { protectTextFromFontClipping } from '../theme/fontProtection';
import type { FontSet } from '../theme/typography';
import { radius, spacing } from '../theme/tokens';
import type { MemoryPromptRequest, MovieReviewRequest } from '../types/domain';

interface MemoryPromptRequestListProps {
  currentUserId: string;
  friendName: string;
  memoryPrompts: MemoryPromptRequest[];
  moviePrompts?: MovieReviewRequest[];
  onAnswerMemoryPrompt: (requestId: string) => void;
  onCancelMemoryPrompt: (requestId: string) => void;
  onCreateMemoryPrompt: () => void;
  onAnswerMoviePrompt?: (requestId: string) => void;
  onCancelMoviePrompt?: (requestId: string) => void;
  onCreateMoviePrompt?: () => void;
  themeColors?: ColorTokens;
  tint?: string;
}

export function MemoryPromptRequestList({
  currentUserId,
  friendName,
  memoryPrompts,
  moviePrompts = [],
  onAnswerMemoryPrompt,
  onCancelMemoryPrompt,
  onCreateMemoryPrompt,
  onAnswerMoviePrompt,
  onCancelMoviePrompt,
  onCreateMoviePrompt,
  themeColors,
  tint,
}: MemoryPromptRequestListProps) {
  const { colors: appColors, fonts } = useTheme();
  const colors = themeColors ?? appColors;
  const activeTint = tint ?? colors.accent;
  const styles = useMemo(() => makeStyles(colors, fonts, activeTint), [activeTint, colors, fonts]);
  const hasPrompts = memoryPrompts.length > 0 || moviePrompts.length > 0;
  const hasIncomingMoviePrompt = moviePrompts.some((request) => request.recipientUserId === currentUserId);
  const hasIncomingPrompt = hasIncomingMoviePrompt || memoryPrompts.some((request) => request.recipientUserId === currentUserId);
  const promptBubbleTitle = hasIncomingMoviePrompt ? 'New movie prompt' : hasIncomingPrompt ? 'New prompt waiting' : 'Prompts live here';
  const promptBubbleCopy = hasIncomingMoviePrompt
    ? 'Movie ratings are the fastest way to turn a friend request into a memory card.'
    : hasIncomingPrompt
      ? 'Answer a prompt to add something new to your shared wall.'
      : `Ask ${friendName} for a song, photo memory, note, or movie rating.`;

  if (!hasPrompts) {
    return (
      <View style={styles.empty}>
        <PromptGuideBubble title={promptBubbleTitle} copy={promptBubbleCopy} styles={styles} tint={activeTint} />
        <View style={styles.primaryCtaStack}>
          {onCreateMoviePrompt ? (
            <Pressable onPress={onCreateMoviePrompt} style={styles.movieHeroButton} accessibilityRole="button">
              <View style={styles.movieHeroIcon}>
                <Ionicons name="film-outline" size={22} color={colors.white} />
              </View>
              <View style={styles.movieHeroCopy}>
                <Text style={styles.movieHeroTitle}>Ask for a movie rating</Text>
                <Text style={styles.movieHeroSubtitle}>Send one movie. Their review becomes a memory.</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </Pressable>
          ) : null}
          <Pressable onPress={onCreateMemoryPrompt} style={[styles.primaryButton, styles.sendPromptButton]} accessibilityRole="button">
            <Ionicons name="sparkles-outline" size={18} color={colors.white} />
            <Text style={[styles.primaryText, styles.sendPromptText]}>Send prompt</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <PromptGuideBubble title={promptBubbleTitle} copy={promptBubbleCopy} styles={styles} tint={activeTint} />
      <View style={styles.primaryCtaStack}>
        {onCreateMoviePrompt ? (
          <Pressable onPress={onCreateMoviePrompt} style={styles.movieHeroButton} accessibilityRole="button">
            <View style={styles.movieHeroIcon}>
              <Ionicons name="film-outline" size={22} color={colors.white} />
            </View>
            <View style={styles.movieHeroCopy}>
              <Text style={styles.movieHeroTitle}>Ask for a movie rating</Text>
              <Text style={styles.movieHeroSubtitle}>Make movie prompts the next shared memory.</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </Pressable>
        ) : null}
        <Pressable onPress={onCreateMemoryPrompt} style={[styles.primaryButton, styles.sendPromptButton]} accessibilityRole="button">
          <Ionicons name="sparkles-outline" size={18} color={colors.white} />
          <Text style={[styles.primaryText, styles.sendPromptText]}>Send prompt</Text>
        </Pressable>
      </View>
      {memoryPrompts.map((request) => {
        const incoming = currentUserId === request.recipientUserId;
        return (
          <View key={`memory-${request.id}`} style={styles.card}>
            <View style={styles.icon}>
              <Ionicons name={iconForPromptType(request.promptType)} size={18} color={activeTint} />
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{incoming ? `${friendName} asked` : `You asked ${friendName}`}</Text>
                {incoming ? <Text style={styles.newPill}>New</Text> : null}
              </View>
              <Text style={styles.promptText} numberOfLines={3}>{request.promptText}</Text>
              <Text style={styles.kindText}>{labelForPromptType(request.promptType)}</Text>
              <View style={styles.actions}>
                {incoming ? (
                  <Pressable onPress={() => onAnswerMemoryPrompt(request.id)} style={styles.primaryButton} accessibilityRole="button">
                    <Text style={styles.primaryText}>Answer</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => onCancelMemoryPrompt(request.id)} style={styles.secondaryButton} accessibilityRole="button">
                    <Text style={styles.secondaryText}>Cancel request</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        );
      })}
      {moviePrompts.map((request) => {
        const incoming = currentUserId === request.recipientUserId;
        return (
          <View key={`movie-${request.id}`} style={[styles.card, styles.movieCard, incoming && styles.newMovieCard]}>
            <View style={[styles.icon, styles.movieIcon]}>
              <Ionicons name="film-outline" size={18} color={colors.white} />
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{incoming ? `${friendName} asked you to rate` : `You asked ${friendName} to rate`}</Text>
                {incoming ? <Text style={styles.newPill}>New movie</Text> : null}
              </View>
              <Text style={styles.movieTitle}>{request.movie.title}{request.movie.year ? ` (${request.movie.year})` : ''}</Text>
              {request.prompt ? <Text style={styles.promptText} numberOfLines={2}>{request.prompt}</Text> : null}
              <View style={styles.actions}>
                {incoming ? (
                  <Pressable onPress={() => onAnswerMoviePrompt?.(request.id)} style={styles.bigAnswerButton} accessibilityRole="button">
                    <Ionicons name="star-outline" size={15} color={colors.white} />
                    <Text style={styles.primaryText}>Rate movie</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => onCancelMoviePrompt?.(request.id)} style={styles.secondaryButton} accessibilityRole="button">
                    <Text style={styles.secondaryText}>Cancel request</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PromptGuideBubble({ title, copy, styles, tint }: { title: string; copy: string; styles: ReturnType<typeof makeStyles>; tint: string }) {
  return (
    <View style={styles.guideBubble}>
      <View style={styles.guidePointer} />
      <View style={styles.guideHeader}>
        <Ionicons name="notifications-outline" size={15} color={tint} />
        <Text style={styles.guideTitle}>{title}</Text>
      </View>
      <Text style={styles.guideCopy}>{copy}</Text>
    </View>
  );
}

function iconForPromptType(promptType: MemoryPromptRequest['promptType']) {
  if (promptType === 'photo_reference') return 'images-outline' as const;
  if (promptType === 'text') return 'chatbubble-ellipses-outline' as const;
  return 'musical-notes-outline' as const;
}

function labelForPromptType(promptType: MemoryPromptRequest['promptType']) {
  if (promptType === 'photo_reference') return 'Photo prompt';
  if (promptType === 'text') return 'Text prompt';
  return 'Song prompt';
}

const makeStyles = (colors: ColorTokens, fonts: FontSet, tint: string) => StyleSheet.create({
  list: { gap: spacing.sm },
  empty: { gap: spacing.sm, alignItems: 'flex-start' },
  emptyHint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  emptyActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  guideBubble: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: tint + '44',
    backgroundColor: tint + '12',
    padding: spacing.md,
    gap: spacing.xs,
  },
  guidePointer: {
    position: 'absolute',
    top: -7,
    left: 38,
    width: 14,
    height: 14,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: tint + '44',
    backgroundColor: colors.paper,
    transform: [{ rotate: '45deg' }],
  },
  guideHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  guideIcon: { color: tint },
  guideTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: tint },
  guideCopy: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  primaryCtaStack: { alignSelf: 'stretch', gap: spacing.sm },
  movieHeroButton: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: tint,
    padding: spacing.md,
  },
  movieHeroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  movieHeroCopy: { flex: 1, gap: 2 },
  movieHeroTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  movieHeroSubtitle: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.white },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
  },
  movieCard: { borderColor: tint + '55', backgroundColor: colors.paper },
  newMovieCard: { borderColor: tint, backgroundColor: tint + '10' },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tint + '14',
  },
  movieIcon: { backgroundColor: tint },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  title: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
  newPill: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: tint,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.white,
    textTransform: 'uppercase',
  },
  movieTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 18) },
  promptText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.ink },
  kindText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkMuted },
  actions: { flexDirection: 'row', marginTop: spacing.xs },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: tint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
  sendPromptButton: {
    alignSelf: 'stretch',
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sendPromptText: { fontSize: 15 },
  bigAnswerButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: tint,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 12, color: tint },
});
