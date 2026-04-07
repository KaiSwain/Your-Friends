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

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { contrastText, contrastTextSoft, contrastAccent } from '../lib/contrastText';
import { PeopleListItem } from '../types/domain';
import { fonts } from '../theme/typography';
import { spacing } from '../theme/tokens';

interface PolaroidCarouselProps {
  activeIndex: number;
  items: PeopleListItem[];
  onIndexChange: (index: number) => void;
  onPressItem: (item: PeopleListItem) => void;
  onLongPressItem?: (item: PeopleListItem) => void;
  getUnreadCount?: (item: PeopleListItem) => number;
}

// Triplicate — just enough to scroll left/right and teleport back to centre copy.
const COPIES = 3;

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList<PeopleListItem>,
);

export function PolaroidCarousel({ activeIndex, items, onIndexChange, onPressItem, onLongPressItem, getUnreadCount }: PolaroidCarouselProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const photoSize = cardWidth - 28;
  const cardMinHeight = photoSize + (compact ? 80 : 94) + 14;
  const initialsSize = compact ? 44 : 54;
  const nameSize = compact ? 20 : 24;

  const count = items.length;

  // 3 copies of the list: [copy0 | copy1 (centre) | copy2]
  const loopedData = useMemo(() => {
    if (count === 0) return [];
    const arr: PeopleListItem[] = [];
    for (let c = 0; c < COPIES; c++) {
      for (let i = 0; i < count; i++) arr.push(items[i]);
    }
    return arr;
  }, [items, count]);

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
      if (virtualIndex < count || virtualIndex >= count * 2) {
        const centreTarget = count + realIndex;
        flatListRef.current?.scrollToIndex({ index: centreTarget, animated: false });
      }
    },
    [count, snapInterval, onIndexChange],
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
        keyExtractor={(_: PeopleListItem, index: number) => String(index)}
        getItemLayout={getItemLayout}
        initialScrollIndex={count + activeIndex}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: sideInset }}
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

          const ct = contrastText(item.cardColor);
          const ctSoft = contrastTextSoft(item.cardColor);
          const ctAccent = contrastAccent(item.cardColor, colors.accent);

          return (
            <Animated.View
              style={{
                width: snapInterval,
                alignItems: 'center' as const,
                transform: [{ scale }],
                opacity: cardOpacity,
              }}
            >
              <Pressable
                onPress={() => onPressItem(item)}
                onLongPress={onLongPressItem ? () => onLongPressItem(item) : undefined}
                style={({ pressed }) => [
                  styles.card,
                  { width: cardWidth, minHeight: cardMinHeight },
                  item.cardColor ? { backgroundColor: item.cardColor } : undefined,
                  pressed && styles.pressed,
                ]}
              >
                {item.pinned && (
                  <View style={styles.pinBadge}>
                    <Text style={styles.pinBadgeText}>📌</Text>
                  </View>
                )}
                <View style={[styles.photoFrame, { width: photoSize, height: photoSize }]}>
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={styles.photoImage} />
                  ) : (
                    <View style={[styles.photoSurface, { backgroundColor: item.avatarColor }]}>
                      <Text style={[styles.photoInitials, { fontSize: initialsSize }]}>
                        {getInitials(item.title)}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.bottomStrip}>
                  <Text style={[styles.name, { fontSize: nameSize }, item.cardColor && { color: ct }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.tags.length > 0 && (
                    <View style={styles.tagRow}>
                      {item.tags.slice(0, 2).map((tag) => (
                        <View key={tag} style={[styles.tag, item.cardColor && { backgroundColor: ctAccent + '1A' }]}>
                          <Text style={[styles.tagText, item.cardColor && { color: ctAccent }]} numberOfLines={1}>{tag}</Text>
                        </View>
                      ))}
                      {item.tags.length > 2 && (
                        <Text style={[styles.tagMore, item.cardColor && { color: ctSoft }]}>+{item.tags.length - 2}</Text>
                      )}
                    </View>
                  )}
                  {item.note ? (
                    <Text style={[styles.note, item.cardColor && { color: ctSoft }]} numberOfLines={2}>{item.note}</Text>
                  ) : !item.tags.length ? (
                    <Text style={[styles.caption, item.cardColor && { color: ctAccent }]}>{item.caption}</Text>
                  ) : null}
                </View>
              </Pressable>
              {(() => {
                const count = getUnreadCount?.(item) ?? 0;
                return count > 0 ? (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{count}</Text>
                  </View>
                ) : null;
              })()}
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    wrapper: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
      // Break out of parent padding so the carousel spans the full screen width.
      // The parent (AppScreen scroll content) has paddingHorizontal: spacing.lg.
      marginHorizontal: -spacing.lg,
    },
    positionRow: {
      marginTop: spacing.sm,
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
      borderRadius: 2,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 14,
      paddingBottom: 0,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    pressed: { transform: [{ scale: 0.985 }] },
    pinBadge: { position: 'absolute', top: 6, right: 6, zIndex: 1 },
    pinBadgeText: { fontSize: 16 },
    notifBadge: {
      position: 'absolute',
      bottom: 8,
      right: -6,
      backgroundColor: colors.accent,
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
      zIndex: 2,
    },
    notifBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.white },
    photoFrame: {
      borderRadius: 1,
      overflow: 'hidden',
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
    },
    photoInitials: {
      fontFamily: fonts.heading,
      color: colors.white,
    },
    bottomStrip: {
      width: '100%',
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: 4,
    },
    name: {
      fontFamily: fonts.heading,
      color: colors.ink,
      textAlign: 'center',
    },
    caption: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    note: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 16,
      color: colors.inkSoft,
      textAlign: 'center',
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 4,
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
  });

function getInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
