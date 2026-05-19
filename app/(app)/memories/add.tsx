import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { MemoryPromptPicker } from '../../../src/components/MemoryPromptPicker';
import { MemoryTextStylePicker } from '../../../src/components/MemoryTextStylePicker';
import { SongSearchPicker } from '../../../src/components/SongSearchPicker';
import { WallPostCard } from '../../../src/components/WallPostCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { usePremium } from '../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import { buildMemoryPrompts, type MemoryPrompt } from '../../../src/features/memoryPrompts/memoryPrompts';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { isCardColorUnlocked, getCardColorLockMessage } from '../../../src/features/theme/cardColorUnlocks';
import { useAddMemory } from '../../../src/hooks/useAddMemory';
import { AI_CAPTION_TONES, AiCaptionContext, AiCaptionTone, generateAiCaptions } from '../../../src/lib/aiCaptions';
import { memoryImagePickerOptions } from '../../../src/lib/imagePickerPresets';
import { backOnce, dismissToOnce, pushOnce, replaceOnce } from '../../../src/lib/navigationGuard';
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
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import type { FontSet } from '../../../src/theme/typography';
import { accentPalette, radius, spacing } from '../../../src/theme/tokens';
import { CreateWallPostInput, PeopleListItem, SongAttachment, WallPost, WallPostTextColor, WallPostTextEffect, WallPostTextFont, WallPostTextSize, WallPostVisibility } from '../../../src/types/domain';

type MemoryKind = 'note' | 'photo' | 'song';
type PhotoSource = 'camera' | 'gallery' | null;

const MEMORY_KIND_OPTIONS: { id: MemoryKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'note', label: 'Note', icon: 'create-outline' },
  { id: 'photo', label: 'Photo', icon: 'camera-outline' },
  { id: 'song', label: 'Song', icon: 'musical-notes-outline' },
];

