import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Redirect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { AppScreen } from '../../src/components/AppScreen';
import { CustomThemeVisualizer } from '../../src/components/CustomThemeVisualizer';
import { SectionCard } from '../../src/components/SectionCard';
import { useAuth } from '../../src/features/auth/AuthContext';
import { MusicOpenPreference, useMusicPreference } from '../../src/features/music/MusicPreferenceContext';
import { usePremium } from '../../src/features/premium/PremiumContext';
import { DEFAULT_BACKGROUND_BLUR, MAX_BACKGROUND_BLUR, MIN_BACKGROUND_BLUR, useTheme } from '../../src/features/theme/ThemeContext';
import { createCustomThemePair, type CustomThemeFontKey, type CustomThemeSettings } from '../../src/features/theme/customTheme';
import type { ThemeMode } from '../../src/features/theme/themes';
import { featuredThemeNames, legacyThemeNames, themes } from '../../src/features/theme/themes';
import { backOnce, pushOnce, replaceOnce } from '../../src/lib/navigationGuard';
import { showErrorAlert } from '../../src/lib/alertUtils';
import { showProfileBackgroundPaywall } from '../../src/lib/premiumGates';
import { cropProfileBackgroundAsset } from '../../src/lib/profileBackgroundImage';
import { profileBackgroundImagePickerOptions } from '../../src/lib/imagePickerPresets';
import { LEGAL_LINKS } from '../../src/lib/legalLinks';
import type { ColorTokens } from '../../src/features/theme/themes';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import type { FontSet } from '../../src/theme/typography';
import { fontSets } from '../../src/theme/typography';
import { radius, semanticColors, spacing } from '../../src/theme/tokens';

