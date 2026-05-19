import { ReactNode, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import type { ColorTokens } from '../../features/theme/themes';
import type { FontSet } from '../../theme/typography';
import { radius, spacing } from '../../theme/tokens';
import type { PinboardCardMetrics, PinboardPosition } from './pinboardLayout';

interface PinboardCardProps {
  arrangeMode: boolean;
  children: ReactNode;
  colors: ColorTokens;
  fonts: FontSet;
  gestureScale: number;
  metrics: PinboardCardMetrics;
  onBringToFront: () => void;
  onDragEnd: (position: PinboardPosition) => void;
  onReset: () => void;
  onResize: (scale: number) => void;
  pinColor: string;
  position: PinboardPosition;
}

export function PinboardCard({ arrangeMode, children, colors, fonts, gestureScale, metrics, onBringToFront, onDragEnd, onReset, onResize, pinColor, position }: PinboardCardProps) {
  const visualWidth = metrics.realWidth * position.scale;
  const visualHeight = metrics.realHeight * position.scale;
  const translateX = useSharedValue(position.x);
  const translateY = useSharedValue(position.y);
  const startX = useSharedValue(position.x);
  const startY = useSharedValue(position.y);
  const active = useSharedValue(0);
  const scale = useSharedValue(position.scale);

  useEffect(() => {
    translateX.value = withSpring(position.x, { damping: 18, mass: 0.8, stiffness: 180 });
    translateY.value = withSpring(position.y, { damping: 18, mass: 0.8, stiffness: 180 });
    scale.value = withSpring(position.scale, { damping: 18, mass: 0.8, stiffness: 180 });
  }, [position.scale, position.x, position.y, scale, translateX, translateY]);

  const dragGesture = useMemo(() => Gesture.Pan()
    .enabled(arrangeMode)
    .minDistance(2)
    .onBegin(() => {
      active.value = 1;
      startX.value = translateX.value;
      startY.value = translateY.value;
      runOnJS(onBringToFront)();
    })
    .onUpdate((event) => {
      translateX.value = Math.max(12, startX.value + event.translationX / gestureScale);
      translateY.value = Math.max(78, startY.value + event.translationY / gestureScale);
    })
    .onFinalize(() => {
      active.value = 0;
      runOnJS(onDragEnd)({
        x: Math.round(translateX.value),
        y: Math.round(translateY.value),
        scale: scale.value,
        zIndex: position.zIndex,
      });
    }), [active, arrangeMode, gestureScale, onBringToFront, onDragEnd, position.zIndex, scale, startX, startY, translateX, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(active.value ? 0.96 : 1, { duration: 120 }),
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${metrics.rotation}deg` },
      { scale: withTiming(active.value ? 1.035 : 1, { duration: 120 }) },
    ],
  }));

  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View
        style={[
          styles.cardSlot,
          {
            width: visualWidth,
            height: visualHeight,
            zIndex: position.zIndex,
          },
          arrangeMode && styles.cardSlotArrange,
          animatedStyle,
        ]}
      >
      <View pointerEvents="none" style={[styles.pinDot, { backgroundColor: pinColor }]} />
      <View pointerEvents="none" style={styles.pinTape} />
      {arrangeMode ? (
        <View style={styles.arrangeControls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Make card smaller" onPress={() => onResize(Math.max(0.42, Number((position.scale - 0.06).toFixed(2))))} style={styles.controlButton}>
            <Text style={styles.controlLabel}>-</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Reset card position" onPress={onReset} style={styles.controlButtonWide}>
            <Text style={styles.controlLabel}>Reset</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Make card bigger" onPress={() => onResize(Math.min(1.05, Number((position.scale + 0.06).toFixed(2))))} style={styles.controlButton}>
            <Text style={styles.controlLabel}>+</Text>
          </Pressable>
        </View>
      ) : null}
        <View
          pointerEvents={arrangeMode ? 'none' : 'auto'}
          style={[
            styles.scaledViewport,
            {
              width: visualWidth,
              height: visualHeight,
            },
          ]}
        >
          <View
            style={[
              styles.scaledCard,
              {
                width: metrics.realWidth,
                height: metrics.realHeight,
                transform: [{ scale: position.scale }],
              },
            ]}
          >
            {children}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    cardSlot: {
      position: 'absolute',
      alignItems: 'center',
      overflow: 'visible',
    },
    cardSlotArrange: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.24,
      shadowRadius: 18,
      elevation: 8,
    },
    pinDot: {
      position: 'absolute',
      top: 2,
      width: 12,
      height: 12,
      borderRadius: 6,
      zIndex: 6,
      borderWidth: 2,
      borderColor: colors.paper,
    },
    pinTape: {
      position: 'absolute',
      top: 12,
      width: 54,
      height: 16,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,220,0.48)',
      zIndex: 5,
      transform: [{ rotate: '-4deg' }],
    },
    arrangeControls: {
      position: 'absolute',
      right: -8,
      top: -18,
      zIndex: 8,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      overflow: 'hidden',
    },
    controlButton: {
      minWidth: 30,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
    },
    controlButtonWide: {
      alignItems: 'center',
      justifyContent: 'center',
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    controlLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 11,
      color: colors.ink,
    },
    scaledViewport: {
      overflow: 'visible',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    scaledCard: {
      alignItems: 'center',
      overflow: 'visible',
      transformOrigin: 'top left',
    },
  });
