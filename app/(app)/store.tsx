import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { StoreBannerAd } from '../../src/components/StoreBannerAd';
import { AppScreen } from '../../src/components/AppScreen';
import { SectionCard } from '../../src/components/SectionCard';
import { useAuth } from '../../src/features/auth/AuthContext';
import {
  PREMIUM_PRODUCT_IDS,
  PREMIUM_SUBSCRIPTION_PRICE,
  type PremiumPlanId,
  usePremium,
} from '../../src/features/premium/PremiumContext';
import { contrastText, contrastTextSoft } from '../../src/lib/contrastText';
import { LEGAL_LINKS, SUBSCRIPTION_LEGAL_COPY } from '../../src/lib/legalLinks';
import { backOnce } from '../../src/lib/navigationGuard';
import { themeCardUnlocks } from '../../src/features/theme/cardColorUnlocks';
import type { ColorTokens, ThemeMode, ThemeName } from '../../src/features/theme/themes';
import { featuredThemeNames, legacyThemeNames, themes } from '../../src/features/theme/themes';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import { fontSets } from '../../src/theme/typography';
import type { FontSet } from '../../src/theme/typography';
import { spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/features/theme/ThemeContext';

const PREMIUM_FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: 'calendar-outline',
    title: 'Friendship calendar',
    body: 'Add birthdays, anniversaries, plans, recurring events, local reminders, and shared events your friends can keep too.',
  },
  {
    icon: 'images-outline',
    title: 'Gallery photos',
    body: 'Turn camera-roll photos into memory cards instead of only taking fresh shots in the app.',
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
    title: 'Funny AI captions',
    body: 'Generate captions from the photo plus your relationship context, then pick the one that sounds most like you.',
  },
  {
    icon: 'chatbubbles-outline',
    title: 'Send memory prompts',
    body: 'Ask friends for songs, photo memories, voice memories, or notes when you do not know what to post.',
  },
  {
    icon: 'mic-outline',
    title: 'Voice memories',
    body: 'Record short audio memories and answer voice prompts with something more personal than text.',
  },
  {
    icon: 'phone-portrait-outline',
    title: 'Shake-to-develop',
    body: 'Make developing memory cards interactive. Shake your phone to help them come to life faster.',
  },
  {
    icon: 'color-palette-outline',
    title: 'Every theme',
    body: 'Unlock the full theme catalog, including matching typography, colors, moods, and future theme drops.',
  },
  {
    icon: 'brush-outline',
    title: 'Premium card colors',
    body: 'Use the full card-color palette for memories and profile cards so every person can have their own vibe.',
  },
  {
    icon: 'ribbon-outline',
    title: 'Premium profile border',
    body: 'Show off Premium with the glowing premium treatment on your friend/profile memory cards.',
  },
  {
    icon: 'ban-outline',
    title: 'Ad-free',
    body: 'Keep the scrapbook calm, focused, and uninterrupted as the app grows.',
  },
  {
    icon: 'rocket-outline',
    title: 'Future releases',
    body: 'Premium members get upcoming creative tools first, including new memory formats, decorations, and packs.',
  },
];

const THEME_DESCRIPTIONS: Record<ThemeName, string> = {
  yourFriends: 'The intentional house palette: purple actions, warm paper, and meaning-based accent colors across the app.',
  custom: 'Build your own readable palette with custom fonts, accent color, background hue, and intensity.',
  default: 'Classic Your Friends purple: clean, familiar, and easy to read.',
  neon: 'Electric cyan for people who want the app to feel like a late-night arcade.',
  synthwave: 'Hot pink and violet with a retro, music-video glow.',
  matcha: 'Soft green and cream for a calm scrapbook feel.',
  bubblegum: 'Sweet pinks for a playful, cute profile wall.',
  lava: 'Warm orange-red energy for bold memories.',
  arctic: 'Cool blues and icy surfaces for a crisp look.',
  vintage: 'Creamy paper tones for an old-photo feeling.',
  grape: 'Deep purple and gold, dramatic but still cozy.',
  cocoa: 'Chocolatey neutrals for a warm journal mood.',
  mint: 'Fresh greens and bright accents.',
  noir: 'High contrast, cinematic, and minimal.',
  sunset: 'Golden hour colors for soft nostalgia.',
  forest: 'Earthy greens for a grounded, outdoorsy feel.',
  peach: 'Warm peach tones that feel friendly and light.',
};

