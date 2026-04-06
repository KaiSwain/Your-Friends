import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { AppScreen } from '../../src/components/AppScreen';
import { SectionCard } from '../../src/components/SectionCard';
import { useAuth } from '../../src/features/auth/AuthContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ThemeName, ThemeMode } from '../../src/features/theme/themes';
import { themeNames } from '../../src/features/theme/themes';
import type { ColorTokens } from '../../src/features/theme/themes';
import { fonts } from '../../src/theme/typography';
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
  const { colors, themeName, themeMode, setThemeName, setThemeMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backLabel}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Signed in as {currentUser.displayName}</Text>

      <SectionCard eyebrow="Your code" title="Friend Code">
        <Pressable
          onPress={() => Alert.alert('Your Friend Code', currentUser.friendCode, [{ text: 'OK' }])}
          style={styles.codeBadge}
        >
          <Text style={styles.codeValue}>{currentUser.friendCode}</Text>
          <Text style={styles.codeHint}>Tap to copy · Share with friends</Text>
        </Pressable>
      </SectionCard>

      <SectionCard eyebrow="Appearance" title="Color Mode">
        <View style={styles.optionRow}>
          {modeOptions.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setThemeMode(opt.value)}
              style={[styles.optionPill, themeMode === opt.value && styles.optionPillActive]}
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
          {themeNames.map((name) => (
            <Pressable
              key={name}
              onPress={() => setThemeName(name)}
              style={[styles.themeTile, themeName === name && styles.themeTileActive]}
            >
              <Text style={styles.themeTileLabel}>{capitalize(name)}</Text>
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

const makeStyles = (colors: ColorTokens) =>
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
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.line,
    },
    themeTileActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    themeTileLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
  });
