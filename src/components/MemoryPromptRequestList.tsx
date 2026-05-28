import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { protectTextFromFontClipping } from '../theme/fontProtection';
import type { FontSet } from '../theme/typography';
import { radius, semanticColors, spacing } from '../theme/tokens';
import type { MemoryPromptRequest, MovieReviewRequest } from '../types/domain';
import { getPromptExpirationLabel, isPromptExpired } from '../lib/promptExpiration';
import { VoiceMemoryCard } from './VoiceMemoryCard';

interface MemoryPromptRequestListProps {
  currentUserId: string;
  friendName: string;
  memoryPrompts: MemoryPromptRequest[];
  moviePrompts?: MovieReviewRequest[];
  newMemoryPromptIds?: readonly string[];
  newMoviePromptIds?: readonly string[];
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
  newMemoryPromptIds = [],
  newMoviePromptIds = [],
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
  const altTint = activeTint;
  const tertiaryTint = tint ? colors.inkSoft : colors.accentTertiary ?? colors.accentSoft ?? activeTint;
  const styles = useMemo(() => makeStyles(colors, fonts, altTint, tertiaryTint), [altTint, colors, fonts, tertiaryTint]);
  const newMemoryPromptIdSet = useMemo(() => new Set(newMemoryPromptIds), [newMemoryPromptIds]);
  const newMoviePromptIdSet = useMemo(() => new Set(newMoviePromptIds), [newMoviePromptIds]);
  const hasPrompts = memoryPrompts.length > 0 || moviePrompts.length > 0;
  const [now, setNow] = useState(Date.now());
  const hasIncomingMoviePrompt = moviePrompts.some((request) => request.recipientUserId === currentUserId);
  const hasIncomingPrompt = hasIncomingMoviePrompt || memoryPrompts.some((request) => request.recipientUserId === currentUserId);
  const promptBubbleTitle = hasIncomingMoviePrompt ? 'New movie prompt' : hasIncomingPrompt ? 'New prompt waiting' : 'Prompts live here';
  const promptBubbleCopy = hasIncomingMoviePrompt
    ? 'Movie ratings are the fastest way to turn a friend request into a memory card.'
    : hasIncomingPrompt
      ? 'Answer a prompt to add something new to your shared wall.'
      : `Ask ${friendName} anything, then choose a song, photo, voice, note, or movie answer.`;

