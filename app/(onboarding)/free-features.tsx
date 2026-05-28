import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import { pushOnce, replaceOnce } from '../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import type { FontSet } from '../../src/theme/typography';
import { radius, semanticColors, spacing } from '../../src/theme/tokens';

interface FreeFeature {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  accent: string;
}

const FREE_FEATURES: FreeFeature[] = [
  {
    icon: 'people-outline',
    title: 'Add all your people',
    body: 'Create friend profiles, save facts, tags, private notes, and the little details that make each person feel known.',
    accent: semanticColors.replyPurple,
  },
  {
    icon: 'camera-outline',
    title: 'Fresh Memory Cards',
    body: 'Take new memory cards right from the camera and build a wall that feels like a real scrapbook.',
    accent: semanticColors.promptGold,
  },
  {
    icon: 'videocam-outline',
    title: 'Live Memory Cards',
    body: 'Capture short video moments as Live Memory Cards for free, so memories can move when a still photo is not enough.',
    accent: semanticColors.voiceRed,
  },
  {
    icon: 'images-outline',
    title: 'Shared memory walls',
    body: 'Keep a private timeline between you and a friend with notes, songs, photos, and moments all in one place.',
    accent: '#3A8C8C',
  },
  {
    icon: 'musical-notes-outline',
    title: 'Songs and notes',
    body: 'Write memory notes, attach songs, and make regular moments feel more personal without needing Premium.',
    accent: semanticColors.spotifyGreen,
  },
  {
    icon: 'film-outline',
    title: 'Movie ratings',
    body: 'Send movie requests and collect friend ratings for free whenever you want their take on what you watched.',
    accent: semanticColors.movieGold,
  },
];

export default function OnboardingFreeFeaturesScreen() {
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [busy, setBusy] = useState(false);

  async function startFree() {
    if (busy) return;
    setBusy(true);
    try {
      await completeOnboarding();
      replaceOnce(router, '/friends');
    } catch {
      setBusy(false);
    }
  }

  function showPremiumAgain() {
    if (busy) return;
    pushOnce(router, '/(onboarding)/paywall');
  }

  return (
    <OnboardingFrame
      step={12}
      totalSteps={13}
      eyebrow="Start free"
      title="There is already so much to love."
      subtitle="Premium unlocks more, but the free app is still a full friendship scrapbook."
      scrollable
      footer={
        <>
          <ActionButton
            label={busy ? 'Setting up...' : 'Start with free features'}
            onPress={startFree}
            disabled={busy}
          />
          <Pressable
            onPress={showPremiumAgain}
            disabled={busy}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>See Premium again</Text>
          </Pressable>
        </>
      }
    >
      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Ionicons name="heart" size={24} color={colors.white} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Your first memories are free.</Text>
          <Text style={styles.heroBody}>
            Add friends, make fresh Memory Cards, collect songs, and start building walls right away.
          </Text>
        </View>
      </View>

      <View style={styles.featureGrid}>
        {FREE_FEATURES.map((feature) => (
          <View key={feature.title} style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: feature.accent + '18', borderColor: feature.accent + '40' }]}>
              <Ionicons name={feature.icon} size={20} color={feature.accent} />
            </View>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureBody}>{feature.body}</Text>
          </View>
        ))}
      </View>
    </OnboardingFrame>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      borderRadius: radius.lg,
      padding: spacing.md,
      shadowColor: colors.black,
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    heroCopy: { flex: 1, gap: 3 },
    heroTitle: {
      fontFamily: fonts.heading,
      fontSize: 20,
      lineHeight: 25,
      color: colors.ink,
      ...protectTextFromFontClipping(fonts.heading, 20),
    },
    heroBody: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 19,
      color: colors.inkSoft,
    },
    featureGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingBottom: spacing.sm,
    },
    featureCard: {
      width: '48%',
      minHeight: 176,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    featureIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginBottom: 2,
    },
    featureTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      lineHeight: 18,
      color: colors.ink,
    },
    featureBody: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      color: colors.inkSoft,
    },
    secondaryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
    },
    secondaryButtonPressed: {
      opacity: 0.72,
    },
    secondaryButtonText: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.inkSoft,
      textDecorationLine: 'underline',
    },
  });
