import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppScreen } from '../../../../src/components/AppScreen';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../../src/features/theme/themes';
import { fonts } from '../../../../src/theme/typography';
import { accentPalette, profileBackgrounds, radius, spacing } from '../../../../src/theme/tokens';
import { contrastText, contrastTextSoft, contrastAccent } from '../../../../src/lib/contrastText';

export default function EditContactProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ contactId: string | string[] }>();
  const { currentUser } = useAuth();
  const { getContactById, getPeopleListForUser, updateContact } = useSocialGraph();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const contactId = Array.isArray(params.contactId) ? params.contactId[0] : params.contactId;
  const contact = contactId ? getContactById(contactId) : undefined;

  const [name, setName] = useState(contact?.displayName ?? '');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>(contact?.tags ?? []);
  const [note, setNote] = useState(contact?.note ?? '');
  const [cardColor, setCardColor] = useState<string | null>(contact?.cardColor ?? null);
  const [profileBg, setProfileBg] = useState<string | null>(contact?.profileBg ?? null);
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving] = useState(false);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  if (!contact || contact.ownerUserId !== currentUser.id) {
    return (
      <AppScreen>
        <Text style={styles.errorText}>Contact not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backLabel}>← Back</Text>
        </Pressable>
      </AppScreen>
    );
  }

  const accentColor =
    getPeopleListForUser(currentUser.id).find((item) => item.id === contact.id)?.avatarColor ?? colors.apricot;

  // The image to show: prefer locally picked image, then saved avatar, then nothing.
  const displayImage = localImageUri ?? contact.avatarPath ?? null;
  const displayName = name.trim() || contact.displayName;

  const PRESET_TAGS = [
    'Best Friend', 'Close Friend', 'Family', 'Coworker',
    'Roommate', 'Partner', 'Sibling', 'Classmate', 'Neighbor', 'Mentor',
  ];

  function toggleTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function addCustomTag() {
    const t = customTag.trim();
    if (!t || tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setCustomTag('');
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setLocalImageUri(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera permission is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setLocalImageUri(result.assets[0].uri);
    }
  }

  function removePhoto() {
    setLocalImageUri(null);
  }

  const hasChanges =
    name.trim() !== contact.displayName ||
    localImageUri !== null ||
    JSON.stringify(tags) !== JSON.stringify(contact.tags) ||
    note.trim() !== (contact.note ?? '') ||
    cardColor !== (contact.cardColor ?? null) ||
    profileBg !== (contact.profileBg ?? null);

  async function handleSave() {
    if (!hasChanges) { router.back(); return; }
    setSaving(true);
    try {
      const updates: { displayName?: string; avatarLocalUri?: string | null; tags?: string[]; note?: string | null; cardColor?: string | null; profileBg?: string | null } = {};
      if (name.trim() && name.trim() !== contact!.displayName) updates.displayName = name.trim();
      if (localImageUri !== null) updates.avatarLocalUri = localImageUri;
      if (JSON.stringify(tags) !== JSON.stringify(contact!.tags)) updates.tags = tags;
      if (note.trim() !== (contact!.note ?? '')) updates.note = note.trim() || null;
      if (cardColor !== (contact!.cardColor ?? null)) updates.cardColor = cardColor;
      if (profileBg !== (contact!.profileBg ?? null)) updates.profileBg = profileBg;
      if (Object.keys(updates).length > 0) await updateContact(contact!.id, updates);
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  }

  const ct = contrastText(cardColor);
  const ctSoft = contrastTextSoft(cardColor);
  const ctAccent = contrastAccent(cardColor, colors.accent);

  const bgPreset = profileBg ? profileBackgrounds.find((b) => b.key === profileBg) : undefined;

  return (
    <AppScreen gradientColors={bgPreset?.gradient}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backLabel}>← Cancel</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={saving} style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}>
          <Text style={[styles.saveButtonLabel, !hasChanges && styles.saveButtonLabelDisabled]}>
            {saving ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.title}>Edit Profile</Text>

      {/* Live preview — matches the carousel card exactly */}
      <View style={styles.previewSection}>
        <Text style={styles.previewLabel}>Preview</Text>
        <View style={[styles.previewCard, cardColor ? { backgroundColor: cardColor } : undefined]}>
          <View style={styles.previewPhotoFrame}>
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={styles.previewPhoto} />
            ) : (
              <View style={[styles.previewPhotoSurface, { backgroundColor: accentColor }]}>
                <Text style={styles.previewInitials}>{getInitials(displayName)}</Text>
              </View>
            )}
          </View>
          <View style={styles.previewBottom}>
            <Text style={[styles.previewName, cardColor && { color: ct }]} numberOfLines={1}>{displayName}</Text>
            {tags.length > 0 && (
              <View style={styles.previewTagRow}>
                {tags.slice(0, 2).map((tag) => (
                  <View key={tag} style={[styles.previewTag, cardColor && { backgroundColor: ctAccent + '1A' }]}>
                    <Text style={[styles.previewTagText, cardColor && { color: ctAccent }]} numberOfLines={1}>{tag}</Text>
                  </View>
                ))}
                {tags.length > 2 && (
                  <Text style={[styles.previewTagMore, cardColor && { color: ctSoft }]}>+{tags.length - 2}</Text>
                )}
              </View>
            )}
            {note.trim() ? (
              <Text style={[styles.previewNote, cardColor && { color: ctSoft }]} numberOfLines={2}>{note.trim()}</Text>
            ) : null}
          </View>
        </View>
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

      {/* Photo actions */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Photo</Text>
        <View style={styles.photoRow}>
          <Pressable onPress={takePhoto} style={styles.photoOption}>
            <Text style={styles.photoOptionIcon}>📷</Text>
            <Text style={styles.photoOptionLabel}>Camera</Text>
          </Pressable>
          <Pressable onPress={pickPhoto} style={styles.photoOption}>
            <Text style={styles.photoOptionIcon}>🖼️</Text>
            <Text style={styles.photoOptionLabel}>Gallery</Text>
          </Pressable>
        </View>
        {displayImage && (
          <Pressable onPress={removePhoto} style={styles.removePhotoButton}>
            <Text style={styles.removePhotoLabel}>Remove Photo</Text>
          </Pressable>
        )}
      </View>

      {/* Note / description */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Note</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="A short note about this person…"
          placeholderTextColor={colors.inkMuted}
          multiline
          maxLength={120}
        />
        <Text style={styles.charCount}>{note.length}/120</Text>
      </View>

      {/* Card color */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Card Color</Text>
        <View style={styles.colorRow}>
          <Pressable onPress={() => setCardColor(null)} style={[styles.colorSwatch, { backgroundColor: colors.paper, borderColor: !cardColor ? colors.accent : colors.line }]}>
            {!cardColor && <Text style={styles.colorCheck}>✓</Text>}
          </Pressable>
          {accentPalette.map((c) => (
            <Pressable key={c} onPress={() => setCardColor(c)} style={[styles.colorSwatch, { backgroundColor: c, borderColor: cardColor === c ? colors.ink : 'transparent' }]}>
              {cardColor === c && <Text style={styles.colorCheck}>✓</Text>}
            </Pressable>
          ))}
        </View>
      </View>

      {/* Profile background */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Profile Background</Text>
        <View style={styles.bgRow}>
          <Pressable onPress={() => setProfileBg(null)} style={[styles.bgSwatch, !profileBg && styles.bgSwatchSelected]}>
            <View style={[styles.bgSwatchInner, { backgroundColor: colors.canvas }]}>
              {!profileBg && <Text style={styles.bgCheck}>✓</Text>}
            </View>
            <Text style={styles.bgSwatchLabel}>Default</Text>
          </Pressable>
          {profileBackgrounds.map((bg) => (
            <Pressable key={bg.key} onPress={() => setProfileBg(bg.key)} style={[styles.bgSwatch, profileBg === bg.key && styles.bgSwatchSelected]}>
              <LinearGradient colors={[...bg.gradient]} style={styles.bgSwatchInner}>
                {profileBg === bg.key && <Text style={styles.bgCheck}>✓</Text>}
              </LinearGradient>
              <Text style={styles.bgSwatchLabel}>{bg.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Relationship tags */}
      <View style={styles.fieldSection}>
        <Text style={styles.fieldLabel}>Relationship Tags</Text>
        {tags.length > 0 && (
          <View style={styles.selectedTags}>
            {tags.map((tag) => (
              <Pressable key={tag} onPress={() => toggleTag(tag)} style={styles.selectedTag}>
                <Text style={styles.selectedTagText}>{tag}</Text>
                <Text style={styles.selectedTagRemove}>×</Text>
              </Pressable>
            ))}
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll} contentContainerStyle={styles.presetScrollContent}>
          {PRESET_TAGS.filter((t) => !tags.includes(t)).map((tag) => (
            <Pressable key={tag} onPress={() => toggleTag(tag)} style={styles.presetTag}>
              <Text style={styles.presetTagText}>{tag}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.customTagRow}>
          <TextInput
            style={styles.customTagInput}
            value={customTag}
            onChangeText={setCustomTag}
            placeholder="Custom tag…"
            placeholderTextColor={colors.inkMuted}
            returnKeyType="done"
            onSubmitEditing={addCustomTag}
          />
          <Pressable onPress={addCustomTag} style={styles.customTagButton}>
            <Text style={styles.customTagButtonLabel}>+</Text>
          </Pressable>
        </View>
      </View>
    </AppScreen>
  );
}

function getInitials(value: string) {
  return value.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

const PREVIEW_PHOTO = 140;
const PREVIEW_PADDING = 14;
const PREVIEW_WIDTH = PREVIEW_PHOTO + PREVIEW_PADDING * 2;

const makeStyles = (colors: ColorTokens) =>
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
    removePhotoButton: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.error,
    },
    removePhotoLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
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
    previewCard: {
      alignSelf: 'center',
      width: PREVIEW_WIDTH,
      borderRadius: 2,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      padding: PREVIEW_PADDING,
      paddingBottom: 0,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    previewPhotoFrame: {
      width: PREVIEW_PHOTO,
      height: PREVIEW_PHOTO,
      borderRadius: 1,
      overflow: 'hidden',
    },
    previewPhoto: { width: '100%', height: '100%' },
    previewPhotoSurface: {
      flex: 1,
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewInitials: { fontFamily: fonts.heading, fontSize: 44, color: colors.white },
    previewBottom: {
      width: '100%',
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: 4,
    },
    previewName: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink, textAlign: 'center' },
    previewTagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
    previewTag: {
      backgroundColor: colors.accent + '1A',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    previewTagText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
    previewTagMore: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.inkMuted },
    previewNote: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.inkSoft, textAlign: 'center' },

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
    colorCheck: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },

    /* ── Background picker ── */
    bgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    bgSwatch: {
      alignItems: 'center',
      gap: 4,
      opacity: 0.7,
    },
    bgSwatchSelected: { opacity: 1 },
    bgSwatchInner: {
      width: 48,
      height: 48,
      borderRadius: radius.sm,
      borderWidth: 2,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    bgCheck: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
    bgSwatchLabel: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.inkSoft },
  });
