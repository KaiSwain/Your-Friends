import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AppScreen } from '../../../../src/components/AppScreen';
import { CustomThemeVisualizer } from '../../../../src/components/CustomThemeVisualizer';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { usePremium } from '../../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import type { ColorTokens } from '../../../../src/features/theme/themes';
import { polaroidFilters } from '../../../../src/lib/polaroidFilters';
import { protectTextFromFontClipping } from '../../../../src/theme/fontProtection';
import type { FontSet } from '../../../../src/theme/typography';
import { fontSets } from '../../../../src/theme/typography';
import { accentPalette, radius, spacing } from '../../../../src/theme/tokens';
import { featuredThemeNames, legacyThemeNames, themes } from '../../../../src/features/theme/themes';
import { createCustomThemePair, decodeProfileCustomTheme, encodeProfileCustomTheme, isProfileCustomTheme, DEFAULT_CUSTOM_THEME_SETTINGS, type CustomThemeFontKey, type CustomThemeSettings } from '../../../../src/features/theme/customTheme';
import { onCapturedUri } from '../../../../src/lib/cameraHandoff';
import { backOnce, pushOnce } from '../../../../src/lib/navigationGuard';
import { showGalleryPaywall, showProfileBackgroundPaywall } from '../../../../src/lib/premiumGates';
import { cropProfileBackgroundAsset } from '../../../../src/lib/profileBackgroundImage';
import { isCardColorUnlocked, getCardColorLockMessage } from '../../../../src/features/theme/cardColorUnlocks';
import { MemoryProfileCardPreview } from '../../../../src/components/profile';
import { avatarImagePickerOptions, profileBackgroundImagePickerOptions } from '../../../../src/lib/imagePickerPresets';
import { useEffectiveProfileTheme } from '../../../../src/hooks/useEffectiveProfileTheme';

const RELATIONSHIP_TAG_PRESETS = [
  'Friend',
  'New Friend',
  'Best Friend',
  'Close Friend',
  'Old Friend',
  'Childhood Friend',
  'Online Friend',
  'Long Distance Friend',
  'Mutual Friend',
  'Friend of Friend',
  'Family Friend',
  'Group Chat Friend',
  'Chosen Family',
  'Family',
  'Close Family',
  'Sibling',
  'Cousin',
  'Parent',
  'Grandparent',
  'Partner',
  'Girlfriend',
  'Boyfriend',
  'Crush',
  'Date',
  'Spouse',
  'Fiance',
  'Soulmate',
  'Ex',
  'Acquaintance',
  'Neighbor',
  'Roommate',
  'Coworker',
  'Work Friend',
  'Old Coworker',
  'Mentor',
  'Mentee',
  'Classmate',
  'School Friend',
  'College Friend',
  'Old Classmate',
  'Teammate',
  'Gym Friend',
  'Study Friend',
  'Travel Friend',
  'Comfort Person',
  'Support Person',
];

const customFontOptions: { label: string; value: CustomThemeFontKey; sampleTheme: string }[] = [
  { label: 'Classic', value: 'classic', sampleTheme: 'default' },
  { label: 'Modern', value: 'modern', sampleTheme: 'neon' },
  { label: 'Playful', value: 'playful', sampleTheme: 'bubblegum' },
  { label: 'Editorial', value: 'editorial', sampleTheme: 'vintage' },
];