export default function AddMemoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId: string | string[]; subjectType: string | string[]; targetKeys: string | string[]; capturedUri: string | string[]; capturedVideoUri: string | string[]; returnTo: string | string[]; backTo: string | string[] }>();
  const { currentUser } = useAuth();
  const { contacts, getUserById, getContactById, getWallPostsForSubject, getPrivateNotesForContact, getPrivateNoteBlocks, getFriendFactsFor, getPeopleListForUser } = useSocialGraph();
  const { colors, fonts, themeName } = useTheme();
  const { isPremium, purchasedThemes } = usePremium();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const addMemory = useAddMemory();
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const subjectType = (Array.isArray(params.subjectType) ? params.subjectType[0] : params.subjectType) as 'user' | 'contact' | undefined;
  const targetKeysParam = Array.isArray(params.targetKeys) ? params.targetKeys[0] : params.targetKeys;
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;

  const [body, setBody] = useState('');
  const [memoryKind, setMemoryKind] = useState<MemoryKind>('note');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoMuted, setVideoMuted] = useState(false);
  const [photoSource, setPhotoSource] = useState<PhotoSource>(null);
  const [memoryDateInput, setMemoryDateInput] = useState(() => getDateKey(new Date()));
  const [selectedSong, setSelectedSong] = useState<SongAttachment | null>(null);
  const [songPreviewRequestKey, setSongPreviewRequestKey] = useState<string | null>(null);
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
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<string[]>(() => parseInitialTargetKeys(targetKeysParam, subjectId, subjectType));

  const onFlip = useCallback((back: boolean) => setShowingBack(back), []);
  const textInputTypography = useMemo(
    () => (memoryKind === 'note' && !imageUri ? resolveWallPostTextStyle(fonts, textFont, textSize) : null),
    [fonts, imageUri, memoryKind, textFont, textSize],
  );
  const selectedTextColor = useMemo(() => resolveWallPostTextColor(textColor, colors), [colors, textColor]);
  // Pick up photo from Polaroid camera screen
  const capturedUri = Array.isArray(params.capturedUri) ? params.capturedUri[0] : params.capturedUri;
  const capturedVideoUri = Array.isArray(params.capturedVideoUri) ? params.capturedVideoUri[0] : params.capturedVideoUri;
  useEffect(() => {
    if (capturedUri) {
      setImageUri(capturedUri);
      setVideoUri(capturedVideoUri ?? null);
      if (capturedVideoUri) setVideoMuted(false);
      setPhotoSource('camera');
      setMemoryKind('photo');
    }
  }, [capturedUri, capturedVideoUri]);

  useEffect(() => {
    setCaptionSuggestions([]);
  }, [imageUri, selectedTargetKeys]);

  useEffect(() => {
    const nextKeys = parseInitialTargetKeys(targetKeysParam, subjectId, subjectType);
    if (nextKeys.length > 0) setSelectedTargetKeys(nextKeys);
  }, [subjectId, subjectType, targetKeysParam]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const authenticatedUser = currentUser;
  const peopleTargets = getPeopleListForUser(authenticatedUser.id);
  const selectedTargets = peopleTargets.filter((person) => selectedTargetKeys.includes(memoryTargetKey(person)));
  const primaryTarget = selectedTargets[0] ?? getFallbackTarget(peopleTargets, subjectId, subjectType);
  const primarySubjectId = primaryTarget?.id ?? subjectId;
  const primarySubjectType = primaryTarget?.entityType ?? subjectType;

  const subjectName = selectedTargets.length > 1
    ? `${selectedTargets[0].title} + ${selectedTargets.length - 1} more`
    : primaryTarget?.title
      ?? (primarySubjectType === 'user'
        ? getUserById(primarySubjectId ?? '')?.displayName
        : getContactById(primarySubjectId ?? '')?.displayName);
  const memoryPromptTarget = selectedTargets.length === 1 ? selectedTargets[0] : primaryTarget;
  const memoryPrompts = useMemo(() => {
    if (!memoryPromptTarget) return [];
    const promptContext = getMemoryPromptContext(memoryPromptTarget);
    return buildMemoryPrompts({
      subjectName: memoryPromptTarget.title,
      facts: promptContext.facts,
      relationshipTags: promptContext.relationshipTags,
      previousMemoryCount: promptContext.previousMemoryCount,
    });
  }, [memoryPromptTarget, contacts, authenticatedUser.id, getContactById, getFriendFactsFor, getUserById, getWallPostsForSubject]);

  function handleBack() {
    if (backTo) {
      dismissToOnce(router, backTo as any);
      return;
    }
    backOnce(router);
  }

  function toggleTarget(target: PeopleListItem) {
    const key = memoryTargetKey(target);
    setError('');
    setSelectedTargetKeys((current) => (
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key]
    ));
  }

  function openCamera() {
    setMemoryKind('photo');
    pushOnce(router, {
      pathname: '/(app)/camera',
      params: {
        subjectId: primarySubjectId ?? '',
        subjectType: primarySubjectType ?? '',
        targetKeys: selectedTargetKeys.join(','),
        returnTo: '/(app)/memories/add',
        backTo: backTo ?? '',
      },
    });
  }

  function openLiveThumbnailCamera() {
    if (!videoUri) return;
    setMemoryKind('photo');
    pushOnce(router, {
      pathname: '/(app)/camera',
      params: {
        subjectId: primarySubjectId ?? '',
        subjectType: primarySubjectType ?? '',
        targetKeys: selectedTargetKeys.join(','),
        returnTo: '/(app)/memories/add',
        backTo: backTo ?? '',
        capturedVideoUri: videoUri,
        thumbnailOnly: '1',
      },
    });
  }

  function selectMemoryKind(nextKind: MemoryKind) {
    setError('');
    setShowingBack(false);
    setMemoryKind(nextKind);
    if (nextKind !== 'photo') {
      setImageUri(null);
      setVideoUri(null);
      setVideoMuted(false);
      setPhotoSource(null);
      setFilter(null);
      setDateStamp(false);
      setBackText('');
      setCaptionSuggestions([]);
    }
    if (nextKind === 'note') {
      setBackText('');
    }
  }

  function applyMemoryPrompt(prompt: MemoryPrompt) {
    setError('');
    setShowingBack(false);
    setMemoryKind('note');
    setImageUri(null);
    setVideoUri(null);
    setVideoMuted(false);
    setPhotoSource(null);
    setFilter(null);
    setDateStamp(false);
    setBackText('');
    setBody(prompt.body);
  }

  function getMemoryPromptContext(target: PeopleListItem) {
    const contact = target.entityType === 'contact'
      ? getContactById(target.id)
      : contacts.find((entry) => entry.ownerUserId === authenticatedUser.id && entry.linkedUserId === target.id);
    const user = target.entityType === 'user'
      ? getUserById(target.id)
      : contact?.linkedUserId
        ? getUserById(contact.linkedUserId)
        : null;
    const contactPosts = contact ? getWallPostsForSubject(contact.id, 'contact') : [];
    const userPosts = user ? getWallPostsForSubject(user.id, 'user') : [];
    const previousMemoryCount = dedupePosts([...contactPosts, ...userPosts]).length;
    const friendFacts = user ? getFriendFactsFor(authenticatedUser.id, user.id).map((fact) => fact.body) : [];
    return {
      facts: [...(contact?.facts ?? []), ...(user?.profileFacts ?? []), ...friendFacts],
      relationshipTags: contact?.tags ?? [],
      previousMemoryCount,
    };
  }

  async function pickGalleryPhoto() {
    if (!isPremium) {
      showGalleryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync(memoryImagePickerOptions);
    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
      setVideoUri(null);
      setVideoMuted(false);
      setPhotoSource('gallery');
      setMemoryDateInput(getDateKey(new Date()));
      setMemoryKind('photo');
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
    const linkedContact = primarySubjectType === 'user' && primarySubjectId
      ? contacts.find((contact) => contact.ownerUserId === authenticatedUser.id && contact.linkedUserId === primarySubjectId)
      : null;
    const contact = primarySubjectType === 'contact' && primarySubjectId ? getContactById(primarySubjectId) : linkedContact;
    const user = primarySubjectType === 'user' && primarySubjectId
      ? getUserById(primarySubjectId)
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
      subjectType: primarySubjectType ?? 'contact',
      memoryDate: canChooseMemoryDate ? (parseMemoryDateInput(memoryDateInput) ?? new Date().toISOString()) : new Date().toISOString(),
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
      showAiCaptionPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    if (!primaryTarget && !primarySubjectId) {
      setError('Choose at least one wall.');
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
    const isSongMemory = memoryKind === 'song';
    if (isSongMemory && !selectedSong) { setError('Choose a song to add to the wall.'); return; }
    if (!isSongMemory && !body.trim() && !imageUri) { setError('Add a photo or write something to remember.'); return; }
    if (selectedTargets.length === 0) { setError('Choose at least one wall.'); return; }
    const selectedMemoryDate = canChooseMemoryDate ? parseMemoryDateInput(memoryDateInput) : null;
    if (canChooseMemoryDate && !selectedMemoryDate) { setError('Choose a valid memory date like 2026-05-15.'); return; }
    if (selectedMemoryDate && isFutureDateKey(selectedMemoryDate)) { setError('Memory dates cannot be in the future.'); return; }
    setError('');
    const postType = isSongMemory ? 'song' : imageUri ? 'polaroid' : 'note';

    const posts: CreateWallPostInput[] = selectedTargets.map((target) => {
      // When the subject is a contact linked to a real user, target the user directly
      // so the post shows up via RLS on their wall.
      let finalSubjectUserId: string | null = target.entityType === 'user' ? target.id : null;
      let finalSubjectContactId: string | null = target.entityType === 'contact' ? target.id : null;
      let finalVisibility = visibility;
      if (target.entityType === 'contact') {
        const contact = getContactById(target.id);
        if (contact?.linkedUserId) {
          finalSubjectUserId = contact.linkedUserId;
          finalSubjectContactId = null;
          // Default to visible so the friend can see it on their wall.
          if (finalVisibility === 'private') finalVisibility = 'visible_to_subject';
        }
      }

      return {
        subjectUserId: finalSubjectUserId,
        subjectContactId: finalSubjectContactId,
        visibility: finalVisibility,
        postType,
        body: body.trim(),
        imageUri: null,
        videoUri: null,
        videoMuted: !!videoUri && videoMuted,
        cardColor: imageUri ? cardColor : null,
        backText: imageUri ? (backText.trim() || null) : null,
        filter: imageUri ? filter : null,
        textFont: postType === 'note' ? textFont : null,
        textSize: postType === 'note' ? textSize : null,
        textEffect: postType === 'note' ? textEffect : null,
        textColor: postType === 'note' ? textColor : null,
        dateStamp: !!imageUri && dateStamp,
        song: selectedSong,
        memoryDate: selectedMemoryDate,
      };
    });

    try {
      await addMemory.mutateAsync({
        authorUserId: authenticatedUser.id,
        imageUri: isSongMemory ? null : imageUri,
        videoUri: isSongMemory ? null : videoUri,
        videoMuted: !!videoUri && videoMuted,
        memoryDate: selectedMemoryDate,
        posts,
      });

      if (selectedTargets.length > 1) {
        if (backTo) dismissToOnce(router, backTo as any);
        else replaceOnce(router, '/friends');
        return;
      }

      const target = selectedTargets[0];
      if (target.entityType === 'user') {
        replaceOnce(router, { pathname: '/(app)/profiles/user/[userId]', params: { userId: target.id } });
      } else {
        replaceOnce(router, { pathname: '/(app)/profiles/contact/[contactId]', params: { contactId: target.id } });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  const previewPostType = memoryKind === 'song' ? 'song' : imageUri ? 'polaroid' : 'note';
  const hasPreview = memoryKind === 'song' ? !!selectedSong : !!(body.trim() || imageUri || selectedSong);
  const inputLabel = memoryKind === 'song'
    ? 'Song Note'
    : showingBack
      ? 'Back of Card'
      : imageUri
        ? 'Front Caption'
        : 'Memory Note';
  const inputPlaceholder = memoryKind === 'song'
    ? 'Why does this song belong here?'
    : showingBack
      ? 'Write something on the back...'
      : 'What do you want to remember?';
  const showSongPicker = memoryKind === 'song' || memoryKind === 'note' || (memoryKind === 'photo' && !!imageUri);
  const canChooseMemoryDate = isPremium && memoryKind === 'photo' && !!imageUri && photoSource === 'gallery' && !videoUri;

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={addMemory.isPending ? 'Saving…' : 'Save Memory'} onPress={handleSave} disabled={addMemory.isPending} />}>

      <Text style={styles.title}>New Memory</Text>
      <Text style={styles.subtitle}>About {subjectName ?? 'someone'}</Text>

      <View style={styles.targetSection}>
        <View style={styles.targetHeaderRow}>
          <Text style={styles.targetLabel}>Add to walls</Text>
          <Text style={styles.targetCount}>{selectedTargets.length} selected</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetScroll}>
          {peopleTargets.map((target) => {
            const selected = selectedTargetKeys.includes(memoryTargetKey(target));
            return (
              <Pressable
                key={memoryTargetKey(target)}
                onPress={() => toggleTarget(target)}
                style={[styles.targetChip, selected && styles.targetChipActive]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`Add to ${target.title}'s wall`}
              >
                <View style={[styles.targetAvatar, { backgroundColor: target.avatarColor }]}>
                  {target.imageUri ? (
                    <Image source={{ uri: target.imageUri }} style={styles.targetAvatarImage} />
                  ) : (
                    <Text style={styles.targetInitials}>{getInitials(target.title)}</Text>
                  )}
                </View>
                <Text style={[styles.targetChipText, selected && styles.targetChipTextActive]} numberOfLines={1}>
                  {target.title}
                </Text>
                {selected ? <Ionicons name="checkmark-circle" size={16} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.visibilityRow}>
        <Text style={styles.visibilityLabel}>Private</Text>
        <Switch
          value={visibility === 'private'}
          onValueChange={(val) => setVisibility(val ? 'private' : 'visible_to_subject')}
          trackColor={{ false: colors.line, true: colors.accent }}
          thumbColor={colors.white}
        />
      </View>

      {canChooseMemoryDate ? (
      <View style={styles.memoryDateSection}>
        <View style={styles.memoryDateHeader}>
          <View style={styles.memoryDateCopy}>
            <Text style={styles.memoryDateLabel}>Memory Date</Text>
            <Text style={styles.memoryDateHint}>
              Choose when this gallery photo happened.
            </Text>
          </View>
        </View>
        <View style={styles.memoryDateQuickRow}>
          {[
            { label: 'Today', value: getDateKey(new Date()) },
            { label: 'Yesterday', value: getDateKey(addDays(new Date(), -1)) },
            { label: 'Last week', value: getDateKey(addDays(new Date(), -7)) },
          ].map((option) => {
            const active = memoryDateInput === option.value;
            return (
              <Pressable key={option.label} onPress={() => setMemoryDateInput(option.value)} style={[styles.memoryDateChip, active && styles.memoryDateChipActive]}>
                <Text style={[styles.memoryDateChipText, active && styles.memoryDateChipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={memoryDateInput}
          onChangeText={setMemoryDateInput}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          style={styles.memoryDateInput}
        />
      </View>
      ) : null}

      <View style={styles.kindTabs}>
        {MEMORY_KIND_OPTIONS.map((option) => {
          const active = memoryKind === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => selectMemoryKind(option.id)}
              style={[styles.kindTab, active && styles.kindTabActive]}
              accessibilityRole="button"
              accessibilityLabel={`Create ${option.label.toLowerCase()} memory`}
            >
              <Ionicons name={option.icon} size={18} color={active ? colors.accent : colors.inkSoft} />
              <Text style={[styles.kindTabLabel, active && styles.kindTabLabelActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!showingBack ? (
        <MemoryPromptPicker prompts={memoryPrompts} onSelectPrompt={applyMemoryPrompt} />
      ) : null}

      {showSongPicker ? (
        <SongSearchPicker
          selectedSong={selectedSong}
          onSelect={(song) => {
            setSelectedSong(song);
            setSongPreviewRequestKey(`${song.provider}:${song.providerTrackId}:${Date.now()}`);
            if (memoryKind === 'song') {
              setImageUri(null);
              setShowingBack(false);
            }
            setError('');
          }}
          onRemove={() => {
            setSelectedSong(null);
            setSongPreviewRequestKey(null);
          }}
        />
      ) : null}

      {hasPreview && (
        <View style={styles.previewSection}>
          <WallPostCard
            authorName={authenticatedUser.displayName}
            cardColor={imageUri ? cardColor : null}
            preview
            onFlip={imageUri ? onFlip : undefined}
            autoPlaySongPreviewKey={songPreviewRequestKey}
            post={{
              id: 'preview',
              authorUserId: authenticatedUser.id,
              subjectUserId: primarySubjectType === 'user' ? (primarySubjectId ?? null) : null,
              subjectContactId: primarySubjectType === 'contact' ? (primarySubjectId ?? null) : null,
              visibility,
              postType: previewPostType,
              body: body.trim(),
              cardColor: imageUri ? cardColor : null,
              backText: imageUri ? (backText.trim() || null) : null,
              imageUri: memoryKind === 'song' ? null : imageUri,
              videoUri: memoryKind === 'song' ? null : videoUri,
              videoMuted: memoryKind === 'song' ? false : !!videoUri && videoMuted,
              memoryDate: canChooseMemoryDate ? parseMemoryDateInput(memoryDateInput) : null,
              createdAt: new Date().toISOString(),
              filter: imageUri ? filter : null,
              textFont: previewPostType === 'note' ? textFont : null,
              textSize: previewPostType === 'note' ? textSize : null,
              textEffect: previewPostType === 'note' ? textEffect : null,
              textColor: previewPostType === 'note' ? textColor : null,
              dateStamp: !!imageUri && dateStamp,
              song: selectedSong,
            }}
          />
          {imageUri ? <Text style={styles.previewHint}>{videoUri ? 'Preview the Live Memory Card, retake its cover, or add a photo filter below.' : 'Tap card to flip'}</Text> : null}
        </View>
      )}

      <View style={styles.inputSection}>
        <View style={styles.inputHeaderRow}>
          <Text style={styles.inputLabel}>{inputLabel}</Text>
          {memoryKind === 'photo' && imageUri && !showingBack ? (
            <Pressable onPress={handleGenerateCaption} disabled={isGeneratingCaption} style={[styles.aiButton, isGeneratingCaption && styles.aiButtonDisabled]}>
              <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
              <Text style={styles.aiButtonText}>{isGeneratingCaption ? 'Writing…' : 'AI Caption'}</Text>
            </Pressable>
          ) : null}
        </View>
        {memoryKind === 'photo' && imageUri && !showingBack ? (
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
          placeholder={inputPlaceholder}
          placeholderTextColor={colors.inkMuted}
          style={[styles.textInput, memoryKind === 'note' && !imageUri && !showingBack && textInputTypography, memoryKind === 'note' && !imageUri && !showingBack && { color: selectedTextColor }]}
          value={showingBack ? backText : body}
        />
        {memoryKind === 'photo' && imageUri && !showingBack && captionSuggestions.length > 0 ? (
          <View style={styles.captionSuggestionList}>
            {captionSuggestions.map((caption) => (
              <Pressable key={caption} onPress={() => setBody(caption)} style={[styles.captionSuggestion, body.trim() === caption && styles.captionSuggestionActive]}>
                <Text style={styles.captionSuggestionText}>{caption}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {memoryKind === 'note' && !imageUri ? (
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

      {memoryKind === 'photo' ? <View style={styles.photoRow}>
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
          <Pressable onPress={() => { setImageUri(null); setVideoUri(null); setVideoMuted(false); setPhotoSource(null); setSelectedSong(null); setSongPreviewRequestKey(null); }} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoLabel}>{videoUri ? 'Remove Live Memory Card' : 'Remove Photo'}</Text>
          </Pressable>
        )}
        {imageUri && videoUri ? (
          <Pressable onPress={openLiveThumbnailCamera} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoLabel}>Retake Thumbnail</Text>
          </Pressable>
        ) : null}
        {imageUri && (
          <Pressable onPress={videoUri ? openCamera : openPhotoSourcePicker} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoLabel}>{videoUri ? 'Retake Live Memory Card' : 'Change Photo'}</Text>
          </Pressable>
        )}
      </View> : null}

      {imageUri && videoUri ? (
        <View style={styles.dateStampSection}>
          <Pressable onPress={() => setVideoMuted((muted) => !muted)} style={styles.dateStampToggle}>
            <Ionicons name={videoMuted ? 'checkbox' : 'square-outline'} size={20} color={videoMuted ? colors.accent : colors.inkMuted} />
            <Text style={[styles.dateStampLabel, videoMuted && styles.dateStampLabelActive]}>Turn off audio for this Live Memory Card</Text>
          </Pressable>
        </View>
      ) : null}

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
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 28) },
    subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
    targetSection: { gap: spacing.xs },
    targetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    targetLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    targetCount: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    targetScroll: { gap: spacing.sm, paddingVertical: 2 },
    targetChip: {
      minWidth: 112,
      maxWidth: 148,
      minHeight: 44,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: 6,
      paddingLeft: 6,
      paddingRight: spacing.sm,
    },
    targetChipActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accent + '12',
    },
    targetAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    targetAvatarImage: { width: '100%', height: '100%' },
    targetInitials: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.white },
    targetChipText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    targetChipTextActive: { fontFamily: fonts.bodyBold, color: colors.ink },
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
    memoryDateSection: {
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      padding: spacing.md,
    },
    memoryDateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    memoryDateCopy: { flex: 1, gap: 3 },
    memoryDateLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    memoryDateHint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
    premiumBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    premiumBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.white, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
    memoryDateQuickRow: { flexDirection: 'row' as const, gap: spacing.xs, flexWrap: 'wrap' as const },
    memoryDateChip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
    },
    memoryDateChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '14' },
    memoryDateChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    memoryDateChipTextActive: { fontFamily: fonts.bodyBold, color: colors.accent },
    memoryDateInput: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      color: colors.ink,
    },
    memoryDateLockedButton: {
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.accent + '66',
      backgroundColor: colors.accent + '12',
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    memoryDateLockedText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent },
    kindTabs: {
      flexDirection: 'row' as const,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      padding: 4,
      gap: 4,
    },
    kindTab: {
      flex: 1,
      minHeight: 42,
      borderRadius: 8,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 6,
      paddingHorizontal: spacing.sm,
    },
    kindTabActive: {
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    kindTabLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
    kindTabLabelActive: { fontFamily: fonts.bodyBold, color: colors.accent },
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

function memoryTargetKey(target: Pick<PeopleListItem, 'entityType' | 'id'>) {
  return `${target.entityType}:${target.id}`;
}

function parseInitialTargetKeys(
  targetKeysParam: string | undefined,
  subjectId: string | undefined,
  subjectType: 'user' | 'contact' | undefined,
) {
  const fromParam = targetKeysParam
    ?.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^(user|contact):.+/.test(entry)) ?? [];
  if (fromParam.length > 0) return Array.from(new Set(fromParam));
  return subjectId && subjectType ? [`${subjectType}:${subjectId}`] : [];
}

function getFallbackTarget(
  targets: PeopleListItem[],
  subjectId: string | undefined,
  subjectType: 'user' | 'contact' | undefined,
) {
  if (!subjectId || !subjectType) return undefined;
  return targets.find((target) => target.id === subjectId && target.entityType === subjectType);
}

function getInitials(value: string) {
  return value.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseMemoryDateInput(value: string) {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return trimmed;
}

function isFutureDateKey(dateKey: string) {
  return dateKey > getDateKey(new Date());
}
