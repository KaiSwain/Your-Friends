import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import { usePremium } from '../../src/features/premium/PremiumContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

interface Perk {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

const PERKS: Perk[] = [
  {
    icon: 'sparkles-outline',
    title: 'No ads, ever',
    body: 'A clean, quiet scrapbook with nothing trying to sell you anything.',
  },
  {
    icon: 'color-palette-outline',
    title: 'Every app theme, unlocked',
    body: 'Switch the whole app between curated palettes whenever the mood changes.',
  },
  {
    icon: 'person-circle-outline',
    title: 'Profile themes for every friend',
    body: 'Give each friend their own backdrop so their wall feels unmistakably theirs.',
  },
  {
    icon: 'square-outline',
    title: 'All card colors',
    body: 'Pick from the full palette of polaroid card colors when posting memories.',
  },
  {
    icon: 'images-outline',
    title: 'Pull memories from your gallery',
    body: 'Add photos straight from your camera roll — not just freshly taken polaroids.',
  },
];

const PRICE_LABEL = '$14.99 / 3 months';

export default function OnboardingPaywallScreen() {
  const router = useRouter();
  const { purchase } = usePremium();
  const { completeOnboarding } = useOnboarding();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [busy, setBusy] = useState(false);

  async function finish() {
    await completeOnboarding();
    router.replace('/(app)/friends');
  }

  async function handlePurchase() {
    if (busy) return;
    setBusy(true);
    try {
      await purchase();
      await finish();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not complete the purchase.';
      Alert.alert('Hmm', message);
      setBusy(false);
    }
  }

  async function handleLater() {
    if (busy) return;
    setBusy(true);
    try {
      await finish();
    } catch {
      setBusy(false);
    }
  }

  return (
    <OnboardingFrame
      step={6}
      totalSteps={7}
      eyebrow="One last thing"
      title="Unlock everything."
      subtitle={`${PRICE_LABEL}. Cancel anytime in Settings.`}
      onClose={handleLater}
      footer={
        <ActionButton
          label={busy ? 'Working…' : 'Subscribe to Premium'}
          onPress={handlePurchase}
          disabled={busy}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.perkList}>
          {PERKS.map((perk) => (
            <View key={perk.title} style={styles.perkRow}>
              <View style={styles.perkIcon}>
                <Ionicons name={perk.icon} size={20} color={colors.accent} />
              </View>
              <View style={styles.perkBody}>
                <Text style={styles.perkTitle}>{perk.title}</Text>
                <Text style={styles.perkBodyText}>{perk.body}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.fineprint}>
          Referral invites can unlock 7 days of Premium for both friends. Purchases restore automatically if you reinstall.
        </Text>
      </ScrollView>
    </OnboardingFrame>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    scrollContent: { gap: spacing.md, paddingBottom: spacing.md },
    perkList: { gap: spacing.sm },
    perkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    perkIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accent + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    perkBody: { flex: 1, gap: 2 },
    perkTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    perkBodyText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
    fineprint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.inkSoft,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    skipButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
    },
    skipLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.inkSoft,
      textDecorationLine: 'underline',
    },
  });
