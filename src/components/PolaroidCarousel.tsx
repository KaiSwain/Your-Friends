import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
  useWindowDimensions,
} from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { contrastText, contrastTextSoft } from '../lib/contrastText';
import { PeopleListItem } from '../types/domain';
import { protectTextFromFontClipping } from '../theme/fontProtection';
import type { FontSet } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { CardFlourish } from './CardFlourish';
import { CachedRemoteImage, prefetchCachedImages } from './CachedRemoteImage';
import { LivePolaroidLayer } from './LivePolaroidLayer';
import { AvatarInitials, MemoryPhotoEffects, MemoryPhotoGhost } from './memory-card';

const PIN_CAROUSEL_IMAGE = require('../../assets/icons/pin_carosel.png');

interface PolaroidCarouselProps {
  activeIndex: number;
  items: PeopleListItem[];
  onIndexChange: (index: number) => void;
  onPressItem: (item: PeopleListItem) => void;
  onLongPressItem?: (item: PeopleListItem) => void;
  getUnreadCount?: (item: PeopleListItem) => number;
  loop?: boolean;
  livePolaroidScope?: string;
}

// Triplicate — just enough to scroll left/right and teleport back to centre copy.
const COPIES = 3;

// Warm ivory — real Polaroid frames are never pure white.
const POLAROID_FRAME = '#F5F2EA';
// Dark ink colors for text on Polaroid frame (always light ivory regardless of theme)
const FRAME_INK = '#2A2218';
const FRAME_INK_SOFT = '#6B6052';

// Real Polaroid proportions — thicker bottom than top/sides.
const CARD_PAD_TOP = 10;
const CARD_PAD_SIDE = 10;
const BOTTOM_STRIP_PAD_TOP = 6;
const BOTTOM_STRIP_PAD_BOTTOM = 28;
const CAROUSEL_NOTE_LINES = 2;
const CAROUSEL_NOTE_LINE_HEIGHT = 18;
const PIN_OVERHANG_SPACE = 36;

// Deterministic "random" tilt from item id so it's stable across re-renders.
function stableTilt(id: string, range: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((((h >>> 0) % 1000) / 1000) - 0.5) * range;
}

function getCarouselImageKey(item: PeopleListItem) {
  return `${item.id}:${item.imageUri ?? 'none'}`;
}

function getCarouselCellKey(item: PeopleListItem, index: number) {
  return `${index}:${item.pinned ? 'pinned' : 'unpinned'}:${getCarouselImageKey(item)}`;
}

function itemBadgeReservedSpace(items: PeopleListItem[]) {
  return items.some((item) => item.isPremium) ? 74 : 40;
}

type ProfileLoadEntry = { key: string; uri?: string };

function buildProfileLoadBatches(items: PeopleListItem[]) {
  const batches: ProfileLoadEntry[][] = [];
  const seenKeys = new Set<string>();

  const getEntry = (index: number) => {
    const item = items[index];
    if (!item) return null;
    const key = getCarouselImageKey(item);
    if (seenKeys.has(key)) return null;
    seenKeys.add(key);
    return { key, uri: item.imageUri ?? undefined };
  };

  const pushBatch = (indexes: number[]) => {
    const batch: ProfileLoadEntry[] = [];
    for (const index of indexes) {
      const entry = getEntry(index);
      if (entry) batch.push(entry);
    }
    if (batch.length > 0) batches.push(batch);
  };

  pushBatch([0]);
  for (let distance = 1; distance < items.length; distance++) {
    pushBatch([distance, items.length - distance]);
  }

  return batches;
}

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList<PeopleListItem>,
);

