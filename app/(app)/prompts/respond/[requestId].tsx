import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import { SongSearchPicker } from '../../../../src/components/SongSearchPicker';
import { TextOrVoiceComposer } from '../../../../src/components/TextOrVoiceComposer';
import { DEFAULT_VOICE_RECORDING_MAX_MS, VoiceRecorder } from '../../../../src/components/VoiceRecorder';
import { VoiceMemoryCard } from '../../../../src/components/VoiceMemoryCard';
import { PolaroidIcon } from '../../../../src/components/PolaroidIcon';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { usePremium } from '../../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import { backOnce, backOrReplaceOnce, pushOnce } from '../../../../src/lib/navigationGuard';
import { compareWallPostsByMemoryDateDesc } from '../../../../src/lib/memoryDate';
import { memoryImagePickerOptions, memoryMediaPickerOptions } from '../../../../src/lib/imagePickerPresets';
import { showGalleryPaywall, showMediaMemoryPaywall, showVoiceMemoryPaywall } from '../../../../src/lib/premiumGates';
import { showPhotoSourceSheet } from '../../../../src/lib/photoSourceSheet';
import { getPromptExpirationLabel, isPromptExpired } from '../../../../src/lib/promptExpiration';
import { protectTextFromFontClipping } from '../../../../src/theme/fontProtection';
import { radius, semanticColors, spacing } from '../../../../src/theme/tokens';
import type { SongAttachment, VoiceAttachment, WallPost } from '../../../../src/types/domain';

const REGULAR_VIDEO_MAX_DURATION_MS = 5000;

