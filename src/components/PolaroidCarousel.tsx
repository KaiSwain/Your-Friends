import { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  FlatList,
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
import { PeopleListItem } from '../types/domain';
import { fonts } from '../theme/typography';
import { spacing } from '../theme/tokens';

interface PolaroidCarouselProps {
  activeIndex: number;
  items: PeopleListItem[];
  onIndexChange: (index: number) => void;
  onPressItem: (item: PeopleListItem) => void;
}

// Triplicate — just enough to scroll left/right and teleport back to centre copy.
const COPIES = 3;

const AnimatedFlatList = Animated.createAnimatedComponent(
  FlatList<PeopleListItem>,
);

export function PolaroidCarousel({ activeIndex, items, onIndexChange, onPressItem }: PolaroidCarouselProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList<PeopleListItem>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const compact = width < 390;
  const cardWidth = Math.min(width * 0.62, 270);
  const gap = spacing.md;
  const snapInterval = cardWidth + gap;
  // Padding so the centred card's midpoint aligns with the screen midpoint.
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
            outputRange: [0.88, 1, 0.88],
            extrapolate: 'clamp',
          });
          const cardOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.5, 1, 0.5],
            extrapolate: 'clamp',
          });

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
                style={({ pressed }) => [
                  styles.card,
                  { width: cardWidth, minHeight: cardMinHeight },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.photoFrame, { width: photoSize, height: photoSize }]}>
                  <View style={[styles.photoSurface, { backgroundColor: item.avatarColor }]}>
                    <Text style={[styles.photoInitials, { fontSize: initialsSize }]}>
                      {getInitials(item.title)}
                    </Text>
                  </View>
                </View>
                <View style={styles.bottomStrip}>
                  <Text style={[styles.name, { fontSize: nameSize }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.caption}>{item.caption}</Text>
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
      />

      {/* Scroll position indicator */}
      <View style={styles.positionRow}>
        <Text style={styles.positionText}>
          {activeIndex + 1} / {count}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    wrapper: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    positionRow: {
      marginTop: spacing.sm,
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
    photoInitials: {
      fontFamily: fonts.heading,
      color: colors.white,
    },
    bottomStrip: {
      width: '100%',
      paddingVertical: spacing.md,
      alignItems: 'center',
      gap: 2,
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
  });

function getInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