  useEffect(() => {
    if (!hasPrompts) return undefined;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [hasPrompts]);

  if (!hasPrompts) {
    return (
      <View style={styles.empty}>
        <PromptGuideBubble title={promptBubbleTitle} copy={promptBubbleCopy} styles={styles} tint={tertiaryTint} />
        <View style={styles.primaryCtaStack}>
          {onCreateMoviePrompt ? (
            <Pressable onPress={onCreateMoviePrompt} style={styles.movieHeroButton} accessibilityRole="button">
              <View style={styles.movieHeroIcon}>
                <Ionicons name="film-outline" size={22} color={tertiaryTint} />
              </View>
              <View style={styles.movieHeroCopy}>
                <Text style={styles.movieHeroTitle}>Ask for a movie rating</Text>
                <Text style={styles.movieHeroSubtitle}>Send one movie. Their review becomes a memory.</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={tertiaryTint} />
            </Pressable>
          ) : null}
          <Pressable onPress={onCreateMemoryPrompt} style={[styles.primaryButton, styles.sendPromptButton]} accessibilityRole="button">
            <Ionicons name="sparkles-outline" size={18} color={altTint} />
            <Text style={[styles.primaryText, styles.sendPromptText]}>Send prompt</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <PromptGuideBubble title={promptBubbleTitle} copy={promptBubbleCopy} styles={styles} tint={tertiaryTint} />
      <View style={styles.primaryCtaStack}>
        {onCreateMoviePrompt ? (
          <Pressable onPress={onCreateMoviePrompt} style={styles.movieHeroButton} accessibilityRole="button">
            <View style={styles.movieHeroIcon}>
              <Ionicons name="film-outline" size={22} color={tertiaryTint} />
            </View>
            <View style={styles.movieHeroCopy}>
              <Text style={styles.movieHeroTitle}>Ask for a movie rating</Text>
              <Text style={styles.movieHeroSubtitle}>Make movie prompts the next shared memory.</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={tertiaryTint} />
          </Pressable>
        ) : null}
        <Pressable onPress={onCreateMemoryPrompt} style={[styles.primaryButton, styles.sendPromptButton]} accessibilityRole="button">
          <Ionicons name="sparkles-outline" size={18} color={altTint} />
          <Text style={[styles.primaryText, styles.sendPromptText]}>Send prompt</Text>
        </Pressable>
      </View>
      {memoryPrompts.map((request) => {
        const incoming = currentUserId === request.recipientUserId;
        const isNew = incoming && newMemoryPromptIdSet.has(request.id);
        const expired = isPromptExpired(request, now);
        return (
          <View key={`memory-${request.id}`} style={[styles.card, isNew && styles.newCard, expired && styles.expiredCard]}>
            <View style={styles.icon}>
              <Ionicons name={iconForPromptType(request.promptType)} size={18} color={semanticColors.promptGold} />
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{incoming ? `${friendName} asked` : `You asked ${friendName}`}</Text>
                {isNew ? <Text style={styles.newPill}>New</Text> : null}
              </View>
              <Text style={styles.promptText} numberOfLines={3}>{request.promptText}</Text>
              {request.promptVoice ? (
                <View style={styles.promptVoicePreview}>
                  <VoiceMemoryCard
                    voice={request.promptVoice}
                    postId={`memory-prompt-list:${request.id}`}
                    authorName={incoming ? friendName : 'You'}
                    themeColors={colors}
                    variant="embedded"
                    label="Voice prompt"
                    preview
                  />
                </View>
              ) : null}
              <Text style={[styles.kindText, expired && styles.expiredText]}>{labelForPromptType(request.promptType)} - {getPromptExpirationLabel(request.expiresAt, now)}</Text>
              <View style={styles.actions}>
                {incoming ? (
                  <Pressable
                    onPress={() => {
                      if (!expired) onAnswerMemoryPrompt(request.id);
                    }}
                    disabled={expired}
                    style={[styles.primaryButton, expired && styles.disabledButton]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.primaryText, expired && styles.disabledText]}>{expired ? 'Expired' : 'Answer'}</Text>
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
        const isNew = incoming && newMoviePromptIdSet.has(request.id);
        const expired = isPromptExpired(request, now);
        return (
          <View key={`movie-${request.id}`} style={[styles.card, styles.movieCard, isNew && styles.newCard, expired && styles.expiredCard]}>
            <View style={[styles.icon, styles.movieIcon]}>
              <Ionicons name="film-outline" size={18} color={semanticColors.promptGold} />
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{incoming ? `${friendName} asked you to rate` : `You asked ${friendName} to rate`}</Text>
                {isNew ? <Text style={styles.newPill}>New movie</Text> : null}
              </View>
              <Text style={styles.movieTitle}>{request.movie.title}{request.movie.year ? ` (${request.movie.year})` : ''}</Text>
              {request.prompt ? <Text style={styles.promptText} numberOfLines={2}>{request.prompt}</Text> : null}
              {request.promptVoice ? (
                <View style={styles.promptVoicePreview}>
                  <VoiceMemoryCard
                    voice={request.promptVoice}
                    postId={`movie-prompt-list:${request.id}`}
                    authorName={incoming ? friendName : 'You'}
                    themeColors={colors}
                    variant="embedded"
                    label="Voice prompt"
                    preview
                  />
                </View>
              ) : null}
              <Text style={[styles.kindText, expired && styles.expiredText]}>Movie rating - {getPromptExpirationLabel(request.expiresAt, now)}</Text>
              <View style={styles.actions}>
                {incoming ? (
                  <Pressable
                    onPress={() => {
                      if (!expired) onAnswerMoviePrompt?.(request.id);
                    }}
                    disabled={expired}
                    style={[styles.bigAnswerButton, expired && styles.disabledButton]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="star-outline" size={15} color={semanticColors.movieGold} />
                    <Text style={[styles.primaryText, expired && styles.disabledText]}>{expired ? 'Expired' : 'Rate movie'}</Text>
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
  if (promptType === 'photo') return 'camera-outline' as const;
  if (promptType === 'photo_reference') return 'images-outline' as const;
  if (promptType === 'text') return 'chatbubble-ellipses-outline' as const;
  if (promptType === 'voice') return 'mic-outline' as const;
  return 'musical-notes-outline' as const;
}

function labelForPromptType(promptType: MemoryPromptRequest['promptType']) {
  if (promptType === 'photo') return 'Photo prompt';
  if (promptType === 'photo_reference') return 'Photo prompt';
  if (promptType === 'text') return 'Text prompt';
  if (promptType === 'voice') return 'Voice answer requested';
  return 'Song prompt';
}

const makeStyles = (colors: ColorTokens, fonts: FontSet, altTint: string, tertiaryTint: string) => StyleSheet.create({
  list: { gap: spacing.sm },
  empty: { gap: spacing.sm, alignItems: 'flex-start' },
  emptyHint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  emptyActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  guideBubble: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.line, 0.42),
    backgroundColor: withAlpha(colors.paper, 0.96),
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
    borderColor: withAlpha(colors.line, 0.42),
    backgroundColor: withAlpha(colors.paper, 0.96),
    transform: [{ rotate: '45deg' }],
  },
  guideHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  guideIcon: { color: tertiaryTint },
  guideTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: tertiaryTint },
  guideCopy: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink },
  primaryCtaStack: { alignSelf: 'stretch', gap: spacing.sm },
  movieHeroButton: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.line, 0.42),
    backgroundColor: withAlpha(colors.paper, 0.96),
    padding: spacing.md,
  },
  movieHeroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tertiaryTint + '22',
  },
  movieHeroCopy: { flex: 1, gap: 2 },
  movieHeroTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  movieHeroSubtitle: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.ink },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: spacing.md,
  },
  movieCard: { borderColor: withAlpha(colors.line, 0.42), backgroundColor: withAlpha(colors.paper, 0.96) },
  newCard: { borderColor: withAlpha(colors.line, 0.52), borderWidth: 1 },
  expiredCard: { opacity: 0.68 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.paper, 0.96),
  },
  movieIcon: { backgroundColor: semanticColors.promptGold + '22' },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  title: { fontFamily: fonts.bodyBold, fontSize: 12, color: semanticColors.promptGold },
  newPill: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: altTint + '1A',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: altTint,
    textTransform: 'uppercase',
  },
  movieTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 18) },
  promptText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.ink },
  promptVoicePreview: { marginTop: spacing.xs },
  kindText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkMuted },
  expiredText: { color: colors.inkMuted },
  actions: { flexDirection: 'row', marginTop: spacing.xs },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: withAlpha(colors.line, 0.42),
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 12, color: altTint },
  disabledButton: { opacity: 0.7 },
  disabledText: { color: colors.inkMuted },
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
    borderWidth: 1,
    borderColor: withAlpha(colors.line, 0.42),
    backgroundColor: colors.paper,
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
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 12, color: altTint },
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
