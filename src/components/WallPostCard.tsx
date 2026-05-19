import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, TextInput, View, type GestureResponderEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

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
import { LivePolaroidLayer } from './LivePolaroidLayer';
import { MemoryPhotoEffects, MemoryPhotoGhost } from './memory-card';
import { MemoryStyledText } from './MemoryStyledText';
import { SongMemoryCard } from './SongMemoryCard';
import { WallPost } from '../types/domain';
import { protectTextFromFontClipping } from '../theme/fontProtection';
import type { FontSet } from '../theme/typography';
import { spacing } from '../theme/tokens';

interface WallPostCardProps {
  authorName: string;
  post: WallPost;
  cardColor?: string | null;
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
  onPress?: () => void;
  onLongPress?: () => void;
  onReferencedPostPress?: (postId: string) => void;
  onFlip?: (showingBack: boolean) => void;
  onImageReady?: (postId: string) => void;
  onSaveBackText?: (postId: string, text: string) => void;
}

export function WallPostCard({ authorName, post, cardColor, themeColors, imageLoadEnabled = true, displayMode = 'timeline', editing: editMode, preview, shareable, livePolaroidScope, livePolaroidForcePlayback, autoPlaySongPreviewKey, referencedPost, referencedPostAuthorName, onPress, onLongPress, onReferencedPostPress, onFlip, onImageReady, onSaveBackText }: WallPostCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors: appColors, fonts } = useTheme();
  const { isPremium } = usePremium();
  const colors = themeColors ?? appColors;
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [frontHeight, setFrontHeight] = useState(0);
  const imageState = usePolaroidImageReady(post.imageUri, imageLoadEnabled);

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
    createdAt: post.createdAt,
    disabled: showBack,
    imageLoadEnabled,
    imageUri: post.imageUri,
    isPremium,
    postId: post.id,
    preview,
  });

  // Stable tilt per memory so scaled reference previews match the original card.
  const tilt = useMemo(() => getStablePolaroidTilt(post.id), [post.id]);

  useEffect(() => {
    if (!post.imageUri || !imageLoadEnabled) {
      setAspectRatio(null);
      return;
    }

    if (post.imageUri) {
      Image.getSize(
        post.imageUri,
        (w, h) => { if (h > 0) setAspectRatio(w / h); },
        () => setAspectRatio(null),
      );
    }
  }, [imageLoadEnabled, post.imageUri]);

  useEffect(() => {
    if (!post.imageUri || !imageLoadEnabled || !imageState.imageReady) return;
    onImageReady?.(post.id);
  }, [imageLoadEnabled, imageState.imageReady, onImageReady, post.id, post.imageUri]);

  const onFrameLayout = (e: LayoutChangeEvent) => {
    setFrameWidth(e.nativeEvent.layout.width);
  };

  const date = getWallPostMemoryDate(post);
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Classic film-camera date stamp: YY.MM.DD HH:MM
  const stampText = post.dateStamp
    ? `${String(date.getFullYear()).slice(-2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    : null;

  const imageHeight = aspectRatio && frameWidth > 0
    ? frameWidth / aspectRatio
    : 260;

  const bg = cardColor || POLAROID_FRAME;
  // On the default ivory frame, always use dark ink (readable in any theme mode).
  // On custom card colors, use computed contrast colors.
  const frameDefault = !cardColor;
  const ct = frameDefault ? FRAME_INK : contrastText(cardColor);
  const ctSoft = frameDefault ? FRAME_INK_SOFT : contrastTextSoft(cardColor);
  const ctAccent = frameDefault ? colors.accent : contrastAccent(cardColor, colors.accent);

  const standaloneSong = post.postType === 'song' ? post.song : null;
  const attachedSong = post.postType !== 'song' ? post.song : null;
  const movie = post.postType === 'movie' ? post.movie : null;
  const showInlineShareButton = !!shareable && !attachedSong;
  const standaloneSongKey = standaloneSong ? `${standaloneSong.provider}:${standaloneSong.providerTrackId}` : null;
  const attachedSongKey = attachedSong ? `${attachedSong.provider}:${attachedSong.providerTrackId}` : null;
  const isTextOnly = !standaloneSong && !post.imageUri;
  const textOnlyTypography = useMemo(
    () => resolveWallPostTextStyle(fonts, post.textFont, post.textSize),
    [fonts, post.textFont, post.textSize],
  );
  const textOnlyColor = useMemo(() => resolveWallPostTextColor(post.textColor, colors), [colors, post.textColor]);
  const showDevelopingStatus = imageLoadEnabled && cure.developing && (editMode || !showBack);
  const isPolaroidGhost = !!post.imageUri && !imageState.imageReady;
  const showShareButton = !post.imageUri || imageState.imageReady;
  const syncStatus = post.syncStatus && post.syncStatus !== 'synced' ? post.syncStatus : null;
  const syncLabel = syncStatus === 'saving'
    ? 'Saving...'
    : syncStatus === 'waiting'
      ? 'Waiting for connection'
      : syncStatus === 'failed'
        ? 'Tap to retry'
        : null;
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
        color={syncStatus === 'failed' ? colors.error : colors.inkSoft}
      />
      <Text style={[styles.syncStatusText, syncStatus === 'failed' && { color: colors.error }]}>{syncLabel}</Text>
    </Pressable>
  ) : null;
  const promptIconName = post.promptType === 'photo_reference' ? 'images-outline' : post.promptType === 'text' ? 'chatbubble-ellipses-outline' : 'sparkles-outline';
  const promptQuestionElement = post.promptText ? (
    <View style={styles.promptQuestion}>
      <View style={styles.promptQuestionHeader}>
        <Ionicons name={promptIconName} size={13} color={colors.accent} />
        <Text style={styles.promptQuestionLabel}>Prompt question</Text>
      </View>
      <Text style={styles.promptQuestionText}>{post.promptText}</Text>
    </View>
  ) : null;
  const polaroidPromptQuestionElement = post.promptText ? (
    <View style={styles.polaroidPromptQuestion}>
      <View style={styles.promptQuestionHeader}>
        <Ionicons name={promptIconName} size={12} color={ctAccent} />
        <Text style={[styles.polaroidPromptQuestionLabel, { color: ctAccent }]}>Prompt question</Text>
      </View>
      <Text style={[styles.polaroidPromptQuestionText, { color: ct }]}>{post.promptText}</Text>
    </View>
  ) : null;
  const referencedPhotoElement = post.referencedWallPostId ? (
    <ReferencedPolaroidPreview
      post={referencedPost ?? null}
      authorName={referencedPostAuthorName}
      fallbackText="Referenced polaroid"
      styles={styles}
      colors={colors}
      onPress={onReferencedPostPress ? () => onReferencedPostPress(post.referencedWallPostId!) : undefined}
    />
  ) : null;
  const photoContent = imageState.showImage ? (
    <>
      {isPolaroidGhost ? (
        <MemoryPhotoGhost style={styles.photoGhostSurface} />
      ) : null}
      <Image
        source={{ uri: post.imageUri! }}
        style={[styles.image, { height: imageHeight }, isPolaroidGhost && styles.imageLoading]}
        fadeDuration={0}
        blurRadius={cure.imageBlur}
        onLoad={imageState.handleImageLoad}
        onError={imageState.handleImageError}
      />
      {post.videoUri && !isPolaroidGhost ? (
        <LivePolaroidLayer videoUri={post.videoUri} colors={colors} scope={livePolaroidScope} forceMuted={post.videoMuted} forcePlayback={livePolaroidForcePlayback} />
      ) : null}
      {!isPolaroidGhost ? (
        <MemoryPhotoEffects
          dateStamp={stampText}
          dateStampStyle={styles.dateStamp}
          developingDateOpacity={cure.developing ? 1 - cure.darkOverlay : undefined}
          filterKey={post.filter}
        >
          {cure.developing ? (
            <>
              <View style={[styles.darkOverlay, { opacity: cure.darkOverlay }]} />
              {cure.warmOverlay > 0 && <View style={[styles.warmOverlay, { opacity: cure.warmOverlay }]} />}
              {shakeFeedback !== 'idle' && <View style={styles.shakeBoostOverlay} />}
            </>
          ) : null}
        </MemoryPhotoEffects>
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

  if (standaloneSong) {
    return (
      <View style={styles.promptWrappedCard}>
        <SongMemoryCard
          key={standaloneSongKey}
          song={standaloneSong}
          postId={post.id}
          body={post.body}
          authorName={authorName}
          createdAt={getWallPostMemoryDateValue(post)}
          themeColors={colors}
          preview={preview}
          editing={editMode}
          autoPlayKey={autoPlaySongPreviewKey}
          promptContent={promptQuestionElement}
          onPress={onPress}
        />
      </View>
    );
  }

  if (movie) {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} disabled={!onPress && !onLongPress} style={({ pressed }) => [styles.movieCardShell, pressed && (onPress || onLongPress) && styles.pressed]}>
        <View style={[styles.movieCard, displayMode === 'grid' && styles.movieCardGrid]}>
          {promptQuestionElement}
          <View style={[styles.movieHeader, displayMode === 'grid' && styles.movieHeaderGrid]}>
            <View style={[styles.moviePosterFrame, displayMode === 'grid' && styles.moviePosterFrameGrid]}>
              {movie.posterUrl ? (
                <Image source={{ uri: movie.posterUrl }} style={styles.moviePoster} />
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
                  <Ionicons key={value} name={getStarIcon(movie.reviewRating ?? 0, value)} size={displayMode === 'grid' ? 15 : 20} color={colors.accent} />
                ))}
                <Text style={[styles.movieRatingText, displayMode === 'grid' && styles.movieRatingTextGrid]}>{formatStars(movie.reviewRating)}</Text>
              </View>
              {post.body ? <Text style={[styles.movieReviewText, displayMode === 'grid' && styles.movieReviewTextGrid]} numberOfLines={displayMode === 'grid' ? 4 : undefined}>{post.body}</Text> : null}
              <Text style={styles.movieAuthor} numberOfLines={1}>— {authorName}</Text>
            </View>
          </View>
          {syncStatusElement}
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
    <View style={styles.cardWithStatus}>
      <Pressable onPress={onPress} onLongPress={onLongPress} disabled={!onPress && !onLongPress} style={({ pressed }) => [styles.wrapper, pressed && (onPress || onLongPress) && styles.pressed]}>
        <View style={[styles.textOnlyCard, displayMode === 'grid' && styles.textOnlyCardGrid, { transform: [{ rotate: `${tilt}deg` }] }]}> 
          {promptQuestionElement}
          {referencedPhotoElement}
          <Text style={styles.textOnlyDate}>{formatted}</Text>
          {post.body ? (
            <MemoryStyledText
              text={post.body}
              effect={post.textEffect}
              color={textOnlyColor}
              accentColor={textOnlyColor}
              paperColor={colors.paper}
              style={[styles.textOnlyBody, textOnlyTypography]}
            />
          ) : null}
          <Text style={styles.textOnlyAuthor}>— {authorName}</Text>
        </View>
      </Pressable>
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
                <View renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.card, isPolaroidGhost && styles.cardGhost, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] }]}> 
                  {polaroidPromptQuestionElement}
                  <View style={[styles.photoFrame, isPolaroidGhost && styles.photoFrameGhost]} onLayout={onFrameLayout}>
                    {photoContent}
                  </View>
                  <View style={styles.bottomStrip}>
                    <Text style={[styles.date, { color: ctAccent }]}>{formatted}</Text>
                    <View style={styles.textSlot}>
                      {post.body ? <Text style={[styles.text, { color: ct }]} numberOfLines={FRONT_TEXT_LINES}>{post.body}</Text> : null}
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
                      <View renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.card, isPolaroidGhost && styles.cardGhost, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] }]}> 
                        {polaroidPromptQuestionElement}
                        <View style={[styles.photoFrame, isPolaroidGhost && styles.photoFrameGhost]} onLayout={onFrameLayout}>
                          {photoContent}
                        </View>
                        <View style={styles.bottomStrip}>
                          <Text style={[styles.date, { color: ctAccent }]}>{formatted}</Text>
                          <View style={styles.textSlot}>
                            {post.body ? <Text style={[styles.text, { color: ct }]} numberOfLines={FRONT_TEXT_LINES}>{post.body}</Text> : null}
                          </View>
                          <Text style={[styles.author, { color: ctSoft }]}>— {authorName}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
 
                  <View pointerEvents={showBack ? 'auto' : 'none'} style={[styles.flipFaceOverlay, !showBack && styles.hiddenFace]}>
                    <View style={styles.ambientShadow}>
                      <View style={styles.tape} />
                      <View renderToHardwareTextureAndroid shouldRasterizeIOS style={[styles.card, styles.backCard, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] }, frontHeight > 0 && { height: frontHeight }]}> 
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
                              {post.backText || (canEditBack ? 'Tap to write…' : '')}
                            </Text>
                          </Pressable>
                        )}
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
          <Ionicons name="share-outline" size={18} color={colors.inkSoft} />
        </Pressable>
      )}
    </View>
  );

  const memoryContent = isTextOnly ? textOnlyMemory : polaroidMemory;

  if (attachedSong) {
    const attachedMemoryContent = shareable ? (
      <View ref={memoryOnlyCaptureRef} collapsable={false} style={styles.memoryOnlyCapture}>
        {memoryContent}
      </View>
    ) : memoryContent;
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
        autoPlayKey={autoPlaySongPreviewKey}
        shareable={shareable}
        shareMemoryRef={memoryOnlyCaptureRef}
        onPress={editMode ? onPress : undefined}
      >
        {attachedMemoryContent}
      </SongMemoryCard>
    );
  }

  return memoryContent;
}

const CARD_PADDING_SIDE = 14;
const CARD_PADDING_TOP = 12;
const CARD_PADDING_BOTTOM = 38;
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

function ReferencedPolaroidPreview({
  post,
  authorName,
  fallbackText,
  styles,
  colors,
  onPress,
}: {
  post: WallPost | null;
  authorName?: string;
  fallbackText: string;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorTokens;
  onPress?: () => void;
}) {
  const preview = (
    <View style={styles.referencePreviewBlock}>
      <View style={styles.referenceHeader}>
        <Ionicons name="albums-outline" size={13} color={colors.accent} />
        <Text style={styles.referenceLabel}>Referenced polaroid</Text>
      </View>
      <View style={styles.referencePolaroidViewport}>
        {post ? (
          <View pointerEvents="none" style={styles.referenceScaledPolaroidStage}>
            <WallPostCard
              authorName={authorName ?? 'Someone'}
              post={post}
              cardColor={post.cardColor}
              themeColors={colors}
              preview
            />
          </View>
        ) : (
          <View style={styles.referenceFallback}>
            <Ionicons name="image-outline" size={36} color={colors.inkMuted} />
            <Text style={styles.referenceFallbackText}>{fallbackText}</Text>
          </View>
        )}
      </View>
      {onPress ? <Text style={styles.referenceHint}>Tap to find this polaroid</Text> : null}
    </View>
  );

  if (!onPress) return preview;
  return (
    <Pressable
      onPress={(event: GestureResponderEvent) => {
        event.stopPropagation();
        onPress();
      }}
      onStartShouldSetResponder={() => true}
      accessibilityRole="button"
      accessibilityLabel="Find referenced polaroid"
    >
      {preview}
    </Pressable>
  );
}

function getStablePolaroidTilt(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return (hash / 0xffffffff - 0.5) * 5;
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
      alignItems: 'center',
      gap: spacing.xs,
    },
    promptQuestion: {
      alignSelf: 'stretch',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.accent + '33',
      backgroundColor: colors.accent + '10',
      padding: spacing.sm,
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
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    promptQuestionText: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink,
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
    referencePreviewBlock: {
      alignSelf: 'stretch',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.accent + '26',
      backgroundColor: colors.paper + 'D9',
      padding: spacing.md,
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    referenceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    referenceLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    referencePolaroidViewport: {
      width: 214,
      height: 306,
      alignItems: 'center',
      justifyContent: 'flex-start',
      overflow: 'visible',
    },
    referenceScaledPolaroidStage: {
      width: 260,
      alignItems: 'center',
      transform: [{ scale: 0.76 }],
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
    referenceHint: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.accent,
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
      alignItems: 'center' as const,
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    textOnlyCardGrid: {
      width: 260,
      paddingHorizontal: spacing.md,
    },
    textOnlyBody: {
      textAlign: 'center' as const,
    },
    textOnlyDate: {
      fontFamily: fonts.handwritten,
      fontSize: 13,
      color: colors.accent,
      ...protectTextFromFontClipping(fonts.handwritten, 13),
    },
    textOnlyAuthor: {
      fontFamily: fonts.handwritten,
      fontSize: 14,
      color: colors.inkSoft,
      ...protectTextFromFontClipping(fonts.handwritten, 14),
    },
    movieCardShell: {
      width: '100%',
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    movieCard: {
      width: '100%',
      maxWidth: 390,
      borderRadius: 24,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.md,
      gap: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      elevation: 5,
    },
    movieCardGrid: {
      width: 260,
      maxWidth: 260,
      borderRadius: 18,
      padding: spacing.sm,
      gap: spacing.sm,
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
      color: colors.accent,
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
      color: colors.accent,
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
      borderRadius: 3,
      backgroundColor: POLAROID_FRAME,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(180,170,155,0.4)',
      paddingTop: CARD_PADDING_TOP,
      paddingHorizontal: CARD_PADDING_SIDE,
      paddingBottom: 0,
      // Contact shadow (tight, dark)
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 5,
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
      paddingBottom: CARD_PADDING_SIDE,
    },
    backContent: {
      flex: 1,
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
      gap: 2,
      marginTop: spacing.md,
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
      color: colors.inkMuted,
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
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
    },
  });
