import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

type FlipCardMode = 'midpoint' | 'continuous';

interface FlipCardOptions {
  disabled?: boolean;
  duration?: number;
  mode?: FlipCardMode;
  onBeforeFlip?: (state: { showBack: boolean }) => boolean | void;
  onFlip?: (showBack: boolean) => void;
}

export function useFlipCard({
  disabled = false,
  duration = 180,
  mode = 'midpoint',
  onBeforeFlip,
  onFlip,
}: FlipCardOptions = {}) {
  const [showBack, setShowBack] = useState(false);
  const animating = useRef(false);
  const continuousTarget = useRef(0);
  const animValue = useRef(new Animated.Value(0)).current;
  const onFlipRef = useRef(onFlip);
  const skipFlipNotifyRef = useRef(true);

  onFlipRef.current = onFlip;

  useEffect(() => {
    if (skipFlipNotifyRef.current) {
      skipFlipNotifyRef.current = false;
      return;
    }
    onFlipRef.current?.(showBack);
  }, [showBack]);

  const rotateY = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '0deg'],
  });
  const scaleX = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.95, 1],
  });
  const frontRotateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const flip = useCallback(() => {
    if (disabled || animating.current) return;
    if (onBeforeFlip?.({ showBack }) === false) return;

    animating.current = true;

    if (mode === 'continuous') {
      const nextTarget = continuousTarget.current === 0 ? 1 : 0;
      continuousTarget.current = nextTarget;
      const nextShowBack = nextTarget === 1;
      setShowBack(nextShowBack);
      Animated.timing(animValue, {
        toValue: nextTarget,
        duration,
        useNativeDriver: true,
      }).start(() => {
        animating.current = false;
      });
      return;
    }

    Animated.timing(animValue, {
      toValue: 0.5,
      duration,
      useNativeDriver: true,
    }).start(() => {
      setShowBack((prev) => !prev);
      Animated.timing(animValue, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }).start(() => {
        animValue.setValue(0);
        animating.current = false;
      });
    });
  }, [animValue, disabled, duration, mode, onBeforeFlip, showBack]);

  return {
    backRotateY,
    flip,
    frontRotateY,
    rotateY,
    scaleX,
    showBack,
  };
}
