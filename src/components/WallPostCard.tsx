import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image as RNImage, LayoutChangeEvent, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';

import { retryPendingMemory } from '../features/memories/pendingMemorySync';
import { usePremium } from '../features/premium/PremiumContext';
import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { contrastText, contrastTextSoft, contrastAccent } from '../lib/contrastText';
import { sharePolaroid } from '../lib/sharePolaroid';
import { pushOnce } from '../lib/navigationGuard';
import { showShakeDevelopPaywall } from '../lib/premiumGates';
import { resolveWallPostTextColor, resolveWallPostTextStyle } from '../lib/wallPostTextStyle';
import { getWallPostMemoryDate, getWallPostMemoryDateValue } from '../lib/memoryDate';
import { useFlipCard } from '../hooks/useFlipCard';
import { useMemoryDeveloping } from '../hooks/useMemoryDeveloping';
import { usePolaroidImageReady } from '../hooks/usePolaroidImageReady';
import { CachedRemoteImage } from './CachedRemoteImage';
import { LivePolaroidLayer } from './LivePolaroidLayer';
import { MemoryPhotoEffects, MemoryPhotoGhost } from './memory-card';
import { MemoryStyledText } from './MemoryStyledText';
import { SongMemoryCard } from './SongMemoryCard';
import { VoiceMemoryCard } from './VoiceMemoryCard';
import { WallPost } from '../types/domain';
import { protectTextFromFontClipping } from '../theme/fontProtection';
import type { FontSet } from '../theme/typography';
import { semanticColors, spacing } from '../theme/tokens';

interface WallPostCardProps {
  authorName: string;
  post: WallPost;
  cardColor?: string | null;
  developStartAt?: string | null;
  themeColors?: ColorTokens;
  imageLoadEnabled?: boolean;
  displayMode?: 'timeline' | 'grid';
  editing?: boolean;
  preview?: boolean;
  shareable?: boolean;
  livePolaroidScope?: string;
  livePolaroidForcePlayback?: boolean;
  autoPlaySongPreviewKey?: string | number | null;
  referencedPost?: WallPost | null;
  referencedPostAuthorName?: string;
  promptAuthorName?: string;
  suppressAttachments?: boolean;
  suppressAttachedVoice?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onFlip?: (showingBack: boolean) => void;
  onDeveloped?: () => void;
  onImageReady?: (postId: string) => void;
  onSaveBackText?: (postId: string, text: string) => void;
}

