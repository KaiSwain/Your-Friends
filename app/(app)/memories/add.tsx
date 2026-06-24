import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { DateDropdownPicker } from '../../../src/components/DateDropdownPicker';
import { MemoryLocationPicker } from '../../../src/components/MemoryLocationPicker';
import { MemoryPromptPicker } from '../../../src/components/MemoryPromptPicker';
import { MemoryTextStylePicker } from '../../../src/components/MemoryTextStylePicker';
import { PolaroidIcon } from '../../../src/components/PolaroidIcon';
import { SongSearchPicker } from '../../../src/components/SongSearchPicker';
import { TextOrVoiceComposer } from '../../../src/components/TextOrVoiceComposer';
import { DEFAULT_VOICE_RECORDING_MAX_MS } from '../../../src/components/VoiceRecorder';
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
import { normalizeLocationName } from '../../../src/lib/memoryLocation';
import { extractAssetMemoryDateKey } from '../../../src/lib/memoryExifDate';
import { resolveImportedAssetMetadata } from '../../../src/lib/memoryAssetMetadata';
import { reverseGeocodeLocationLabel } from '../../../src/lib/memoryLocationSearch';
import { memoryImagePickerOptions, memoryMediaPickerOptions } from '../../../src/lib/imagePickerPresets';
import { backOnce, dismissToOnce, pushOnce, replaceOnce, shouldPopForBackTarget } from '../../../src/lib/navigationGuard';
import { showAiCaptionPaywall, showGalleryPaywall, showMediaMemoryPaywall } from '../../../src/lib/premiumGates';
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
import { Contact, CreateWallPostInput, PeopleListItem, SongAttachment, VoiceAttachment, WallPost, WallPostTextColor, WallPostTextEffect, WallPostTextFont, WallPostTextSize, WallPostVisibility } from '../../../src/types/domain';

type MemoryKind = 'note' | 'media' | 'photo' | 'song';
type PhotoSource = 'camera' | 'gallery' | null;

const REGULAR_VIDEO_MAX_DURATION_MS = 30000;

