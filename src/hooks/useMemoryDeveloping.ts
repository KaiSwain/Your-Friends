import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { Accelerometer } from 'expo-sensors';

import { CURE_DURATION_MS, getCureProgress, getCureStyles } from '../lib/polaroidCure';
import {
  addPolaroidShakeBoost,
  getCachedPolaroidShakeBoost,
  loadPolaroidShakeBoost,
  subscribePolaroidShakeBoost,
} from '../lib/polaroidShakeBoost';
import { getCachedMemoryDeveloped, loadMemoryDeveloped, markMemoryDeveloped, notifyMemoryDevelopedNow } from '../lib/memoryDevelopNotifications';

const CURE_REFRESH_MS = 250;
const SHAKE_SAMPLE_MS = 100;
const SHAKE_MAGNITUDE_THRESHOLD = 1.75;
const SHAKE_DELTA_THRESHOLD = 0.45;
const SHAKE_COOLDOWN_MS = 550;
const SHAKE_BOOST_MS = 10_000;
const MAX_SHAKE_BOOST_MS = 90_000;
const SHAKE_FEEDBACK_MS = 900;

type ShakeFeedbackState = 'idle' | 'boosted' | 'maxed';

interface UseMemoryDevelopingOptions {
  createdAt: string;
  disabled?: boolean;
  holdUndeveloped?: boolean;
  imageLoadEnabled?: boolean;
  imageUri?: string | null;
  isPremium: boolean;
  onDeveloped?: () => void;
  postId: string;
  preview?: boolean;
}

export function useMemoryDeveloping({
  createdAt,
  disabled = false,
  holdUndeveloped = false,
  imageLoadEnabled = true,
  imageUri,
  isPremium,
  onDeveloped,
  postId,
  preview = false,
}: UseMemoryDevelopingOptions) {
  const [now, setNow] = useState(Date.now());
  const [shakeBoostMs, setShakeBoostMs] = useState(() => getCachedPolaroidShakeBoost(postId));
  const [forceDeveloped, setForceDeveloped] = useState(() => getCachedMemoryDeveloped(postId));
  const [shakeFeedback, setShakeFeedback] = useState<ShakeFeedbackState>('idle');
  const lastShakeMagnitudeRef = useRef(1);
  const wasDevelopingRef = useRef(false);
  const shakeFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const cureProgress = holdUndeveloped ? 0 : preview || forceDeveloped ? 1 : getCureProgress(createdAt, now + shakeBoostMs);
  const cure = getCureStyles(cureProgress);

  useEffect(() => {
    if (!cure.developing || preview || holdUndeveloped) return;
    const id = setInterval(() => setNow(Date.now()), CURE_REFRESH_MS);
    return () => clearInterval(id);
  }, [cure.developing, holdUndeveloped, preview]);

  useEffect(() => {
    if (preview || holdUndeveloped) return;
    if (wasDevelopingRef.current && !cure.developing) {
      setForceDeveloped(true);
      markMemoryDeveloped(postId).catch(() => undefined);
      onDeveloped?.();
    }
    wasDevelopingRef.current = cure.developing;
  }, [cure.developing, holdUndeveloped, onDeveloped, postId, preview]);

  useEffect(() => {
    let active = true;
    const cachedBoostMs = getCachedPolaroidShakeBoost(postId);
    setShakeBoostMs(cachedBoostMs);
    setForceDeveloped(getCachedMemoryDeveloped(postId));
    setShakeFeedback('idle');
    lastShakeMagnitudeRef.current = 1;
    shakeAnim.setValue(0);

    const unsubscribe = subscribePolaroidShakeBoost(postId, (boostMs) => {
      if (!active) return;
      setShakeBoostMs(boostMs);
      setNow(Date.now());
    });

    loadPolaroidShakeBoost(postId).then((boostMs) => {
      if (!active) return;
      setShakeBoostMs(boostMs);
      setNow(Date.now());
    }).catch(() => undefined);
    loadMemoryDeveloped(postId).then((developed) => {
      if (!active) return;
      setForceDeveloped(developed);
      if (developed) setNow(Date.now());
    }).catch(() => undefined);

    return () => {
      active = false;
      unsubscribe();
      if (shakeFeedbackTimerRef.current) clearTimeout(shakeFeedbackTimerRef.current);
    };
  }, [createdAt, postId, shakeAnim]);

  const showShakeFeedback = useCallback((nextBoostMs: number) => {
    const maxed = nextBoostMs >= MAX_SHAKE_BOOST_MS;
    setShakeFeedback(maxed ? 'maxed' : 'boosted');
    if (shakeFeedbackTimerRef.current) clearTimeout(shakeFeedbackTimerRef.current);
    shakeFeedbackTimerRef.current = setTimeout(() => setShakeFeedback('idle'), SHAKE_FEEDBACK_MS);

    shakeAnim.stopAnimation();
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 75, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0.65, duration: 65, useNativeDriver: true }),
      Animated.spring(shakeAnim, { toValue: 0, friction: 6, tension: 140, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  useEffect(() => {
    if (disabled || preview || holdUndeveloped || !isPremium || !imageLoadEnabled || !imageUri || !cure.developing) return;
    let active = true;
    let subscription: { remove: () => void } | null = null;

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!active || !available) return;
        Accelerometer.setUpdateInterval(SHAKE_SAMPLE_MS);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          const delta = Math.abs(magnitude - lastShakeMagnitudeRef.current);
          lastShakeMagnitudeRef.current = magnitude;
          const shaken = magnitude >= SHAKE_MAGNITUDE_THRESHOLD && delta >= SHAKE_DELTA_THRESHOLD;
          if (!shaken) return;

          const timestamp = Date.now();
          const nextBoostMs = addPolaroidShakeBoost(
            postId,
            SHAKE_BOOST_MS,
            MAX_SHAKE_BOOST_MS,
            SHAKE_COOLDOWN_MS,
            timestamp,
          );
          if (nextBoostMs === null) return;
          setNow(timestamp);
          showShakeFeedback(nextBoostMs);
          if (getCureProgress(createdAt, timestamp + nextBoostMs) >= 1) {
            notifyMemoryDevelopedNow(postId).catch(() => undefined);
          }
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [createdAt, cure.developing, disabled, holdUndeveloped, imageLoadEnabled, imageUri, isPremium, postId, preview, showShakeFeedback]);

  const developingLabel = shakeFeedback === 'boosted'
    ? 'Shake worked — developing faster'
    : shakeFeedback === 'maxed'
      ? 'Shake boost maxed — almost there'
      : !isPremium
        ? 'Premium unlocks shake-to-develop'
        : shakeBoostMs > 0
        ? 'Shake gently to keep it developing faster'
        : 'Shake gently to help it develop';

  const shakeTranslateX = shakeAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-9, 0, 9],
  });
  const shakeRotateZ = shakeAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-2.2deg', '0deg', '2.2deg'],
  });

  return {
    cure,
    cureProgress,
    developingLabel,
    shakeBoostMs,
    shakeFeedback,
    shakeRotateZ,
    shakeTranslateX,
  };
}

export { CURE_DURATION_MS };
