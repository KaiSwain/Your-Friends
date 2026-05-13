import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { StoreBannerAd } from '../../src/components/StoreBannerAd';
import { AppScreen } from '../../src/components/AppScreen';
import { FormField } from '../../src/components/FormField';
import { SectionCard } from '../../src/components/SectionCard';
import { useAuth } from '../../src/features/auth/AuthContext';
import {
  PREMIUM_SUBSCRIPTION_PRICE,
  REFERRAL_REWARD_LABEL,
  usePremium,
} from '../../src/features/premium/PremiumContext';
import { createFriendInviteLink } from '../../src/lib/friendCode';
import { themeCardUnlocks } from '../../src/features/theme/cardColorUnlocks';
import type { ColorTokens } from '../../src/features/theme/themes';
import { themeNames, themes } from '../../src/features/theme/themes';
import { fontSets } from '../../src/theme/typography';
import type { FontSet } from '../../src/theme/typography';
import { spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/features/theme/ThemeContext';

export default function StoreScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { colors, fonts } = useTheme();
  const {
    isPremium,
    premiumDaysRemaining,
    hasTheme,
    purchase,
    cancelSubscription,
    restore,
    referralRewardCount,
    referrerCode,
    pendingReferralCode,
    applyReferralCode,
  } = usePremium();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [enteredCode, setEnteredCode] = useState('');
  const [referralError, setReferralError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingReferralCode && !referrerCode) setEnteredCode((current) => current || pendingReferralCode);
  }, [pendingReferralCode, referrerCode]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const inviteLink = createFriendInviteLink(currentUser.friendCode);
  const topBar = (
    <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  function confirmSubscribe() {
    Alert.alert(
      'Subscribe to Premium',
      `Premium unlocks every theme, unlimited friends, calendar events, and reminders. ${PREMIUM_SUBSCRIPTION_PRICE}. Cancel anytime.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Subscribe', onPress: () => purchase() },
      ],
    );
  }

  function confirmCancel() {
    Alert.alert(
      'Cancel Premium',
      'You will lose access to premium themes, unlimited friends, calendar edits, and reminders.',
      [
        { text: 'Keep Premium', style: 'cancel' },
        { text: 'Cancel subscription', style: 'destructive', onPress: () => cancelSubscription() },
      ],
    );
  }

  async function submitReferralCode() {
    setReferralError(null);
    const result = await applyReferralCode(enteredCode);
    if (!result.ok) {
      setReferralError(result.error ?? 'Could not apply code.');
      return;
    }
    setEnteredCode('');
  }

  const premiumSubtitle = isPremium && premiumDaysRemaining < 10000
    ? `Premium active \u00b7 ${premiumDaysRemaining} ${premiumDaysRemaining === 1 ? 'day' : 'days'} left`
    : isPremium
      ? 'Premium active \u00b7 every theme unlocked'
      : 'Premium unlocks everything';

  return (
    <AppScreen header={topBar} floatingHeaderOnScroll>

      <Text style={styles.title}>Store</Text>
      <Text style={styles.subtitle}>{premiumSubtitle}</Text>

      <SectionCard eyebrow="Subscription" title="Premium">
        <Text style={styles.bodyText}>
          Premium unlocks every theme, every card color, unlimited friends, birthdays, events, and reminders.
        </Text>
        <Text style={styles.priceLine}>{PREMIUM_SUBSCRIPTION_PRICE}</Text>
        {isPremium ? (
          <ActionButton label="Cancel subscription" onPress={confirmCancel} variant="ghost" />
        ) : (
          <ActionButton label="Subscribe to Premium" onPress={confirmSubscribe} variant="primary" />
        )}
        <Pressable onPress={() => restore()} style={styles.restoreRow} accessibilityRole="button">
          <Text style={styles.restoreLabel}>Restore purchases</Text>
        </Pressable>
      </SectionCard>

      <SectionCard eyebrow="Refer a friend" title="Give 7 days, get 7 days">
        <Text style={styles.bodyText}>
          Share your referral code. When a friend creates an account with it, both of you get {REFERRAL_REWARD_LABEL}, free.
        </Text>
        <View style={styles.referralCodeRow}>
          <Text style={styles.referralCodeLabel}>Your code</Text>
          <Text style={styles.referralCode} selectable>{currentUser.friendCode}</Text>
        </View>
        <ActionButton
          label="Share invite"
          onPress={() =>
            Share.share({
              message: `Join me on Your Friends and use my referral code so we both get 7 days of Premium free.\n${inviteLink}\nReferral code: ${currentUser.friendCode}`,
            })
          }
          variant="secondary"
        />
        {referralRewardCount > 0 ? (
          <View style={styles.referralRewardBanner}>
            <Ionicons name="gift" size={16} color={colors.accent} />
            <Text style={styles.referralRewardText}>
              {referralRewardCount === 1
                ? '1 referral reward earned'
                : `${referralRewardCount} referral rewards earned`}
            </Text>
          </View>
        ) : null}
        {referrerCode ? (
          <Text style={styles.referrerLine}>
            Referral locked to code <Text style={styles.referrerCode}>{referrerCode}</Text>
          </Text>
        ) : (
          <View style={styles.referrerForm}>
            <Text style={styles.bodyText}>Got referred? Enter the code once to give both of you {REFERRAL_REWARD_LABEL}.</Text>
            <FormField
              label="Referrer's friend code"
              autoCapitalize="characters"
              placeholder="e.g. AB3XK7PN"
              value={enteredCode}
              onChangeText={(t) => {
                setEnteredCode(t);
                if (referralError) setReferralError(null);
              }}
            />
            {referralError ? <Text style={styles.referralErrorText}>{referralError}</Text> : null}
            <ActionButton label="Apply code" onPress={submitReferralCode} variant="secondary" disabled={!enteredCode.trim()} />
          </View>
        )}
      </SectionCard>

      <SectionCard
        eyebrow="Themes"
        title={isPremium ? 'Included with Premium' : 'Premium'}
      >
        <Text style={styles.bodyText}>
          {isPremium
            ? 'Every theme is included with your subscription.'
            : 'Every theme is included when you subscribe.'}
        </Text>
        <View style={styles.themeList}>
          {themeNames.map((name) => {
            const owned = hasTheme(name);
            const swatchColors = themeCardUnlocks[name] ?? [];
            return (
              <View key={name} style={styles.themeRow}>
                <View style={[styles.themeSwatch, { backgroundColor: themes[name].swatch }]} />
                <View style={styles.themeInfo}>
                  <Text style={[styles.themeName, { fontFamily: (fontSets[name] ?? fontSets.default).heading }]}>
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
                    <Ionicons name="lock-closed" size={12} color={colors.inkMuted} />
                    <Text style={styles.lockedLabel}>Premium</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard eyebrow="Coming Soon" title="Sticker Packs">
        <Text style={styles.bodyText}>
          Sticker packs are coming soon so you can add more personality to memories and profiles.
        </Text>
        <ActionButton label="Coming Soon" variant="secondary" disabled />
      </SectionCard>

      <SectionCard eyebrow="Sponsored" title="Support YourFriends">
        <Text style={styles.bodyText}>
          Ads help support continued development. Test ads are shown in development builds; live ads appear in release builds.
        </Text>
        <StoreBannerAd />
      </SectionCard>
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginBottom: spacing.sm },
    bodyText: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginBottom: spacing.sm },
    priceLine: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink, marginBottom: spacing.sm },
    restoreRow: { alignSelf: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
    restoreLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkMuted, textDecorationLine: 'underline' },
    themeList: { gap: spacing.sm },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
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
    referralCodeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      marginBottom: spacing.sm,
    },
    referralCodeLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkMuted, letterSpacing: 1.2 },
    referralCode: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.ink, letterSpacing: 2 },
    referralRewardBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: 999,
      backgroundColor: 'rgba(245,194,66,0.18)',
    },
    referralRewardText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
    referrerLine: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: spacing.sm },
    referrerCode: { fontFamily: fonts.bodyBold, color: colors.ink, letterSpacing: 1.4 },
    referrerForm: { marginTop: spacing.sm, gap: spacing.xs },
    referralErrorText: { fontFamily: fonts.body, fontSize: 12, color: '#B23A3A' },
  });