export default function MemoryPromptResponseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string | string[]; capturedUri?: string | string[]; capturedVideoUri?: string | string[] }>();
  const { currentUser } = useAuth();
  const { isPremium } = usePremium();
  const { completeMemoryPromptRequest, getMemoryPromptRequestById, getUserById, getVisiblePostsByAuthor } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const requestId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
  const request = requestId ? getMemoryPromptRequestById(requestId) : undefined;
  const requester = request ? getUserById(request.requesterUserId) : undefined;
  const expired = request ? isPromptExpired(request) : false;
  const [body, setBody] = useState('');
  const [selectedSong, setSelectedSong] = useState<SongAttachment | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceAttachment | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [photoResponseType, setPhotoResponseType] = useState<'polaroid' | 'media' | null>(null);
  const [photoResponseImageUri, setPhotoResponseImageUri] = useState<string | null>(null);
  const [photoResponseVideoUri, setPhotoResponseVideoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const capturedUri = Array.isArray(params.capturedUri) ? params.capturedUri[0] : params.capturedUri;
  const capturedVideoUri = Array.isArray(params.capturedVideoUri) ? params.capturedVideoUri[0] : params.capturedVideoUri;
  const sharedPolaroids = useMemo(() => {
    if (!request || !currentUser) return [];
    const requesterPosts = getVisiblePostsByAuthor(request.requesterUserId).filter((post) => post.subjectUserId === currentUser.id);
    const myPosts = getVisiblePostsByAuthor(currentUser.id).filter((post) => post.subjectUserId === request.requesterUserId);
    return [...requesterPosts, ...myPosts]
      .filter((post, index, posts) => post.imageUri && posts.findIndex((candidate) => candidate.id === post.id) === index)
      .sort(compareWallPostsByMemoryDateDesc);
  }, [currentUser?.id, getVisiblePostsByAuthor, request?.requesterUserId]);

  useEffect(() => {
    if (!capturedUri) return;
    setPhotoResponseType('polaroid');
    setPhotoResponseImageUri(capturedUri);
    setPhotoResponseVideoUri(capturedVideoUri ?? null);
    setError('');
  }, [capturedUri, capturedVideoUri]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const header = (
    <Pressable onPress={() => backOnce(router)} style={styles.backButton}>
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  async function handleSubmit() {
    if (!request || !currentUser) return;
    if (request.promptType === 'song' && !selectedSong) {
      setError('Choose a song first.');
      return;
    }
    if (selectedVoice && !isPremium) {
      showVoiceMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    if (request.promptType === 'voice' && !selectedVoice) {
      setError('Record a voice memory first.');
      return;
    }
    if (request.promptType === 'text' && !body.trim() && !selectedVoice) {
      setError('Write or record a response first.');
      return;
    }
    if (request.promptType === 'photo_reference' && !selectedPostId) {
      setError('Choose a photo memory first.');
      return;
    }
    if (request.promptType === 'photo' && !photoResponseImageUri && !photoResponseVideoUri) {
      setError('Choose a Memory Card or media response first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await completeMemoryPromptRequest(currentUser.id, {
        requestId: request.id,
        body,
        song: selectedSong,
        voice: selectedVoice,
        responsePostType: photoResponseType,
        imageUri: photoResponseImageUri,
        videoUri: photoResponseVideoUri,
        referencedWallPostId: selectedPostId,
      });
      backOrReplaceOnce(router, `/(app)/wall/${request.requesterUserId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not answer prompt.');
      setBusy(false);
    }
  }

  function openPolaroidCamera() {
    if (!request) return;
    pushOnce(router, {
      pathname: '/(app)/camera',
      params: {
        requestId: request.id,
        returnTo: '/(app)/prompts/respond/[requestId]',
      },
    });
  }

  async function choosePolaroidFromGallery() {
    if (!isPremium) {
      showGalleryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync(memoryImagePickerOptions);
    } catch {
      Alert.alert('Gallery unavailable', 'We could not open your gallery. Try again in a moment.');
      return;
    }
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) return;
    setPhotoResponseType('polaroid');
    setPhotoResponseImageUri(asset.uri);
    setPhotoResponseVideoUri(null);
    setError('');
  }

  async function chooseMedia(source: 'camera' | 'gallery') {
    if (!isPremium) {
      showMediaMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    let result: ImagePicker.ImagePickerResult;
    try {
      result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(memoryMediaPickerOptions)
        : await ImagePicker.launchImageLibraryAsync(memoryMediaPickerOptions);
    } catch {
      Alert.alert(source === 'camera' ? 'Camera unavailable' : 'Gallery unavailable', source === 'camera' ? 'Try this on a real phone or choose from your gallery.' : 'We could not open your gallery. Try again in a moment.');
      return;
    }
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) return;
    if (asset.type === 'video' && asset.duration && asset.duration > REGULAR_VIDEO_MAX_DURATION_MS + 250) {
      Alert.alert('Video too long', 'Regular video memories can be up to 5 seconds.');
      return;
    }
    setPhotoResponseType('media');
    setPhotoResponseImageUri(asset.type === 'video' ? null : asset.uri);
    setPhotoResponseVideoUri(asset.type === 'video' ? asset.uri : null);
    setError('');
  }

  function openPhotoResponseSource(type: 'polaroid' | 'media') {
    if (type === 'polaroid') {
      showPhotoSourceSheet({
        title: 'Answer with Memory Card',
        cameraLabel: 'Take Memory Card',
        onCamera: openPolaroidCamera,
        onGallery: choosePolaroidFromGallery,
        galleryLocked: !isPremium,
      });
      return;
    }

    if (!isPremium) {
      showMediaMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    showPhotoSourceSheet({
      title: 'Answer with Media',
      cameraLabel: 'Take Photo or Video',
      galleryLabel: 'Choose Photo or Video',
      galleryLocked: false,
      onCamera: () => chooseMedia('camera'),
      onGallery: () => chooseMedia('gallery'),
    });
  }

  if (!request) {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Prompt unavailable</Text>
        <Text style={styles.subtitle}>This prompt could not be opened.</Text>
      </AppScreen>
    );
  }

  if (request.recipientUserId !== currentUser.id) {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Not your prompt</Text>
        <Text style={styles.subtitle}>This memory prompt belongs to another account.</Text>
      </AppScreen>
    );
  }

  if (request.status !== 'pending') {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Already answered</Text>
        <Text style={styles.subtitle}>This prompt has already been handled.</Text>
      </AppScreen>
    );
  }

  if (expired) {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Prompt expired</Text>
        <Text style={styles.subtitle}>This prompt was available for 7 days and can no longer be answered.</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={request.promptType === 'voice' && !isPremium ? 'Unlock Premium to answer' : busy ? 'Sending...' : 'Add to memory wall'} onPress={handleSubmit} disabled={busy} />}>
      <Text style={styles.title}>Answer Prompt</Text>
      <Text style={styles.subtitle}>
        <Text style={styles.promptAskedText}>{requester?.displayName ?? 'A friend'} asked</Text>
        {' '}you to add something to the wall.
      </Text>

      <View style={styles.promptCard}>
        <View style={styles.promptIcon}>
          <Ionicons name={iconForPromptType(request.promptType)} size={20} color={semanticColors.promptGold} />
        </View>
        <View style={styles.promptBody}>
          <Text style={styles.promptLabel}>{labelForPromptType(request.promptType)}</Text>
          <Text style={styles.expirationText}>{getPromptExpirationLabel(request.expiresAt)}</Text>
          <Text style={styles.promptText}>{request.promptText}</Text>
          {request.promptVoice ? (
            <VoiceMemoryCard
              voice={request.promptVoice}
              postId={`prompt:${request.id}`}
              authorName={requester?.displayName ?? 'A friend'}
              themeColors={colors}
              variant="embedded"
              label="Voice prompt"
              preview
            />
          ) : null}
        </View>
      </View>

      {request.promptType === 'song' ? (
        <View style={styles.section}>
          <SongSearchPicker selectedSong={selectedSong} onSelect={setSelectedSong} onRemove={() => setSelectedSong(null)} />
        </View>
      ) : null}

      {request.promptType === 'voice' ? (
        <View style={styles.section}>
          {!isPremium ? (
            <View style={styles.premiumNotice}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.accent} />
              <Text style={styles.premiumNoticeText}>Voice prompt responses are a Premium feature.</Text>
            </View>
          ) : (
            <VoiceRecorder
              value={selectedVoice}
              onChange={(voice) => {
                setSelectedVoice(voice);
                setError('');
              }}
              maxDurationMs={DEFAULT_VOICE_RECORDING_MAX_MS}
              previewAuthorName={currentUser.displayName}
              helperText="Record a voice memory to answer this prompt."
            />
          )}
        </View>
      ) : null}

      {request.promptType === 'photo' ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Answer with a photo</Text>
          <View style={styles.photoAnswerRow}>
            <Pressable
              onPress={() => openPhotoResponseSource('polaroid')}
              style={[styles.photoAnswerCard, photoResponseType === 'polaroid' && styles.photoAnswerCardActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: photoResponseType === 'polaroid' }}
            >
              <PolaroidIcon size={28} color={photoResponseType === 'polaroid' ? colors.white : colors.accent} />
              <Text style={[styles.photoAnswerLabel, photoResponseType === 'polaroid' && styles.photoAnswerLabelActive]}>Memory Card</Text>
            </Pressable>
            <Pressable
              onPress={() => openPhotoResponseSource('media')}
              style={[styles.photoAnswerCard, photoResponseType === 'media' && styles.photoAnswerCardActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: photoResponseType === 'media' }}
            >
              <Ionicons name="camera-outline" size={29} color={photoResponseType === 'media' ? colors.white : colors.accent} />
              <Text style={[styles.photoAnswerLabel, photoResponseType === 'media' && styles.photoAnswerLabelActive]}>Media</Text>
            </Pressable>
          </View>
          {photoResponseImageUri || photoResponseVideoUri ? (
            <View style={styles.photoResponsePreview}>
              {photoResponseImageUri ? (
                <Image source={{ uri: photoResponseImageUri }} style={styles.photoResponseImage} />
              ) : (
                <View style={styles.photoResponseVideoPreview}>
                  <Ionicons name="play-circle-outline" size={38} color={colors.ink} />
                  <Text style={styles.helperText}>Video selected</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.helperText}>They can answer with a new Memory Card or a regular photo/video memory.</Text>
          )}
        </View>
      ) : null}

      {request.promptType === 'photo_reference' ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose a photo memory</Text>
          <View style={styles.photoGrid}>
            {sharedPolaroids.length > 0 ? sharedPolaroids.map((post) => (
              <PhotoChoice key={post.id} post={post} selected={selectedPostId === post.id} onPress={() => setSelectedPostId(post.id)} />
            )) : (
              <Text style={styles.helperText}>No shared photo memories yet. Try a song or text prompt instead.</Text>
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <TextOrVoiceComposer
          label={request.promptType === 'text' ? 'Your answer' : request.promptType === 'voice' || request.promptType === 'photo' ? 'Optional caption' : 'Optional note'}
          text={body}
          onTextChange={setBody}
          voice={request.promptType === 'voice' ? null : selectedVoice}
          onVoiceChange={(voice) => {
            setSelectedVoice(voice);
            setError('');
          }}
          placeholder={request.promptType === 'song' ? 'Why this song?' : request.promptType === 'photo' ? 'Add a caption for your photo...' : request.promptType === 'photo_reference' ? 'Why this photo memory?' : request.promptType === 'voice' ? 'Add a caption for your voice memory...' : 'Write your memory...'}
          previewAuthorName={currentUser.displayName}
          allowVoice={request.promptType !== 'voice'}
          voiceLabel="Voice note"
          voiceHelperText="Record a voice note instead of typing."
          textInputStyle={styles.responseInput}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

function PhotoChoice({ post, selected, onPress }: { post: WallPost; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[photoChoiceStyles.choice, { borderColor: selected ? colors.accent : colors.line, backgroundColor: colors.paper }]} accessibilityRole="button" accessibilityState={{ selected }}>
      {post.imageUri ? <Image source={{ uri: post.imageUri }} style={photoChoiceStyles.image} /> : null}
      {selected ? (
        <View style={[photoChoiceStyles.check, { backgroundColor: colors.accent }]}>
          <Ionicons name="checkmark" size={14} color={colors.white} />
        </View>
      ) : null}
    </Pressable>
  );
}

function iconForPromptType(promptType: string) {
  if (promptType === 'photo') return 'camera-outline' as const;
  if (promptType === 'photo_reference') return 'images-outline' as const;
  if (promptType === 'text') return 'chatbubble-ellipses-outline' as const;
  if (promptType === 'voice') return 'mic-outline' as const;
  return 'musical-notes-outline' as const;
}

function labelForPromptType(promptType: string) {
  if (promptType === 'photo') return 'Photo prompt';
  if (promptType === 'photo_reference') return 'Photo prompt';
  if (promptType === 'text') return 'Text prompt';
  if (promptType === 'voice') return 'Voice answer requested';
  return 'Song prompt';
}

const photoChoiceStyles = StyleSheet.create({
  choice: { width: 96, height: 116, borderRadius: radius.md, borderWidth: 2, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  check: { position: 'absolute', right: 6, top: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) => StyleSheet.create({
  backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
  backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  section: { gap: spacing.sm },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
  promptCard: { flexDirection: 'row', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md },
  promptIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: semanticColors.promptGold + '18', alignItems: 'center', justifyContent: 'center' },
  promptBody: { flex: 1, gap: spacing.xs },
  promptLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: semanticColors.promptGold, textTransform: 'uppercase', letterSpacing: 0.7 },
  expirationText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent },
  promptAskedText: { fontFamily: fonts.bodyBold, color: semanticColors.promptGold },
  promptText: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 27, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 22) },
  premiumNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.paper, padding: spacing.md },
  premiumNoticeText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.ink },
  responseInput: { minHeight: 120, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  photoAnswerRow: { flexDirection: 'row', gap: spacing.sm },
  photoAnswerCard: { flex: 1, minHeight: 92, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.md },
  photoAnswerCardActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  photoAnswerLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
  photoAnswerLabelActive: { color: colors.white },
  photoResponsePreview: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, overflow: 'hidden' },
  photoResponseImage: { width: '100%', height: 260 },
  photoResponseVideoPreview: { height: 180, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  helperText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.inkMuted },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
});