export function PolaroidCarousel({ activeIndex, items, onIndexChange, onPressItem, onLongPressItem, getUnreadCount, loop = true, livePolaroidScope }: PolaroidCarouselProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [readyImages, setReadyImages] = useState<Record<string, true>>({});
  const [failedImages, setFailedImages] = useState<Record<string, true>>({});
  const [loadableProfiles, setLoadableProfiles] = useState<Record<string, true>>({});
  const prefetchedImageKeysRef = useRef(new Set<string>());
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList<PeopleListItem>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const compact = width < 390;
  const cardWidth = Math.min(width * 0.65, 299);
  const gap = spacing.md;
  const snapInterval = cardWidth + gap;
  // Each item occupies snapInterval wide. To centre item N the scroll offset is
  // N * snapInterval. With paddingHorizontal = sideInset the visible card centre
  // lands at sideInset + snapInterval/2 which must equal width/2.
  const sideInset = (width - snapInterval) / 2;
  const photoSize = cardWidth - CARD_PAD_SIDE * 2;
  const noteSlotHeight = CAROUSEL_NOTE_LINES * CAROUSEL_NOTE_LINE_HEIGHT;
  const bottomStripMinHeight = compact ? 120 : 127;
  const cardMinHeight = photoSize + CARD_PAD_TOP + bottomStripMinHeight;
  const aboveCardSpace = spacing.md + PIN_OVERHANG_SPACE;
  // Reserve only enough room for the status row / caption without pushing the profile meta too far down.
  const belowCardSpace = itemBadgeReservedSpace(items);
  const listHeight = aboveCardSpace + cardMinHeight + belowCardSpace;
  const initialsSize = compact ? 57 : 70;
  const nameSize = compact ? 26 : 31;

  const count = items.length;
  // Looping only makes sense with more than one card. When disabled (e.g. during
  // a search that has already narrowed the list), render items once so the same
  // card doesn't appear to repeat forever.
  const shouldLoop = loop && count > 1;
  const profileLoadBatches = useMemo(() => buildProfileLoadBatches(items), [items]);

  useEffect(() => {
    const nextBatch = profileLoadBatches.find((batch) => (
      !batch.every(({ key, uri }) => loadableProfiles[key] && (!uri || readyImages[key] || failedImages[key]))
    ));
    if (!nextBatch || nextBatch.every(({ key }) => loadableProfiles[key])) return;

    setLoadableProfiles((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const { key } of nextBatch) {
        if (next[key]) continue;
        next[key] = true;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [failedImages, loadableProfiles, profileLoadBatches, readyImages]);

  useEffect(() => {
    const imagesToPrefetch: { key: string; uri: string }[] = [];

    for (const batch of profileLoadBatches) {
      for (const { key, uri } of batch) {
        if (!uri || !loadableProfiles[key] || readyImages[key] || failedImages[key] || prefetchedImageKeysRef.current.has(key)) continue;
        imagesToPrefetch.push({ key, uri });
      }
    }

    for (const image of imagesToPrefetch) {
      prefetchedImageKeysRef.current.add(image.key);
    }
    prefetchCachedImages(imagesToPrefetch.map((image) => image.uri)).catch(() => undefined);
  }, [failedImages, loadableProfiles, profileLoadBatches, readyImages]);

  // 3 copies of the list when looping: [copy0 | copy1 (centre) | copy2]. When
  // not looping, just the items once.
  const loopedData = useMemo(() => {
    if (count === 0) return [];
    if (!shouldLoop) return items;
    const arr: PeopleListItem[] = [];
    for (let c = 0; c < COPIES; c++) {
      for (let i = 0; i < count; i++) arr.push(items[i]);
    }
    return arr;
  }, [items, count, shouldLoop]);

  // FlatList needs exact item layout for initialScrollIndex + snap to work reliably.
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: snapInterval,
      offset: snapInterval * index,
      index,
    }),
    [snapInterval],
  );

  // When scroll settles, compute real index and teleport to centre copy if needed.
  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (count === 0) return;
      const offsetX = event.nativeEvent.contentOffset.x;
      const virtualIndex = Math.round(offsetX / snapInterval);
      const realIndex = ((virtualIndex % count) + count) % count;

      onIndexChange(realIndex);

      // If we scrolled into the first or last copy, silently jump to centre copy.
      if (shouldLoop && (virtualIndex < count || virtualIndex >= count * 2)) {
        const centreTarget = count + realIndex;
        flatListRef.current?.scrollToIndex({ index: centreTarget, animated: false });
      }
    },
    [count, snapInterval, onIndexChange, shouldLoop],
  );

  // Track which item is closest to the centre while scrolling for live index updates.
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        // We don't call onIndexChange here to avoid fighting with handleMomentumEnd.
      }
    },
  ).current;

  const renderCarouselItem = useCallback(({ item, index }: { item: PeopleListItem; index: number }) => {
    const imageKey = getCarouselImageKey(item);
    const cardRenderKey = `${item.pinned ? 'pinned' : 'unpinned'}:${imageKey}`;
    const profileLoadAllowed = !!loadableProfiles[imageKey];
    const hasRemoteImage = !!item.imageUri && !failedImages[imageKey];
    const imageReady = !!readyImages[imageKey];
    const isPolaroidGhost = hasRemoteImage && (!profileLoadAllowed || !imageReady);
    const showImage = hasRemoteImage && profileLoadAllowed;
    const inputRange = [
      (index - 1) * snapInterval,
      index * snapInterval,
      (index + 1) * snapInterval,
    ];
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.85, 1, 0.85],
      extrapolate: 'clamp',
    });
    const cardOpacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.65, 1, 0.65],
      extrapolate: 'clamp',
    });

    const frameDefault = !item.cardColor;
    const ct = frameDefault ? FRAME_INK : contrastText(item.cardColor);
    const ctSoft = frameDefault ? FRAME_INK_SOFT : contrastTextSoft(item.cardColor);
    const bg = item.cardColor || POLAROID_FRAME;
    const unread = getUnreadCount?.(item) ?? 0;
    const isConnected = item.entityType === 'user' || !!item.linkedUserId;
    const needsLink = !isConnected && !!item.suggestedLinkedUserId;
    const realIndex = count > 0 ? ((index % count) + count) % count : index;
    const isFocusedCarouselItem = realIndex === activeIndex;

    const tilt = stableTilt(item.id, 5);

    return (
      <Animated.View
        style={{
          width: snapInterval,
          alignItems: 'center' as const,
          transform: [{ scale }],
          opacity: cardOpacity,
        }}
      >
        <View style={[styles.ambientShadow, item.isPremium && styles.premiumGlow]}>
          {item.pinned ? (
            <View style={styles.pinSlot} pointerEvents="none">
              <Image source={PIN_CAROUSEL_IMAGE} style={styles.carouselPinImage} resizeMode="contain" />
            </View>
          ) : (
            <View style={[styles.tape, isPolaroidGhost && styles.tapeGhost]} />
          )}
          <Pressable
            key={cardRenderKey}
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            onPress={() => onPressItem(item)}
            onLongPress={onLongPressItem ? () => onLongPressItem(item) : undefined}
            style={({ pressed }) => [
              styles.card,
              isPolaroidGhost && styles.cardGhost,
              {
                width: cardWidth,
                height: cardMinHeight,
                backgroundColor: bg,
                transform: [{ rotate: `${tilt}deg` }, ...(pressed ? [{ scale: 0.985 }] : [])],
              },
            ]}
          >
            {unread > 0 ? (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
            <View style={[styles.photoFrame, isPolaroidGhost && styles.photoFrameGhost, { width: photoSize, height: photoSize }]}> 
              {showImage ? (
                <>
                  {isPolaroidGhost ? (
                    <MemoryPhotoGhost style={styles.photoGhostSurface} />
                  ) : null}
                  <CachedRemoteImage
                    key={imageKey}
                    uri={item.imageUri!}
                    style={[styles.photoImage, isPolaroidGhost && styles.photoImageLoading]}
                    onLoad={() => setReadyImages((prev) => (prev[imageKey] ? prev : { ...prev, [imageKey]: true }))}
                    onError={() => setFailedImages((prev) => (prev[imageKey] ? prev : { ...prev, [imageKey]: true }))}
                  />
                  {!isPolaroidGhost ? (
                    <>
                      {item.avatarVideoPath ? (
                        <LivePolaroidLayer
                          videoUri={item.avatarVideoPath}
                          colors={colors}
                          scope={livePolaroidScope}
                          playbackEnabled={isFocusedCarouselItem}
                          forceMuted={item.avatarVideoMuted}
                        />
                      ) : null}
                      <MemoryPhotoEffects />
                    </>
                  ) : null}
                </>
              ) : isPolaroidGhost ? (
                <MemoryPhotoGhost style={styles.photoGhostSurface} />
              ) : (
                <View style={[styles.photoSurface, { backgroundColor: item.avatarColor }]}> 
                  <AvatarInitials name={item.title} size={initialsSize * 0.82} />
                </View>
              )}
            </View>
            <View style={[styles.bottomStrip, { minHeight: bottomStripMinHeight }]}> 
              {isPolaroidGhost ? (
                <>
                  <View style={[styles.ghostTextLine, { width: Math.min(cardWidth * 0.58, 120) }]} />
                  <View style={styles.ghostNoteSlot}>
                    <View style={[styles.ghostTextLineSoft, { width: Math.min(cardWidth * 0.72, 150) }]} />
                    <View style={[styles.ghostTextLineSoft, { width: Math.min(cardWidth * 0.46, 98) }]} />
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.name, { fontSize: nameSize, color: ct }, protectTextFromFontClipping(fonts.handwrittenBold, nameSize)]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {item.title}
                  </Text>
                  <View style={[styles.noteSlot, { minHeight: noteSlotHeight }]}> 
                    {item.note ? (
                      <Text style={[styles.note, { color: ctSoft }]} numberOfLines={CAROUSEL_NOTE_LINES} adjustsFontSizeToFit minimumFontScale={0.8}>{item.note}</Text>
                    ) : null}
                  </View>
                </>
              )}
            </View>
            {!isPolaroidGhost ? <CardFlourish size={14} color={ctSoft} opacity={0.28} inset={10} /> : null}
          </Pressable>
        </View>
        {isConnected || needsLink ? (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isConnected ? styles.statusDotOn : styles.statusDotReview]} />
            <Text style={[styles.statusLabel, needsLink && styles.statusLabelReview]}>
              {isConnected ? 'Connected' : 'Needs link'}
            </Text>
          </View>
        ) : null}
        {item.isPremium ? (
          <View style={styles.premiumBadge}>
            <Ionicons name="star" size={10} color="#7A5A1A" />
            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
          </View>
        ) : null}
        {!item.note && item.caption ? (
          <Text style={styles.caption}>{item.caption}</Text>
        ) : null}
      </Animated.View>
    );
  }, [
    bottomStripMinHeight,
    cardMinHeight,
    cardWidth,
    activeIndex,
    count,
    failedImages,
    getUnreadCount,
    initialsSize,
    loadableProfiles,
    nameSize,
    noteSlotHeight,
    onLongPressItem,
    onPressItem,
    photoSize,
    readyImages,
    scrollX,
    snapInterval,
    styles,
  ]);

  if (count === 0) return null;

  return (
    <View style={styles.wrapper}>
      <AnimatedFlatList
        ref={flatListRef as any}
        horizontal
        data={loopedData}
        style={[styles.list, { height: listHeight }]}
        keyExtractor={getCarouselCellKey}
        getItemLayout={getItemLayout}
        initialScrollIndex={shouldLoop ? count + activeIndex : Math.min(activeIndex, Math.max(0, count - 1))}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        directionalLockEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: sideInset, paddingTop: aboveCardSpace, paddingBottom: belowCardSpace }}
        onMomentumScrollEnd={handleMomentumEnd}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        // Keep every loop cell mounted so the seam teleport (e.g. #1 ↔ last)
        // is a pure scroll-offset change. With a tight window, the destination
        // copy's cells were unmounted before the teleport and had to remount in
        // the same frame, briefly exposing neighbor cells (#2) inside the
        // current frame as they were torn down. Loop data is bounded
        // (3 × items) so mounting all of it is cheap.
        initialNumToRender={loopedData.length}
        maxToRenderPerBatch={loopedData.length}
        windowSize={Math.max(3, loopedData.length)}
        removeClippedSubviews={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        renderItem={renderCarouselItem}
      />
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    wrapper: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
      // Break out of parent padding so the carousel spans the full screen width.
      // The parent (AppScreen scroll content) has paddingHorizontal: spacing.lg.
      marginHorizontal: -spacing.lg,
    },
    list: {
      flexGrow: 0,
    },
    card: {
      alignSelf: 'center',
      borderRadius: 5,
      backgroundColor: POLAROID_FRAME,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(180,170,155,0.28)',
      paddingTop: CARD_PAD_TOP,
      paddingHorizontal: CARD_PAD_SIDE,
      paddingBottom: 0,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 8,
      backfaceVisibility: 'hidden',
    },
    cardGhost: {
      backgroundColor: 'rgba(245,242,234,0.58)',
      borderColor: 'rgba(180,170,155,0.22)',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      opacity: 0.82,
    },
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
    pinSlot: {
      width: 48,
      height: 14,
      alignSelf: 'center',
      alignItems: 'center',
      marginBottom: -7,
      zIndex: 4,
      overflow: 'visible' as const,
    },
    carouselPinImage: {
      position: 'absolute' as const,
      top: -28,
      width: 58,
      height: 58,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.16,
      shadowRadius: 4,
    },
    ambientShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.13,
      shadowRadius: 30,
    },
    premiumGlow: {
      shadowColor: '#F5C242',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.95,
      shadowRadius: 22,
      elevation: 12,
    },
    premiumBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'center',
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: '#F8DA7A',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#C99A2A',
      shadowColor: '#F5C242',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 6,
    },
    premiumBadgeText: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 1.4,
      color: '#7A5A1A',
    },
    notifBadge: {
      position: 'absolute',
      top: -13,
      right: -13,
      minWidth: 26,
      height: 26,
      borderRadius: 13,
      paddingHorizontal: 7,
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: colors.canvas,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      elevation: 4,
    },
    notifBadgeText: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.white,
      letterSpacing: 0.2,
    },
    photoFrame: {
      borderRadius: 2,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.055)',
      backfaceVisibility: 'hidden',
    },
    photoFrameGhost: {
      borderColor: 'rgba(0,0,0,0.025)',
      backgroundColor: 'rgba(237,232,221,0.58)',
    },
    photoGhostSurface: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
      backgroundColor: '#DCD7CC',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoGhostBloom: {
      position: 'absolute' as const,
      width: '74%',
      height: '74%',
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.22)',
      transform: [{ rotate: '-8deg' }],
    },
    photoGhostBand: {
      position: 'absolute' as const,
      left: -18,
      right: -18,
      height: '38%',
      backgroundColor: 'rgba(255,255,255,0.12)',
      transform: [{ rotate: '-12deg' }],
    },
    photoSurface: {
      flex: 1,
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoImage: {
      width: '100%',
      height: '100%',
      transform: [{ scale: 1.01 }],
      backfaceVisibility: 'hidden',
    },
    photoImageLoading: {
      opacity: 0,
    },
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
      zIndex: 6,
      pointerEvents: 'none' as const,
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
    photoInitials: {
      fontFamily: fonts.bodyBold,
      color: colors.white,
      textAlign: 'center',
    },
    bottomStrip: {
      alignSelf: 'stretch',
      paddingTop: BOTTOM_STRIP_PAD_TOP,
      paddingBottom: BOTTOM_STRIP_PAD_BOTTOM,
      paddingHorizontal: 16,
      alignItems: 'center',
      gap: 4,
      overflow: 'visible' as const,
      justifyContent: 'flex-start',
    },
    ghostTextLine: {
      height: 12,
      borderRadius: 999,
      backgroundColor: 'rgba(83,74,62,0.12)',
      marginTop: 5,
    },
    ghostNoteSlot: {
      minHeight: 36,
      gap: 7,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 4,
    },
    ghostTextLineSoft: {
      height: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(83,74,62,0.08)',
    },
    noteSlot: {
      width: '100%',
      justifyContent: 'flex-start',
    },
    name: {
      fontFamily: fonts.handwrittenBold,
      color: colors.ink,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 8,
      overflow: 'visible' as const,
    },
    caption: {
      fontFamily: fonts.handwritten,
      fontSize: 13,
      color: colors.accent,
      letterSpacing: 0.3,
      ...protectTextFromFontClipping(fonts.handwritten, 13),
    },
    note: {
      fontFamily: fonts.handwritten,
      fontSize: 14,
      lineHeight: CAROUSEL_NOTE_LINE_HEIGHT,
      color: FRAME_INK_SOFT,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 8,
      overflow: 'visible' as const,
      ...protectTextFromFontClipping(fonts.handwritten, 14),
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 4,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    statusDotOn: {
      backgroundColor: '#34C759',
    },
    statusDotReview: {
      backgroundColor: colors.accent,
    },
    statusDotOff: {
      backgroundColor: '#8E8E93',
    },
    statusLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.inkSoft,
      letterSpacing: 0.3,
    },
    statusLabelReview: {
      color: colors.accent,
    },
  });