export function WallPostCard({ authorName, post, cardColor, developStartAt, themeColors, imageLoadEnabled = true, displayMode = 'timeline', editing: editMode, preview, shareable, livePolaroidScope, livePolaroidForcePlayback, autoPlaySongPreviewKey, referencedPost, referencedPostAuthorName, promptAuthorName, suppressAttachments, suppressAttachedVoice, onPress, onLongPress, onFlip, onDeveloped, onImageReady, onSaveBackText }: WallPostCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors: appColors, fonts, resolvedMode } = useTheme();
  const { isPremium } = usePremium();
  const colors = themeColors ?? appColors;
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const cardPost = useMemo((): WallPost => {
    if (displayMode !== 'grid' || post.promptType !== 'photo_reference' || !referencedPost?.imageUri) {
      return post;
    }

    return {
      ...referencedPost,
      id: post.id,
      authorUserId: post.authorUserId,
      subjectUserId: post.subjectUserId,
      subjectContactId: post.subjectContactId,
      visibility: post.visibility,
      body: post.body,
      backText: post.backText ?? referencedPost.backText,
      memoryDate: post.memoryDate ?? referencedPost.memoryDate,
      createdAt: post.createdAt,
      promptText: post.promptText,
      promptType: post.promptType,
      memoryPromptRequestId: post.memoryPromptRequestId,
      referencedWallPostId: post.referencedWallPostId,
      locationName: post.locationName ?? referencedPost.locationName,
      syncStatus: post.syncStatus,
      pendingMemoryId: post.pendingMemoryId,
      textFont: post.textFont,
      textSize: post.textSize,
      textEffect: post.textEffect,
      textColor: post.textColor,
      song: post.song ?? null,
      voice: post.voice ?? null,
    };
  }, [displayMode, post, referencedPost]);
  const isRegularMedia = cardPost.postType === 'media';
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [frontHeight, setFrontHeight] = useState(0);
  const imageState = usePolaroidImageReady(cardPost.imageUri, imageLoadEnabled);

  // ── Capture ref for sharing ──────────────────────────────────────────
  const captureRef = useRef<View>(null);
  const memoryOnlyCaptureRef = useRef<View>(null);
  const handleShare = useCallback(() => { sharePolaroid(captureRef); }, []);

  const [editingBack, setEditingBack] = useState(false);
  const [backDraft, setBackDraft] = useState(post.backText ?? '');

  const canEditBack = !!editMode && !!onSaveBackText;

  const saveBackBeforeFlip = useCallback(({ showBack: showingBack }: { showBack: boolean }) => {
    if (showingBack && editingBack) {
      if (onSaveBackText && backDraft !== (post.backText ?? '')) {
        onSaveBackText(post.id, backDraft);
      }
      setEditingBack(false);
    }
  }, [backDraft, editingBack, onSaveBackText, post.backText, post.id]);

  const { rotateY, scaleX, showBack, flip: handleFlip } = useFlipCard({
    disabled: !!editMode,
    onBeforeFlip: saveBackBeforeFlip,
    onFlip,
  });
  const { cure, developingLabel, shakeFeedback, shakeRotateZ, shakeTranslateX } = useMemoryDeveloping({
    createdAt: developStartAt ?? cardPost.createdAt,
    disabled: showBack || isRegularMedia,
    imageLoadEnabled,
    imageUri: cardPost.imageUri,
    isPremium,
    onDeveloped,
    postId: post.id,
    preview,
  });

  // Stable tilt per memory so scaled reference previews match the original card.
  const tilt = useMemo(() => getStablePolaroidTilt(post.id), [post.id]);

  useEffect(() => {
    if (!isRegularMedia || !cardPost.imageUri || !imageLoadEnabled) {
      setAspectRatio(null);
      return;
    }

    RNImage.getSize(
      cardPost.imageUri,
      (w, h) => { if (h > 0) setAspectRatio(w / h); },
      () => setAspectRatio(null),
    );
  }, [cardPost.imageUri, imageLoadEnabled, isRegularMedia]);

  useEffect(() => {
    if (!cardPost.imageUri || !imageLoadEnabled || !imageState.imageReady) return;
    onImageReady?.(post.id);
  }, [cardPost.imageUri, imageLoadEnabled, imageState.imageReady, onImageReady, post.id]);

  const onFrameLayout = (e: LayoutChangeEvent) => {
    setFrameWidth(e.nativeEvent.layout.width);
  };

  const date = getWallPostMemoryDate(cardPost);
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Classic film-camera date stamp: YY.MM.DD HH:MM
  const stampText = cardPost.dateStamp
    ? `${String(date.getFullYear()).slice(-2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    : null;

  const imageHeight = POLAROID_PHOTO_HEIGHT;
  const mediaAspectHeight = aspectRatio && frameWidth > 0 ? frameWidth / aspectRatio : null;
  const mediaFrameHeight = displayMode === 'grid' ? 180 : mediaAspectHeight;
  const mediaFallbackHeight = displayMode === 'grid' ? 180 : 292;

  const bg = cardColor || cardPost.cardColor || POLAROID_FRAME;
  // On the default ivory frame, always use dark ink (readable in any theme mode).
  // On custom card colors, use computed contrast colors.
  const frameDefault = !cardColor;
  const ct = frameDefault ? FRAME_INK : contrastText(cardColor);
  const ctSoft = frameDefault ? FRAME_INK_SOFT : contrastTextSoft(cardColor);
  const ctAccent = frameDefault ? colors.accent : contrastAccent(cardColor, colors.accent);
  const editBorderColor = getMemoryEditBorderColor(cardPost, colors);

  const standaloneSong = cardPost.postType === 'song' ? cardPost.song : null;
  const standaloneVoice = cardPost.postType === 'voice' ? cardPost.voice : null;
  const attachedSong = !suppressAttachments && cardPost.postType !== 'song' ? cardPost.song : null;
  const attachedVoice = !suppressAttachments && !suppressAttachedVoice && cardPost.postType !== 'voice' ? cardPost.voice : null;
  const movie = cardPost.postType === 'movie' ? cardPost.movie : null;
  const showInlineShareButton = !!shareable && !attachedSong;
  const standaloneSongKey = standaloneSong ? `${standaloneSong.provider}:${standaloneSong.providerTrackId}` : null;
  const attachedSongKey = attachedSong ? `${attachedSong.provider}:${attachedSong.providerTrackId}` : null;
  const compactSong = Boolean(cardPost.memoryPromptRequestId || cardPost.promptText || cardPost.promptVoice || cardPost.promptType);
  const compactVoice = Boolean(cardPost.memoryPromptRequestId || cardPost.promptText || cardPost.promptVoice || cardPost.promptType);
  const isTextOnly = !standaloneSong && !standaloneVoice && !cardPost.imageUri && !cardPost.videoUri;
  const thumbnailUri = cardPost.imageThumbUri && cardPost.imageThumbUri !== cardPost.imageUri ? cardPost.imageThumbUri : null;
  const showThumbnailOnly = Boolean(thumbnailUri && !imageLoadEnabled);
  const displayImageUri = showThumbnailOnly ? thumbnailUri : cardPost.imageUri;
  const showAnyImage = imageState.showImage || showThumbnailOnly;
  const textOnlyTypography = useMemo(
    () => resolveWallPostTextStyle(fonts, cardPost.textFont, cardPost.textSize),
    [cardPost.textFont, cardPost.textSize, fonts],
  );
  const textOnlyColor = useMemo(() => resolveWallPostTextColor(cardPost.textColor, colors), [cardPost.textColor, colors]);
  const showDevelopingStatus = !isRegularMedia && imageLoadEnabled && cure.developing && (editMode || !showBack);
  const isPolaroidGhost = !isRegularMedia && !!cardPost.imageUri && !imageState.imageReady && !thumbnailUri;
  const showShareButton = !cardPost.imageUri || imageState.imageReady;
  const syncStatus = !suppressAttachments && post.syncStatus && post.syncStatus !== 'synced' ? post.syncStatus : null;
  const syncLabel = syncStatus === 'saving'
    ? 'Saving...'
    : syncStatus === 'waiting'
      ? 'Waiting for connection'
      : syncStatus === 'failed'
        ? 'Tap to retry'
        : null;
  const locationLabel = cardPost.locationName?.trim() || null;
  const polaroidBackLocation = locationLabel ? (
    <View style={styles.backFooter}>
      <View style={styles.backLocationRow}>
        <Ionicons name="location-sharp" size={12} color={ctAccent} />
        <Text style={[styles.backLocationText, { color: ct }]} numberOfLines={2}>
          {locationLabel}
        </Text>
      </View>
    </View>
  ) : null;
  const surfaceBackLocation = locationLabel ? (
    <View style={styles.surfaceLocationFooter}>
      <View style={styles.backLocationRow}>
        <Ionicons name="location-sharp" size={12} color={colors.accent} />
        <Text style={styles.surfaceLocationText} numberOfLines={2}>
          {locationLabel}
        </Text>
      </View>
    </View>
  ) : null;
  const syncStatusElement = syncLabel ? (
    <Pressable
      disabled={syncStatus !== 'failed' || !post.pendingMemoryId}
      onPress={() => {
        if (post.pendingMemoryId) {
          retryPendingMemory(queryClient, post.pendingMemoryId).catch((error) => console.warn('[pending memories] retry failed:', error));
        }
      }}
      style={[styles.syncStatusPill, syncStatus === 'failed' && styles.syncStatusPillFailed]}
      accessibilityRole={syncStatus === 'failed' ? 'button' : undefined}
    >
      <Ionicons
        name={syncStatus === 'failed' ? 'refresh-outline' : syncStatus === 'waiting' ? 'cloud-offline-outline' : 'cloud-upload-outline'}
        size={12}
        color={syncStatus === 'failed' ? colors.error : colors.ink}
      />
      <Text style={[styles.syncStatusText, syncStatus === 'failed' && { color: colors.error }]}>{syncLabel}</Text>
    </Pressable>
  ) : null;
  const promptIconName = cardPost.promptType === 'photo'
    ? 'camera-outline'
    : cardPost.promptType === 'photo_reference'
      ? 'images-outline'
      : cardPost.promptType === 'text'
      ? 'chatbubble-ellipses-outline'
      : cardPost.promptType === 'voice'
        ? 'mic-outline'
        : 'sparkles-outline';
  const promptText = cardPost.promptText?.trim() || null;
  const promptDisplayText = promptText && !(cardPost.promptVoice && /^voice prompt$/i.test(promptText)) ? promptText : null;
  const promptQuestionLabel = promptAuthorName ? `${promptAuthorName} asked` : 'Asked';
  const responseTypeLabel = getResponseTypeLabel(cardPost);
  const hasPromptContext = !suppressAttachments && Boolean(cardPost.memoryPromptRequestId || cardPost.promptText?.trim() || cardPost.promptVoice || cardPost.promptType);
  const responseSummaryLabel = hasPromptContext
    ? responseTypeLabel ? `${authorName} responded with ${responseTypeLabel}` : `${authorName} responded`
    : undefined;
  const promptVoiceElement = cardPost.promptVoice ? (
    <VoiceMemoryCard
      key={`${post.id}:prompt-voice:${cardPost.promptVoice.uri}`}
      voice={cardPost.promptVoice}
      postId={`${post.id}:prompt-voice`}
      themeColors={colors}
      variant="embedded"
      emphasis="secondary"
      label={promptDisplayText ? 'By voice' : undefined}
      preview={preview}
    />
  ) : null;
  const promptQuestionElement = !suppressAttachments && (promptDisplayText || promptVoiceElement) ? (
    <View style={styles.promptQuestion}>
      <View style={styles.promptQuestionHeader}>
        <Ionicons name={promptIconName} size={13} color={semanticColors.promptGold} />
        <Text style={styles.promptQuestionLabel}>{promptQuestionLabel}</Text>
      </View>
      {promptDisplayText ? (
        <>
          <Text style={styles.promptQuestionText}>{promptDisplayText}</Text>
          {promptVoiceElement}
        </>
      ) : (
        <View style={styles.promptVoiceOnlyRow}>{promptVoiceElement}</View>
      )}
    </View>
  ) : null;
  const showPromptInPhotoFrame = !suppressAttachments && displayMode === 'grid' && !!promptDisplayText;
  const polaroidPromptQuestionElement = !suppressAttachments && (promptDisplayText || promptVoiceElement) && !showPromptInPhotoFrame ? (
    <View style={styles.polaroidPromptQuestion}>
      <View style={styles.promptQuestionHeader}>
        <Ionicons name={promptIconName} size={12} color={semanticColors.promptGold} />
        <Text style={[styles.polaroidPromptQuestionLabel, { color: semanticColors.promptGold }]}>{promptQuestionLabel}</Text>
      </View>
      {promptDisplayText ? <Text style={[styles.polaroidPromptQuestionText, { color: ct }]}>{promptDisplayText}</Text> : null}
    </View>
  ) : null;
  const photoFramePromptOverlay = showPromptInPhotoFrame ? (
    <View pointerEvents="none" style={styles.photoFramePrompt}>
      <View style={styles.photoFramePromptHeader}>
        <Ionicons name={promptIconName} size={10} color={semanticColors.promptGold} />
        <Text style={styles.photoFramePromptLabel}>Prompt</Text>
      </View>
      <Text style={styles.photoFramePromptText} numberOfLines={3}>
        {promptDisplayText}
      </Text>
    </View>
  ) : null;
  const referencedPhotoElement = post.referencedWallPostId && !cardPost.imageUri ? (
    <ReferencedPolaroidPreview
      post={referencedPost ?? null}
      authorName={referencedPostAuthorName}
      fallbackText="Referenced photo memory"
      styles={styles}
      colors={colors}
    />
  ) : null;
  const hasReferencedPhotoResponse = !!referencedPhotoElement;
  const attachedVoiceElement = attachedVoice ? (
    <View style={styles.attachedVoiceWrap}>
      <VoiceMemoryCard
        key={`${post.id}:attached-voice:${attachedVoice.uri}`}
        voice={attachedVoice}
        postId={`${post.id}:voice-attachment`}
        authorName={authorName}
        themeColors={colors}
        variant="embedded"
        emphasis="secondary"
        label="Voice"
        preview={preview}
      />
    </View>
  ) : null;
  const polaroidVoiceElement = attachedVoice && cardPost.imageUri ? (
    <View style={styles.polaroidVoiceSlot}>
      <VoiceMemoryCard
        key={`${post.id}:polaroid-voice:${attachedVoice.uri}`}
        voice={attachedVoice}
        postId={`${post.id}:polaroid-voice`}
        themeColors={colors}
        variant="embedded"
        emphasis="secondary"
        label="Voice"
        labelColor={ct}
        preview={preview}
      />
    </View>
  ) : null;
  const photoContent = showAnyImage && displayImageUri ? (
    <>
      {isPolaroidGhost ? (
        <MemoryPhotoGhost style={styles.photoGhostSurface} />
      ) : null}
      <CachedRemoteImage
        uri={displayImageUri}
        placeholderUri={thumbnailUri}
        style={[styles.image, { height: imageHeight }, isPolaroidGhost && styles.imageLoading]}
        blurRadius={cure.imageBlur}
        onLoad={showThumbnailOnly ? undefined : imageState.handleImageLoad}
        onError={showThumbnailOnly ? undefined : imageState.handleImageError}
      />
      {cardPost.videoUri && !isPolaroidGhost ? (
        <LivePolaroidLayer videoUri={cardPost.videoUri} colors={colors} scope={livePolaroidScope} forceMuted={cardPost.videoMuted} forcePlayback={livePolaroidForcePlayback} />
      ) : null}
      {!isPolaroidGhost ? (
        <>
          <MemoryPhotoEffects
            dateStamp={stampText}
            dateStampStyle={[styles.dateStamp, { color: ct }]}
            developingDateOpacity={cure.developing ? 1 - cure.darkOverlay : undefined}
            filterKey={cardPost.filter}
          >
            {cure.developing ? (
              <>
                <View style={[styles.darkOverlay, { opacity: cure.darkOverlay }]} />
                {cure.warmOverlay > 0 && <View style={[styles.warmOverlay, { opacity: cure.warmOverlay }]} />}
                {shakeFeedback !== 'idle' && <View style={styles.shakeBoostOverlay} />}
              </>
            ) : null}
          </MemoryPhotoEffects>
        </>
      ) : null}
    </>
  ) : isPolaroidGhost ? (
    <MemoryPhotoGhost style={[styles.photoGhostBlock, { height: imageHeight }]} />
  ) : (
    <View style={styles.photoFallbackSurface}>
      <Ionicons name="image-outline" size={32} color={ctSoft} />
      <Text style={[styles.photoFallbackLabel, { color: ctSoft }]}>Image unavailable</Text>
    </View>
  );

  const mediaContent = cardPost.videoUri && !cardPost.imageUri ? (
    <View style={[styles.mediaVideoOnlyFrame, { height: mediaFrameHeight ?? mediaFallbackHeight }]}>
      <LivePolaroidLayer videoUri={cardPost.videoUri} colors={colors} scope={livePolaroidScope} forceMuted={cardPost.videoMuted} forcePlayback={livePolaroidForcePlayback} />
    </View>
  ) : cardPost.imageUri ? (
    <View style={styles.mediaFrame} onLayout={onFrameLayout}>
      {showAnyImage && displayImageUri && mediaFrameHeight ? (
        <>
          <CachedRemoteImage
            uri={displayImageUri}
            placeholderUri={thumbnailUri}
            style={[styles.mediaImage, { height: mediaFrameHeight }]}
            onLoad={showThumbnailOnly ? undefined : imageState.handleImageLoad}
            onError={showThumbnailOnly ? undefined : imageState.handleImageError}
          />
          {cardPost.videoUri ? (
            <LivePolaroidLayer videoUri={cardPost.videoUri} colors={colors} scope={livePolaroidScope} forceMuted={cardPost.videoMuted} forcePlayback={livePolaroidForcePlayback} />
          ) : null}
        </>
      ) : (
        <View style={[styles.mediaImageFallback, { height: mediaFrameHeight ?? mediaFallbackHeight }]}>
          <Ionicons name="image-outline" size={32} color={colors.ink} />
        </View>
      )}
    </View>
  ) : null;

  if (isRegularMedia) {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} disabled={!onPress && !onLongPress} style={({ pressed }) => [styles.mediaCardShell, pressed && (onPress || onLongPress) && styles.pressed]}>
        <View style={[styles.mediaCard, displayMode === 'grid' && styles.mediaCardGrid, editMode && { borderColor: editBorderColor }]}>
          <BlurView intensity={28} tint={resolvedMode === 'dark' ? 'dark' : 'light'} style={[styles.mediaCardBlur, displayMode === 'grid' && styles.mediaCardBlurGrid]}>
            <View pointerEvents="none" style={styles.memoryGlassTint} />
            <View pointerEvents="none" style={styles.memoryGlassHighlight} />
            {promptQuestionElement}
            {responseSummaryLabel ? <Text style={styles.responseSummaryText}>{responseSummaryLabel}</Text> : null}
            {mediaContent}
            {cardPost.body ? <Text style={[styles.mediaCaption, displayMode === 'grid' && styles.mediaCaptionGrid]} numberOfLines={displayMode === 'grid' ? 3 : undefined}>{cardPost.body}</Text> : null}
            {attachedVoiceElement ? <View style={styles.photoReferenceResponseFooter}>{attachedVoiceElement}</View> : null}
            <View style={styles.mediaMetaRow}>
              <Text style={styles.textOnlyAuthor}>{authorName} - {formatted}</Text>
            </View>
            {surfaceBackLocation}
            {syncStatusElement}
          </BlurView>
        </View>
      </Pressable>
    );
  }

  if (standaloneSong) {
    return (
      <View style={styles.promptWrappedCard}>
        <SongMemoryCard
          key={standaloneSongKey}
          song={standaloneSong}
          postId={post.id}
          body={cardPost.body}
          authorName={authorName}
          createdAt={getWallPostMemoryDateValue(post)}
          themeColors={colors}
          preview={preview}
          editing={editMode}
          compact={compactSong}
          autoPlayKey={autoPlaySongPreviewKey}
          promptContent={promptQuestionElement}
          responseLabel={responseSummaryLabel}
          footerContent={attachedVoiceElement}
          onPress={onPress}
        />
        {surfaceBackLocation}
        {syncStatusElement}
      </View>
    );
  }

  if (standaloneVoice) {
    return (
      <View style={styles.promptWrappedCard}>
        <VoiceMemoryCard
          key={`${post.id}:${standaloneVoice.uri}`}
          voice={standaloneVoice}
          postId={post.id}
          body={cardPost.body}
          authorName={authorName}
          createdAt={getWallPostMemoryDateValue(post)}
          themeColors={colors}
          displayMode={displayMode}
          preview={preview}
          compact={compactVoice}
          promptContent={promptQuestionElement}
          editing={editMode}
          editingAccentColor={editBorderColor}
          onPress={onPress}
        />
        {surfaceBackLocation}
        {syncStatusElement}
      </View>
    );
  }

  if (movie) {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} disabled={!onPress && !onLongPress} style={({ pressed }) => [styles.movieCardShell, pressed && (onPress || onLongPress) && styles.pressed]}>
        <View style={[styles.movieCard, displayMode === 'grid' && styles.movieCardGrid, editMode && { borderColor: editBorderColor }]}>
          <BlurView intensity={28} tint={resolvedMode === 'dark' ? 'dark' : 'light'} style={[styles.movieCardBlur, displayMode === 'grid' && styles.movieCardBlurGrid]}>
            <View pointerEvents="none" style={styles.memoryGlassTint} />
            <View pointerEvents="none" style={styles.memoryGlassHighlight} />
            {promptQuestionElement}
            <View style={[styles.movieHeader, displayMode === 'grid' && styles.movieHeaderGrid]}>
              <View style={[styles.moviePosterFrame, displayMode === 'grid' && styles.moviePosterFrameGrid]}>
                {movie.posterUrl ? (
                  <CachedRemoteImage uri={movie.posterUrl} style={styles.moviePoster} />
                ) : (
                  <View style={[styles.moviePosterFallback, displayMode === 'grid' && styles.moviePosterFallbackGrid]}>
                    <Ionicons name="film-outline" size={displayMode === 'grid' ? 36 : 58} color={colors.accent} />
                  </View>
                )}
              </View>
              <View style={styles.movieBody}>
                <Text style={styles.movieEyebrow}>Movie review</Text>
                <Text style={[styles.movieTitle, displayMode === 'grid' && styles.movieTitleGrid]} numberOfLines={displayMode === 'grid' ? 2 : 3}>{movie.title}{movie.year ? ` (${movie.year})` : ''}</Text>
                <View style={[styles.movieRatingRow, displayMode === 'grid' && styles.movieRatingRowGrid]}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Ionicons key={value} name={getStarIcon(movie.reviewRating ?? 0, value)} size={displayMode === 'grid' ? 15 : 20} color={semanticColors.movieGold} />
                  ))}
                  <Text style={[styles.movieRatingText, displayMode === 'grid' && styles.movieRatingTextGrid]}>{formatStars(movie.reviewRating)}</Text>
                </View>
                {cardPost.body ? <Text style={[styles.movieReviewText, displayMode === 'grid' && styles.movieReviewTextGrid]} numberOfLines={displayMode === 'grid' ? 4 : undefined}>{cardPost.body}</Text> : null}
                <Text style={styles.movieAuthor} numberOfLines={1}>— {authorName}</Text>
              </View>
            </View>
            {attachedVoiceElement ? <View style={styles.photoReferenceResponseFooter}>{attachedVoiceElement}</View> : null}
            {surfaceBackLocation}
            {syncStatusElement}
          </BlurView>
        </View>
      </Pressable>
    );
  }

  /* ── Single animated view — content swaps at the 90° midpoint ── */
  const onFrontLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setFrontHeight(h);
  };

  const textOnlyMemory = (
    <View style={[styles.cardWithStatus, styles.photoReferenceResponseHost]}>
      {hasReferencedPhotoResponse ? (
        <View style={[styles.photoReferenceResponseShell, displayMode === 'grid' && styles.photoReferenceResponseShellGrid, editMode && { borderColor: editBorderColor }]}>
          <BlurView intensity={28} tint={resolvedMode === 'dark' ? 'dark' : 'light'} style={styles.photoReferenceResponseBlur}>
            <View pointerEvents="none" style={styles.memoryGlassTint} />
            <View pointerEvents="none" style={styles.memoryGlassHighlight} />
            {promptQuestionElement}
            {responseSummaryLabel ? <Text style={styles.responseSummaryText}>{responseSummaryLabel}</Text> : null}
            <View style={styles.photoReferenceResponseContent}>{referencedPhotoElement}</View>
            {cardPost.body ? (
              <MemoryStyledText
                text={cardPost.body}
                effect={cardPost.textEffect}
                color={textOnlyColor}
                accentColor={textOnlyColor}
                paperColor={colors.paper}
                style={[styles.textOnlyBody, textOnlyTypography]}
              />
            ) : null}
            {attachedVoiceElement ? <View style={styles.photoReferenceResponseFooter}>{attachedVoiceElement}</View> : null}
            {surfaceBackLocation}
          </BlurView>
        </View>
      ) : (
        <Pressable onPress={onPress} onLongPress={onLongPress} disabled={!onPress && !onLongPress} style={({ pressed }) => [styles.wrapper, pressed && (onPress || onLongPress) && styles.pressed]}>
          <View style={[styles.textOnlyCard, displayMode === 'grid' && styles.textOnlyCardGrid, editMode && { borderColor: editBorderColor }]}>
            <BlurView intensity={28} tint={resolvedMode === 'dark' ? 'dark' : 'light'} style={styles.textOnlyCardBlur}>
              <View pointerEvents="none" style={styles.memoryGlassTint} />
              <View pointerEvents="none" style={styles.memoryGlassHighlight} />
              {promptQuestionElement}
              {promptQuestionElement && responseSummaryLabel ? <Text style={styles.responseSummaryText}>{responseSummaryLabel}</Text> : null}
              {cardPost.body ? (
                <MemoryStyledText
                  text={cardPost.body}
                  effect={cardPost.textEffect}
                  color={textOnlyColor}
                  accentColor={textOnlyColor}
                  paperColor={colors.paper}
                  style={[styles.textOnlyBody, textOnlyTypography]}
                />
              ) : null}
              <Text style={styles.textOnlyAuthor}>{authorName} - {formatted}</Text>
              {surfaceBackLocation}
            </BlurView>
          </View>
        </Pressable>
      )}
      {syncStatusElement}
    </View>
  );

  const polaroidMemory = (
    <View style={[styles.wrapper, showBack && !editMode && { zIndex: 10 }]}>
      <Animated.View style={{ transform: [{ perspective: 800 }, { rotateY }, { scaleX }, { translateX: shakeTranslateX }, { rotateZ: shakeRotateZ }] }}>
        {editMode ? (
          <>
          <Pressable onPress={onPress} onLongPress={onLongPress} disabled={!onPress && !onLongPress}>
            {/* Front of the polaroid — edit mode (no flip animation) */}
            <View style={styles.cardWithStatus}>
              <View onLayout={onFrontLayout} style={styles.ambientShadow}>
                <View style={[styles.tape, isPolaroidGhost && styles.tapeGhost]} />
                <View renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.card, isPolaroidGhost && styles.cardGhost, editMode && { borderColor: editBorderColor }, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] }]}> 
                  <View pointerEvents="none" style={styles.polaroidLiquidSheen} />
                  {polaroidPromptQuestionElement}
                  <View style={[styles.photoFrame, isPolaroidGhost && styles.photoFrameGhost]} onLayout={onFrameLayout}>
                    {photoContent}
                  </View>
                  <View style={styles.bottomStrip}>
                    <Text style={[styles.date, { color: ct }]}>{formatted}</Text>
                    <View style={styles.textSlot}>
                      {cardPost.body ? <Text style={[styles.text, { color: ct }]} numberOfLines={FRONT_TEXT_LINES}>{cardPost.body}</Text> : polaroidVoiceElement}
                    </View>
                    <Text style={[styles.author, { color: ctSoft }]}>— {authorName}</Text>
                  </View>
                </View>
              </View>
              {showDevelopingStatus && (
                <Pressable
                  disabled={isPremium}
                  onPress={() => showShakeDevelopPaywall(() => pushOnce(router, '/(app)/store'))}
                  accessibilityRole={isPremium ? undefined : 'button'}
                  accessibilityLabel={isPremium ? undefined : 'Unlock shake-to-develop'}
                >
                  <Text style={styles.developingLabel}>{developingLabel}</Text>
                </Pressable>
              )}
              {syncStatusElement}
            </View>
          </Pressable>
          </>
        ) : (
          <>
          <Pressable onPress={handleFlip} onLongPress={onLongPress}>
            <View style={styles.cardWithStatus}>
              <View ref={captureRef} collapsable={false} style={showInlineShareButton ? styles.captureStage : undefined}>
                <View onLayout={onFrontLayout} style={styles.flipCardHost}>
                  <View pointerEvents={showBack ? 'none' : 'auto'} style={[styles.flipFace, showBack && styles.hiddenFace]}>
                    <View style={styles.ambientShadow}>
                      <View style={[styles.tape, isPolaroidGhost && styles.tapeGhost]} />
                      <View renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.card, isPolaroidGhost && styles.cardGhost, editMode && { borderColor: editBorderColor }, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] }]}>
                        <View pointerEvents="none" style={styles.polaroidLiquidSheen} />
                        {polaroidPromptQuestionElement}
                        <View style={[styles.photoFrame, isPolaroidGhost && styles.photoFrameGhost]} onLayout={onFrameLayout}>
                          {photoContent}
                          {photoFramePromptOverlay}
                        </View>
                        <View style={styles.bottomStrip}>
                          <Text style={[styles.date, { color: ct }]}>{formatted}</Text>
                          <View style={styles.textSlot}>
                            {cardPost.body ? <Text style={[styles.text, { color: ct }]} numberOfLines={FRONT_TEXT_LINES}>{cardPost.body}</Text> : polaroidVoiceElement}
                          </View>
                          <Text style={[styles.author, { color: ctSoft }]}>— {authorName}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
 
                  <View pointerEvents={showBack ? 'auto' : 'none'} style={[styles.flipFaceOverlay, !showBack && styles.hiddenFace]}>
                    <View style={styles.ambientShadow}>
                      <View style={styles.tape} />
                      <View renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.card, styles.backCard, editMode && { borderColor: editBorderColor }, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] }, frontHeight > 0 && { height: frontHeight }]}>
                        <View pointerEvents="none" style={styles.polaroidLiquidSheen} />
                        <View style={styles.backContent}>
                          {editingBack ? (
                            <TextInput
                              style={[styles.backText, { color: ct }]}
                              value={backDraft}
                              onChangeText={setBackDraft}
                              placeholder="Write something…"
                              placeholderTextColor={FRAME_INK_MUTED}
                              multiline
                              autoFocus
                            />
                          ) : (
                            <Pressable onPress={() => { if (canEditBack) setEditingBack(true); }} disabled={!canEditBack}>
                              <Text style={[styles.backText, { color: ct }]}>
                                {cardPost.backText || (canEditBack ? 'Tap to write…' : '')}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                        {polaroidBackLocation}
                      </View>
                    </View>
                  </View>
                </View>
              </View>
              {showDevelopingStatus && (
                <Pressable
                  disabled={isPremium}
                  onPress={() => showShakeDevelopPaywall(() => pushOnce(router, '/(app)/store'))}
                  accessibilityRole={isPremium ? undefined : 'button'}
                  accessibilityLabel={isPremium ? undefined : 'Unlock shake-to-develop'}
                >
                  <Text style={styles.developingLabel}>{developingLabel}</Text>
                </Pressable>
              )}
              {syncStatusElement}
            </View>
          </Pressable>
          </>
        )}
      </Animated.View>
      {showInlineShareButton && !editingBack && showShareButton && (
        <Pressable onPress={handleShare} style={styles.shareButton} accessibilityRole="button" accessibilityLabel={showBack ? 'Share memory card back' : 'Share memory card'}>
          <Ionicons name="share-outline" size={18} color={colors.ink} />
        </Pressable>
      )}
    </View>
  );

  const memoryContent = isTextOnly ? textOnlyMemory : polaroidMemory;
  const memoryContentWithVoice = attachedVoiceElement && !hasReferencedPhotoResponse && !cardPost.imageUri ? (
    <View style={styles.attachedVoiceStack}>
      {memoryContent}
      {attachedVoiceElement}
    </View>
  ) : memoryContent;

  if (attachedSong) {
    const attachedMemoryContent = shareable ? (
      <View ref={memoryOnlyCaptureRef} collapsable={false} style={styles.memoryOnlyCapture}>
        {memoryContentWithVoice}
      </View>
    ) : memoryContentWithVoice;
    return (
      <SongMemoryCard
        key={attachedSongKey}
        song={attachedSong}
        postId={`${post.id}:song-attachment`}
        authorName={authorName}
        createdAt={getWallPostMemoryDateValue(post)}
        themeColors={colors}
        preview={preview}
        editing={editMode}
        compact={compactSong}
        autoPlayKey={autoPlaySongPreviewKey}
        shareable={shareable}
        shareMemoryRef={memoryOnlyCaptureRef}
        responseLabel={responseSummaryLabel}
        onPress={editMode ? onPress : undefined}
      >
        {attachedMemoryContent}
      </SongMemoryCard>
    );
  }

  return memoryContentWithVoice;
}

function getMemoryEditBorderColor(post: WallPost, colors: ColorTokens) {
  if (post.postType === 'voice' || post.voice) return semanticColors.voiceRed;
  if (post.postType === 'movie' || post.movie) return semanticColors.movieGold;
  if (post.postType === 'media') return colors.accentTertiary ?? '#3A8C8C';
  if (post.postType === 'polaroid' || post.imageUri) return colors.accentAlt ?? colors.accent;
  return semanticColors.replyPurple;
}

const CARD_PADDING_SIDE = 14;
const CARD_PADDING_TOP = 12;
const CARD_PADDING_BOTTOM = 38;
const POLAROID_PHOTO_HEIGHT = 260;
const FRONT_TEXT_LINE_HEIGHT = 22;
const FRONT_TEXT_LINES = 2;
const FRONT_TEXT_SLOT_HEIGHT = FRONT_TEXT_LINE_HEIGHT * FRONT_TEXT_LINES;
const FRONT_BOTTOM_MIN_HEIGHT = 120;

// Warm ivory — real Polaroid frames are never pure white.
const POLAROID_FRAME = '#F5F2EA';

// Dark ink colors for text on Polaroid frame (always light ivory regardless of theme)
const FRAME_INK = '#2A2218';
const FRAME_INK_SOFT = '#6B6052';
const FRAME_INK_MUTED = '#9A9080';

function formatStars(rating: number | null | undefined) {
  const clamped = Math.max(0, Math.min(5, Math.round((rating ?? 0) * 2) / 2));
  return `${clamped}/5`;
}

function getStarIcon(rating: number, starValue: number) {
  if (rating >= starValue) return 'star' as const;
  if (rating >= starValue - 0.5) return 'star-half-outline' as const;
  return 'star-outline' as const;
}

function getResponseTypeLabel(post: WallPost) {
  const parts: string[] = [];
  if (post.song) parts.push('song');
  if (post.movie) parts.push('movie');
  if (post.postType === 'media' && post.videoUri && !post.imageUri) parts.push('video');
  else if (post.imageUri || post.referencedWallPostId) parts.push('photo');
  if (post.body?.trim() && !post.song && !post.movie && !post.imageUri && !post.referencedWallPostId) parts.push('note');
  if (post.voice) parts.push('voice');
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} + ${parts[parts.length - 1]}`;
}

