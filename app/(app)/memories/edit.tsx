import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { MemoryLocationPicker } from '../../../src/components/MemoryLocationPicker';
import { MemoryTextStylePicker } from '../../../src/components/MemoryTextStylePicker';
import { SongSearchPicker } from '../../../src/components/SongSearchPicker';
import { TextOrVoiceComposer } from '../../../src/components/TextOrVoiceComposer';
import { WallPostCard } from '../../../src/components/WallPostCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { usePremium } from '../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { AI_CAPTION_TONES, AiCaptionContext, AiCaptionTone, generateAiCaptions } from '../../../src/lib/aiCaptions';
import { backOnce, pushOnce } from '../../../src/lib/navigationGuard';
import { uploadMemoryAudio } from '../../../src/lib/memoryMediaUpload';
import { normalizeLocationName } from '../../../src/lib/memoryLocation';
import { getCureProgress } from '../../../src/lib/polaroidCure';
import { showAiCaptionPaywall } from '../../../src/lib/premiumGates';
import { canDeleteWallPost, canEditWallPostContent } from '../../../src/lib/wallPostPermissions';
import {
  defaultWallPostTextColor,
  defaultWallPostTextEffect,
  defaultWallPostTextFont,
  defaultWallPostTextSize,
  encodeWallPostTextStyle,
  resolveWallPostTextColor,
  resolveWallPostTextStyle,
} from '../../../src/lib/wallPostTextStyle';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import type { FontSet } from '../../../src/theme/typography';
import { ThemedGlyph } from '../../../src/components/ThemedGlyph';
import { radius, spacing } from '../../../src/theme/tokens';
import { CreateWallPostInput, PeopleListItem, SongAttachment, WallPost, WallPostTextColor, WallPostTextEffect, WallPostTextFont, WallPostTextSize, WallPostVisibility } from '../../../src/types/domain';
import type { VoiceAttachment } from '../../../src/types/domain';