export default function EditContactProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ contactId: string | string[]; capturedUri: string | string[]; capturedVideoUri: string | string[] }>();
  const { currentUser } = useAuth();
  const { getContactById, getPeopleListForUser, updateContact } = useSocialGraph();
  const { purchasedThemes, isPremium } = usePremium();
  const unlockedThemeSet = useMemo(() => new Set<string>(['default', 'yourFriends', ...purchasedThemes]), [purchasedThemes]);
  const unlockedFeaturedThemeNames = useMemo(
    () => featuredThemeNames.filter((name) => name !== 'default' && unlockedThemeSet.has(name)),
    [unlockedThemeSet],
  );
  const unlockedLegacyThemeNames = useMemo(
    () => legacyThemeNames.filter((name) => unlockedThemeSet.has(name)),
    [unlockedThemeSet],
  );

  const contactId = Array.isArray(params.contactId) ? params.contactId[0] : params.contactId;
  const contact = contactId ? getContactById(contactId) : undefined;

  const [name, setName] = useState(contact?.displayName ?? '');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [localVideoUri, setLocalVideoUri] = useState<string | null>(null);
  const [removeAvatarVideo, setRemoveAvatarVideo] = useState(false);
  const [avatarVideoMuted, setAvatarVideoMuted] = useState(contact?.avatarVideoMuted ?? false);
  const [note, setNote] = useState(contact?.note ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(contact?.tags ?? []);
  const [customTag, setCustomTag] = useState('');
  const [cardColor, setCardColor] = useState<string | null>(contact?.cardColor ?? null);
  const [backText, setBackText] = useState(contact?.backText ?? '');
  const [profileBg, setProfileBg] = useState<string | null>(contact?.profileBg ?? null);
  const [profileCustomTheme, setProfileCustomTheme] = useState<CustomThemeSettings>(
    decodeProfileCustomTheme(contact?.profileBg) ?? DEFAULT_CUSTOM_THEME_SETTINGS,
  );
  const [showCustomThemeFineTune, setShowCustomThemeFineTune] = useState(false);
  const [profileBgImageUri, setProfileBgImageUri] = useState<string | null>(null);
  const [removeProfileBgImage, setRemoveProfileBgImage] = useState(false);
  const {
    baseColors: colors,
    effectiveColors,
    effectiveFonts,
    themedColors,
  } = useEffectiveProfileTheme(profileBg);

  const styles = useMemo(() => makeStyles(effectiveColors, effectiveFonts), [effectiveColors, effectiveFonts]);
  const profileCustomThemePair = useMemo(() => createCustomThemePair(profileCustomTheme), [profileCustomTheme]);
  const profileCustomThemeColors = profileCustomThemePair.light;
  const customProfileThemeSelected = isProfileCustomTheme(profileBg) || profileBg === 'custom';

  // Pick up media from Polaroid camera screen.
  const capturedUri = Array.isArray(params.capturedUri) ? params.capturedUri[0] : params.capturedUri;
  const capturedVideoUri = Array.isArray(params.capturedVideoUri) ? params.capturedVideoUri[0] : params.capturedVideoUri;
  useEffect(() => {
    if (capturedUri) {
      setLocalImageUri(capturedUri);
      if (capturedVideoUri) {
        setLocalVideoUri(capturedVideoUri);
        setRemoveAvatarVideo(false);
        setAvatarVideoMuted(false);
      } else {
        setLocalVideoUri(null);
        setRemoveAvatarVideo(Boolean(contact?.avatarVideoPath));
        setAvatarVideoMuted(false);
      }
    }
  }, [capturedUri, capturedVideoUri, contact?.avatarVideoPath]);

  useEffect(() => onCapturedUri((uri, videoUri) => {
    setLocalImageUri(uri);
    if (videoUri) {
      setLocalVideoUri(videoUri);
      setRemoveAvatarVideo(false);
      setAvatarVideoMuted(false);
    } else {
      setLocalVideoUri(null);
      setRemoveAvatarVideo(Boolean(contact?.avatarVideoPath));
      setAvatarVideoMuted(false);
    }
  }), [contact?.avatarVideoPath]);

  // ── Preview flip ──
  const [showBack, setShowBack] = useState(false);
  const [saving, setSaving] = useState(false);
  const displayImage = localImageUri ?? contact?.avatarPath ?? null;
  const displayVideo = removeAvatarVideo ? null : localVideoUri ?? contact?.avatarVideoPath ?? null;
  const displayVideoMuted = avatarVideoMuted;

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  if (!contact || contact.ownerUserId !== currentUser.id) {
    return (
      <AppScreen
        header={(
          <Pressable onPress={() => backOnce(router)} style={styles.backButton}>
            <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
          </Pressable>
        )}
        floatingHeaderOnScroll
      >
        <Text style={styles.errorText}>Contact not found.</Text>
      </AppScreen>
    );
  }

  const accentColor =
    getPeopleListForUser(currentUser.id).find((item) => item.id === contact.id)?.avatarColor ?? colors.apricot;

  // The image to show: prefer locally picked image, then saved avatar, then nothing.
  const displayName = name.trim() || contact.displayName;

  function openMemoryCamera() {
    pushOnce(router, {
      pathname: '/(app)/camera',
      params: { handoff: '1', liveHandoff: '1' },
    });
  }

  async function pickProfileCardPhoto() {
    if (!isPremium) {
      showGalleryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(avatarImagePickerOptions);
    if (!result.canceled && result.assets[0]?.uri) {
      setLocalImageUri(result.assets[0].uri);
      setLocalVideoUri(null);
      setRemoveAvatarVideo(Boolean(contact?.avatarVideoPath));
      setAvatarVideoMuted(false);
    }
  }

  async function pickProfileBackgroundPhoto() {
    if (!isPremium) {
      showProfileBackgroundPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(profileBackgroundImagePickerOptions);
    if (!result.canceled && result.assets[0]) {
      const croppedUri = await cropProfileBackgroundAsset(result.assets[0]);
      setProfileBgImageUri(croppedUri);
      setRemoveProfileBgImage(false);
    }
  }

  function clearProfileBackgroundPhoto() {
    setProfileBgImageUri(null);
    setRemoveProfileBgImage(Boolean(contact?.profileBgImagePath));
  }

  function selectCustomProfileTheme() {
    setProfileBg(encodeProfileCustomTheme(profileCustomTheme));
  }

  function previewProfileCustomTheme(updates: Partial<CustomThemeSettings>) {
    setProfileCustomTheme((current) => ({ ...current, ...updates }));
  }

  function commitProfileCustomTheme(updates: Partial<CustomThemeSettings> = {}) {
    const next = { ...profileCustomTheme, ...updates };
    setProfileCustomTheme(next);
    setProfileBg(encodeProfileCustomTheme(next));
  }

  function addTag(rawTag: string) {
    const tag = rawTag.trim();
    if (!tag) return;
    setSelectedTags((currentTags) => {
      if (currentTags.some((existingTag) => existingTag.toLowerCase() === tag.toLowerCase())) return currentTags;
      return [...currentTags, tag].slice(0, 6);
    });
    setCustomTag('');
  }

  function removeTag(tag: string) {
    setSelectedTags((currentTags) => currentTags.filter((existingTag) => existingTag !== tag));
  }

  const savedTags = contact.tags ?? [];
  const tagsChanged = selectedTags.length !== savedTags.length || selectedTags.some((tag, index) => tag !== savedTags[index]);
  const availablePresetTags = RELATIONSHIP_TAG_PRESETS.filter(
    (tag) => !selectedTags.some((selectedTag) => selectedTag.toLowerCase() === tag.toLowerCase()),
  );
  const currentProfileBg = customProfileThemeSelected ? encodeProfileCustomTheme(profileCustomTheme) : profileBg;

  const hasChanges =
    name.trim() !== contact.displayName ||
    localImageUri !== null ||
    localVideoUri !== null ||
    removeAvatarVideo ||
    (displayVideo ? avatarVideoMuted !== (contact.avatarVideoMuted ?? false) : false) ||
    note.trim() !== (contact.note ?? '') ||
    tagsChanged ||
    cardColor !== (contact.cardColor ?? null) ||
    backText.trim() !== (contact.backText ?? '') ||
    currentProfileBg !== (contact.profileBg ?? null) ||
    profileBgImageUri !== null ||
    removeProfileBgImage;

  async function handleSave() {
    if (!hasChanges) { backOnce(router); return; }
    setSaving(true);
    try {
      const updates: { displayName?: string; avatarLocalUri?: string | null; avatarVideoLocalUri?: string | null; avatarVideoMuted?: boolean; tags?: string[]; note?: string | null; cardColor?: string | null; backText?: string | null; profileBg?: string | null; profileBgImageLocalUri?: string | null } = {};
      if (name.trim() && name.trim() !== contact!.displayName) updates.displayName = name.trim();
      if (localImageUri !== null) {
        updates.avatarLocalUri = localImageUri;
      }
      if (localVideoUri) {
        updates.avatarVideoLocalUri = localVideoUri;
      } else if (removeAvatarVideo) {
        updates.avatarVideoLocalUri = null;
      }
      if (displayVideo && (localVideoUri || avatarVideoMuted !== (contact!.avatarVideoMuted ?? false))) updates.avatarVideoMuted = avatarVideoMuted;
      if (note.trim() !== (contact!.note ?? '')) updates.note = note.trim() || null;
      if (tagsChanged) updates.tags = selectedTags;
      if (cardColor !== (contact!.cardColor ?? null)) updates.cardColor = cardColor;
      if (backText.trim() !== (contact!.backText ?? '')) updates.backText = backText.trim() || null;
      if (currentProfileBg !== (contact!.profileBg ?? null)) updates.profileBg = currentProfileBg;
      if (profileBgImageUri) updates.profileBgImageLocalUri = profileBgImageUri;
      else if (removeProfileBgImage) updates.profileBgImageLocalUri = null;
      if (Object.keys(updates).length > 0) await updateContact(contact!.id, updates);
      backOnce(router);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  }

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => backOnce(router)} style={styles.backButton}>
        <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Cancel</Text>
      </Pressable>
      <Pressable onPress={handleSave} disabled={saving} style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}>
        <Text style={[styles.saveButtonLabel, !hasChanges && styles.saveButtonLabelDisabled]}>
          {saving ? 'Saving…' : 'Save'}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <AppScreen header={topBar} floatingHeaderOnScroll gradientColors={themedColors ? [themedColors.canvas, themedColors.canvasAlt, themedColors.canvas] : undefined}>

      <Text style={styles.title}>Edit Profile</Text>

      {/* Photo actions — above the card */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Memory Profile Card</Text>
        <View style={styles.photoActionRow}>
          <Pressable onPress={openMemoryCamera} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoLabel}>Take Memory</Text>
          </Pressable>
          <Pressable onPress={pickProfileCardPhoto} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoLabel}>Gallery Photo</Text>
          </Pressable>
        </View>
        <Text style={styles.fieldHint}>Take this like a regular memory, or use a Premium gallery photo for this profile card.</Text>
        {displayVideo ? (
          <View style={styles.videoAudioRow}>
            <View style={styles.videoAudioCopy}>
              <Text style={styles.videoAudioLabel}>Video Sound</Text>
              <Text style={styles.videoAudioHint}>Turn this off if the profile card video should always play silently.</Text>
            </View>
            <Switch
              value={!avatarVideoMuted}
              onValueChange={(enabled) => setAvatarVideoMuted(!enabled)}
              trackColor={{ false: colors.line, true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>
        ) : null}
      </View>

      {/* Live preview — flippable card with front and back */}
      <View style={styles.previewSection}>
        <Text style={styles.previewLabel}>Preview — tap to flip</Text>
        <MemoryProfileCardPreview
          accentColor={accentColor}
          backPlaceholder="Write on the back…"
          backText={backText.trim()}
          cardColor={cardColor}
          colors={effectiveColors}
          imageUri={displayImage}
          name={displayName}
          note={note.trim()}
          onFlip={setShowBack}
          videoMuted={displayVideoMuted}
          videoUri={displayVideo}
        />
      </View>

      {/* Name editor */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Display Name</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Enter a name"
          placeholderTextColor={colors.ink}
          returnKeyType="done"
        />
      </View>

      {/* Front / back of card note — switcheroo based on flip state */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>{showBack ? 'Back of Card Note' : 'Front of Card Note'}</Text>
        <TextInput
          style={styles.noteInput}
          value={showBack ? backText : note}
          onChangeText={showBack ? setBackText : setNote}
          placeholder={showBack ? 'Write something on the back…' : 'A short note about this person…'}
          placeholderTextColor={colors.ink}
          multiline
          maxLength={showBack ? 200 : 120}
        />
        <Text style={styles.charCount}>{showBack ? backText.length : note.length}/{showBack ? 200 : 120}</Text>
      </View>

      {/* Card color */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Card Color</Text>
        <View style={styles.colorRow}>
          <Pressable onPress={() => setCardColor(null)} style={[styles.colorSwatch, { backgroundColor: POLAROID_FRAME, borderColor: !cardColor ? colors.accent : colors.line }]}>
            {!cardColor && <Ionicons name="checkmark" size={16} color={FRAME_INK} />}
          </Pressable>
          {accentPalette.filter((c) => isCardColorUnlocked(c, purchasedThemes)).map((c) => {
            const selected = cardColor === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCardColor(c)}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c, borderColor: selected ? colors.ink : 'transparent' },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Card color ${c}`}
              >
                {selected && <Ionicons name="checkmark" size={16} color={colors.ink} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Profile theme */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Profile Theme</Text>
        <Text style={styles.fieldHint}>Pick a theme to style this friend's profile page.</Text>
        <View style={styles.bgRow}>
          <Pressable onPress={() => setProfileBg(null)} style={[styles.themeSwatch, !profileBg && styles.themeSwatchSelected]}>
            <View style={[styles.themeSwatchInner, { backgroundColor: colors.canvas, borderColor: colors.line }]}>
              {!profileBg && <Ionicons name="checkmark" size={16} color={colors.ink} />}
            </View>
            <Text style={styles.bgSwatchLabel}>Default</Text>
          </Pressable>
          {unlockedFeaturedThemeNames.map((name) => {
            const isCustom = name === 'custom';
            const t = isCustom ? profileCustomThemeColors : themes[name].light;
            const selected = isCustom ? customProfileThemeSelected : profileBg === name;
            return (
              <Pressable key={name} onPress={() => isCustom ? selectCustomProfileTheme() : setProfileBg(name)} style={[styles.themeSwatch, selected && styles.themeSwatchSelected]}>
                <View style={[styles.themeSwatchInner, { backgroundColor: t.canvas, borderColor: selected ? colors.ink : colors.line }]}>
                  <View style={[styles.themeSwatchDot, { backgroundColor: t.accent }]} />
                  {selected && <Ionicons name="checkmark" size={14} color={t.ink} style={styles.themeSwatchCheck} />}
                </View>
                <Text style={styles.bgSwatchLabel}>{themes[name].label}</Text>
              </Pressable>
            );
          })}
        </View>
        {unlockedLegacyThemeNames.length > 0 ? (
          <>
            <Text style={styles.themeGroupLabel}>Advanced / legacy themes</Text>
            <View style={styles.bgRow}>
              {unlockedLegacyThemeNames.map((name) => {
                const t = themes[name].light;
                const selected = profileBg === name;
                return (
                  <Pressable key={name} onPress={() => setProfileBg(name)} style={[styles.themeSwatch, styles.themeSwatchLegacy, selected && styles.themeSwatchSelected]}>
                    <View style={[styles.themeSwatchInner, { backgroundColor: t.canvas, borderColor: selected ? colors.ink : colors.line }]}>
                      <View style={[styles.themeSwatchDot, { backgroundColor: t.accent }]} />
                      {selected && <Ionicons name="checkmark" size={14} color={t.ink} style={styles.themeSwatchCheck} />}
                    </View>
                    <Text style={styles.bgSwatchLabel}>{themes[name].label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
        {customProfileThemeSelected ? (
          <View style={styles.customThemeEditor}>
            <Text style={styles.fieldHint}>Custom profile themes stay attached to this person only.</Text>
            <View style={[styles.customThemePreview, { backgroundColor: profileCustomThemeColors.canvas, borderColor: profileCustomThemeColors.accent }]}>
              <View style={styles.customThemePreviewCopy}>
                <Text style={[styles.customThemePreviewTitle, { color: profileCustomThemeColors.ink }]}>Custom profile look</Text>
                <Text style={[styles.customThemePreviewSubtitle, { color: profileCustomThemeColors.inkSoft }]}>Readable text is generated from your colors.</Text>
              </View>
              <View style={[styles.customThemeAccentOrb, { backgroundColor: profileCustomThemeColors.accent }]} />
            </View>
            <CustomThemeVisualizer
              colors={colors}
              fonts={effectiveFonts}
              onSelectAccentHue={(accentHue) => commitProfileCustomTheme({ accentHue })}
              onSelectBackgroundHue={(backgroundHue) => commitProfileCustomTheme({ backgroundHue })}
              previewColors={profileCustomThemeColors}
              settings={profileCustomTheme}
            />
            <View style={styles.customThemeFontGrid}>
              {customFontOptions.map((option) => {
                const active = profileCustomTheme.fontKey === option.value;
                const optionFonts = fontSets[option.sampleTheme] ?? fontSets.default;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => commitProfileCustomTheme({ fontKey: option.value })}
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
              <>
                <CustomThemeSlider
                  colors={colors}
                  fonts={effectiveFonts}
                  label="Accent color"
                  maximumValue={359}
                  value={profileCustomTheme.accentHue}
                  onSlidingComplete={(accentHue) => commitProfileCustomTheme({ accentHue })}
                  onValueChange={(accentHue) => previewProfileCustomTheme({ accentHue })}
                />
                <CustomThemeSlider
                  colors={colors}
                  fonts={effectiveFonts}
                  label="Background hue"
                  maximumValue={359}
                  value={profileCustomTheme.backgroundHue}
                  onSlidingComplete={(backgroundHue) => commitProfileCustomTheme({ backgroundHue })}
                  onValueChange={(backgroundHue) => previewProfileCustomTheme({ backgroundHue })}
                />
                <CustomThemeSlider
                  colors={colors}
                  fonts={effectiveFonts}
                  label="Background intensity"
                  maximumValue={100}
                  value={profileCustomTheme.backgroundIntensity}
                  onSlidingComplete={(backgroundIntensity) => commitProfileCustomTheme({ backgroundIntensity })}
                  onValueChange={(backgroundIntensity) => previewProfileCustomTheme({ backgroundIntensity })}
                />
              </>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Profile background photo */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Background Photo</Text>
        <Text style={styles.fieldHint}>Premium: choose a gallery photo to sit behind this friend's profile.</Text>
        <View style={styles.backgroundPhotoCard}>
          {profileBgImageUri || (!removeProfileBgImage && contact.profileBgImagePath) ? (
            <Image source={{ uri: profileBgImageUri ?? contact.profileBgImagePath! }} style={styles.backgroundPhotoPreview} resizeMode="cover" />
          ) : (
            <View style={styles.backgroundPhotoEmpty}>
              <Ionicons name="image-outline" size={28} color={colors.ink} />
              <Text style={styles.backgroundPhotoEmptyText}>No background photo</Text>
            </View>
          )}
        </View>
        <View style={styles.photoActionRow}>
          <Pressable onPress={pickProfileBackgroundPhoto} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoLabel}>{profileBgImageUri || (!removeProfileBgImage && contact.profileBgImagePath) ? 'Change Background' : 'Choose Background'}</Text>
          </Pressable>
          {(profileBgImageUri || (!removeProfileBgImage && contact.profileBgImagePath)) ? (
            <Pressable onPress={clearProfileBackgroundPhoto} style={styles.changePhotoButton}>
              <Text style={styles.changePhotoLabel}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Relationship Tags</Text>
        <Text style={styles.fieldHint}>Add a few labels for how you know this person.</Text>
        {selectedTags.length > 0 ? (
          <View style={styles.selectedTags}>
            {selectedTags.map((tag) => (
              <View key={tag} style={styles.selectedTag}>
                <Text style={styles.selectedTagText}>{tag}</Text>
                <Pressable onPress={() => removeTag(tag)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove tag ${tag}`}>
                  <Ionicons name="close" size={13} color={colors.white} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll} contentContainerStyle={styles.presetScrollContent}>
          {availablePresetTags.map((tag) => (
            <Pressable key={tag} onPress={() => addTag(tag)} style={styles.presetTag} accessibilityRole="button" accessibilityLabel={`Add tag ${tag}`}>
              <Text style={styles.presetTagText}>{tag}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.customTagRow}>
          <TextInput
            value={customTag}
            onChangeText={setCustomTag}
            placeholder="Custom tag"
            placeholderTextColor={colors.ink}
            style={styles.customTagInput}
            returnKeyType="done"
            maxLength={24}
            onSubmitEditing={() => addTag(customTag)}
          />
          <Pressable onPress={() => addTag(customTag)} style={styles.customTagButton} accessibilityRole="button" accessibilityLabel="Add custom tag">
            <Text style={styles.customTagButtonLabel}>+</Text>
          </Pressable>
        </View>
      </View>
    </AppScreen>
  );
}

const PREVIEW_PHOTO = 140;
const PREVIEW_PAD_SIDE = 10;
const PREVIEW_WIDTH = PREVIEW_PHOTO + PREVIEW_PAD_SIDE * 2;
const PREVIEW_NOTE_LINES = 2;
const PREVIEW_NOTE_LINE_HEIGHT = 18;
const PREVIEW_NOTE_SLOT_HEIGHT = PREVIEW_NOTE_LINES * PREVIEW_NOTE_LINE_HEIGHT;
const PREVIEW_BOTTOM_MIN_HEIGHT = 92;

// Warm ivory — real Polaroid frames are never pure white.
const POLAROID_FRAME = '#F5F2EA';
const FRAME_INK = '#2A2218';
const FRAME_INK_SOFT = '#6B6052';

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
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    backButton: { minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
    backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    saveButton: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
    saveButtonLabelDisabled: { color: colors.white },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, textAlign: 'center', ...protectTextFromFontClipping(fonts.heading, 28) },
    errorText: { fontFamily: fonts.body, fontSize: 15, color: colors.error, textAlign: 'center' },
    previewSection: { alignItems: 'center', gap: spacing.sm },
    previewLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.inkMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    fieldSection: { gap: spacing.sm },
    fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 },
    fieldHint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkMuted, marginTop: -spacing.xs },
    nameInput: {
      borderRadius: radius.md,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.ink,
    },
    photoActionRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
    changePhotoButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
    },
    changePhotoLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
    videoAudioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      padding: spacing.md,
    },
    videoAudioCopy: { flex: 1, gap: 3 },
    videoAudioLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
    videoAudioHint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
    backgroundPhotoCard: {
      width: '58%',
      maxWidth: 220,
      aspectRatio: 9 / 16,
      alignSelf: 'center',
      borderRadius: radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
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
    noteInput: {
      borderRadius: radius.md,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.ink,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    charCount: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.inkMuted, textAlign: 'right' },
    selectedTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    selectedTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
      gap: 4,
    },
    selectedTagText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
    presetScroll: { marginHorizontal: -spacing.lg },
    presetScrollContent: { paddingHorizontal: spacing.lg, gap: spacing.xs },
    presetTag: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    presetTagText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    customTagRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    customTagInput: {
      flex: 1,
      borderRadius: radius.md,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.ink,
    },
    customTagButton: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    customTagButtonLabel: { fontFamily: fonts.heading, fontSize: 22, color: colors.white, ...protectTextFromFontClipping(fonts.heading, 22) },

    /* ── Live preview card (matches PolaroidCarousel card exactly) ── */
    previewAmbientShadow: {
      alignSelf: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
    },
    previewTape: {
      width: 48,
      height: 14,
      backgroundColor: 'rgba(255,255,220,0.35)',
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: -7,
      zIndex: 1,
    },
    previewFaceHost: {
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    previewFaceOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    previewHiddenFace: {
      opacity: 0,
    },
    previewCard: {
      width: PREVIEW_WIDTH,
      borderRadius: 3,
      backgroundColor: POLAROID_FRAME,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(180,170,155,0.4)',
      paddingTop: 10,
      paddingHorizontal: PREVIEW_PAD_SIDE,
      paddingBottom: 0,
      alignItems: 'center',
      // Contact shadow (tight, dark)
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 5,
    },
    previewPhotoFrame: {
      width: PREVIEW_PHOTO,
      height: PREVIEW_PHOTO,
      borderRadius: 1,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.045)',
    },
    previewPhoto: { width: '100%', height: '100%', transform: [{ scale: 1.01 }] },
    previewLiveBadge: {
      position: 'absolute',
      top: spacing.xs,
      left: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(0,0,0,0.62)',
      paddingHorizontal: spacing.xs,
      paddingVertical: 3,
      zIndex: 7,
    },
    previewLiveBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9, color: '#fff', letterSpacing: 0.7 },
    previewPhotoSurface: {
      flex: 1,
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewInitials: { fontFamily: fonts.bodyBold, fontSize: 38, lineHeight: 42, color: colors.white, textAlign: 'center' },
    previewWarmBaseTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(210,180,140,0.04)',
      zIndex: 4,
      pointerEvents: 'none' as const,
    },
    previewPhotoSheen: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 5,
      pointerEvents: 'none' as const,
    },
    previewInsetShadowTop: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: 6,
      backgroundColor: 'transparent',
      zIndex: 6,
      pointerEvents: 'none' as const,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    previewInsetShadowLeft: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      bottom: 0,
      width: 4,
      backgroundColor: 'transparent',
      zIndex: 6,
      pointerEvents: 'none' as const,
      shadowColor: '#000',
      shadowOffset: { width: 3, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    previewBottom: {
      width: '100%',
      paddingTop: 6,
      paddingBottom: 28,
      alignItems: 'center',
      gap: 4,
      overflow: 'visible' as const,
      minHeight: PREVIEW_BOTTOM_MIN_HEIGHT,
      justifyContent: 'flex-start',
    },
    previewNoteSlot: { width: '100%', minHeight: PREVIEW_NOTE_SLOT_HEIGHT, justifyContent: 'flex-start' },
    previewName: {
      fontFamily: fonts.handwrittenBold,
      fontSize: 22,
      color: FRAME_INK,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible' as const,
      ...protectTextFromFontClipping(fonts.handwrittenBold, 22),
    },
    previewNote: {
      fontFamily: fonts.handwritten,
      fontSize: 14,
      lineHeight: PREVIEW_NOTE_LINE_HEIGHT,
      color: colors.inkSoft,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible' as const,
      ...protectTextFromFontClipping(fonts.handwritten, 14),
    },
    /* ── Back face ── */
    previewCardBack: {
      justifyContent: 'center',
      paddingTop: PREVIEW_PAD_SIDE,
      paddingBottom: PREVIEW_PAD_SIDE,
      paddingHorizontal: 14,
    },
    previewBackText: {
      fontFamily: fonts.handwritten,
      fontSize: 15,
      lineHeight: 20,
      color: FRAME_INK,
      textAlign: 'center',
      flex: 1,
      width: '100%',
      overflow: 'visible' as const,
      ...protectTextFromFontClipping(fonts.handwritten, 15),
    },
    previewBackPlaceholder: {
      fontFamily: fonts.handwritten,
      fontSize: 15,
      color: FRAME_INK_SOFT,
      textAlign: 'center',
      flex: 1,
      width: '100%',
      overflow: 'visible' as const,
      opacity: 0.5,
      ...protectTextFromFontClipping(fonts.handwritten, 15),
    },
    previewBackHint: {
      fontFamily: fonts.body,
      fontSize: 10,
      color: FRAME_INK_SOFT,
      textAlign: 'center',
      marginTop: 8,
      opacity: 0.6,
    },

    /* ── Color picker ── */
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    colorSwatch: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSwatchLocked: { opacity: 0.45 },
    colorCheck: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },

    /* ── Theme picker ── */
    bgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    themeSwatch: {
      alignItems: 'center',
      gap: 4,
      opacity: 0.7,
    },
    themeSwatchLegacy: { opacity: 0.58 },
    themeSwatchSelected: { opacity: 1 },
    themeSwatchInner: {
      width: 52,
      height: 52,
      borderRadius: radius.sm,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    },
    themeSwatchDot: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    themeSwatchCheck: { position: 'absolute' },
    customThemeEditor: {
      gap: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      padding: spacing.md,
    },
    customThemePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
    },
    customThemePreviewCopy: { flex: 1, gap: 3 },
    customThemePreviewTitle: {
      fontFamily: fonts.heading,
      fontSize: 18,
      ...protectTextFromFontClipping(fonts.heading, 18),
    },
    customThemePreviewSubtitle: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
    customThemeAccentOrb: {
      width: 38,
      height: 38,
      borderRadius: 19,
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
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fineTuneToggleLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
    themeGroupLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: colors.inkMuted,
      marginTop: spacing.xs,
    },
    bgSwatchLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.inkSoft },
  });