function ReferencedPolaroidPreview({
  post,
  authorName,
  fallbackText,
  styles,
  colors,
}: {
  post: WallPost | null;
  authorName?: string;
  fallbackText: string;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorTokens;
}) {
  return (
    <View style={styles.referencePreviewBlock}>
      <View style={styles.referencePolaroidViewport}>
        {post ? (
          <View style={styles.referenceScaledPolaroidStage}>
            <WallPostCard
              authorName={authorName ?? 'Someone'}
              post={post}
              cardColor={post.cardColor}
              themeColors={colors}
              preview
              suppressAttachments
            />
          </View>
        ) : (
          <View style={styles.referenceFallback}>
            <Ionicons name="image-outline" size={36} color={colors.ink} />
            <Text style={styles.referenceFallbackText}>{fallbackText}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function getStablePolaroidTilt(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return (hash / 0xffffffff - 0.5) * 5;
}

function withAlpha(color: string, alpha: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    wrapper: { paddingVertical: spacing.sm, alignItems: 'center' },
    memoryOnlyCapture: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { transform: [{ scale: 0.985 }] },
    promptWrappedCard: {
      width: '100%',
      alignSelf: 'stretch',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    attachedVoiceStack: {
      width: '100%',
      alignItems: 'center',
      gap: spacing.sm,
    },
    attachedVoiceWrap: {
      width: '100%',
      maxWidth: 390,
      alignSelf: 'center',
    },
    promptQuestion: {
      alignSelf: 'stretch',
      gap: 4,
    },
    promptQuestionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    promptQuestionLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      color: semanticColors.promptGold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    promptQuestionText: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink,
    },
    responseSummaryText: {
      alignSelf: 'stretch',
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: semanticColors.promptGold,
    },
    promptVoiceOnlyRow: {
      marginTop: -2,
    },
    polaroidPromptQuestion: {
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(100,88,68,0.22)',
      backgroundColor: 'rgba(255,255,255,0.28)',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginBottom: spacing.sm,
      gap: 3,
    },
    polaroidPromptQuestionLabel: {
      fontFamily: fonts.handwrittenBold,
      fontSize: 11,
      letterSpacing: 0.3,
      ...protectTextFromFontClipping(fonts.handwrittenBold, 11),
    },
    polaroidPromptQuestionText: {
      fontFamily: fonts.handwritten,
      fontSize: 15,
      lineHeight: 19,
      ...protectTextFromFontClipping(fonts.handwritten, 15),
    },
    photoFramePrompt: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      zIndex: 28,
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(255,255,255,0.16)',
    },
    photoFramePromptHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      marginBottom: 2,
    },
    photoFramePromptLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 9,
      color: semanticColors.promptGold,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    photoFramePromptText: {
      fontFamily: fonts.handwritten,
      fontSize: 12,
      lineHeight: 16,
      color: '#F8F4EA',
      textShadowColor: 'rgba(0,0,0,0.65)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      ...protectTextFromFontClipping(fonts.handwritten, 12),
    },
    referencePreviewBlock: {
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    referencePolaroidViewport: {
      width: 212,
      height: 300,
      alignItems: 'center',
      justifyContent: 'flex-start',
      overflow: 'visible',
    },
    referenceScaledPolaroidStage: {
      width: 260,
      alignItems: 'center',
      transform: [{ scale: 0.72 }],
      transformOrigin: 'top center',
    },
    referenceFallback: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.canvasAlt,
    },
    referenceFallbackText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkMuted,
      textAlign: 'center',
    },
    captureStage: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardWithStatus: {
      alignItems: 'center',
    },
    photoReferenceResponseHost: {
      alignSelf: 'stretch',
      width: '100%',
      alignItems: 'stretch',
    },
    syncStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      marginTop: spacing.xs,
    },
    syncStatusPillFailed: {
      borderColor: colors.error + '66',
      backgroundColor: colors.error + '10',
    },
    syncStatusText: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.inkSoft,
    },
    flipCardHost: {
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    flipFace: {
      alignItems: 'center',
    },
    flipFaceOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    hiddenFace: {
      opacity: 0,
    },
    /* ── Share button ── */
    shareButton: {
      alignSelf: 'center' as const,
      marginTop: spacing.xs,
      padding: spacing.xs,
      borderRadius: 16,
    },

    /* ── Text-only (plain, no card) ── */
    textOnlyCard: {
      alignItems: 'stretch' as const,
      width: '100%',
      maxWidth: 390,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: withAlpha(colors.white, 0.18),
      backgroundColor: withAlpha(colors.paper, 0.56),
      overflow: 'hidden',
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 5,
    },
    textOnlyCardGrid: {
      width: 260,
      maxWidth: 260,
      borderRadius: 18,
    },
    textOnlyCardBlur: {
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    photoReferenceResponseShell: {
      width: '100%',
      alignSelf: 'stretch',
      maxWidth: 390,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: withAlpha(colors.white, 0.18),
      backgroundColor: withAlpha(colors.paper, 0.56),
      overflow: 'hidden',
      shadowColor: colors.black,
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },
    photoReferenceResponseShellGrid: {
      width: 260,
      maxWidth: 260,
      borderRadius: 18,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    photoReferenceResponseBlur: {
      padding: spacing.lg,
      gap: spacing.md,
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    memoryGlassTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(colors.paper, 0.12),
    },
    memoryGlassHighlight: {
      position: 'absolute' as const,
      top: 1,
      left: 18,
      right: 18,
      height: StyleSheet.hairlineWidth,
      backgroundColor: withAlpha(colors.white, 0.72),
    },
    photoReferenceResponseContent: {
      alignItems: 'center',
    },
    photoReferenceResponseFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line + '66',
      paddingTop: spacing.sm,
    },
    textOnlyBody: {
      textAlign: 'left' as const,
    },
    textOnlyMetaRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    surfaceLocationFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      paddingTop: spacing.sm,
      marginTop: spacing.xs,
      width: '100%',
      maxWidth: 320,
    },
    surfaceLocationText: {
      flex: 1,
      fontFamily: fonts.handwritten,
      fontSize: 14,
      lineHeight: 19,
      color: colors.inkSoft,
      textAlign: 'center',
      ...protectTextFromFontClipping(fonts.handwritten, 14),
    },
    textOnlyDate: {
      fontFamily: fonts.handwritten,
      fontSize: 13,
      color: colors.accent,
      ...protectTextFromFontClipping(fonts.handwritten, 13),
    },
    textOnlyAuthor: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.inkSoft,
    },
    movieCardShell: {
      width: '100%',
      paddingVertical: spacing.sm,
      alignItems: 'stretch',
    },
    movieCard: {
      width: '100%',
      maxWidth: 390,
      borderRadius: 26,
      backgroundColor: withAlpha(colors.paper, 0.56),
      borderWidth: 1,
      borderColor: withAlpha(colors.white, 0.18),
      overflow: 'hidden',
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 5,
    },
    movieCardGrid: {
      width: 260,
      maxWidth: 260,
      borderRadius: 18,
    },
    movieCardBlur: {
      padding: spacing.md,
      gap: spacing.md,
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    movieCardBlurGrid: {
      padding: spacing.sm,
    },
    movieHeader: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'stretch',
    },
    movieHeaderGrid: {
      gap: spacing.sm,
      alignItems: 'flex-start',
    },
    moviePosterFrame: {
      width: 120,
      height: 178,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: colors.canvasAlt,
      borderWidth: 1,
      borderColor: colors.line,
    },
    moviePosterFrameGrid: {
      width: 82,
      height: 122,
      borderRadius: 12,
    },
    moviePoster: {
      width: '100%',
      height: '100%',
    },
    moviePosterFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moviePosterFallbackGrid: {
      minHeight: 0,
    },
    movieBody: {
      flex: 1,
      gap: spacing.xs,
      justifyContent: 'flex-start',
      minWidth: 0,
    },
    movieEyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: semanticColors.movieGold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    movieTitle: {
      fontFamily: fonts.heading,
      fontSize: 26,
      color: colors.ink,
      ...protectTextFromFontClipping(fonts.heading, 26),
    },
    movieTitleGrid: {
      fontSize: 18,
      lineHeight: 21,
      ...protectTextFromFontClipping(fonts.heading, 18),
    },
    movieRatingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
    },
    movieRatingRowGrid: {
      gap: 2,
      flexWrap: 'nowrap',
      alignItems: 'center',
    },
    movieRatingText: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: semanticColors.movieGold,
      marginLeft: 4,
    },
    movieRatingTextGrid: {
      fontSize: 10,
      marginLeft: 2,
    },
    movieReviewText: {
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 20,
      color: colors.ink,
      marginTop: spacing.xs,
    },
    movieReviewTextGrid: {
      fontSize: 12,
      lineHeight: 16,
    },
    movieAuthor: {
      fontFamily: fonts.handwritten,
      fontSize: 16,
      color: colors.inkSoft,
    },
    mediaCardShell: {
      width: '100%',
      paddingVertical: spacing.sm,
      alignItems: 'stretch',
    },
    mediaCard: {
      width: '100%',
      maxWidth: 390,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: withAlpha(colors.white, 0.18),
      backgroundColor: withAlpha(colors.paper, 0.56),
      overflow: 'hidden',
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 5,
    },
    mediaCardGrid: {
      width: 260,
      maxWidth: 260,
      borderRadius: 18,
    },
    mediaCardBlur: {
      padding: spacing.md,
      gap: spacing.md,
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    mediaCardBlurGrid: {
      padding: spacing.xs,
    },
    mediaFrame: {
      alignSelf: 'stretch',
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: colors.canvasAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line + '66',
    },
    mediaVideoOnlyFrame: {
      alignSelf: 'stretch',
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: '#111',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.line + '66',
    },
    mediaImage: {
      width: '100%',
      resizeMode: 'cover',
    },
    mediaImageFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.canvasAlt,
    },
    mediaCaption: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 21,
      color: colors.ink,
    },
    mediaCaptionGrid: {
      fontSize: 12,
      lineHeight: 17,
    },
    mediaMetaRow: {
      alignItems: 'center',
    },

    /* ── Polaroid card ── */
    tape: {
      width: 48,
      height: 14,
      backgroundColor: 'rgba(255,255,220,0.35)',
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: -7,
      zIndex: 1,
    },
    tapeGhost: {
      backgroundColor: 'rgba(255,255,220,0.18)',
    },
    card: {
      width: 260,
      borderRadius: 5,
      backgroundColor: POLAROID_FRAME,
      borderWidth: 1,
      borderColor: 'rgba(180,170,155,0.34)',
      paddingTop: CARD_PADDING_TOP,
      paddingHorizontal: CARD_PADDING_SIDE,
      paddingBottom: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 6,
      overflow: 'hidden',
    },
    polaroidLiquidSheen: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 5,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.72)',
      backgroundColor: 'rgba(255,255,255,0.035)',
    },
    cardGhost: {
      borderColor: 'rgba(180,170,155,0.22)',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      opacity: 0.82,
    },
    photoFrame: {
      borderRadius: 1,
      overflow: 'hidden',
      backgroundColor: '#000000',
      // Subtle border to define the photo inset
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.14)',
    },
    photoFrameGhost: {
      backgroundColor: 'rgba(237,232,221,0.58)',
      borderColor: 'rgba(0,0,0,0.05)',
    },
    photoGhostSurface: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
      backgroundColor: '#DCD7CC',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoGhostBlock: {
      width: '100%',
      overflow: 'hidden',
      backgroundColor: '#DCD7CC',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoGhostBloom: {
      position: 'absolute' as const,
      width: '72%',
      height: '72%',
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.2)',
      transform: [{ rotate: '-8deg' }],
    },
    photoGhostBand: {
      position: 'absolute' as const,
      left: -22,
      right: -22,
      height: '36%',
      backgroundColor: 'rgba(255,255,255,0.11)',
      transform: [{ rotate: '-12deg' }],
    },
    photoPlaceholderArea: {
      height: 200,
      backgroundColor: colors.canvasAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoFallbackSurface: {
      minHeight: 220,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
    photoFallbackLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
    },
    image: { width: '100%', transform: [{ scale: 1.01 }] },
    imageLoading: { opacity: 0 },
    photoPlaceholder: { fontSize: 36 },
    dateStamp: {
      position: 'absolute' as const,
      bottom: 8,
      right: 8,
      fontFamily: 'Courier',
      fontWeight: '700' as const,
      fontSize: 12,
      color: colors.accent,
      textShadowColor: 'rgba(0,0,0,0.7)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
      zIndex: 30,
      pointerEvents: 'none' as const,
    },
    bottomStrip: {
      paddingTop: spacing.sm,
      paddingBottom: CARD_PADDING_BOTTOM - CARD_PADDING_TOP,
      gap: spacing.xs,
      minHeight: FRONT_BOTTOM_MIN_HEIGHT,
      justifyContent: 'flex-start',
    },
    textSlot: {
      minHeight: FRONT_TEXT_SLOT_HEIGHT,
      justifyContent: 'flex-start',
    },
    polaroidVoiceSlot: {
      minHeight: FRONT_TEXT_SLOT_HEIGHT,
      justifyContent: 'center',
      marginTop: -2,
    },
    date: {
      fontFamily: fonts.handwrittenBold,
      fontSize: 14,
      color: colors.accent,
      letterSpacing: 0.3,
      ...protectTextFromFontClipping(fonts.handwrittenBold, 14),
    },
    text: {
      fontFamily: fonts.handwritten,
      fontSize: 17,
      lineHeight: FRONT_TEXT_LINE_HEIGHT,
      color: colors.ink,
      ...protectTextFromFontClipping(fonts.handwritten, 17),
    },
    author: {
      fontFamily: fonts.handwritten,
      fontSize: 15,
      color: colors.inkSoft,
      ...protectTextFromFontClipping(fonts.handwritten, 15),
    },

    /* ── Back face ── */
    backCard: {
      flexDirection: 'column',
      paddingBottom: CARD_PADDING_SIDE,
    },
    backContent: {
      flex: 1,
      minHeight: 0,
    },
    backLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: spacing.sm,
    },
    backText: {
      fontFamily: fonts.handwritten,
      fontSize: 17,
      lineHeight: 24,
      color: FRAME_INK,
      flex: 1,
      minHeight: 120,
      padding: 0,
      ...protectTextFromFontClipping(fonts.handwritten, 17),
    },
    backFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(128,128,128,0.2)',
      paddingTop: spacing.sm,
      marginTop: spacing.md,
    },
    backLocationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    backLocationText: {
      flex: 1,
      fontFamily: fonts.handwritten,
      fontSize: 14,
      lineHeight: 19,
      textAlign: 'center',
      ...protectTextFromFontClipping(fonts.handwritten, 14),
    },
    flipHint: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.inkMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
    },

    /* ── Polaroid curing ── */
    darkOverlay: {
      position: 'absolute' as const,
      top: -2,
      right: -2,
      bottom: -2,
      left: -2,
      backgroundColor: '#000000',
      zIndex: 20,
      pointerEvents: 'none',
    },
    warmOverlay: {
      position: 'absolute' as const,
      top: -2,
      right: -2,
      bottom: -2,
      left: -2,
      backgroundColor: '#D4A76A',
      zIndex: 21,
      pointerEvents: 'none',
    },
    shakeBoostOverlay: {
      position: 'absolute' as const,
      top: -2,
      right: -2,
      bottom: -2,
      left: -2,
      backgroundColor: 'rgba(255,236,180,0.18)',
      zIndex: 22,
      pointerEvents: 'none',
    },
    developingLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.error,
      textAlign: 'center',
      fontStyle: 'italic',
      marginTop: spacing.xs,
    },
    filterOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 3,
      pointerEvents: 'none' as const,
    },

    /* ── Photo realism overlays ── */
    warmBaseTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(210,180,140,0.04)',
      zIndex: 4,
      pointerEvents: 'none' as const,
    },
    photoSheen: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 5,
      pointerEvents: 'none' as const,
    },
    insetShadowTop: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: 6,
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      // Simulate inset shadow with a gradient-like dark strip
      opacity: 1,
      zIndex: 6,
      pointerEvents: 'none' as const,
      borderBottomWidth: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    insetShadowLeft: {
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
    /* ── Ambient shadow wrapper ── */
    ambientShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 26,
      elevation: 4,
    },
  });
