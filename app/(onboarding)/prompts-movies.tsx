import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import { pushOnce } from '../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

const PROMPT_TYPES = [
  { icon: 'musical-notes-outline' as const, label: 'Song prompt', text: 'What song reminds you of us?' },
  { icon: 'images-outline' as const, label: 'Photo prompt', text: 'Pick a photo memory and tell me the story.' },
  { icon: 'film-outline' as const, label: 'Movie prompt', text: 'Rate this movie after you watch it.' },
];

export default function OnboardingPromptsMoviesScreen() {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <OnboardingFrame
      step={5}
      totalSteps={13}
      eyebrow="Prompts"
      title="When you do not know what to post, ask for a memory."
      subtitle="Prompts let you send a question to a friend. Their answer can become a song memory, a note, a referenced photo memory, or a movie rating on the wall."
      footer={<ActionButton label="Keep going" onPress={() => pushOnce(router, '/(onboarding)/tutorial')} />}
      scrollable
    >
      <View style={styles.phoneCard}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>Prompt inbox</Text>
            <Text style={styles.cardTitle}>New things to answer</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>3</Text>
          </View>
        </View>

        <View style={styles.promptList}>
          {PROMPT_TYPES.map((prompt, index) => (
            <View key={prompt.label} style={[styles.promptCard, index === 2 && styles.moviePromptCard]}>
              <View style={[styles.iconBubble, index === 2 && styles.movieIconBubble]}>
                <Ionicons name={prompt.icon} size={18} color={index === 2 ? colors.white : colors.accent} />
              </View>
              <View style={styles.promptCopy}>
                <Text style={styles.promptLabel}>{prompt.label}</Text>
                <Text style={styles.promptText}>{prompt.text}</Text>
              </View>
              {index === 2 ? (
                <View style={styles.movieCta}>
                  <Ionicons name="star" size={13} color={colors.white} />
                  <Text style={styles.movieCtaText}>Rate</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.explainerRow}>
        <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
        <Text style={styles.explainerText}>
          The point is to give friends an easy reason to add something meaningful, even when nobody has a fresh photo.
        </Text>
      </View>
    </OnboardingFrame>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    phoneCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      padding: spacing.md,
      gap: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 4,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    kicker: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: colors.accent,
    },
    cardTitle: {
      fontFamily: fonts.heading,
      fontSize: 23,
      color: colors.ink,
      ...protectTextFromFontClipping(fonts.heading, 23),
    },
    badge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    badgeText: {
      fontFamily: fonts.bodyBold,
      fontSize: 15,
      color: colors.white,
    },
    promptList: { gap: spacing.sm },
    promptCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      padding: spacing.md,
    },
    moviePromptCard: {
      borderColor: colors.accent,
      backgroundColor: colors.paper,
    },
    iconBubble: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paper,
    },
    movieIconBubble: {
      backgroundColor: colors.accent,
    },
    promptCopy: { flex: 1, gap: 3 },
    promptLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: colors.ink,
    },
    promptText: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      color: colors.ink,
    },
    movieCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    movieCtaText: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.white,
    },
    explainerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.paper,
      padding: spacing.md,
    },
    explainerText: {
      flex: 1,
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      lineHeight: 19,
      color: colors.ink,
    },
  });
