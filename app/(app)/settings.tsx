import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { AppScreen } from '../../src/components/AppScreen';
import { SectionCard } from '../../src/components/SectionCard';
import { useAuth } from '../../src/features/auth/AuthContext';
import { usePremium } from '../../src/features/premium/PremiumContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ThemeMode } from '../../src/features/theme/themes';
import { themeNames, themes } from '../../src/features/theme/themes';
import type { ColorTokens } from '../../src/features/theme/themes';
import type { FontSet } from '../../src/theme/typography';
import { fontSets } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

const modeOptions: { label: string; value: ThemeMode; recommended?: boolean; notRecommended?: boolean }[] = [
  { label: 'Light', value: 'light', recommended: true },
  { label: 'Dark', value: 'dark', notRecommended: true },
  { label: 'System', value: 'system' },
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function SettingsScreen() {
  const router = useRouter();
  const { currentUser, signOut } = useAuth();
  const { hasTheme } = usePremium();
  const { colors, fonts, themeName, themeMode, setThemeName, setThemeMode } = useTheme();
  const availableThemeNames = useMemo(() => themeNames.filter((name) => hasTheme(name)), [hasTheme]);
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const topBar = (
    <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  return (
    <AppScreen header={topBar} floatingHeaderOnScroll>

      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Signed in as {currentUser.displayName}</Text>

      <SectionCard eyebrow="Appearance" title="Color Mode">
        <View style={styles.optionRow}>
          {modeOptions.map((opt) => (
            <View key={opt.value} style={styles.optionColumn}>
              <View style={styles.optionTagSlot}>
                {opt.recommended ? (
                  <Text style={styles.recommendedTag}>Recommended</Text>
                ) : opt.notRecommended ? (
                  <Text style={styles.notRecommendedTag}>Not recommended</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => setThemeMode(opt.value)}
                style={[styles.optionPill, themeMode === opt.value && styles.optionPillActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: themeMode === opt.value }}
                accessibilityLabel={`${opt.label} color mode${opt.recommended ? ' (recommended)' : opt.notRecommended ? ' (not recommended)' : ''}`}
              >
                <Text style={[styles.optionLabel, themeMode === opt.value && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard eyebrow="Appearance" title="Theme">
        <View style={styles.themeGrid}>
          {availableThemeNames.map((name) => (
            <Pressable
              key={name}
              onPress={() => setThemeName(name)}
              style={[styles.themeTile, themeName === name && styles.themeTileActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: themeName === name }}
              accessibilityLabel={`${capitalize(name)} theme`}
            >
              <View style={[styles.themeSwatch, { backgroundColor: themes[name].swatch }]} />
              <Text style={[styles.themeTileLabel, { fontFamily: (fontSets[name] ?? fontSets.default).heading }]}>{capitalize(name)}</Text>
            </Pressable>
          ))}
        </View>
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
    optionRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
    optionColumn: { flex: 1 },
    optionTagSlot: { minHeight: 16, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 4 },
    recommendedTag: {
      fontFamily: fonts.bodyBold,
      fontSize: 9,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.accent,
    },
    notRecommendedTag: {
      fontFamily: fonts.bodyBold,
      fontSize: 9,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.inkMuted,
    },
    optionPill: {
      paddingVertical: spacing.sm, borderRadius: radius.pill,
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
    themeSwatch: { width: 10, height: 10, borderRadius: 5, marginRight: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.15)' },
    themeTileLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  });
