import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
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
import { AI_CAPTION_TONES, AiCaptionContext, AiCaptionTone, generateAiCaptions } from '../../../src/lib/aiCaptions';
import { showAiCaptionPaywall, showGalleryPaywall } from '../../../src/lib/premiumGates';
import { showPhotoSourceSheet } from '../../../src/lib/photoSourceSheet';
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
import { WallPost, WallPostTextColor, WallPostTextEffect, WallPostTextFont, WallPostTextSize, WallPostVisibility } from '../../../src/types/domain';

export default function AddMemoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId: string | string[]; subjectType: string | string[]; capturedUri: string | string[]; returnTo: string | string[]; backTo: string | string[] }>();
  const { currentUser } = useAuth();
  const { contacts, getUserById, getContactById, getWallPostsForSubject, getPrivateNotesForContact, getPrivateNoteBlocks, getFriendFactsFor } = useSocialGraph();
  const { colors, fonts, themeName } = useTheme();
  const { isPremium, purchasedThemes } = usePremium();
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
  const [captionTone, setCaptionTone] = useState<AiCaptionTone>('witty');
  const [captionSuggestions, setCaptionSuggestions] = useState<string[]>([]);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);

  const onFlip = useCallback((back: boolean) => setShowingBack(back), []);
  const textInputTypography = useMemo(
    () => (!imageUri ? resolveWallPostTextStyle(fonts, textFont, textSize) : null),
    [fonts, imageUri, textFont, textSize],
  );
  const selectedTextColor = useMemo(() => resolveWallPostTextColor(textColor, colors), [colors, textColor]);
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const subjectType = (Array.isArray(params.subjectType) ? params.subjectType[0] : params.subjectType) as 'user' | 'contact';
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;

  // Pick up photo from Polaroid camera screen
  const capturedUri = Array.isArray(params.capturedUri) ? params.capturedUri[0] : params.capturedUri;
  useEffect(() => {
    if (capturedUri) setImageUri(capturedUri);
  }, [capturedUri]);

  useEffect(() => {
    setCaptionSuggestions([]);
  }, [imageUri, subjectId, subjectType]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const authenticatedUser = currentUser;

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

  async function pickGalleryPhoto() {
    if (!isPremium) {
      showGalleryPaywall(() => router.push('/(app)/store'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
      setShowingBack(false);
    }
  }

  function openPhotoSourcePicker() {
    showPhotoSourceSheet({
      galleryLocked: !isPremium,
      onCamera: openCamera,
      onGallery: pickGalleryPhoto,
      title: imageUri ? 'Change Photo' : 'Add Photo',
    });
  }

  function buildCaptionContext(): AiCaptionContext {
    const linkedContact = subjectType === 'user' && subjectId
      ? contacts.find((contact) => contact.ownerUserId === authenticatedUser.id && contact.linkedUserId === subjectId)
      : null;
    const contact = subjectType === 'contact' && subjectId ? getContactById(subjectId) : linkedContact;
    const user = subjectType === 'user' && subjectId
      ? getUserById(subjectId)
      : contact?.linkedUserId
        ? getUserById(contact.linkedUserId)
        : null;

    const contactPosts = contact ? getWallPostsForSubject(contact.id, 'contact') : [];
    const userPosts = user ? getWallPostsForSubject(user.id, 'user') : [];
    const previousPosts = dedupePosts([...contactPosts, ...userPosts]);
    const privateNotes = contact ? getPrivateNotesForContact(contact.id) : [];
    const privateNoteText = privateNotes.flatMap((note) =>
      getPrivateNoteBlocks(note.id)
        .filter((block) => block.type === 'text' && block.content)
        .map((block) => block.content ?? ''),
    );
    const friendFacts = user ? getFriendFactsFor(authenticatedUser.id, user.id).map((fact) => fact.body) : [];

    return {
      authorName: authenticatedUser.displayName,
      subjectName: contact?.nickname || contact?.displayName || user?.displayName || subjectName || 'someone',
      subjectType,
      memoryDate: new Date().toISOString(),
      draftCaption: body.trim() || null,
      relationshipTags: contact?.tags ?? [],
      facts: [...(contact?.facts ?? []), ...(user?.profileFacts ?? []), ...friendFacts],
      notes: [contact?.note ?? '', ...privateNoteText],
      previousCaptions: previousPosts.map((post) => post.body),
      previousBackText: previousPosts.map((post) => post.backText ?? ''),
    };
  }

  async function handleGenerateCaption() {
    if (!imageUri) {
      Alert.alert('Add a photo first', 'AI captions need a photo to look at.');
      return;
    }
    if (!isPremium) {
      showAiCaptionPaywall(() => router.push('/(app)/store'));
      return;
    }
    if (!subjectId) {
      setError('Missing subject.');
      return;
    }

    setError('');
    setShowingBack(false);
    setIsGeneratingCaption(true);
    try {
      const captions = await generateAiCaptions({
        context: buildCaptionContext(),
        imageUri,
        tone: captionTone,
      });
      setCaptionSuggestions(captions);
      if (!body.trim() && captions[0]) setBody(captions[0]);
    } catch (err) {
      Alert.alert('Could not write captions', err instanceof Error ? err.message : 'Try again in a moment.');
    } finally {
      setIsGeneratingCaption(false);
    }
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
        <View style={styles.inputHeaderRow}>
          <Text style={styles.inputLabel}>{showingBack ? 'Back of Card' : 'Front Caption'}</Text>
          {imageUri && !showingBack ? (
            <Pressable onPress={handleGenerateCaption} disabled={isGeneratingCaption} style={[styles.aiButton, isGeneratingCaption && styles.aiButtonDisabled]}>
              <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
              <Text style={styles.aiButtonText}>{isGeneratingCaption ? 'Writing…' : 'AI Caption'}</Text>
            </Pressable>
          ) : null}
        </View>
        {imageUri && !showingBack ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toneScroll}>
            {AI_CAPTION_TONES.map((tone) => {
              const active = captionTone === tone.id;
              return (
                <Pressable key={tone.id} onPress={() => setCaptionTone(tone.id)} style={[styles.toneChip, active && styles.toneChipActive]}>
                  <Text style={[styles.toneChipText, active && styles.toneChipTextActive]}>{tone.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        <TextInput
          multiline
          onChangeText={showingBack ? setBackText : setBody}
          placeholder={showingBack ? 'Write something on the back…' : 'What do you want to remember?'}
          placeholderTextColor={colors.inkMuted}
          style={[styles.textInput, !imageUri && !showingBack && textInputTypography, !imageUri && !showingBack && { color: selectedTextColor }]}
          value={showingBack ? backText : body}
        />
        {imageUri && !showingBack && captionSuggestions.length > 0 ? (
          <View style={styles.captionSuggestionList}>
            {captionSuggestions.map((caption) => (
              <Pressable key={caption} onPress={() => setBody(caption)} style={[styles.captionSuggestion, body.trim() === caption && styles.captionSuggestionActive]}>
                <Text style={styles.captionSuggestionText}>{caption}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
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
            <Text style={styles.photoOptionLabel}>Camera</Text>
          </Pressable>
        )}
        {!imageUri && (
          <Pressable onPress={pickGalleryPhoto} style={[styles.photoOption, !isPremium && styles.photoOptionLocked]}>
            <Ionicons name={isPremium ? 'images-outline' : 'lock-closed-outline'} size={28} color={colors.ink} />
            <Text style={styles.photoOptionLabel}>Gallery</Text>
          </Pressable>
        )}
        {imageUri && (
          <Pressable onPress={() => setImageUri(null)} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoLabel}>Remove Photo</Text>
          </Pressable>
        )}
        {imageUri && (
          <Pressable onPress={openPhotoSourcePicker} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoLabel}>Change Photo</Text>
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
    photoOptionLocked: { opacity: 0.72 },
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
    inputHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    inputLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    aiButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.accent + '66',
      backgroundColor: colors.accent + '12',
    },
    aiButtonDisabled: { opacity: 0.6 },
    aiButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent },
    toneScroll: { gap: spacing.xs, paddingVertical: 2 },
    toneChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    toneChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '14' },
    toneChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    toneChipTextActive: { fontFamily: fonts.bodyBold, color: colors.accent },
    captionSuggestionList: { gap: spacing.xs },
    captionSuggestion: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    captionSuggestionActive: { borderColor: colors.accent, backgroundColor: colors.accent + '10' },
    captionSuggestionText: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.ink },
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

function dedupePosts(posts: WallPost[]) {
  const seen = new Set<string>();
  const result: WallPost[] = [];
  for (const post of posts) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    result.push(post);
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
}