export default function StoreScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { colors, fonts, themeName, setThemeName, setThemeMode } = useTheme();
  const {
    isPremium,
    premiumDaysRemaining,
    hasTheme,
    purchase,
    premiumPlans,
    purchaseLoading,
    purchaseError,
    cancelSubscription,
    restore,
  } = usePremium();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [previewThemeName, setPreviewThemeName] = useState<ThemeName>(themeName);
  const [previewMode, setPreviewMode] = useState<Exclude<ThemeMode, 'system'>>('dark');
  const [previewCardColorByTheme, setPreviewCardColorByTheme] = useState<Partial<Record<ThemeName, string>>>({});

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const topBar = (
    <Pressable onPress={() => backOnce(router)} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  function confirmSubscribe(planId: PremiumPlanId = PREMIUM_PRODUCT_IDS.yearly) {
    const plan = premiumPlans.find((candidate) => candidate.id === planId);
    const priceLabel = `${plan?.displayPrice ?? PREMIUM_SUBSCRIPTION_PRICE}${plan ? ` per ${plan.period}` : ''}`;
    Alert.alert(
      'Subscribe to Premium',
      `Premium unlocks the calendar, prompts, gallery photos, every theme, AI captions, shake-to-develop, premium borders, card colors, ad-free use, and future releases.\n\n${priceLabel}. This is an auto-renewable subscription — it renews automatically each period and your Apple ID is charged unless you cancel at least 24 hours before the period ends. Manage or cancel anytime in your App Store account settings.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Subscribe', onPress: () => purchase(planId).catch((error) => Alert.alert('Purchase failed', error instanceof Error ? error.message : 'Try again in a moment.')) },
      ],
    );
  }

  function confirmCancel() {
    Alert.alert(
      'Cancel Premium',
      'You will lose access to premium themes, calendar edits, reminders, gallery photos, and creative tools.',
      [
        { text: 'Keep Premium', style: 'cancel' },
        { text: 'Cancel subscription', style: 'destructive', onPress: () => cancelSubscription() },
      ],
    );
  }

  function applyPreviewTheme() {
    if (!hasTheme(previewThemeName)) {
      confirmSubscribe();
      return;
    }
    setThemeName(previewThemeName);
    setThemeMode(previewMode);
  }

  async function openExternalLink(url: string) {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Could not open link', url);
      return;
    }
    await Linking.openURL(url);
  }

  const premiumSubtitle = isPremium && premiumDaysRemaining < 10000
    ? `Premium active \u00b7 ${premiumDaysRemaining} ${premiumDaysRemaining === 1 ? 'day' : 'days'} left`
    : isPremium
      ? 'Premium active \u00b7 every theme unlocked'
      : 'Premium unlocks everything';
  const yearlyPlan = premiumPlans.find((plan) => plan.id === PREMIUM_PRODUCT_IDS.yearly);
  const yearlyPriceLabel = yearlyPlan ? `${yearlyPlan.displayPrice} / ${yearlyPlan.period}` : PREMIUM_SUBSCRIPTION_PRICE;
  const previewTheme = themes[previewThemeName];
  const previewColors = previewTheme[previewMode];
  const previewFonts = fontSets[previewThemeName] ?? fontSets.default;
  const previewOwned = hasTheme(previewThemeName);
  const previewCardColors = themeCardUnlocks[previewThemeName] ?? [];
  const previewCardColor = previewCardColorByTheme[previewThemeName] ?? previewCardColors[0] ?? previewColors.paper;
  const previewCardInk = contrastText(previewCardColor);
  const previewCardInkSoft = contrastTextSoft(previewCardColor);

  return (
    <AppScreen header={topBar} floatingHeaderOnScroll>

      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <Ionicons name="sparkles" size={22} color={colors.white} />
        </View>
        <Text style={styles.heroEyebrow}>Your Friends Premium</Text>
        <Text style={styles.title}>Make the app feel alive.</Text>
        <Text style={styles.subtitle}>{premiumSubtitle}</Text>
        <Text style={styles.heroBody}>
          Build a prettier scrapbook, remember more moments, and unlock the playful tools that make Your Friends feel personal.
        </Text>
        <View style={styles.planGrid}>
          {premiumPlans.map((plan) => (
            <Pressable
              key={plan.id}
              onPress={() => confirmSubscribe(plan.id)}
              disabled={isPremium || purchaseLoading}
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
        {isPremium ? (
          <ActionButton label="Premium is active" onPress={() => undefined} variant="secondary" disabled />
        ) : (
          <ActionButton label={purchaseLoading ? 'Opening App Store...' : 'Start yearly: best deal'} onPress={() => confirmSubscribe(PREMIUM_PRODUCT_IDS.yearly)} variant="primary" disabled={purchaseLoading} />
        )}
        <Pressable onPress={() => restore()} style={styles.restoreRow} accessibilityRole="button">
          <Text style={styles.restoreLabel}>Restore purchases</Text>
        </Pressable>
        <Text style={styles.legalCopy}>{SUBSCRIPTION_LEGAL_COPY}</Text>
        <View style={styles.legalLinks}>
          <Pressable onPress={() => void openExternalLink(LEGAL_LINKS.termsOfUse)} accessibilityRole="link">
            <Text style={styles.legalLink}>Terms of Use (EULA)</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>•</Text>
          <Pressable onPress={() => void openExternalLink(LEGAL_LINKS.privacyPolicy)} accessibilityRole="link">
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
        </View>
      </View>

      <SectionCard eyebrow="Everything included" title="Premium features">
        <View style={styles.featureGrid}>
          {PREMIUM_FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon} size={18} color={colors.accent} />
              </View>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureBody}>{feature.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </SectionCard>

      <Text style={styles.title}>Store</Text>
      <Text style={styles.subtitle}>{premiumSubtitle}</Text>

      <SectionCard eyebrow="Subscription" title="Premium">
        <Text style={styles.bodyText}>
          Premium unlocks every theme, every card color, prompts, gift notes, media memories, birthdays, events, reminders, gallery photos, AI captions, and shake-to-develop.
        </Text>
        <Text style={styles.priceLine}>{yearlyPriceLabel}</Text>
        {isPremium ? (
          <ActionButton label="Cancel subscription" onPress={confirmCancel} variant="ghost" />
        ) : (
          <ActionButton label={purchaseLoading ? 'Opening App Store...' : 'Subscribe to Premium'} onPress={() => confirmSubscribe(PREMIUM_PRODUCT_IDS.yearly)} variant="primary" disabled={purchaseLoading} />
        )}
        <Pressable onPress={() => restore()} style={styles.restoreRow} accessibilityRole="button">
          <Text style={styles.restoreLabel}>Restore purchases</Text>
        </Pressable>
        <Text style={styles.legalCopy}>{SUBSCRIPTION_LEGAL_COPY}</Text>
        <View style={styles.legalLinks}>
          <Pressable onPress={() => void openExternalLink(LEGAL_LINKS.termsOfUse)} accessibilityRole="link">
            <Text style={styles.legalLink}>Terms of Use (EULA)</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>•</Text>
          <Pressable onPress={() => void openExternalLink(LEGAL_LINKS.privacyPolicy)} accessibilityRole="link">
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
        </View>
      </SectionCard>

      <SectionCard
        eyebrow="Themes"
        title="Try every theme"
      >
        <Text style={styles.bodyText}>
          {isPremium
            ? 'Preview a theme in light or dark, then apply it instantly.'
            : 'Tap through the full catalog before subscribing. Premium unlocks every mood.'}
        </Text>
        <View style={[styles.themePreview, { backgroundColor: previewColors.canvas, borderColor: previewColors.line }]}>
          <View style={[styles.previewHeader, { backgroundColor: previewColors.paper }]}>
            <View style={[styles.previewAvatar, { backgroundColor: previewColors.accent }]}>
              <Text style={[styles.previewAvatarText, { color: previewColors.white, fontFamily: previewFonts.bodyBold }]}>YF</Text>
            </View>
            <View style={styles.previewHeaderCopy}>
              <Text style={[styles.previewTitle, { color: previewColors.ink, fontFamily: previewFonts.heading }, protectTextFromFontClipping(previewFonts.heading, 22)]}>
                {previewTheme.label}
              </Text>
              <Text style={[styles.previewSubtitle, { color: previewColors.inkSoft, fontFamily: previewFonts.body }]}>
                {THEME_DESCRIPTIONS[previewThemeName]}
              </Text>
            </View>
          </View>
          <View style={[styles.previewPolaroid, { backgroundColor: previewCardColor }]}>
            <View style={[styles.previewPhoto, { backgroundColor: previewColors.accent }]}>
              <Ionicons name="image-outline" size={26} color={previewColors.white} />
            </View>
            <Text style={[styles.previewCaption, { color: previewCardInk, fontFamily: previewFonts.heading }, protectTextFromFontClipping(previewFonts.heading, 15)]}>
              saturday with friends
            </Text>
            <Text style={[styles.previewAuthor, { color: previewCardInkSoft, fontFamily: previewFonts.body }]}>
              card color preview
            </Text>
          </View>
          <View style={styles.previewCardColorBlock}>
            <Text style={[styles.previewCardColorLabel, { color: previewColors.inkSoft, fontFamily: previewFonts.bodyBold }]}>
              Test card colors
            </Text>
            <View style={styles.previewCardColorRow}>
              {previewCardColors.map((cardColor, index) => {
                const active = cardColor === previewCardColor;
                return (
                  <Pressable
                    key={`${previewThemeName}-${cardColor}-${index}`}
                    onPress={() => setPreviewCardColorByTheme((current) => ({ ...current, [previewThemeName]: cardColor }))}
                    style={[
                      styles.previewCardSwatchButton,
                      { borderColor: active ? previewColors.accent : previewColors.line },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Preview card color ${index + 1}`}
                    accessibilityState={{ selected: active }}
                  >
                    <View style={[styles.previewCardSwatch, { backgroundColor: cardColor }]}>
                      {active ? <Ionicons name="checkmark" size={14} color={contrastText(cardColor)} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.previewModeRow}>
            {(['light', 'dark'] as const).map((mode) => {
              const active = previewMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => setPreviewMode(mode)}
                  style={[
                    styles.modePill,
                    { borderColor: active ? previewColors.accent : previewColors.line, backgroundColor: active ? previewColors.accent : previewColors.paper },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons name={mode === 'light' ? 'sunny-outline' : 'moon-outline'} size={14} color={active ? previewColors.white : previewColors.ink} />
                  <Text style={[styles.modePillLabel, { color: active ? previewColors.white : previewColors.inkSoft, fontFamily: previewFonts.bodyBold }]}>
                    {mode === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <ActionButton
            label={previewOwned ? 'Use this look' : 'Unlock this theme'}
            onPress={applyPreviewTheme}
            variant={previewOwned ? 'secondary' : 'primary'}
          />
        </View>
        <View style={styles.themeList}>
          <Text style={styles.themeGroupLabel}>Featured themes</Text>
          {[...featuredThemeNames, ...legacyThemeNames].map((name, index) => {
            const owned = hasTheme(name);
            const swatchColors = themeCardUnlocks[name] ?? [];
            const legacyStarts = index === featuredThemeNames.length;
            return (
              <View key={name} style={legacyStarts && styles.legacyThemeGroup}>
                {legacyStarts ? <Text style={styles.themeGroupLabel}>Advanced / legacy themes</Text> : null}
                <Pressable
                  onPress={() => setPreviewThemeName(name)}
                  style={[styles.themeRow, legacyStarts || legacyThemeNames.includes(name) ? styles.themeRowLegacy : undefined, previewThemeName === name && styles.themeRowActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: previewThemeName === name }}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: themes[name].swatch }]} />
                  <View style={styles.themeInfo}>
                    <Text style={[styles.themeName, { fontFamily: (fontSets[name] ?? fontSets.default).heading }, protectTextFromFontClipping((fontSets[name] ?? fontSets.default).heading, 15)]}>
                      {themes[name].label}
                    </Text>
                    <View style={styles.colorRow}>
                      {swatchColors.map((c, i) => (
                        <View key={`${name}-${i}`} style={[styles.colorDot, { backgroundColor: c }]} />
                      ))}
                    </View>
                  </View>
                  {owned ? (
                    <View style={styles.ownedBadge}>
                      <Ionicons name="checkmark" size={14} color={colors.accent} />
                      <Text style={styles.ownedLabel}>Included</Text>
                    </View>
                  ) : (
                    <View style={styles.lockedBadge}>
                      <Ionicons name="lock-closed" size={12} color={colors.ink} />
                      <Text style={styles.lockedLabel}>Premium</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard eyebrow="Coming Soon" title="Future releases">
        <Text style={styles.bodyText}>
          Premium is where new creative releases land first: sticker packs, new memory decorations, more themes, seasonal card styles, and experimental friendship tools.
        </Text>
        <ActionButton label="Coming Soon" variant="secondary" disabled />
      </SectionCard>

      {!isPremium ? (
      <SectionCard eyebrow="Sponsored" title="Free plan support">
        <Text style={styles.bodyText}>
          Ads help support continued development on the free plan. Tap the close button on a banner to hide it for a few hours. Premium keeps the app ad-free.
        </Text>
        <StoreBannerAd />
      </SectionCard>
      ) : null}
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
    backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
    subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginBottom: spacing.sm },
    heroCard: {
      borderRadius: 32,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.paper,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    heroEyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.accent,
    },
    heroBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
    bodyText: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, marginBottom: spacing.sm },
    priceLine: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink, marginBottom: spacing.sm },
    planGrid: { gap: spacing.sm, marginVertical: spacing.xs },
    planCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      padding: spacing.md,
      gap: 2,
    },
    planCardBest: {
      borderColor: colors.accent,
      borderWidth: 2,
      backgroundColor: colors.paperMuted,
    },
    bestBadge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
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
    planPrice: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 26) },
    planPeriod: { fontFamily: fonts.body, fontSize: 12, color: colors.ink },
    planSavings: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent, marginTop: spacing.xs },
    errorText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
    restoreRow: { alignSelf: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
    restoreLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkMuted, textDecorationLine: 'underline' },
    legalCopy: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      color: colors.ink,
      textAlign: 'center',
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
      color: colors.ink,
    },
    featureGrid: { gap: spacing.sm },
    featureRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    featureIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureCopy: { flex: 1, gap: 2 },
    featureTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
    featureBody: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink },
    themePreview: {
      borderRadius: 28,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 20,
      padding: spacing.md,
    },
    previewAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewAvatarText: { fontSize: 13 },
    previewHeaderCopy: { flex: 1, gap: 2 },
    previewTitle: { fontSize: 22 },
    previewSubtitle: { fontSize: 12, lineHeight: 17 },
    previewPolaroid: {
      alignSelf: 'center',
      width: 150,
      borderRadius: 8,
      padding: 9,
      paddingBottom: 24,
      gap: 8,
    },
    previewPhoto: {
      aspectRatio: 1,
      borderRadius: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewCaption: { fontSize: 15, textAlign: 'center' },
    previewAuthor: { fontSize: 10, textAlign: 'center', marginTop: -4 },
    previewCardColorBlock: { gap: spacing.xs },
    previewCardColorLabel: { fontSize: 12, textAlign: 'center' },
    previewCardColorRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    previewCardSwatchButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    previewCardSwatch: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(0,0,0,0.16)',
    },
    previewModeRow: { flexDirection: 'row', gap: spacing.sm },
    modePill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 999,
      borderWidth: 1,
      paddingVertical: spacing.sm,
    },
    modePillLabel: { fontSize: 12 },
    themeList: { gap: spacing.sm },
    themeGroupLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: colors.inkMuted,
    },
    legacyThemeGroup: { marginTop: spacing.sm },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
      borderRadius: 16,
      paddingHorizontal: spacing.sm,
    },
    themeRowLegacy: { opacity: 0.84 },
    themeRowActive: { backgroundColor: colors.paper },
    themeSwatch: {
      width: 28, height: 28, borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.15)',
    },
    themeInfo: { flex: 1 },
    themeName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
    colorRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
    colorDot: {
      width: 10, height: 10, borderRadius: 5,
      borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.15)',
    },
    ownedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ownedLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.accent },
    lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    lockedLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkMuted },
  });
