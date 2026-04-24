import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { AppScreen } from '../../src/components/AppScreen';
import { SectionCard } from '../../src/components/SectionCard';
import { ThemedIcon } from '../../src/components/ThemedIcon';
import { useAuth } from '../../src/features/auth/AuthContext';
import { usePremium } from '../../src/features/premium/PremiumContext';
import { THEME_PRICE } from '../../src/features/premium/PremiumContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import { createFriendInviteLink } from '../../src/lib/friendCode';
import type { ThemeName, ThemeMode } from '../../src/features/theme/themes';
import { themeNames, themes } from '../../src/features/theme/themes';
import type { ColorTokens } from '../../src/features/theme/themes';
import type { FontSet } from '../../src/theme/typography';
import { fontSets } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

const modeOptions: { label: string; value: ThemeMode }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function SettingsScreen() {
  const router = useRouter();
  const { currentUser, signOut } = useAuth();
  const { isPremium, hasTheme, purchaseTheme, purchase } = usePremium();
  const { colors, fonts, themeName, themeMode, setThemeName, setThemeMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const inviteLink = createFriendInviteLink(currentUser.friendCode);

  return (
    <AppScreen floatingHeaderOnScroll>

      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Signed in as {currentUser.displayName}</Text>

      <SectionCard eyebrow="Your code" title="Friend Code">
        <Pressable
          onPress={() => Share.share({ message: `Add me on Your Friends!\n${inviteLink}\nFriend code: ${currentUser.friendCode}` })}
          style={styles.codeBadge}
          accessibilityRole="button"
          accessibilityLabel={`Friend code: ${currentUser.friendCode}. Tap to share`}
        >
          <Text style={styles.codeValue}>{currentUser.friendCode}</Text>
          <Text style={styles.codeHint}>Tap to share your friend link</Text>
        </Pressable>
      </SectionCard>

      <SectionCard eyebrow="Appearance" title="Color Mode">
        <View style={styles.optionRow}>
          {modeOptions.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setThemeMode(opt.value)}
              style={[styles.optionPill, themeMode === opt.value && styles.optionPillActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: themeMode === opt.value }}
              accessibilityLabel={`${opt.label} color mode`}
            >
              <Text style={[styles.optionLabel, themeMode === opt.value && styles.optionLabelActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard eyebrow="Appearance" title="Theme">
        <View style={styles.themeGrid}>
          {themeNames.map((name) => {
            const locked = !hasTheme(name);
            return (
              <Pressable
                key={name}
                onPress={() => {
                  if (locked) {
                    Alert.alert(
                      `Unlock ${themes[name].label}`,
                      `Get the ${themes[name].label} theme for ${THEME_PRICE}. Each theme also unlocks its matching card colors.`,
                      [
                        { text: 'Not now', style: 'cancel' },
                        { text: `Unlock ${THEME_PRICE}`, onPress: () => purchaseTheme(name) },
                      ],
                    );
                  } else {
                    setThemeName(name);
                  }
                }}
                style={[styles.themeTile, themeName === name && styles.themeTileActive, locked && styles.themeTileLocked]}
                accessibilityRole="radio"
                accessibilityState={{ selected: themeName === name }}
                accessibilityLabel={locked ? `${capitalize(name)} theme, locked` : `${capitalize(name)} theme`}
              >
                {locked && <View style={{ marginRight: 4 }}><ThemedIcon name="lock" size={12} color={colors.inkMuted} /></View>}
                <View style={[styles.themeSwatch, { backgroundColor: themes[name].swatch }, locked && { opacity: 0.5 }]} />
                <Text style={[styles.themeTileLabel, { fontFamily: (fontSets[name] ?? fontSets.default).heading }, locked && styles.themeTileLabelLocked]}>{capitalize(name)}</Text>
              </Pressable>
            );
          })}
        </View>
        {!isPremium && (
          <Text style={styles.premiumHint}>Each theme is {THEME_PRICE} and unlocks its matching card colors.</Text>
        )}
      </SectionCard>

      <SectionCard eyebrow="Store" title="Unlock All">
        <Text style={styles.premiumHint}>Grab every theme and unlimited friends in one tap.</Text>
        <ActionButton
          label={isPremium ? 'Everything unlocked' : 'Unlock All'}
          onPress={() =>
            Alert.alert(
              'Unlock Everything',
              'Grants every theme and unlimited friends. (Simulated purchase — no charge.)',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Unlock All', onPress: () => purchase() },
              ],
            )
          }
          variant="primary"
          disabled={isPremium}
        />
        <ActionButton label="Browse Store" onPress={() => router.push('/(app)/store')} variant="ghost" />
      </SectionCard>

      <SectionCard eyebrow="Account">
        <ActionButton label="Sign out" onPress={signOut} variant="ghost" />
      </SectionCard>
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
    codeBadge: { alignItems: 'center', paddingVertical: spacing.sm },
    codeValue: { fontFamily: fonts.bodyBold, fontSize: 28, color: colors.ink, letterSpacing: 4 },
    codeHint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: 4 },
    optionRow: { flexDirection: 'row', gap: spacing.sm },
    optionPill: {
      flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill,
      borderWidth: 1, borderColor: colors.line, alignItems: 'center',
    },
    optionPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    optionLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
    optionLabelActive: { color: colors.white },
    themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    themeTile: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.line,
    },
    themeTileActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    themeTileLocked: { opacity: 0.55 },
    themeSwatch: { width: 10, height: 10, borderRadius: 5, marginRight: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.15)' },
    themeTileLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
    themeTileLabelLocked: { color: colors.inkMuted },
    premiumHint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: spacing.xs },
  });
