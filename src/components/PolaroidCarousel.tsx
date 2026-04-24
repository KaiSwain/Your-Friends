import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { contrastText, contrastTextSoft } from '../lib/contrastText';
import { PeopleListItem } from '../types/domain';
import type { FontSet } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { CardFlourish } from './CardFlourish';

interface PolaroidCarouselProps {
  activeIndex: number;
  items: PeopleListItem[];
  onIndexChange: (index: number) => void;
  onPressItem: (item: PeopleListItem) => void;
  onLongPressItem?: (item: PeopleListItem) => void;
  getUnreadCount?: (item: PeopleListItem) => number;
  loop?: boolean;
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

// Deterministic "random" tilt from item id so it's stable across re-renders.
function stableTilt(id: string, range: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((((h >>> 0) % 1000) / 1000) - 0.5) * range;
}

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList<PeopleListItem>,
);

export function PolaroidCarousel({ activeIndex, items, onIndexChange, onPressItem, onLongPressItem, getUnreadCount, loop = true }: PolaroidCarouselProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList<PeopleListItem>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const compact = width < 390;
  const cardWidth = Math.min(width * 0.5, 230);
  const gap = spacing.md;
  const snapInterval = cardWidth + gap;
  // Each item occupies snapInterval wide. To centre item N the scroll offset is
  // N * snapInterval. With paddingHorizontal = sideInset the visible card centre
  // lands at sideInset + snapInterval/2 which must equal width/2.
  const sideInset = (width - snapInterval) / 2;
  const photoSize = cardWidth - CARD_PAD_SIDE * 2;
  const noteSlotHeight = CAROUSEL_NOTE_LINES * CAROUSEL_NOTE_LINE_HEIGHT;
  const bottomStripMinHeight = compact ? 92 : 98;
  const cardMinHeight = photoSize + CARD_PAD_TOP + bottomStripMinHeight;
  const aboveCardSpace = spacing.md;
  // Reserve only enough room for the status row / caption without pushing the profile meta too far down.
  const belowCardSpace = 26;
  const listHeight = aboveCardSpace + cardMinHeight + belowCardSpace + spacing.xl;
  const initialsSize = compact ? 44 : 54;
  const nameSize = compact ? 20 : 24;

  const count = items.length;
  // Looping only makes sense with more than one card. When disabled (e.g. during
  // a search that has already narrowed the list), render items once so the same
  // card doesn't appear to repeat forever.
  const shouldLoop = loop && count > 1;

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

  if (count === 0) return null;

  return (
    <View style={styles.wrapper}>
      {/* Scroll position indicator — above cards so it's always visible */}
      <View style={styles.positionRow}>
        <View style={styles.dotRow}>
          {items.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
        <Text style={styles.positionText}>
          {activeIndex + 1} of {count}
        </Text>
      </View>

      <AnimatedFlatList
        ref={flatListRef as any}
        horizontal
        data={loopedData}
        style={[styles.list, { height: listHeight }]}
        keyExtractor={(_: PeopleListItem, index: number) => String(index)}
        getItemLayout={getItemLayout}
        initialScrollIndex={shouldLoop ? count + activeIndex : Math.min(activeIndex, Math.max(0, count - 1))}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        directionalLockEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: sideInset, paddingTop: aboveCardSpace }}
        onMomentumScrollEnd={handleMomentumEnd}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        renderItem={({ item, index }: { item: PeopleListItem; index: number }) => {
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

          // Stable per-card random tilt and subtle photo micro-tilt.
          const tilt = stableTilt(item.id, 5);
          const photoTilt = stableTilt(item.id + '_p', 0.8);

          return (
            <Animated.View
              style={{
                width: snapInterval,
                alignItems: 'center' as const,
                transform: [{ scale }],
                opacity: cardOpacity,
              }}
            >
              <View style={styles.ambientShadow}>
                <View style={styles.tape} />
                <Pressable
                  onPress={() => onPressItem(item)}
                  onLongPress={onLongPressItem ? () => onLongPressItem(item) : undefined}
                  style={({ pressed }) => [
                    styles.card,
                    { width: cardWidth, height: cardMinHeight, backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] },
                    pressed && styles.pressed,
                  ]}
                >
                  {item.pinned && (
                    <View style={styles.pinBadge}>
                      <Ionicons name="pin" size={16} color="#E74C3C" />
                    </View>
                  )}
                  {unread > 0 ? (
                    <View style={styles.notifBadge}>
                      <Text style={styles.notifBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.photoFrame, { width: photoSize, height: photoSize, transform: [{ rotate: `${photoTilt}deg` }] }]}>
                    {item.imageUri ? (
                      <>
                        <Image source={{ uri: item.imageUri }} style={styles.photoImage} fadeDuration={0} />
                        <View style={styles.warmBaseTint} />
                        <LinearGradient
                          colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.06)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.photoSheen}
                        />
                        <View style={styles.insetShadowTop} />
                        <View style={styles.insetShadowLeft} />
                      </>
                    ) : (
                      <View style={[styles.photoSurface, { backgroundColor: item.avatarColor }]}>
                        <Text style={[styles.photoInitials, { fontSize: initialsSize }]}>
                          {getInitials(item.title)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.bottomStrip, { minHeight: bottomStripMinHeight }]}>
                    <Text style={[styles.name, { fontSize: nameSize, color: ct }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                      {item.title}
                    </Text>
                    <View style={[styles.noteSlot, { minHeight: noteSlotHeight }]}> 
                      {item.note ? (
                        <Text style={[styles.note, { color: ctSoft }]} numberOfLines={CAROUSEL_NOTE_LINES} adjustsFontSizeToFit minimumFontScale={0.8}>{item.note}</Text>
                      ) : null}
                    </View>
                  </View>
                  <CardFlourish size={14} color={ctSoft} opacity={0.28} inset={10} />
                </Pressable>
              </View>
              {/* Status row — only shown when actually connected */}
              {isConnected ? (
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, styles.statusDotOn]} />
                  <Text style={styles.statusLabel}>Connected</Text>
                </View>
              ) : null}
              {!item.note && item.caption ? (
                <Text style={styles.caption}>{item.caption}</Text>
              ) : null}
            </Animated.View>
          );
        }}
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
    positionRow: {
      marginTop: spacing.sm,
      marginBottom: spacing.md,
      alignItems: 'center',
      gap: spacing.xs,
    },
    dotRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dotActive: {
      backgroundColor: colors.accent,
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    dotInactive: {
      backgroundColor: colors.inkMuted,
    },
    positionText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkSoft,
      letterSpacing: 0.5,
    },
    card: {
      alignSelf: 'center',
      borderRadius: 3,
      backgroundColor: POLAROID_FRAME,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(180,170,155,0.4)',
      paddingTop: CARD_PAD_TOP,
      paddingHorizontal: CARD_PAD_SIDE,
      paddingBottom: 0,
      alignItems: 'center',
      // Contact shadow (tight, dark)
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 5,
    },
    pressed: { transform: [{ scale: 0.985 }] },
    tape: {
      width: 48,
      height: 14,
      backgroundColor: 'rgba(255,255,220,0.35)',
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: -7,
      zIndex: 1,
    },
    ambientShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
    },
    pinBadge: { position: 'absolute', top: 6, right: 6, zIndex: 1 },
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
      borderRadius: 1,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.045)',
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
      fontFamily: fonts.heading,
      color: colors.white,
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
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 4,
      marginTop: 2,
    },
    tag: {
      backgroundColor: colors.accent + '1A',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    tagText: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    tagMore: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      color: colors.inkMuted,
      alignSelf: 'center',
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
    statusDotOff: {
      backgroundColor: '#8E8E93',
    },
    statusLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.inkSoft,
      letterSpacing: 0.3,
    },
  });

function getInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