const modeOptions: { label: string; value: ThemeMode; recommended?: boolean; notRecommended?: boolean }[] = [
  { label: 'Light', value: 'light', recommended: true },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

const musicOpenOptions: { label: string; value: MusicOpenPreference; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Apple Music', value: 'apple', icon: 'musical-notes' },
  { label: 'Spotify', value: 'spotify', icon: 'radio' },
];

const customFontOptions: { label: string; value: CustomThemeFontKey; sampleTheme: string }[] = [
  { label: 'Classic', value: 'classic', sampleTheme: 'default' },
  { label: 'Modern', value: 'modern', sampleTheme: 'neon' },
  { label: 'Playful', value: 'playful', sampleTheme: 'bubblegum' },
  { label: 'Editorial', value: 'editorial', sampleTheme: 'vintage' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { currentUser, signOut, updateProfile, deleteAccount } = useAuth();
  const { hasTheme, isPremium } = usePremium();
  const { backgroundBlur, colors, customTheme, fonts, resolvedMode, themeName, themeMode, setBackgroundBlur, setCustomTheme, setThemeName, setThemeMode } = useTheme();
  const { musicOpenPreference, setMusicOpenPreference } = useMusicPreference();
  const availableFeaturedThemeNames = useMemo(() => featuredThemeNames.filter((name) => hasTheme(name)), [hasTheme]);
  const availableLegacyThemeNames = useMemo(() => legacyThemeNames.filter((name) => hasTheme(name)), [hasTheme]);
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [draftCustomTheme, setDraftCustomTheme] = useState(customTheme);
  const customThemePair = useMemo(() => createCustomThemePair(draftCustomTheme), [draftCustomTheme]);
  const customThemePreviewColors = customThemePair[resolvedMode];
  const [profileBgImageUri, setProfileBgImageUri] = useState<string | null>(null);
  const [backgroundSaving, setBackgroundSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showCustomThemeFineTune, setShowCustomThemeFineTune] = useState(false);

  useEffect(() => {
    setDraftCustomTheme(customTheme);
  }, [customTheme]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const profileBackgroundUri = profileBgImageUri ?? currentUser.profileBgImagePath ?? null;

  async function pickProfileBackgroundPhoto() {
    if (!isPremium) {
      showProfileBackgroundPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(profileBackgroundImagePickerOptions);
    if (result.canceled || !result.assets[0]) return;

    setBackgroundSaving(true);
    try {
      const croppedUri = await cropProfileBackgroundAsset(result.assets[0]);
      setProfileBgImageUri(croppedUri);
      await updateProfile({ profileBgImageLocalUri: croppedUri });
      setProfileBgImageUri(null);
    } catch (error) {
      setProfileBgImageUri(null);
      showErrorAlert('Could not save background', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setBackgroundSaving(false);
    }
  }

  async function clearProfileBackgroundPhoto() {
    setBackgroundSaving(true);
    try {
      setProfileBgImageUri(null);
      await updateProfile({ profileBgImageLocalUri: null });
    } catch (error) {
      showErrorAlert('Could not remove background', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setBackgroundSaving(false);
    }
  }

  async function setPublicProfileBackground(enabled: boolean) {
    if (!profileBackgroundUri) return;
    setBackgroundSaving(true);
    try {
      await updateProfile({ profileBgImagePublic: enabled });
    } catch (error) {
      showErrorAlert('Could not update public background', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setBackgroundSaving(false);
    }
  }

  function previewCustomTheme(updates: Partial<CustomThemeSettings>) {
    setDraftCustomTheme((current) => ({ ...current, ...updates }));
  }

  function commitCustomTheme(updates: Partial<CustomThemeSettings> = {}) {
    const next = { ...draftCustomTheme, ...updates };
    setDraftCustomTheme(next);
    setCustomTheme(next);
    if (themeName !== 'custom') setThemeName('custom');
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, profile, contacts, private notes, memories, and uploaded media. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Your account will be permanently removed from Your Friends.',
              [
                { text: 'Keep account', style: 'cancel' },
                { text: 'Permanently delete', style: 'destructive', onPress: () => void handleDeleteAccount() },
              ],
            );
          },
        },
      ],
    );
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      replaceOnce(router, '/(auth)/sign-in');
    } catch (error) {
      showErrorAlert('Could not delete account', error instanceof Error ? error.message : 'Try again in a moment.');
      setDeletingAccount(false);
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

  const topBar = (
    <Pressable onPress={() => backOnce(router)} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  return (
    <AppScreen header={topBar} floatingHeaderOnScroll>

      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Signed in as {currentUser.displayName}</Text>

      {currentUser.isOfficial && currentUser.isTeamAdmin ? (
        <SectionCard eyebrow="Team" title="Admin">
          <LegalRow
            colors={colors}
            fonts={fonts}
            icon="megaphone-outline"
            label="Broadcast from Your Friends"
            onPress={() => pushOnce(router, '/(app)/admin/broadcast')}
          />
        </SectionCard>
      ) : null}

      <SectionCard eyebrow="Appearance" title="Color Mode">
        <View style={styles.optionRow}>
          {modeOptions.map((opt) => (
            <View key={opt.value} style={styles.optionColumn}>
              <View style={styles.optionTagSlot}>
                {opt.recommended ? (
                  <Text style={styles.recommendedTag}>Recommended</Text>
                ) : opt.notRecommended ? (
                  <Text style={styles.notRecommendedTag}></Text>
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
        <Text style={styles.themeGroupLabel}>Featured themes</Text>
        <View style={styles.themeGrid}>
          {availableFeaturedThemeNames.map((name) => (
            <Pressable
              key={name}
              onPress={() => setThemeName(name)}
              style={[styles.themeTile, themeName === name && styles.themeTileActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: themeName === name }}
              accessibilityLabel={`${themes[name].label} theme`}
            >
              <View style={[styles.themeSwatch, { backgroundColor: name === 'custom' ? customThemePreviewColors.accent : themes[name].swatch }]} />
              <Text style={[styles.themeTileLabel, themeName === name && styles.themeTileLabelActive, { fontFamily: (fontSets[name] ?? fontSets.default).heading }, protectTextFromFontClipping((fontSets[name] ?? fontSets.default).heading, 13)]}>{themes[name].label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.customThemePreview, { backgroundColor: customThemePreviewColors.canvas, borderColor: themeName === 'custom' ? customThemePreviewColors.accent : colors.line }]}>
          <View style={styles.customThemePreviewCopy}>
            <Text style={[styles.customThemePreviewTitle, { color: customThemePreviewColors.ink, fontFamily: fontSets[customFontOptions.find((option) => option.value === draftCustomTheme.fontKey)?.sampleTheme ?? 'default'].heading }]}>
              Your custom theme
            </Text>
            <Text style={[styles.customThemePreviewSubtitle, { color: customThemePreviewColors.inkSoft }]}>
              Tune colors and typography. Text colors are generated for readability.
            </Text>
          </View>
          <View style={[styles.customThemeAccentOrb, { backgroundColor: customThemePreviewColors.accent }]} />
        </View>
        <CustomThemeVisualizer
          colors={colors}
          fonts={fonts}
          onSelectAccentHue={(accentHue) => commitCustomTheme({ accentHue })}
          onSelectBackgroundHue={(backgroundHue) => commitCustomTheme({ backgroundHue })}
          previewColors={customThemePreviewColors}
          settings={draftCustomTheme}
        />
        <View style={styles.customThemeFontGrid}>
          {customFontOptions.map((option) => {
            const active = draftCustomTheme.fontKey === option.value;
            const optionFonts = fontSets[option.sampleTheme] ?? fontSets.default;
            return (
              <Pressable
                key={option.value}
                onPress={() => commitCustomTheme({ fontKey: option.value })}
                style={[styles.customThemeFontPill, active && styles.customThemeFontPillActive]}
              >
                <Text style={[styles.customThemeFontLabel, active && styles.customThemeFontLabelActive, { fontFamily: optionFonts.heading }, protectTextFromFontClipping(optionFonts.heading, 13)]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={() => setShowCustomThemeFineTune((open) => !open)} style={styles.fineTuneToggle} accessibilityRole="button">
          <Text style={styles.fineTuneToggleLabel}>Fine tune</Text>
          <Ionicons name={showCustomThemeFineTune ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkSoft} />
        </Pressable>
        {showCustomThemeFineTune ? (
          <View style={styles.customThemeSliderPanel}>
            <CustomThemeSlider
              colors={colors}
              fonts={fonts}
              label="Accent color"
              maximumValue={359}
              value={draftCustomTheme.accentHue}
              onSlidingComplete={(accentHue) => commitCustomTheme({ accentHue })}
              onValueChange={(accentHue) => previewCustomTheme({ accentHue })}
            />
            <CustomThemeSlider
              colors={colors}
              fonts={fonts}
              label="Background hue"
              maximumValue={359}
              value={draftCustomTheme.backgroundHue}
              onSlidingComplete={(backgroundHue) => commitCustomTheme({ backgroundHue })}
              onValueChange={(backgroundHue) => previewCustomTheme({ backgroundHue })}
            />
            <CustomThemeSlider
              colors={colors}
              fonts={fonts}
              label="Background intensity"
              maximumValue={100}
              value={draftCustomTheme.backgroundIntensity}
              onSlidingComplete={(backgroundIntensity) => commitCustomTheme({ backgroundIntensity })}
              onValueChange={(backgroundIntensity) => previewCustomTheme({ backgroundIntensity })}
            />
          </View>
        ) : null}
        {availableLegacyThemeNames.length > 0 ? (
          <>
            <Text style={styles.themeGroupLabel}>Advanced / legacy themes</Text>
            <View style={styles.themeGrid}>
              {availableLegacyThemeNames.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => setThemeName(name)}
                  style={[styles.themeTile, styles.themeTileLegacy, themeName === name && styles.themeTileActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: themeName === name }}
                  accessibilityLabel={`${themes[name].label} theme`}
                >
                  <View style={[styles.themeSwatch, { backgroundColor: themes[name].swatch }]} />
                  <Text style={[styles.themeTileLabel, themeName === name && styles.themeTileLabelActive, { fontFamily: (fontSets[name] ?? fontSets.default).heading }, protectTextFromFontClipping((fontSets[name] ?? fontSets.default).heading, 13)]}>{themes[name].label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </SectionCard>

      <SectionCard eyebrow="Appearance" title="Background Photo">
        <Text style={styles.backgroundHint}>Premium: choose a gallery photo to sit behind your profile.</Text>
        <View style={styles.backgroundPhotoCard}>
          {profileBackgroundUri ? (
            <Image source={{ uri: profileBackgroundUri }} style={styles.backgroundPhotoPreview} resizeMode="cover" />
          ) : (
            <View style={styles.backgroundPhotoEmpty}>
              <Ionicons name="image-outline" size={28} color={colors.ink} />
              <Text style={styles.backgroundPhotoEmptyText}>No background photo</Text>
            </View>
          )}
        </View>
        <View style={styles.backgroundActionRow}>
          <Pressable
            onPress={pickProfileBackgroundPhoto}
            disabled={backgroundSaving}
            style={[styles.backgroundActionButton, backgroundSaving && styles.actionDisabled]}
          >
            <Text style={styles.backgroundActionLabel}>
              {backgroundSaving ? 'Saving...' : profileBackgroundUri ? 'Change Background' : 'Choose Background'}
            </Text>
          </Pressable>
          {profileBackgroundUri ? (
            <Pressable
              onPress={clearProfileBackgroundPhoto}
              disabled={backgroundSaving}
              style={[styles.backgroundActionButton, backgroundSaving && styles.actionDisabled]}
            >
              <Text style={styles.backgroundActionLabel}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
        {profileBackgroundUri ? (
          <View style={styles.publicBackgroundPanel}>
            <View style={styles.publicBackgroundCopy}>
              <Text style={styles.publicBackgroundTitle}>Use on public profile</Text>
              <Text style={styles.publicBackgroundHint}>
                Others will see this as your background when they view your real profile.
              </Text>
            </View>
            <Pressable
              onPress={() => setPublicProfileBackground(!currentUser.profileBgImagePublic)}
              disabled={backgroundSaving}
              style={[
                styles.publicBackgroundSwitch,
                currentUser.profileBgImagePublic && styles.publicBackgroundSwitchOn,
                backgroundSaving && styles.actionDisabled,
              ]}
              accessibilityRole="switch"
              accessibilityState={{ checked: currentUser.profileBgImagePublic, disabled: backgroundSaving }}
              accessibilityLabel="Use background on public profile"
            >
              <View style={[styles.publicBackgroundKnob, currentUser.profileBgImagePublic && styles.publicBackgroundKnobOn]} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.backgroundBlurPanel}>
          <View style={styles.backgroundBlurHeader}>
            <Text style={styles.backgroundBlurTitle}>Background blur</Text>
            <Text style={styles.backgroundBlurValue}>{Math.round(backgroundBlur)}</Text>
          </View>
          <Slider
            value={backgroundBlur}
            minimumValue={MIN_BACKGROUND_BLUR}
            maximumValue={MAX_BACKGROUND_BLUR}
            step={1}
            onValueChange={setBackgroundBlur}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.line}
            thumbTintColor={colors.accent}
            accessibilityLabel="App background blur"
            accessibilityValue={{ min: MIN_BACKGROUND_BLUR, max: MAX_BACKGROUND_BLUR, now: Math.round(backgroundBlur) }}
          />
          <View style={styles.backgroundBlurFooter}>
            <Text style={styles.backgroundBlurHint}>Clear</Text>
            <Pressable onPress={() => setBackgroundBlur(DEFAULT_BACKGROUND_BLUR)} accessibilityRole="button">
              <Text style={styles.backgroundBlurReset}>Reset</Text>
            </Pressable>
            <Text style={styles.backgroundBlurHint}>Dreamy</Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard eyebrow="Music" title="Open Songs In">
        <View style={styles.optionRow}>
          {musicOpenOptions.map((opt) => {
            const active = musicOpenPreference === opt.value;
            const serviceColor = getMusicPreferenceColor(opt.value);
            return (
              <Pressable
                key={opt.value}
                onPress={() => setMusicOpenPreference(opt.value)}
                style={[styles.musicOption, active && { backgroundColor: serviceColor, borderColor: serviceColor }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Open songs in ${opt.label}`}
              >
                <Ionicons name={opt.icon} size={17} color={active ? colors.white : serviceColor} />
                <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard eyebrow="Support & Legal" title="Help and legal">
        <LegalRow
          colors={colors}
          fonts={fonts}
          icon="sparkles-outline"
          label="Replay onboarding tour"
          onPress={() => pushOnce(router, '/(onboarding)/referral')}
        />
        <LegalRow
          colors={colors}
          fonts={fonts}
          icon="mail-outline"
          label="Support"
          onPress={() => void openExternalLink(LEGAL_LINKS.supportEmail)}
        />
        <LegalRow
          colors={colors}
          fonts={fonts}
          icon="document-text-outline"
          label="Terms of Use (EULA)"
          onPress={() => void openExternalLink(LEGAL_LINKS.termsOfUse)}
        />
        <LegalRow
          colors={colors}
          fonts={fonts}
          icon="shield-checkmark-outline"
          label="Privacy Policy"
          onPress={() => void openExternalLink(LEGAL_LINKS.privacyPolicy)}
        />
      </SectionCard>

      <SectionCard eyebrow="Account">
        <ActionButton label="Sign out" onPress={signOut} variant="ghost" />
        <View style={styles.dangerBlock}>
          <Text style={styles.dangerTitle}>Delete account</Text>
          <Text style={styles.dangerCopy}>Permanently remove your account and data from Your Friends.</Text>
          <ActionButton
            label={deletingAccount ? 'Deleting...' : 'Delete account'}
            onPress={confirmDeleteAccount}
            variant="ghost"
            disabled={deletingAccount}
          />
        </View>
      </SectionCard>
    </AppScreen>
  );
}

function LegalRow({
  colors,
  fonts,
  icon,
  label,
  onPress,
}: {
  colors: ColorTokens;
  fonts: FontSet;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const styles = useMemo(() => makeLegalRowStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="link">
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={19} color={colors.ink} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.ink} />
    </Pressable>
  );
}

const makeLegalRowStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    row: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    rowLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
      color: colors.ink,
    },
  });

function getMusicPreferenceColor(preference: MusicOpenPreference) {
  return preference === 'spotify' ? semanticColors.spotifyGreen : semanticColors.appleMusicOrange;
}

function CustomThemeSlider({
  colors,
  fonts,
  label,
  maximumValue,
  onSlidingComplete,
  onValueChange,
  value,
}: {
  colors: ColorTokens;
  fonts: FontSet;
  label: string;
  maximumValue: number;
  onSlidingComplete: (value: number) => void;
  onValueChange: (value: number) => void;
  value: number;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink }}>{label}</Text>
        <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent }}>{Math.round(value)}</Text>
      </View>
      <Slider
        value={value}
        minimumValue={0}
        maximumValue={maximumValue}
        step={1}
        onSlidingComplete={onSlidingComplete}
        onValueChange={onValueChange}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.line}
        thumbTintColor={colors.accent}
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: maximumValue, now: Math.round(value) }}
      />
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
    backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
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
    musicOption: {
      flex: 1,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    themeGroupLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: colors.inkMuted,
      marginTop: spacing.xs,
    },
    themeTile: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md,
      borderWidth: 1, borderColor: colors.line,
    },
    themeTileLegacy: { opacity: 0.82 },
    themeTileActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    themeSwatch: { width: 10, height: 10, borderRadius: 5, marginRight: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.15)' },
    themeTileLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
    themeTileLabelActive: { color: colors.white },
    customThemePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
    },
    customThemePreviewCopy: { flex: 1, gap: 3 },
    customThemePreviewTitle: { fontSize: 18, ...protectTextFromFontClipping(fonts.heading, 18) },
    customThemePreviewSubtitle: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
    customThemeAccentOrb: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 3,
      borderColor: colors.white,
    },
    customThemeFontGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    customThemeFontPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    customThemeFontPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    customThemeFontLabel: { fontSize: 13, color: colors.ink },
    customThemeFontLabelActive: { color: colors.white },
    fineTuneToggle: {
      minHeight: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.paperMuted,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fineTuneToggleLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
    customThemeSliderPanel: {
      gap: spacing.md,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      padding: spacing.md,
    },
    backgroundHint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
    backgroundPhotoCard: {
      width: '58%',
      maxWidth: 220,
      aspectRatio: 9 / 16,
      alignSelf: 'center',
      borderRadius: radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
    },
    backgroundPhotoPreview: {
      width: '100%',
      height: '100%',
    },
    backgroundPhotoEmpty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    backgroundPhotoEmptyText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.inkMuted,
    },
    backgroundActionRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
    backgroundActionButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
    },
    backgroundActionLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
    publicBackgroundPanel: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
    },
    publicBackgroundCopy: { flex: 1, gap: 3 },
    publicBackgroundTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
    publicBackgroundHint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
    publicBackgroundSwitch: {
      width: 50,
      height: 30,
      borderRadius: 15,
      padding: 3,
      justifyContent: 'center',
      backgroundColor: colors.line,
    },
    publicBackgroundSwitchOn: { backgroundColor: colors.accent },
    publicBackgroundKnob: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.white,
    },
    publicBackgroundKnobOn: { transform: [{ translateX: 20 }] },
    backgroundBlurPanel: {
      gap: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    backgroundBlurHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backgroundBlurTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
    backgroundBlurValue: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent },
    backgroundBlurFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backgroundBlurHint: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkMuted },
    backgroundBlurReset: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent },
    actionDisabled: { opacity: 0.5 },
    dangerBlock: {
      gap: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: spacing.md,
    },
    dangerTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.error },
    dangerCopy: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  });
