import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import { PREMIUM_PRODUCT_IDS, type PremiumPlanId, usePremium } from '../../src/features/premium/PremiumContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import { LEGAL_LINKS, SUBSCRIPTION_LEGAL_COPY } from '../../src/lib/legalLinks';
import type { ColorTokens } from '../../src/features/theme/themes';
import { replaceOnce } from '../../src/lib/navigationGuard';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

interface Perk {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

const PERKS: Perk[] = [
  {
    icon: 'images-outline',
    title: 'Use your whole camera roll',
    body: 'Turn old photos, screenshots, trips, and favorite moments into memory cards anytime.',
  },
  {
    icon: 'camera-outline',
    title: 'Media memories',
    body: 'Add clean photo and short video memories that are separate from Memory Cards.',
  },
  {
    icon: 'gift-outline',
    title: 'Gift notes',
    body: 'Lock surprise notes for friends that unlock later and become memories.',
  },
  {
    icon: 'sparkles-outline',
    title: 'AI captions that sound like you',
    body: 'Get witty, sweet, or heartfelt caption ideas using the photo and your friendship context.',
  },
  {
    icon: 'chatbubbles-outline',
    title: 'Send memory prompts',
    body: 'Ask friends for songs, photo memories, voice memories, or notes when you want something new on the wall.',
  },
  {
    icon: 'film-outline',
    title: 'Send movie prompts',
    body: 'Send a movie and collect your friends’ ratings, then watch each review become a shared memory card.',
  },
  {
    icon: 'mic-outline',
    title: 'Voice memories',
    body: 'Record quick audio memories and reply to voice prompts when words are better said out loud.',
  },
  {
    icon: 'calendar-outline',
    title: 'Never miss friend moments',
    body: 'Create birthdays, anniversaries, plans, recurring reminders, and shared events your friends can keep too.',
  },
  {
    icon: 'color-palette-outline',
    title: 'Every app theme',
    body: 'Unlock every palette, mood, and matching typography so the whole app feels like yours.',
  },
  {
    icon: 'person-circle-outline',
    title: 'Custom friend profiles',
    body: 'Give each person their own backdrop, profile theme, profile card video, and personal vibe.',
  },
  {
    icon: 'brush-outline',
    title: 'All card colors',
    body: 'Use the full memory-card color palette so every post and profile card can match the moment.',
  },
  {
    icon: 'phone-portrait-outline',
    title: 'Shake-to-develop',
    body: 'Make fresh memory cards interactive: shake your phone to help photos develop faster.',
  },
  {
    icon: 'ribbon-outline',
    title: 'Premium profile glow',
    body: 'Show off Premium with the glowing treatment on your profile and friend cards.',
  },
  {
    icon: 'ban-outline',
    title: 'No ads, ever',
    body: 'Keep the scrapbook calm, focused, and uninterrupted.',
  },
  {
    icon: 'rocket-outline',
    title: 'Future creative tools first',
    body: 'Get upcoming memory formats, editing tools, decorations, and packs as they launch.',
  },
];

export default function OnboardingPaywallScreen() {
  const router = useRouter();
  const { purchase, premiumPlans, purchaseLoading, purchaseError } = usePremium();
  const { completeOnboarding } = useOnboarding();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [busy, setBusy] = useState(false);

  // Render the localized StoreKit price for the yearly plan instead of hard-coding it.
  const yearlyPlan = premiumPlans.find((plan) => plan.id === PREMIUM_PRODUCT_IDS.yearly);
  const yearlyPriceLabel = yearlyPlan ? `${yearlyPlan.displayPrice} / ${yearlyPlan.period}` : null;

  async function finish() {
    await completeOnboarding();
    replaceOnce(router, '/friends');
  }

  async function handlePurchase(planId: PremiumPlanId = PREMIUM_PRODUCT_IDS.yearly) {
    if (busy) return;
    setBusy(true);
    try {
      await purchase(planId);
      await finish();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not complete the purchase.';
      Alert.alert('Hmm', message);
      setBusy(false);
    }
  }

  function handleLater() {
    if (busy) return;
    setBusy(true);
    if (!replaceOnce(router, '/(onboarding)/free-features')) {
      setBusy(false);
    }
  }

  async function openExternalLink(url: string) {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Could not open link', url);
      return;
    }
    await Linking.openURL(url);
  }

  return (
    <OnboardingFrame
      step={12}
      totalSteps={13}
      eyebrow="One last thing"
      title="Make every friendship feel personal."
      subtitle={
        yearlyPriceLabel
          ? `Unlock every creative tool for ${yearlyPriceLabel}. Cancel anytime in Settings.`
          : 'Unlock every creative tool. Cancel anytime in Settings.'
      }
      onClose={handleLater}
      footer={
        <ActionButton
          label={busy ? 'Working…' : 'Subscribe to Premium'}
          onPress={() => handlePurchase(PREMIUM_PRODUCT_IDS.yearly)}
          disabled={busy}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.perkList}>
          <View style={styles.planList}>
            {premiumPlans.map((plan) => (
              <Pressable
                key={plan.id}
                onPress={() => handlePurchase(plan.id)}
                disabled={busy || purchaseLoading}
                style={[styles.planCard, plan.bestValue && styles.planCardBest]}
              >
                {plan.bestValue ? <Text style={styles.bestBadge}>Best deal</Text> : null}
                <Text style={styles.planLabel}>{plan.label}</Text>
                <Text style={styles.planPrice}>{plan.displayPrice}</Text>
                <Text style={styles.planPeriod}>per {plan.period}</Text>
                {plan.savingsLabel ? <Text style={styles.planSavings}>{plan.savingsLabel}</Text> : null}
              </Pressable>
            ))}
          </View>
          {purchaseError ? <Text style={styles.errorText}>{purchaseError}</Text> : null}
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
          {SUBSCRIPTION_LEGAL_COPY}
        </Text>
        <View style={styles.legalLinks}>
          <Pressable onPress={() => void openExternalLink(LEGAL_LINKS.termsOfUse)} accessibilityRole="link">
            <Text style={styles.legalLink}>Terms of Use (EULA)</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>•</Text>
          <Pressable onPress={() => void openExternalLink(LEGAL_LINKS.privacyPolicy)} accessibilityRole="link">
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </OnboardingFrame>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    scrollContent: { gap: spacing.md, paddingBottom: spacing.md },
    perkList: { gap: spacing.sm },
    planList: { gap: spacing.sm },
    planCard: {
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      borderRadius: radius.md,
      padding: spacing.md,
      gap: 2,
    },
    planCardBest: {
      borderColor: colors.accent,
      backgroundColor: colors.paper,
    },
    bestBadge: {
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      overflow: 'hidden',
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      color: colors.white,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: spacing.xs,
    },
    planLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    planPrice: { fontFamily: fonts.heading, fontSize: 25, color: colors.ink },
    planPeriod: { fontFamily: fonts.body, fontSize: 12, color: colors.ink },
    planSavings: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent, marginTop: spacing.xs },
    errorText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
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
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    perkBody: { flex: 1, gap: 2 },
    perkTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    perkBodyText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink },
    fineprint: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.inkSoft,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    legalLinks: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    legalLink: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.accent,
      textDecorationLine: 'underline',
    },
    legalSeparator: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.inkMuted,
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
