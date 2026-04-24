import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { MemoryTextStylePicker } from '../../../src/components/MemoryTextStylePicker';
import { WallPostCard } from '../../../src/components/WallPostCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { usePremium } from '../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { isCardColorUnlocked, getCardColorLockMessage } from '../../../src/features/theme/cardColorUnlocks';
import { useAddMemory } from '../../../src/hooks/useAddMemory';
import {
  defaultWallPostTextColor,
  defaultWallPostTextEffect,
  defaultWallPostTextFont,
  defaultWallPostTextSize,
  resolveWallPostTextColor,
  resolveWallPostTextStyle,
} from '../../../src/lib/wallPostTextStyle';
import { polaroidFilters } from '../../../src/lib/polaroidFilters';
import type { FontSet } from '../../../src/theme/typography';
import { accentPalette, radius, spacing } from '../../../src/theme/tokens';
import { WallPostTextColor, WallPostTextEffect, WallPostTextFont, WallPostTextSize, WallPostVisibility } from '../../../src/types/domain';

export default function AddMemoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId: string | string[]; subjectType: string | string[]; capturedUri: string | string[]; returnTo: string | string[]; backTo: string | string[] }>();
  const { currentUser } = useAuth();
  const { getUserById, getContactById } = useSocialGraph();
  const { colors, fonts, themeName } = useTheme();
  const { purchasedThemes } = usePremium();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const addMemory = useAddMemory();

  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<WallPostVisibility>('visible_to_subject');
  const [cardColor, setCardColor] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [dateStamp, setDateStamp] = useState(false);
  const [backText, setBackText] = useState('');
  const [showingBack, setShowingBack] = useState(false);
  const [error, setError] = useState('');
  const [textFont, setTextFont] = useState<WallPostTextFont>(defaultWallPostTextFont);
  const [textSize, setTextSize] = useState<WallPostTextSize>(defaultWallPostTextSize);
  const [textEffect, setTextEffect] = useState<WallPostTextEffect>(defaultWallPostTextEffect);
  const [textColor, setTextColor] = useState<WallPostTextColor>(defaultWallPostTextColor);

  const onFlip = useCallback((back: boolean) => setShowingBack(back), []);
  const textInputTypography = useMemo(
    () => (!imageUri ? resolveWallPostTextStyle(fonts, textFont, textSize) : null),
    [fonts, imageUri, textFont, textSize],
  );
  const selectedTextColor = useMemo(() => resolveWallPostTextColor(textColor, colors), [colors, textColor]);

  // Pick up photo from Polaroid camera screen
  const capturedUri = Array.isArray(params.capturedUri) ? params.capturedUri[0] : params.capturedUri;
  useEffect(() => {
    if (capturedUri) setImageUri(capturedUri);
  }, [capturedUri]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const authenticatedUser = currentUser;

  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const subjectType = (Array.isArray(params.subjectType) ? params.subjectType[0] : params.subjectType) as 'user' | 'contact';
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;
  const subjectName = subjectType === 'user'
    ? getUserById(subjectId ?? '')?.displayName
    : getContactById(subjectId ?? '')?.displayName;

  function handleBack() {
    if (backTo) {
      router.dismissTo(backTo as any);
      return;
    }
    router.back();
  }

  function openCamera() {
    router.push({
      pathname: '/(app)/camera',
      params: {
        subjectId: subjectId ?? '',
        subjectType: subjectType ?? '',
        returnTo: '/(app)/memories/add',
        backTo: backTo ?? '',
      },
    });
  }

  const header = (
    <Pressable onPress={handleBack} style={styles.backButton}>
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  async function handleSave() {
    if (!body.trim() && !imageUri) { setError('Add a photo or write something to remember.'); return; }
    if (!subjectId) { setError('Missing subject.'); return; }
    setError('');

    // When the subject is a contact linked to a real user, target the user directly
    // so the post shows up via RLS on their wall.
    let finalSubjectUserId: string | null = subjectType === 'user' ? subjectId : null;
    let finalSubjectContactId: string | null = subjectType === 'contact' ? subjectId : null;
    let finalVisibility = visibility;
    if (subjectType === 'contact' && subjectId) {
      const contact = getContactById(subjectId);
      if (contact?.linkedUserId) {
        finalSubjectUserId = contact.linkedUserId;
        finalSubjectContactId = null;
        // Default to visible so the friend can see it on their wall.
        if (finalVisibility === 'private') finalVisibility = 'visible_to_subject';
      }
    }

    addMemory.mutate(
      {
        authorUserId: authenticatedUser.id,
        imageUri,
        post: {
          subjectUserId: finalSubjectUserId,
          subjectContactId: finalSubjectContactId,
          visibility: finalVisibility,
          body: body.trim(),
          imageUri: null,
          cardColor: cardColor,
          backText: backText.trim() || null,
          filter: filter,
          textFont: !imageUri ? textFont : null,
          textSize: !imageUri ? textSize : null,
          textEffect: !imageUri ? textEffect : null,
          textColor: !imageUri ? textColor : null,
          dateStamp: dateStamp,
        },
      },
      {
        onSuccess: () => {
          if (subjectType === 'user' && subjectId) {
            router.replace({ pathname: '/(app)/profiles/user/[userId]', params: { userId: subjectId } });
          } else if (subjectType === 'contact' && subjectId) {
            router.replace({ pathname: '/(app)/profiles/contact/[contactId]', params: { contactId: subjectId } });
          } else {
            router.back();
          }
        },
        onError: (err) => setError(err.message ?? 'Something went wrong.'),
      },
    );
  }

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={addMemory.isPending ? 'Saving…' : 'Save Memory'} onPress={handleSave} disabled={addMemory.isPending} />}>

      <Text style={styles.title}>New Memory</Text>
      <Text style={styles.subtitle}>About {subjectName ?? 'someone'}</Text>

      <View style={styles.visibilityRow}>
        <Text style={styles.visibilityLabel}>Private</Text>
        <Switch
          value={visibility === 'private'}
          onValueChange={(val) => setVisibility(val ? 'private' : 'visible_to_subject')}
          trackColor={{ false: colors.line, true: colors.accent }}
          thumbColor={colors.white}
        />
      </View>

      {(body.trim() || imageUri) && (
        <View style={styles.previewSection}>
          <WallPostCard
            authorName={authenticatedUser.displayName}
            cardColor={cardColor}
            preview
            onFlip={imageUri ? onFlip : undefined}
            post={{
              id: 'preview',
              authorUserId: authenticatedUser.id,
              subjectUserId: subjectType === 'user' ? (subjectId ?? null) : null,
              subjectContactId: subjectType === 'contact' ? (subjectId ?? null) : null,
              visibility,
              body: body.trim(),
              cardColor,
              backText: backText.trim() || null,
              imageUri,
              createdAt: new Date().toISOString(),
              filter: filter,
              textFont: !imageUri ? textFont : null,
              textSize: !imageUri ? textSize : null,
              textEffect: !imageUri ? textEffect : null,
              textColor: !imageUri ? textColor : null,
              dateStamp: dateStamp,
            }}
          />
          {imageUri ? <Text style={styles.previewHint}>Tap card to flip</Text> : null}
        </View>
      )}

      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>{showingBack ? 'Back of Card' : 'Front Caption'}</Text>
        <TextInput
          multiline
          onChangeText={showingBack ? setBackText : setBody}
          placeholder={showingBack ? 'Write something on the back…' : 'What do you want to remember?'}
          placeholderTextColor={colors.inkMuted}
          style={[styles.textInput, !imageUri && !showingBack && textInputTypography, !imageUri && !showingBack && { color: selectedTextColor }]}
          value={showingBack ? backText : body}
        />
      </View>

      {!imageUri ? (
        <MemoryTextStylePicker
          selectedFont={textFont}
          selectedSize={textSize}
          selectedEffect={textEffect}
          selectedColor={textColor}
          onSelectFont={setTextFont}
          onSelectSize={setTextSize}
          onSelectEffect={setTextEffect}
          onSelectColor={setTextColor}
        />
      ) : null}

      <View style={styles.photoRow}>
        {!imageUri && (
          <Pressable onPress={openCamera} style={styles.photoOption}>
            <Ionicons name="camera-outline" size={28} color={colors.ink} />
            <Text style={styles.photoOptionLabel}>Take Photo</Text>
          </Pressable>
        )}
        {imageUri && (
          <Pressable onPress={() => setImageUri(null)} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoLabel}>Remove Photo</Text>
          </Pressable>
        )}
        {imageUri && (
          <Pressable onPress={openCamera} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoLabel}>Retake Photo</Text>
          </Pressable>
        )}
      </View>

      {imageUri && (
        <View style={styles.dateStampSection}>
          <Pressable onPress={() => setDateStamp((d) => !d)} style={styles.dateStampToggle}>
            <Ionicons name={dateStamp ? 'checkbox' : 'square-outline'} size={20} color={dateStamp ? colors.accent : colors.inkMuted} />
            <Text style={[styles.dateStampLabel, dateStamp && styles.dateStampLabelActive]}>Add date stamp to photo</Text>
          </Pressable>
        </View>
      )}

      {imageUri && (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Photo Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {polaroidFilters.map((f) => {
              const active = (filter ?? 'none') === f.key;
              return (
                <Pressable key={f.key} onPress={() => setFilter(f.key === 'none' ? null : f.key)} style={[styles.filterChip, active && styles.filterChipActive]}>
                  <View style={styles.filterPreview}>
                    <Image source={{ uri: imageUri }} style={styles.filterThumb} />
                    {f.overlay && <View style={[styles.filterOverlay, { backgroundColor: f.overlay }]} />}
                    {f.overlay2 && <View style={[styles.filterOverlay, { backgroundColor: f.overlay2 }]} />}
                  </View>
                  <Text style={[styles.filterChipLabel, active && styles.filterChipLabelActive]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {imageUri && (
      <View style={styles.colorSection}>
        <Text style={styles.colorLabel}>Card Color</Text>
        <View style={styles.colorRow}>
          <Pressable onPress={() => setCardColor(null)} style={[styles.colorSwatch, { backgroundColor: colors.paper, borderColor: !cardColor ? colors.accent : colors.line }]}>
            {!cardColor && <Ionicons name="checkmark" size={16} color={colors.ink} />}
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
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
    photoRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
    photoOption: {
      width: 100, height: 100, borderRadius: radius.md, backgroundColor: colors.paper,
      borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    },
    photoOptionIcon: { fontSize: 28 },
    photoOptionLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    changePhotoButton: {
      paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
      borderWidth: 1, borderColor: colors.line,
    },
    changePhotoLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
    textInput: {
      minHeight: 120, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line,
      padding: spacing.md, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink, textAlignVertical: 'top',
    },
    visibilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    visibilityLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
    colorSection: { gap: spacing.xs },
    colorLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    colorRow: { flexDirection: 'row' as const, gap: spacing.sm, flexWrap: 'wrap' as const },
    colorSwatch: {
      width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    colorSwatchLocked: { opacity: 0.45 },
    colorCheck: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.ink },
    previewSection: { gap: spacing.sm, alignItems: 'center' as const },
    previewLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    previewHint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, textAlign: 'center' as const },
    inputSection: { gap: spacing.xs },
    inputLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    filterSection: { gap: spacing.xs },
    filterLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    filterScroll: { gap: spacing.sm },
    filterChip: { alignItems: 'center' as const, gap: 4 },
    filterChipActive: {},
    filterPreview: { width: 56, height: 56, borderRadius: radius.sm, overflow: 'hidden' as const, borderWidth: 2, borderColor: colors.line },
    filterThumb: { width: '100%' as const, height: '100%' as const },
    filterOverlay: { ...StyleSheet.absoluteFillObject },
    filterChipLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.inkSoft },
    filterChipLabelActive: { fontFamily: fonts.bodyBold, color: colors.accent },
    dateStampSection: { gap: spacing.xs },
    dateStampToggle: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    dateStampLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkMuted },
    dateStampLabelActive: { color: colors.ink },
  });