export default function AddMemoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId: string | string[]; subjectType: string | string[]; targetKeys: string | string[]; capturedUri: string | string[]; capturedVideoUri: string | string[]; mediaUri: string | string[]; mediaType: string | string[]; returnTo: string | string[]; backTo: string | string[]; kind: string | string[] }>();
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
  // Memories happen in the past, so let the date dropdown reach years back and cap at today.
  const memoryDateMinDate = useMemo(() => {
    const earliest = new Date();
    earliest.setFullYear(earliest.getFullYear() - 30);
    return earliest;
  }, []);
  const [selectedSong, setSelectedSong] = useState<SongAttachment | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceAttachment | null>(null);
  const [composerMode, setComposerMode] = useState<'text' | 'voice'>('text');
  const [songPreviewRequestKey, setSongPreviewRequestKey] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<WallPostVisibility>('visible_to_subject');
  const [locationNameInput, setLocationNameInput] = useState('');
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
  // Extra styling options stay hidden behind toggles to keep the composer clean.
  const [enableLocation, setEnableLocation] = useState(false);
  const [enableTextStyle, setEnableTextStyle] = useState(false);
  const [enableCardColor, setEnableCardColor] = useState(false);

  const toggleLocation = useCallback((on: boolean) => {
    setEnableLocation(on);
    if (!on) setLocationNameInput('');
  }, []);
  const toggleTextStyle = useCallback((on: boolean) => {
    setEnableTextStyle(on);
    if (!on) {
      setTextFont(defaultWallPostTextFont);
      setTextSize(defaultWallPostTextSize);
      setTextEffect(defaultWallPostTextEffect);
      setTextColor(defaultWallPostTextColor);
    }
  }, []);
  const toggleCardColor = useCallback((on: boolean) => {
    setEnableCardColor(on);
    if (!on) setCardColor(null);
  }, []);
  const [enableSong, setEnableSong] = useState(false);
  const toggleSong = useCallback((on: boolean) => {
    setEnableSong(on);
    if (!on) {
      setSelectedSong(null);
      setSongPreviewRequestKey(null);
    }
  }, []);
  const [enableSongNote, setEnableSongNote] = useState(false);
  const toggleSongNote = useCallback((on: boolean) => {
    setEnableSongNote(on);
    if (!on) {
      setBody('');
      setSelectedVoice(null);
    }
  }, []);
  const [enableMediaCaption, setEnableMediaCaption] = useState(false);
  const toggleMediaCaption = useCallback((on: boolean) => {
    setEnableMediaCaption(on);
    if (!on) {
      setBody('');
      setSelectedVoice(null);
    }
  }, []);
  const [enableMemoryDate, setEnableMemoryDate] = useState(false);
  const toggleMemoryDate = useCallback((on: boolean) => {
    setEnableMemoryDate(on);
    if (!on) setMemoryDateInput(getDateKey(new Date()));
  }, []);

  const onFlip = useCallback((back: boolean) => setShowingBack(back), []);

  const textInputTypography = useMemo(
    () => (memoryKind === 'note' && !imageUri && !videoUri ? resolveWallPostTextStyle(fonts, textFont, textSize) : null),
    [fonts, imageUri, memoryKind, textFont, textSize, videoUri],
  );
  const selectedTextColor = useMemo(() => resolveWallPostTextColor(textColor, colors), [colors, textColor]);
  // Pick up photo from Polaroid camera screen
  const capturedUri = Array.isArray(params.capturedUri) ? params.capturedUri[0] : params.capturedUri;
  const capturedVideoUri = Array.isArray(params.capturedVideoUri) ? params.capturedVideoUri[0] : params.capturedVideoUri;
  const mediaUri = Array.isArray(params.mediaUri) ? params.mediaUri[0] : params.mediaUri;
  const mediaType = Array.isArray(params.mediaType) ? params.mediaType[0] : params.mediaType;
  const initialKind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  useEffect(() => {
    if (capturedUri) {
      setImageUri(capturedUri);
      setVideoUri(capturedVideoUri ?? null);
      if (capturedVideoUri) setVideoMuted(false);
      setSelectedVoice(null);
      setSelectedSong(null);
      setSongPreviewRequestKey(null);
      setPhotoSource('camera');
      setMemoryKind('photo');
    }
  }, [capturedUri, capturedVideoUri]);

  useEffect(() => {
    if (mediaUri) {
      if (!isPremium) {
        showMediaMemoryPaywall(() => pushOnce(router, '/(app)/store'));
        if (shouldPopForBackTarget(backTo)) {
          backOnce(router);
          return;
        }
        replaceOnce(router, backTo ? (backTo as any) : '/friends');
        return;
      }
      const isVideo = mediaType === 'video';
      setImageUri(isVideo ? null : mediaUri);
      setVideoUri(isVideo ? mediaUri : null);
      setVideoMuted(false);
      setSelectedVoice(null);
      setSelectedSong(null);
      setSongPreviewRequestKey(null);
      setPhotoSource('camera');
      setMemoryKind('media');
      setShowingBack(false);
      setFilter(null);
      setDateStamp(false);
      setBackText('');
      return;
    }

    if (initialKind === 'media' && !isPremium) {
      showMediaMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }

    if (initialKind === 'media' || initialKind === 'photo' || initialKind === 'note' || initialKind === 'song') {
      setMemoryKind(initialKind);
    }
  }, [backTo, initialKind, isPremium, mediaType, mediaUri, router]);

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
      if (shouldPopForBackTarget(backTo)) {
        backOnce(router);
        return;
      }
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

  function applyMemoryPrompt(prompt: MemoryPrompt) {
    setError('');
    setShowingBack(false);
    setMemoryKind('note');
    setImageUri(null);
    setVideoUri(null);
    setVideoMuted(false);
    setSelectedVoice(null);
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
      personalityTraits: [...(contact?.personalityTraits ?? []), ...(user?.profilePersonalityTraits ?? [])],
      relationshipTags: contact?.tags ?? [],
      previousMemoryCount,
    };
  }

  // Date a camera-roll import to when the photo was actually taken (from EXIF),
  // revealing the date control pre-filled so the user can confirm or tweak it.
  // Falls back to today when there's no usable metadata or it's a fresh capture.
  function applyImportedMemoryDate(asset: ImagePicker.ImagePickerAsset | null) {
    const detected = asset ? extractAssetMemoryDateKey(asset) : null;
    if (detected) {
      setMemoryDateInput(detected);
      setEnableMemoryDate(true);
    } else {
      setMemoryDateInput(getDateKey(new Date()));
    }
  }

  // Auto-fill the date and location of a camera-roll import from the photo's
  // library metadata (with an EXIF fallback). iOS strips EXIF GPS from picked
  // images, so the date/location come from expo-media-library by assetId. This
  // is async and best-effort: it quietly refines the pre-filled date and reveals
  // the location control when a place is found.
  function applyImportedAssetMetadata(asset: ImagePicker.ImagePickerAsset | null) {
    if (!asset) return;
    void resolveImportedAssetMetadata(asset)
      .then(async ({ dateKey, coords }) => {
        if (dateKey) {
          setMemoryDateInput(dateKey);
          setEnableMemoryDate(true);
        }
        if (coords) {
          const label = await reverseGeocodeLocationLabel(coords.latitude, coords.longitude);
          if (label) {
            setLocationNameInput(label);
            setEnableLocation(true);
          }
        }
      })
      .catch(() => {});
  }

  async function pickGalleryPhoto() {
    if (!isPremium) {
      showGalleryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync(memoryImagePickerOptions);
    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setVideoUri(null);
      setVideoMuted(false);
      setPhotoSource('gallery');
      applyImportedMemoryDate(asset);
      applyImportedAssetMetadata(asset);
      setMemoryKind('photo');
      setShowingBack(false);
    }
  }

  async function pickRegularMedia(source: 'camera' | 'gallery') {
    if (!isPremium) {
      showMediaMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera access needed',
          'Allow camera access so you can take a photo or video for this memory. You can turn it on in Settings.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
          ],
        );
        return;
      }
    }

    let result: ImagePicker.ImagePickerResult;
    try {
      result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(memoryMediaPickerOptions)
        : await ImagePicker.launchImageLibraryAsync(memoryMediaPickerOptions);
    } catch {
      Alert.alert('Camera unavailable', 'The camera is not available on this device. Try this on a real phone or choose from your gallery.');
      return;
    }
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) return;

    if (asset.type === 'video') {
      const durationMs = asset.duration ?? null;
      if (durationMs && durationMs > REGULAR_VIDEO_MAX_DURATION_MS + 250) {
        Alert.alert('Video too long', 'Regular video memories can be up to 30 seconds.');
        return;
      }
      setImageUri(null);
      setVideoUri(asset.uri);
      setVideoMuted(false);
    } else {
      setImageUri(asset.uri);
      setVideoUri(null);
      setVideoMuted(false);
    }
    setSelectedSong(null);
    setSongPreviewRequestKey(null);
    setPhotoSource(source);
    applyImportedMemoryDate(source === 'gallery' ? asset : null);
    applyImportedAssetMetadata(source === 'gallery' ? asset : null);
    setMemoryKind('media');
    setShowingBack(false);
    setFilter(null);
    setDateStamp(false);
    setBackText('');
    setError('');
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
      memoryDate: useCustomMemoryDate ? (parseMemoryDateInput(memoryDateInput) ?? new Date().toISOString()) : new Date().toISOString(),
      draftCaption: body.trim() || null,
      relationshipTags: contact?.tags ?? [],
      personalityTraits: [...(contact?.personalityTraits ?? []), ...(user?.profilePersonalityTraits ?? [])],
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
    const isMediaMemory = memoryKind === 'media';
    const isPolaroidMemory = memoryKind === 'photo';
    if (isSongMemory && !selectedSong) { setError('Choose a song to add to the wall.'); return; }
    if (!isSongMemory && !body.trim() && !imageUri && !videoUri && !selectedVoice) { setError('Add media, write something, or record voice.'); return; }
    if (isMediaMemory && !isPremium) {
      showMediaMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    if (isMediaMemory && !imageUri && !videoUri) { setError('Add a photo or video.'); return; }
    if (selectedTargets.length === 0) { setError('Choose at least one wall.'); return; }
    const selectedMemoryDate = useCustomMemoryDate ? parseMemoryDateInput(memoryDateInput) : null;
    if (useCustomMemoryDate && !selectedMemoryDate) { setError('Choose a valid memory date like 2026-05-15.'); return; }
    if (selectedMemoryDate && isFutureDateKey(selectedMemoryDate)) { setError('Memory dates cannot be in the future.'); return; }
    setError('');
    const postType = isSongMemory ? 'song' : isMediaMemory ? 'media' : isPolaroidMemory && imageUri ? 'polaroid' : 'note';
    const locationName = normalizeLocationName(locationNameInput);

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
        cardColor: isPolaroidMemory && imageUri ? cardColor : null,
        backText: isPolaroidMemory && imageUri ? (backText.trim() || null) : null,
        filter: isPolaroidMemory && imageUri ? filter : null,
        textFont: postType === 'note' ? textFont : null,
        textSize: postType === 'note' ? textSize : null,
        textEffect: postType === 'note' ? textEffect : null,
        textColor: postType === 'note' ? textColor : null,
        dateStamp: isPolaroidMemory && !!imageUri && dateStamp,
        song: selectedSong,
        voice: selectedVoice,
        memoryDate: selectedMemoryDate,
        locationName,
      };
    });

    try {
      await addMemory.mutateAsync({
        authorUserId: authenticatedUser.id,
        imageUri: isSongMemory ? null : imageUri,
        videoUri: isSongMemory ? null : videoUri,
        videoMuted: !!videoUri && videoMuted,
        audioUri: selectedVoice?.uri ?? null,
        audioDurationMs: selectedVoice?.durationMs ?? null,
        memoryDate: selectedMemoryDate,
        posts,
      });

      if (selectedTargets.length > 1) {
        if (shouldPopForBackTarget(backTo)) backOnce(router);
        else if (backTo) dismissToOnce(router, backTo as any);
        else replaceOnce(router, '/friends');
        return;
      }

      const target = selectedTargets[0];
      if (shouldPopForBackTarget(backTo)) {
        backOnce(router);
        return;
      }
      replaceOnce(router, getPostSaveProfileDestination(target, contacts, authenticatedUser.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  const isMediaMemory = memoryKind === 'media';
  const isPolaroidMemory = memoryKind === 'photo';
  const hasMediaAsset = !!(imageUri || videoUri);
  const isMediaChoiceAwaitingSource = (isPolaroidMemory || isMediaMemory) && !hasMediaAsset;
  const previewPostType = memoryKind === 'song' ? 'song' : isMediaMemory ? 'media' : isPolaroidMemory && imageUri ? 'polaroid' : 'note';
  const hasPreview = isMediaChoiceAwaitingSource
    ? false
    : memoryKind === 'song'
      ? !!selectedSong || !!selectedVoice || !!body.trim()
      : !!(body.trim() || imageUri || videoUri || selectedSong || selectedVoice);
  const hasPolaroidInState = memoryKind === 'photo' && !!imageUri;
  const inputLabel = memoryKind === 'song'
    ? 'Song Note'
    : showingBack
      ? 'Back of Card'
      : isPolaroidMemory && imageUri
        ? 'Front Caption'
        : isMediaMemory
          ? 'Caption'
        : 'Memory Note';
  const inputPlaceholder = memoryKind === 'song'
    ? 'Why does this song belong here?'
    : showingBack
      ? 'Write something on the back...'
      : 'What do you want to remember?';
  const showSongPicker = memoryKind === 'song' || memoryKind === 'note' || (memoryKind === 'photo' && !!imageUri);
  const showMemoryPromptPicker = memoryKind === 'note' && composerMode === 'text' && !showingBack && !hasPolaroidInState;
  const showComposer = !isMediaChoiceAwaitingSource
    && (memoryKind !== 'song' || enableSongNote)
    && (!isMediaMemory || enableMediaCaption);
  // Premium users can backdate any memory; the picker stays hidden behind a slider.
  const canChooseMemoryDate = isPremium;
  const useCustomMemoryDate = canChooseMemoryDate && enableMemoryDate;

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

      <View style={styles.visibilityRow}>
        <Text style={styles.visibilityLabel}>Add location</Text>
        <Switch
          value={enableLocation}
          onValueChange={toggleLocation}
          trackColor={{ false: colors.line, true: colors.accent }}
          thumbColor={colors.white}
        />
      </View>
      {enableLocation ? (
        <MemoryLocationPicker value={locationNameInput} onChange={setLocationNameInput} />
      ) : null}

      {canChooseMemoryDate ? (
        <View style={styles.visibilityRow}>
          <Text style={styles.visibilityLabel}>Change date</Text>
          <Switch
            value={enableMemoryDate}
            onValueChange={toggleMemoryDate}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={colors.white}
          />
        </View>
      ) : null}

      {useCustomMemoryDate ? (
      <View style={styles.memoryDateSection}>
        <View style={styles.memoryDateHeader}>
          <View style={styles.memoryDateCopy}>
            <Text style={styles.memoryDateLabel}>Memory Date</Text>
            <Text style={styles.memoryDateHint}>
              Choose when this memory happened.
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
        <DateDropdownPicker
          label="Memory date"
          value={memoryDateInput}
          onChange={setMemoryDateInput}
          minDate={memoryDateMinDate}
          maxYearOffset={30}
        />
      </View>
      ) : null}

      {showMemoryPromptPicker ? (
        <MemoryPromptPicker prompts={memoryPrompts} onSelectPrompt={applyMemoryPrompt} />
      ) : null}

      {showSongPicker && memoryKind !== 'song' ? (
        <View style={styles.visibilityRow}>
          <Text style={styles.visibilityLabel}>Add a song</Text>
          <Switch
            value={enableSong}
            onValueChange={toggleSong}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={colors.white}
          />
        </View>
      ) : null}

      {showSongPicker && (memoryKind === 'song' || enableSong) ? (
        <SongSearchPicker
          selectedSong={selectedSong}
          onSelect={(song) => {
            setSelectedSong(song);
            if (memoryKind === 'note' || memoryKind === 'song') {
              setMemoryKind('song');
              // Keep any note the user already wrote visible after it becomes a song memory.
              if (body.trim() || selectedVoice) setEnableSongNote(true);
            }
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
            if (memoryKind === 'song') setMemoryKind('note');
          }}
        />
      ) : null}

      {hasPreview && (
        <View style={styles.previewSection}>
          <WallPostCard
            authorName={authenticatedUser.displayName}
            cardColor={isPolaroidMemory && imageUri ? cardColor : null}
            preview
            onFlip={isPolaroidMemory && imageUri ? onFlip : undefined}
            autoPlaySongPreviewKey={songPreviewRequestKey}
            post={{
              id: 'preview',
              authorUserId: authenticatedUser.id,
              subjectUserId: primarySubjectType === 'user' ? (primarySubjectId ?? null) : null,
              subjectContactId: primarySubjectType === 'contact' ? (primarySubjectId ?? null) : null,
              visibility,
              postType: previewPostType,
              body: body.trim(),
              cardColor: isPolaroidMemory && imageUri ? cardColor : null,
              backText: isPolaroidMemory && imageUri ? (backText.trim() || null) : null,
              imageUri: memoryKind === 'song' ? null : imageUri,
              videoUri: memoryKind === 'song' ? null : videoUri,
              videoMuted: memoryKind === 'song' ? false : !!videoUri && videoMuted,
              memoryDate: useCustomMemoryDate ? parseMemoryDateInput(memoryDateInput) : null,
              createdAt: new Date().toISOString(),
              filter: isPolaroidMemory && imageUri ? filter : null,
              textFont: previewPostType === 'note' ? textFont : null,
              textSize: previewPostType === 'note' ? textSize : null,
              textEffect: previewPostType === 'note' ? textEffect : null,
              textColor: previewPostType === 'note' ? textColor : null,
              dateStamp: isPolaroidMemory && !!imageUri && dateStamp,
              song: selectedSong,
              voice: selectedVoice,
              locationName: normalizeLocationName(locationNameInput),
            }}
          />
          {(imageUri || videoUri) ? (
            <Text style={styles.previewHint}>
              {isMediaMemory
                ? 'Regular media will appear as a clean photo/video memory, not a Memory Card.'
                : normalizeLocationName(locationNameInput)
                ? 'Tap the card to flip — location is on the back'
                : videoUri
                  ? 'Preview the Live Memory Card, retake its cover, or add a photo filter below.'
                  : 'Tap card to flip'}
            </Text>
          ) : null}
        </View>
      )}

      {memoryKind === 'song' ? (
        <View style={styles.visibilityRow}>
          <Text style={styles.visibilityLabel}>Add a note</Text>
          <Switch
            value={enableSongNote}
            onValueChange={toggleSongNote}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={colors.white}
          />
        </View>
      ) : null}

      {isMediaMemory && hasMediaAsset ? (
        <View style={styles.visibilityRow}>
          <Text style={styles.visibilityLabel}>Add a caption</Text>
          <Switch
            value={enableMediaCaption}
            onValueChange={toggleMediaCaption}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={colors.white}
          />
        </View>
      ) : null}

      {showComposer ? (
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
          {showingBack ? (
            <TextInput
              multiline
              onChangeText={setBackText}
              placeholder={inputPlaceholder}
              placeholderTextColor={colors.ink}
              style={styles.textInput}
              value={backText}
            />
          ) : (
            <TextOrVoiceComposer
              text={body}
              onTextChange={setBody}
              voice={selectedVoice}
              onVoiceChange={(voice) => {
                setSelectedVoice(voice);
                setError('');
              }}
              placeholder={inputPlaceholder}
              previewAuthorName={authenticatedUser.displayName}
              voiceLabel="Voice note"
              voiceHelperText="Record voice instead of typing."
              maxVoiceMs={DEFAULT_VOICE_RECORDING_MAX_MS}
              textInputStyle={[styles.textInput, memoryKind === 'note' && !imageUri && !videoUri && textInputTypography, memoryKind === 'note' && !imageUri && !videoUri && { color: selectedTextColor }]}
              onModeChange={setComposerMode}
            />
          )}
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
      ) : null}

      {memoryKind === 'note' && !imageUri && !videoUri ? (
        <>
          <View style={styles.visibilityRow}>
            <Text style={styles.visibilityLabel}>Customize text style</Text>
            <Switch
              value={enableTextStyle}
              onValueChange={toggleTextStyle}
              trackColor={{ false: colors.line, true: colors.accent }}
              thumbColor={colors.white}
            />
          </View>
          {enableTextStyle ? (
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
        </>
      ) : null}

      {memoryKind === 'media' ? <View style={styles.photoRow}>
        {!imageUri && !videoUri ? (
          <>
            <Pressable onPress={() => pickRegularMedia('camera')} style={styles.photoOption}>
              <Ionicons name="camera-outline" size={28} color={colors.ink} />
              <Text style={styles.photoOptionLabel}>Camera</Text>
            </Pressable>
            <Pressable onPress={() => pickRegularMedia('gallery')} style={[styles.photoOption, !isPremium && styles.photoOptionLocked]}>
              <Ionicons name={isPremium ? 'images-outline' : 'lock-closed-outline'} size={28} color={colors.ink} />
              <Text style={styles.photoOptionLabel}>Gallery</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => { setImageUri(null); setVideoUri(null); setVideoMuted(false); setPhotoSource(null); }} style={styles.changePhotoButton}>
              <Text style={styles.changePhotoLabel}>{videoUri ? 'Remove Video' : 'Remove Photo'}</Text>
            </Pressable>
            <Pressable onPress={() => pickRegularMedia('camera')} style={styles.changePhotoButton}>
              <Text style={styles.changePhotoLabel}>Retake</Text>
            </Pressable>
            <Pressable onPress={() => pickRegularMedia('gallery')} style={styles.changePhotoButton}>
              <Text style={styles.changePhotoLabel}>Choose Different</Text>
            </Pressable>
          </>
        )}
      </View> : null}

      {memoryKind === 'photo' ? <View style={styles.photoRow}>
        {!imageUri && (
          <Pressable onPress={openCamera} style={styles.photoOption}>
            <PolaroidIcon size={28} color={colors.ink} />
            <Text style={styles.photoOptionLabel}>Memory Card Camera</Text>
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

      {isPolaroidMemory && imageUri && videoUri ? (
        <View style={styles.dateStampSection}>
          <Pressable onPress={() => setVideoMuted((muted) => !muted)} style={styles.dateStampToggle}>
            <Ionicons name={videoMuted ? 'checkbox' : 'square-outline'} size={20} color={videoMuted ? colors.accent : colors.ink} />
            <Text style={[styles.dateStampLabel, videoMuted && styles.dateStampLabelActive]}>Turn off audio for this Live Memory Card</Text>
          </Pressable>
        </View>
      ) : null}

      {isPolaroidMemory && imageUri && (
        <View style={styles.dateStampSection}>
          <Pressable onPress={() => setDateStamp((d) => !d)} style={styles.dateStampToggle}>
            <Ionicons name={dateStamp ? 'checkbox' : 'square-outline'} size={20} color={dateStamp ? colors.accent : colors.ink} />
            <Text style={[styles.dateStampLabel, dateStamp && styles.dateStampLabelActive]}>Add date stamp to photo</Text>
          </Pressable>
        </View>
      )}

      {isPolaroidMemory && imageUri && (
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

      {isPolaroidMemory && imageUri && (
        <View style={styles.visibilityRow}>
          <Text style={styles.visibilityLabel}>Customize card color</Text>
          <Switch
            value={enableCardColor}
            onValueChange={toggleCardColor}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={colors.white}
          />
        </View>
      )}

      {isPolaroidMemory && imageUri && enableCardColor && (
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
    backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
    backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 28) },
    subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
    targetSection: { gap: spacing.xs },
    targetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    targetLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
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
      backgroundColor: colors.paper,
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
    targetChipText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
    targetChipTextActive: { fontFamily: fonts.bodyBold, color: colors.ink },
    photoRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
    photoOption: {
      width: 100, height: 100, borderRadius: radius.md, backgroundColor: colors.paper,
      borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    },
    photoOptionLocked: { opacity: 0.9 },
    photoOptionIcon: { fontSize: 28 },
    photoOptionLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
    changePhotoButton: {
      paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
      borderWidth: 1, borderColor: colors.line,
    },
    changePhotoLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
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
    memoryDateLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
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
    memoryDateChipActive: { borderColor: colors.accent, backgroundColor: colors.paper },
    memoryDateChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
    memoryDateChipTextActive: { fontFamily: fonts.bodyBold, color: colors.accent },
    memoryDateLockedButton: {
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
    },
    memoryDateLockedText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
    colorSection: { gap: spacing.xs },
    colorLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    colorRow: { flexDirection: 'row' as const, gap: spacing.sm, flexWrap: 'wrap' as const },
    colorSwatch: {
      width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    colorSwatchLocked: { opacity: 0.45 },
    colorCheck: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.ink },
    previewSection: { gap: spacing.sm, alignItems: 'center' as const },
    previewLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, textTransform: 'uppercase', letterSpacing: 0.5 },
    previewHint: { fontFamily: fonts.body, fontSize: 12, color: colors.ink, textAlign: 'center' as const },
    inputSection: { gap: spacing.xs },
    inputHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    inputLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    aiButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.paper,
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
    toneChipActive: { borderColor: colors.accent, backgroundColor: colors.paper },
    toneChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
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
    captionSuggestionActive: { borderColor: colors.accent, backgroundColor: colors.paper },
    captionSuggestionText: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.ink },
    filterSection: { gap: spacing.xs },
    filterLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
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
    dateStampLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
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

function getPostSaveProfileDestination(
  target: PeopleListItem,
  contacts: Contact[],
  currentUserId: string,
) {
  if (target.entityType === 'contact') {
    return { pathname: '/(app)/profiles/contact/[contactId]', params: { contactId: target.id } } as const;
  }

  const linkedContact = contacts.find((contact) => contact.ownerUserId === currentUserId && contact.linkedUserId === target.id);
  if (linkedContact) {
    return { pathname: '/(app)/profiles/contact/[contactId]', params: { contactId: linkedContact.id } } as const;
  }

  return { pathname: '/(app)/profiles/user/[userId]', params: { userId: target.id } } as const;
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
