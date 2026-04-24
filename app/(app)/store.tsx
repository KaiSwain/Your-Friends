import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { AppScreen } from '../../src/components/AppScreen';
import { SectionCard } from '../../src/components/SectionCard';
import { useAuth } from '../../src/features/auth/AuthContext';
import {
  FRIENDS_UNLOCK_PRICE,
  THEME_PRICE,
  usePremium,
} from '../../src/features/premium/PremiumContext';
import { themeCardUnlocks } from '../../src/features/theme/cardColorUnlocks';
import type { ColorTokens, ThemeName } from '../../src/features/theme/themes';
import { themeNames, themes } from '../../src/features/theme/themes';
import { fontSets } from '../../src/theme/typography';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';
import { useTheme } from '../../src/features/theme/ThemeContext';

export default function StoreScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { colors, fonts } = useTheme();
  const {
    purchasedThemes,
    friendsUnlocked,
    hasTheme,
    purchaseTheme,
    unlockFriends,
    purchase,
    restore,
  } = usePremium();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const lockedThemes = themeNames.filter((n) => !hasTheme(n));
  const ownedCount = purchasedThemes.length;
  const totalCount = themeNames.length;
  const everythingOwned = lockedThemes.length === 0 && friendsUnlocked;

  function confirmTheme(name: ThemeName) {
    Alert.alert(
      `Unlock ${themes[name].label}`,
      `Get the ${themes[name].label} theme for ${THEME_PRICE}. Also unlocks its matching card colors.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: `Unlock ${THEME_PRICE}`, onPress: () => purchaseTheme(name) },
      ],
    );
  }

  function confirmFriends() {
    Alert.alert(
      'Unlimited Friends',
      `Remove the friend limit for ${FRIENDS_UNLOCK_PRICE}.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: `Unlock ${FRIENDS_UNLOCK_PRICE}`, onPress: () => unlockFriends() },
      ],
    );
  }

  function confirmUnlockAll() {
    Alert.alert(
      'Unlock Everything',
      'Grants every theme and unlimited friends. (Simulated purchase — no charge.)',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unlock All', onPress: () => purchase() },
      ],
    );
  }

  return (
    <AppScreen floatingHeaderOnScroll>

      <Text style={styles.title}>Store</Text>
      <Text style={styles.subtitle}>
        {ownedCount} of {totalCount} themes owned · Friends {friendsUnlocked ? 'unlocked' : 'limited'}
      </Text>

      <SectionCard eyebrow="Bundle" title="Unlock Everything">
        <Text style={styles.bodyText}>
          Get every theme, every card color, and unlimited friends in one tap.
        </Text>
        <ActionButton
          label={everythingOwned ? 'Everything unlocked' : 'Unlock All'}
          onPress={confirmUnlockAll}
          variant="primary"
          disabled={everythingOwned}
        />
        <Pressable onPress={() => restore()} style={styles.restoreRow} accessibilityRole="button">
          <Text style={styles.restoreLabel}>Restore purchases</Text>
        </Pressable>
      </SectionCard>

      <SectionCard eyebrow="Add-on" title="Unlimited Friends">
        <Text style={styles.bodyText}>
          {friendsUnlocked
            ? 'You have unlimited friends.'
            : `Remove the friend limit for ${FRIENDS_UNLOCK_PRICE}.`}
        </Text>
        {!friendsUnlocked && (
          <ActionButton
            label={`Unlock ${FRIENDS_UNLOCK_PRICE}`}
            onPress={confirmFriends}
            variant="primary"
          />
        )}
      </SectionCard>

      <SectionCard eyebrow="Themes" title={`${THEME_PRICE} each`}>
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
                    <Text style={styles.ownedLabel}>Owned</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => confirmTheme(name)}
                    style={styles.buyButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Buy ${themes[name].label} theme for ${THEME_PRICE}`}
                  >
                    <Text style={styles.buyLabel}>{THEME_PRICE}</Text>
                  </Pressable>
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
    buyButton: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.pill, backgroundColor: colors.accent,
    },
    buyLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
  });