export default function EditMemoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId: string | string[] }>();
  const { currentUser } = useAuth();
  const {
    contacts,
    wallPosts,
    getWallPostById,
    updateWallPost,
    deleteWallPost,
    addWallPost,
    getUserById,
    getContactById,
    getWallPostsForSubject,
    getPrivateNotesForContact,
    getPrivateNoteBlocks,
    getFriendFactsFor,
    getPeopleListForUser,
  } = useSocialGraph();
  const { isPremium } = usePremium();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const post = getWallPostById(postId ?? '');

  const [body, setBody] = useState(post?.body ?? '');
  const [backText, setBackText] = useState(post?.backText ?? '');
  const [visibility, setVisibility] = useState<WallPostVisibility>(post?.visibility ?? 'private');
  const [showingBack, setShowingBack] = useState(false);
  const [textFont, setTextFont] = useState<WallPostTextFont>(post?.textFont ?? defaultWallPostTextFont);
  const [textSize, setTextSize] = useState<WallPostTextSize>(post?.textSize ?? defaultWallPostTextSize);
  const [textEffect, setTextEffect] = useState<WallPostTextEffect>(post?.textEffect ?? defaultWallPostTextEffect);
  const [textColor, setTextColor] = useState<WallPostTextColor>(post?.textColor ?? defaultWallPostTextColor);
  const [selectedSong, setSelectedSong] = useState<SongAttachment | null>(post?.song ?? null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceAttachment | null>(post?.voice ?? null);
  const [songPreviewRequestKey, setSongPreviewRequestKey] = useState<string | null>(null);
  const [videoMuted, setVideoMuted] = useState(post?.videoMuted ?? false);
  const [locationNameInput, setLocationNameInput] = useState(post?.locationName ?? '');
  const [captionTone, setCaptionTone] = useState<AiCaptionTone>('witty');
  const [captionSuggestions, setCaptionSuggestions] = useState<string[]>([]);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Live developing progress
  const [now, setNow] = useState(Date.now());
  const developing = post?.imageUri ? getCureProgress(post.createdAt, now) < 1 : false;

  useEffect(() => {
    if (!developing) return;
    const id = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(id);
  }, [developing]);

  useEffect(() => {
    setCaptionSuggestions([]);
  }, [post?.id, post?.imageUri]);

  useEffect(() => {
    setSelectedSong(post?.song ?? null);
    setSelectedVoice(post?.voice ?? null);
    setSongPreviewRequestKey(null);
    setVideoMuted(post?.videoMuted ?? false);
    setLocationNameInput(post?.locationName ?? '');
  }, [post?.id, post?.locationName]);

  useEffect(() => {
    const currentTargetKey = post ? getPostTargetKey(post, contacts, currentUser?.id ?? null) : null;
    setSelectedTargetKeys(currentTargetKey ? [currentTargetKey] : []);
  }, [contacts, currentUser?.id, post?.id, post?.subjectContactId, post?.subjectUserId]);

  const onFlip = useCallback((back: boolean) => setShowingBack(back), []);
  const textInputTypography = useMemo(
    () => (post?.postType === 'note' && !post?.imageUri ? resolveWallPostTextStyle(fonts, textFont, textSize) : null),
    [fonts, post?.imageUri, post?.postType, textFont, textSize],
  );
  const selectedTextColor = useMemo(() => resolveWallPostTextColor(textColor, colors), [colors, textColor]);
  const relatedWallPosts = useMemo(
    () => (post && currentUser?.id ? getRelatedWallPostsForEdit(post, wallPosts, contacts, currentUser.id) : []),
    [contacts, currentUser?.id, post, wallPosts],
  );
  const existingPlacementByTargetKey = useMemo(() => {
    const placements = new Map<string, WallPost>();
    for (const relatedPost of relatedWallPosts) {
      const targetKey = getPostTargetKey(relatedPost, contacts, currentUser?.id ?? null);
      if (targetKey && !placements.has(targetKey)) placements.set(targetKey, relatedPost);
    }
    return placements;
  }, [contacts, currentUser?.id, relatedWallPosts]);
  const existingTargetKeysSignature = useMemo(
    () => Array.from(existingPlacementByTargetKey.keys()).sort().join('|'),
    [existingPlacementByTargetKey],
  );

  useEffect(() => {
    if (!existingTargetKeysSignature) return;
    setSelectedTargetKeys(existingTargetKeysSignature.split('|').filter(Boolean));
  }, [existingTargetKeysSignature]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  if (!post) return <Redirect href="/" />;
  const canEditContent = canEditWallPostContent(post, currentUser.id);
  const canDeletePost = canDeleteWallPost(post, currentUser.id);
  if (!canEditContent && !canDeletePost) return <Redirect href="/" />;

  const editablePost = post;
  const authenticatedUser = currentUser;
  const peopleTargets = getPeopleListForUser(authenticatedUser.id);
  const selectedTargets = peopleTargets.filter((target) => selectedTargetKeys.includes(memoryTargetKey(target)));
  const selectedTargetKeySet = new Set(selectedTargetKeys);
  const newTargets = selectedTargets.filter((target) => !existingPlacementByTargetKey.has(memoryTargetKey(target)));
  const selectedExistingPosts = Array.from(existingPlacementByTargetKey.entries())
    .filter(([targetKey]) => selectedTargetKeySet.has(targetKey))
    .map(([, relatedPost]) => relatedPost);
  const removedExistingPosts = relatedWallPosts.filter((relatedPost) => {
    const targetKey = getPostTargetKey(relatedPost, contacts, authenticatedUser.id);
    if (!targetKey) return false;
    const primaryPlacement = existingPlacementByTargetKey.get(targetKey);
    return !selectedTargetKeySet.has(targetKey) || primaryPlacement?.id !== relatedPost.id;
  });
  const pendingRemoveCount = Array.from(existingPlacementByTargetKey.keys()).filter((targetKey) => !selectedTargetKeySet.has(targetKey)).length;
  const pendingAddCount = newTargets.length;
  const authorName = getUserById(editablePost.authorUserId)?.displayName ?? 'Unknown';
  const isSongPost = editablePost.postType === 'song';
  const isVoicePost = editablePost.postType === 'voice';
  const isNotePost = editablePost.postType === 'note' && !editablePost.imageUri;
  const canEditAttachedSong = !isSongPost && !isVoicePost;

  function buildCaptionContext(): AiCaptionContext {
    const linkedContact = editablePost.subjectUserId
      ? contacts.find((contact) => contact.ownerUserId === authenticatedUser.id && contact.linkedUserId === editablePost.subjectUserId)
      : null;
    const contact = editablePost.subjectContactId ? getContactById(editablePost.subjectContactId) : linkedContact;
    const user = editablePost.subjectUserId
      ? getUserById(editablePost.subjectUserId)
      : contact?.linkedUserId
        ? getUserById(contact.linkedUserId)
        : null;

    const contactPosts = contact ? getWallPostsForSubject(contact.id, 'contact') : [];
    const userPosts = user ? getWallPostsForSubject(user.id, 'user') : [];
    const previousPosts = dedupePosts([...contactPosts, ...userPosts], editablePost.id);
    const privateNotes = contact ? getPrivateNotesForContact(contact.id) : [];
    const privateNoteText = privateNotes.flatMap((note) =>
      getPrivateNoteBlocks(note.id)
        .filter((block) => block.type === 'text' && block.content)
        .map((block) => block.content ?? ''),
    );
    const friendFacts = user ? getFriendFactsFor(authenticatedUser.id, user.id).map((fact) => fact.body) : [];

    return {
      authorName: authenticatedUser.displayName,
      subjectName: contact?.nickname || contact?.displayName || user?.displayName || 'someone',
      subjectType: editablePost.subjectUserId ? 'user' : 'contact',
      memoryDate: editablePost.createdAt,
      draftCaption: body.trim() || null,
      relationshipTags: contact?.tags ?? [],
      personalityTraits: [...(contact?.personalityTraits ?? []), ...(user?.profilePersonalityTraits ?? [])],
      facts: [...(contact?.facts ?? []), ...(user?.profileFacts ?? []), ...friendFacts],
      notes: [contact?.note ?? '', ...privateNoteText],
      previousCaptions: previousPosts.map((previousPost) => previousPost.body),
      previousBackText: previousPosts.map((previousPost) => previousPost.backText ?? ''),
    };
  }

  async function handleGenerateCaption() {
    if (!editablePost.imageUri) {
      Alert.alert('Add a photo first', 'AI captions need a photo to look at.');
      return;
    }
    if (!isPremium) {
      showAiCaptionPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }

    setError('');
    setShowingBack(false);
    setIsGeneratingCaption(true);
    try {
      const captions = await generateAiCaptions({
        context: buildCaptionContext(),
        imageUri: editablePost.imageUri,
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

  function handleBack() {
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

  async function handleSave() {
    if (!canEditContent) return;
    if (isVoicePost && !selectedVoice) { setError('Record a voice memory first.'); return; }
    if (!body.trim() && !editablePost.imageUri && !isSongPost && !isVoicePost && !selectedVoice) { setError('Add some text or voice.'); return; }
    if (selectedTargets.length === 0) { setError('Keep this memory on at least one wall, or delete it.'); return; }
    setSaving(true);
    try {
      const voiceForSave = selectedVoice && selectedVoice.uri !== editablePost.voice?.uri
        ? {
          ...selectedVoice,
          uri: await uploadMemoryAudio(selectedVoice.uri, { prefix: `${authenticatedUser.id}/voice` }),
        }
        : selectedVoice;
      for (const relatedPost of selectedExistingPosts) {
        await updateWallPost(
          relatedPost.id,
          body.trim(),
          undefined,
          undefined,
          relatedPost.imageUri ? (backText.trim() || null) : undefined,
          isNotePost ? encodeWallPostTextStyle(textFont, textSize, textEffect, textColor) : undefined,
          visibility,
          canEditAttachedSong ? selectedSong : undefined,
          relatedPost.videoUri ? videoMuted : undefined,
          normalizeLocationName(locationNameInput),
          voiceForSave,
        );
      }
      for (const target of newTargets) {
        await addWallPost(authenticatedUser.id, buildAdditionalWallPostInput({
          post: editablePost,
          target,
          body: body.trim(),
          backText: editablePost.imageUri ? (backText.trim() || null) : editablePost.backText,
          visibility,
          song: canEditAttachedSong ? selectedSong : editablePost.song,
          voice: voiceForSave,
          videoMuted,
          locationName: normalizeLocationName(locationNameInput),
          textFont,
          textSize,
          textEffect,
          textColor,
          getContactById,
        }));
      }
      for (const relatedPost of removedExistingPosts) {
        await deleteWallPost(relatedPost.id);
      }
      backOnce(router);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    }
    setSaving(false);
  }

  function handleDelete() {
    const isDeleteOnlyResponse = !canEditContent;
    Alert.alert(isDeleteOnlyResponse ? 'Delete Response' : 'Delete Memory', isDeleteOnlyResponse ? 'Remove this response from your wall?' : 'Are you sure you want to delete this memory?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWallPost(post!.id);
          backOnce(router);
        },
      },
    ]);
  }

  const header = (
    <Pressable onPress={handleBack} style={styles.backButton}>
      <Text style={styles.backLabel}>‹ Back</Text>
    </Pressable>
  );

  if (!canEditContent) {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Response Options</Text>
        <Text style={styles.deleteOnlyHint}>You can remove this response because you sent the prompt.</Text>
        <View style={styles.previewSection}>
          <WallPostCard
            authorName={authorName}
            cardColor={post.cardColor}
            post={post}
            preview
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteLabel}>Delete Response</Text>
        </Pressable>
      </AppScreen>
    );
  }

  const inputLabel = isSongPost
    ? 'Song Note'
    : isVoicePost
      ? 'Voice Caption'
    : showingBack
      ? 'Back of Card'
      : editablePost.imageUri
        ? 'Front Caption'
        : 'Memory Note';
  const inputPlaceholder = isSongPost
    ? 'Why does this song belong here?'
    : isVoicePost
      ? 'Add a caption for this voice memory...'
    : showingBack
      ? 'Write something on the back...'
      : 'What do you want to remember?';

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={saving ? 'Saving…' : 'Save Changes'} onPress={handleSave} disabled={saving} />}>

      <Text style={styles.title}>Edit Memory</Text>

      <View style={styles.targetSection}>
        <View style={styles.targetHeaderRow}>
          <Text style={styles.targetLabel}>On walls</Text>
          <Text style={styles.targetCount}>
            {formatWallPlacementSummary(selectedTargetKeys.length, pendingAddCount, pendingRemoveCount)}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetScroll}>
          {peopleTargets.map((target) => {
            const key = memoryTargetKey(target);
            const selected = selectedTargetKeys.includes(key);
            const existsOnWall = existingPlacementByTargetKey.has(key);
            const pendingRemoval = existsOnWall && !selected;
            const pendingAdd = !existsOnWall && selected;
            return (
              <Pressable
                key={key}
                onPress={() => toggleTarget(target)}
                style={[styles.targetChip, selected && styles.targetChipActive, pendingRemoval && styles.targetChipRemoved]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${selected ? 'Keep on' : existsOnWall ? 'Remove from' : 'Add to'} ${target.title}'s wall`}
              >
                <View style={[styles.targetAvatar, { backgroundColor: target.avatarColor }]}>
                  {target.imageUri ? (
                    <Image source={{ uri: target.imageUri }} style={styles.targetAvatarImage} />
                  ) : (
                    <Text style={styles.targetInitials}>{getInitials(target.title)}</Text>
                  )}
                </View>
                <View style={styles.targetTextBlock}>
                  <Text style={[styles.targetChipText, selected && styles.targetChipTextActive, pendingRemoval && styles.targetChipTextRemoved]} numberOfLines={1}>
                    {target.title}
                  </Text>
                  <Text style={[styles.targetStatusText, pendingRemoval && styles.targetStatusTextRemoved]} numberOfLines={1}>
                    {pendingRemoval ? 'Will remove' : existsOnWall ? 'On wall' : pendingAdd ? 'Will add' : 'Tap to add'}
                  </Text>
                </View>
                <Ionicons
                  name={selected ? (existsOnWall ? 'checkmark-circle' : 'add-circle') : existsOnWall ? 'remove-circle-outline' : 'ellipse-outline'}
                  size={16}
                  color={pendingRemoval ? colors.error : selected ? colors.accent : colors.inkMuted}
                />
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

      <MemoryLocationPicker value={locationNameInput} onChange={setLocationNameInput} />

      {(body.trim() || backText.trim() || post.imageUri || selectedVoice || (canEditAttachedSong ? selectedSong : post.song)) && (
        <View style={styles.previewSection}>
          <WallPostCard
            authorName={authorName}
            cardColor={post.cardColor}
            onFlip={post.imageUri ? onFlip : undefined}
            autoPlaySongPreviewKey={songPreviewRequestKey}
            livePolaroidForcePlayback={!!post.videoUri}
            post={{ ...post, body: body.trim(), backText: backText.trim() || null, textFont, textSize, textEffect, textColor, song: canEditAttachedSong ? selectedSong : post.song, voice: selectedVoice, videoMuted, locationName: normalizeLocationName(locationNameInput) }}
          />
          {developing && (
            <View style={styles.developingRow}>
              <ThemedGlyph name="polaroid" size={16} color={colors.ink} />
              <Text style={styles.developingHint}>Still developing… your photo will appear shortly</Text>
            </View>
          )}
          {post.imageUri ? (
            <Text style={styles.previewHint}>
              {normalizeLocationName(locationNameInput)
                ? 'Tap the card to flip — location is on the back'
                : 'Tap card to flip'}
            </Text>
          ) : null}
        </View>
      )}

      {editablePost.videoUri ? (
        <View style={styles.videoAudioRow}>
          <View style={styles.videoAudioCopy}>
            <Text style={styles.videoAudioLabel}>Video Audio</Text>
            <Text style={styles.videoAudioHint}>Turn this off if the Live Memory Card should always play silently.</Text>
          </View>
          <Switch
            value={!videoMuted}
            onValueChange={(enabled) => setVideoMuted(!enabled)}
            trackColor={{ false: colors.line, true: colors.accent }}
            thumbColor={colors.white}
          />
        </View>
      ) : null}

      {canEditAttachedSong ? (
        <SongSearchPicker
          selectedSong={selectedSong}
          onSelect={(song) => {
            setSelectedSong(song);
            setSongPreviewRequestKey(`${song.provider}:${song.providerTrackId}:${Date.now()}`);
            setError('');
          }}
          onRemove={() => {
            setSelectedSong(null);
            setSongPreviewRequestKey(null);
          }}
        />
      ) : null}

      <View style={styles.inputSection}>
        <View style={styles.inputHeaderRow}>
          <Text style={styles.inputLabel}>{inputLabel}</Text>
          {post.imageUri && !showingBack ? (
            <Pressable onPress={handleGenerateCaption} disabled={isGeneratingCaption} style={[styles.aiButton, isGeneratingCaption && styles.aiButtonDisabled]}>
              <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
              <Text style={styles.aiButtonText}>{isGeneratingCaption ? 'Writing…' : 'AI Caption'}</Text>
            </Pressable>
          ) : null}
        </View>
        {post.imageUri && !showingBack ? (
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
            voiceLabel={isVoicePost ? 'Voice memory' : 'Voice note'}
            voiceHelperText={isVoicePost ? 'Re-record this voice memory.' : 'Record voice instead of typing.'}
            textInputStyle={[styles.textInput, isNotePost && textInputTypography, isNotePost && { color: selectedTextColor }]}
          />
        )}
        {post.imageUri && !showingBack && captionSuggestions.length > 0 ? (
          <View style={styles.captionSuggestionList}>
            {captionSuggestions.map((caption) => (
              <Pressable key={caption} onPress={() => setBody(caption)} style={[styles.captionSuggestion, body.trim() === caption && styles.captionSuggestionActive]}>
                <Text style={styles.captionSuggestionText}>{caption}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {isNotePost ? (
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={handleDelete} style={styles.deleteButton}>
        <Text style={styles.deleteLabel}>Delete Memory</Text>
      </Pressable>
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
    backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 28) },
    deleteOnlyHint: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
    textInput: {
      minHeight: 100, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line,
      padding: spacing.md, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink, textAlignVertical: 'top',
    },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
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
    previewSection: { gap: spacing.sm, alignItems: 'center' as const },
    previewHint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, textAlign: 'center' as const },
    developingRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: spacing.xs },
    developingHint: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft, textAlign: 'center' as const },
    videoAudioRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
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
    targetSection: { gap: spacing.xs },
    targetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    targetLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    targetCount: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    targetScroll: { gap: spacing.sm, paddingVertical: 2 },
    targetChip: {
      minWidth: 112,
      maxWidth: 148,
      minHeight: 44,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      paddingLeft: 6,
      paddingRight: spacing.sm,
    },
    targetChipActive: {
      borderColor: colors.accent,
      backgroundColor: colors.paper,
    },
    targetChipRemoved: {
      borderColor: colors.error,
      backgroundColor: colors.error + '10',
      opacity: 0.82,
    },
    targetChipLocked: { opacity: 0.9 },
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
    targetTextBlock: { flex: 1, minWidth: 0 },
    targetChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    targetChipTextActive: { fontFamily: fonts.bodyBold, color: colors.ink },
    targetChipTextRemoved: { color: colors.error },
    targetStatusText: { marginTop: 1, fontFamily: fonts.body, fontSize: 10, color: colors.inkMuted },
    targetStatusTextRemoved: { color: colors.error },
    visibilityRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    visibilityLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
    deleteButton: { alignSelf: 'center', paddingVertical: spacing.md },
    deleteLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.error },
  });

function dedupePosts(posts: WallPost[], excludePostId: string) {
  const seen = new Set<string>();
  const result: WallPost[] = [];
  for (const post of posts) {
    if (post.id === excludePostId || seen.has(post.id)) continue;
    seen.add(post.id);
    result.push(post);
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
}

function getRelatedWallPostsForEdit(
  post: WallPost,
  wallPosts: WallPost[],
  contacts: { id: string; ownerUserId: string; linkedUserId?: string | null }[],
  ownerUserId: string,
) {
  const relatedPosts = [post, ...wallPosts.filter((candidate) => candidate.id !== post.id && isSameMemoryPlacementGroup(post, candidate))];
  const seenPostIds = new Set<string>();
  const dedupedPosts: WallPost[] = [];
  for (const relatedPost of relatedPosts) {
    if (seenPostIds.has(relatedPost.id)) continue;
    seenPostIds.add(relatedPost.id);
    dedupedPosts.push(relatedPost);
  }
  return dedupedPosts.sort((left, right) => {
    const leftKey = getPostTargetKey(left, contacts, ownerUserId) ?? '';
    const rightKey = getPostTargetKey(right, contacts, ownerUserId) ?? '';
    if (left.id === post.id) return -1;
    if (right.id === post.id) return 1;
    return leftKey.localeCompare(rightKey);
  });
}

function isSameMemoryPlacementGroup(source: WallPost, candidate: WallPost) {
  if (source.pendingMemoryId && candidate.pendingMemoryId) return source.pendingMemoryId === candidate.pendingMemoryId;
  return source.authorUserId === candidate.authorUserId
    && source.createdAt === candidate.createdAt
    && source.postType === candidate.postType
    && getMemoryIdentityKey(source) === getMemoryIdentityKey(candidate);
}

function getMemoryIdentityKey(post: WallPost) {
  if (post.imageUri) return `image:${post.imageUri}`;
  if (post.videoUri) return `video:${post.videoUri}`;
  if (post.voice?.uri) return `voice:${post.voice.uri}`;
  if (post.song) return `song:${post.song.provider}:${post.song.providerTrackId}`;
  if (post.movie) return `movie:${post.movie.reviewRequestId ?? post.movie.tmdbId}`;
  if (post.memoryPromptRequestId) return `prompt:${post.memoryPromptRequestId}`;
  return `text:${post.postType}`;
}

function formatWallPlacementSummary(selectedCount: number, addCount: number, removeCount: number) {
  const base = `${selectedCount} ${selectedCount === 1 ? 'wall' : 'walls'}`;
  const changes = [
    addCount > 0 ? `+${addCount}` : null,
    removeCount > 0 ? `-${removeCount}` : null,
  ].filter(Boolean);
  return changes.length > 0 ? `${base} (${changes.join(', ')})` : base;
}

function memoryTargetKey(target: Pick<PeopleListItem, 'entityType' | 'id'>) {
  return `${target.entityType}:${target.id}`;
}

function getPostTargetKey(
  post: Pick<WallPost, 'subjectContactId' | 'subjectUserId'>,
  contacts: { id: string; ownerUserId: string; linkedUserId?: string | null }[],
  ownerUserId: string | null,
) {
  if (post.subjectContactId) return `contact:${post.subjectContactId}`;
  if (!post.subjectUserId) return null;
  const linkedContact = ownerUserId
    ? contacts.find((contact) => contact.ownerUserId === ownerUserId && contact.linkedUserId === post.subjectUserId)
    : null;
  return linkedContact ? `contact:${linkedContact.id}` : `user:${post.subjectUserId}`;
}

function buildAdditionalWallPostInput({
  post,
  target,
  body,
  backText,
  visibility,
  song,
  voice,
  videoMuted,
  locationName,
  textFont,
  textSize,
  textEffect,
  textColor,
  getContactById,
}: {
  post: WallPost;
  target: PeopleListItem;
  body: string;
  backText: string | null;
  visibility: WallPostVisibility;
  song: SongAttachment | null;
  voice: VoiceAttachment | null;
  videoMuted: boolean;
  locationName: string | null;
  textFont: WallPostTextFont;
  textSize: WallPostTextSize;
  textEffect: WallPostTextEffect;
  textColor: WallPostTextColor;
  getContactById: (contactId: string) => { linkedUserId?: string | null } | undefined;
}): CreateWallPostInput {
  let subjectUserId: string | null = target.entityType === 'user' ? target.id : null;
  let subjectContactId: string | null = target.entityType === 'contact' ? target.id : null;
  let finalVisibility = visibility;
  if (target.entityType === 'contact') {
    const contact = getContactById(target.id);
    if (contact?.linkedUserId) {
      subjectUserId = contact.linkedUserId;
      subjectContactId = null;
      if (finalVisibility === 'private') finalVisibility = 'visible_to_subject';
    }
  }

  const isTextOnlyNote = post.postType === 'note' && !post.imageUri && !post.videoUri;
  return {
    subjectUserId,
    subjectContactId,
    visibility: finalVisibility,
    postType: post.postType,
    body,
    imageUri: post.imageUri,
    videoUri: post.videoUri ?? null,
    videoMuted: !!post.videoUri && videoMuted,
    cardColor: post.cardColor,
    backText,
    filter: isTextOnlyNote ? null : post.filter,
    textFont: isTextOnlyNote ? textFont : null,
    textSize: isTextOnlyNote ? textSize : null,
    textEffect: isTextOnlyNote ? textEffect : null,
    textColor: isTextOnlyNote ? textColor : null,
    dateStamp: post.dateStamp,
    song,
    voice,
    movie: post.movie ?? null,
    memoryPromptRequestId: post.memoryPromptRequestId ?? null,
    referencedWallPostId: post.referencedWallPostId ?? null,
    promptText: post.promptText ?? null,
    promptType: post.promptType ?? null,
    promptVoice: post.promptVoice ?? null,
    memoryDate: post.memoryDate ?? null,
    locationName,
  };
}

function getInitials(value: string) {
  return value.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}
