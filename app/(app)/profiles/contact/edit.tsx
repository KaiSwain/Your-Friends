import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen } from '../../../../src/components/AppScreen';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { usePremium } from '../../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../../src/features/theme/themes';
import { polaroidFilters } from '../../../../src/lib/polaroidFilters';
import type { FontSet } from '../../../../src/theme/typography';
import { fontSets } from '../../../../src/theme/typography';
import { accentPalette, radius, spacing } from '../../../../src/theme/tokens';
import { themes, themeNames, type ThemeName } from '../../../../src/features/theme/themes';
import { contrastText, contrastTextSoft, contrastAccent } from '../../../../src/lib/contrastText';
import { isCardColorUnlocked, getCardColorLockMessage } from '../../../../src/features/theme/cardColorUnlocks';

export default function EditContactProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ contactId: string | string[]; capturedUri: string | string[] }>();
  const { currentUser } = useAuth();
  const { getContactById, getPeopleListForUser, updateContact } = useSocialGraph();
  const { colors, fonts, themeName, resolvedMode } = useTheme();
  const { purchasedThemes } = usePremium();
  const unlockedThemeSet = useMemo(() => new Set<string>(['default', ...purchasedThemes]), [purchasedThemes]);

  const contactId = Array.isArray(params.contactId) ? params.contactId[0] : params.contactId;
  const contact = contactId ? getContactById(contactId) : undefined;

  const [name, setName] = useState(contact?.displayName ?? '');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [note, setNote] = useState(contact?.note ?? '');
  const [cardColor, setCardColor] = useState<string | null>(contact?.cardColor ?? null);
  const [backText, setBackText] = useState(contact?.backText ?? '');
  const [profileBg, setProfileBg] = useState<string | null>(contact?.profileBg ?? null);

  // Live preview: derive effective theme from the currently-selected profileBg.
  const previewThemeName = profileBg && (themeNames as string[]).includes(profileBg)
    ? (profileBg as ThemeName)
    : null;
  const previewThemedColors = previewThemeName ? themes[previewThemeName][resolvedMode] : null;
  const effectiveColors = previewThemedColors ?? colors;
  const effectiveFonts = previewThemeName ? (fontSets[previewThemeName] ?? fonts) : fonts;
  const styles = useMemo(() => makeStyles(effectiveColors, effectiveFonts), [effectiveColors, effectiveFonts]);

  // Pick up photo from Polaroid camera screen
  const capturedUri = Array.isArray(params.capturedUri) ? params.capturedUri[0] : params.capturedUri;
  useEffect(() => {
    if (capturedUri) setLocalImageUri(capturedUri);
  }, [capturedUri]);

  // ── Preview flip ──
  const [showBack, setShowBack] = useState(false);
  const [previewFrontHeight, setPreviewFrontHeight] = useState(0);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const flipping = useRef(false);

  const rotateY = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '0deg'],
  });
  const scaleX = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.95, 1],
  });

  const handleFlipPreview = useCallback(() => {
    if (flipping.current) return;
    flipping.current = true;
    Animated.timing(flipAnim, { toValue: 0.5, duration: 180, useNativeDriver: true }).start(() => {
      setShowBack((prev) => !prev);
      Animated.timing(flipAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start(() => {
        flipAnim.setValue(0);
        flipping.current = false;
      });
    });
  }, [flipAnim]);
  const [saving, setSaving] = useState(false);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  if (!contact || contact.ownerUserId !== currentUser.id) {
    return (
      <AppScreen
        header={(
          <Pressable onPress={() => router.back()} style={styles.backButton}>
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
  const displayImage = localImageUri ?? contact.avatarPath ?? null;
  const displayName = name.trim() || contact.displayName;

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setLocalImageUri(result.assets[0].uri);
    }
  }

  function openCamera() {
    router.push({
      pathname: '/(app)/camera',
      params: { returnTo: `/(app)/profiles/contact/edit`, contactId: contactId ?? '' },
    });
  }

  function removePhoto() {
    setLocalImageUri(null);
  }

  const hasChanges =
    name.trim() !== contact.displayName ||
    localImageUri !== null ||
    note.trim() !== (contact.note ?? '') ||
    cardColor !== (contact.cardColor ?? null) ||
    backText.trim() !== (contact.backText ?? '') ||
    profileBg !== (contact.profileBg ?? null);

  async function handleSave() {
    if (!hasChanges) { router.back(); return; }
    setSaving(true);
    try {
      const updates: { displayName?: string; avatarLocalUri?: string | null; note?: string | null; cardColor?: string | null; backText?: string | null; profileBg?: string | null } = {};
      if (name.trim() && name.trim() !== contact!.displayName) updates.displayName = name.trim();
      if (localImageUri !== null) updates.avatarLocalUri = localImageUri;
      if (note.trim() !== (contact!.note ?? '')) updates.note = note.trim() || null;
      if (cardColor !== (contact!.cardColor ?? null)) updates.cardColor = cardColor;
      if (backText.trim() !== (contact!.backText ?? '')) updates.backText = backText.trim() || null;
      if (profileBg !== (contact!.profileBg ?? null)) updates.profileBg = profileBg;
      if (Object.keys(updates).length > 0) await updateContact(contact!.id, updates);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  }

  const frameDefault = !cardColor;
  const ct = frameDefault ? FRAME_INK : contrastText(cardColor);
  const ctSoft = frameDefault ? FRAME_INK_SOFT : contrastTextSoft(cardColor);
  const ctAccent = frameDefault ? colors.accent : contrastAccent(cardColor, colors.accent);
  const previewBg = cardColor || POLAROID_FRAME;

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
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
    <AppScreen header={topBar} floatingHeaderOnScroll gradientColors={previewThemedColors ? [previewThemedColors.canvas, previewThemedColors.canvasAlt, previewThemedColors.canvas] : undefined}>

      <Text style={styles.title}>Edit Profile</Text>

      {/* Photo actions — above the card */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Photo</Text>
        <View style={styles.photoRow}>
          {!displayImage && (
            <Pressable onPress={openCamera} style={styles.photoOption}>
              <Ionicons name="camera-outline" size={28} color={colors.ink} />
              <Text style={styles.photoOptionLabel}>Take Photo</Text>
            </Pressable>
          )}
          {!displayImage && (
            <Pressable onPress={pickPhoto} style={styles.photoOption}>
              <Ionicons name="images-outline" size={28} color={colors.ink} />
              <Text style={styles.photoOptionLabel}>Gallery</Text>
            </Pressable>
          )}
        </View>
        {displayImage && (
          <View style={styles.photoActionRow}>
            <Pressable onPress={openCamera} style={styles.changePhotoButton}>
              <Text style={styles.changePhotoLabel}>Retake Photo</Text>
            </Pressable>
            <Pressable onPress={pickPhoto} style={styles.changePhotoButton}>
              <Text style={styles.changePhotoLabel}>Gallery</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Live preview — flippable card with front and back */}
      <View style={styles.previewSection}>
        <Text style={styles.previewLabel}>Preview — tap to flip</Text>
        <Pressable onPress={handleFlipPreview}>
          <Animated.View style={[styles.previewAmbientShadow, { transform: [{ perspective: 800 }, { rotateY }, { scaleX }] }]} renderToHardwareTextureAndroid shouldRasterizeIOS>
            <View style={styles.previewTape} />
            <View onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h > 0) setPreviewFrontHeight(h); }} style={styles.previewFaceHost}>
              <View pointerEvents={showBack ? 'none' : 'auto'} style={[showBack && styles.previewHiddenFace]}>
                <View style={[styles.previewCard, { backgroundColor: previewBg }]}> 
                  <View style={styles.previewPhotoFrame}>
                    {displayImage ? (
                      <>
                        <Image source={{ uri: displayImage }} style={styles.previewPhoto} fadeDuration={0} />
                        <View style={styles.previewWarmBaseTint} />
                        <LinearGradient
                          colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.06)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.previewPhotoSheen}
                        />
                        <View style={styles.previewInsetShadowTop} />
                        <View style={styles.previewInsetShadowLeft} />
                      </>
                    ) : (
                      <View style={[styles.previewPhotoSurface, { backgroundColor: accentColor }]}> 
                        <Text style={styles.previewInitials}>{getInitials(displayName)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.previewBottom}>
                    <Text style={[styles.previewName, { color: ct }]} numberOfLines={1}>{displayName}</Text>
                    <View style={styles.previewNoteSlot}>
                      {note.trim() ? (
                        <Text style={[styles.previewNote, { color: ctSoft }]} numberOfLines={PREVIEW_NOTE_LINES}>{note.trim()}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>

              <View pointerEvents={showBack ? 'auto' : 'none'} style={[styles.previewFaceOverlay, !showBack && styles.previewHiddenFace]}>
                <View style={[styles.previewCard, styles.previewCardBack, { backgroundColor: previewBg }, previewFrontHeight > 0 && { height: previewFrontHeight }]}> 
                  {backText.trim() ? (
                    <Text style={[styles.previewBackText, { color: ct }]}>{backText.trim()}</Text>
                  ) : (
                    <Text style={[styles.previewBackPlaceholder, { color: ctSoft }]}>Write on the back…</Text>
                  )}
                  <Text style={[styles.previewBackHint, { color: ctSoft }]}>tap card to flip back</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </View>

      {/* Name editor */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Display Name</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Enter a name"
          placeholderTextColor={colors.inkMuted}
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
          placeholderTextColor={colors.inkMuted}
          multiline
          maxLength={showBack ? 200 : 120}
        />
        <Text style={styles.charCount}>{showBack ? backText.length : note.length}/{showBack ? 200 : 120}</Text>
      </View>

      {/* Relationship tags removed — hidden from UI */}

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
          {themeNames.filter((name) => name !== 'default' && unlockedThemeSet.has(name)).map((name) => {
            const t = themes[name].dark;
            const selected = profileBg === name;
            return (
              <Pressable key={name} onPress={() => setProfileBg(name)} style={[styles.themeSwatch, selected && styles.themeSwatchSelected]}>
                <View style={[styles.themeSwatchInner, { backgroundColor: t.canvas, borderColor: selected ? t.accent : colors.line }]}>
                  <View style={[styles.themeSwatchDot, { backgroundColor: t.accent }]} />
                  {selected && <Ionicons name="checkmark" size={14} color={t.ink} style={styles.themeSwatchCheck} />}
                </View>
                <Text style={styles.bgSwatchLabel}>{themes[name].label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </AppScreen>
  );
}

function getInitials(value: string) {
  return value.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
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

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    backButton: { paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    saveButton: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
    saveButtonLabelDisabled: { color: colors.white },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, textAlign: 'center' },
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
    photoRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
    photoOption: {
      width: 100,
      height: 100,
      borderRadius: radius.md,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    photoOptionIcon: { fontSize: 28 },
    photoOptionLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    photoActionRow: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
    changePhotoButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
    },
    changePhotoLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
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
    selectedTagRemove: { fontFamily: fonts.heading, fontSize: 16, color: colors.white, lineHeight: 16 },
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
    customTagButtonLabel: { fontFamily: fonts.heading, fontSize: 22, color: colors.white },

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
    previewPhotoSurface: {
      flex: 1,
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewInitials: { fontFamily: fonts.heading, fontSize: 44, color: colors.white },
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
      minHeight: PREVIEW_BOTTOM_MIN_HEIGHT,
      justifyContent: 'flex-start',
    },
    previewNoteSlot: { width: '100%', minHeight: PREVIEW_NOTE_SLOT_HEIGHT, justifyContent: 'flex-start' },
    previewName: { fontFamily: fonts.handwrittenBold, fontSize: 22, color: FRAME_INK, textAlign: 'center' },
    previewTagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
    previewTag: {
      backgroundColor: colors.accent + '1A',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    previewTagText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
    previewTagMore: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.inkMuted },
    previewNote: { fontFamily: fonts.handwritten, fontSize: 14, lineHeight: PREVIEW_NOTE_LINE_HEIGHT, color: colors.inkSoft, textAlign: 'center' },
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
    },
    previewBackPlaceholder: {
      fontFamily: fonts.handwritten,
      fontSize: 15,
      color: FRAME_INK_SOFT,
      textAlign: 'center',
      flex: 1,
      opacity: 0.5,
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
    bgSwatchLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.inkSoft },
  });
