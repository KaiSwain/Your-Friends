import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../auth/AuthContext';

// Storage keys are scoped per-user so a new account on the same device starts fresh.
const doneKey = (userId: string) => `yourfriends:onboarded:${userId}`;
const referralKey = (userId: string) => `yourfriends:onboardingReferral:${userId}`;
const excitedFeaturesKey = (userId: string) => `yourfriends:onboardingExcitedFeatures:${userId}`;

export type ReferralSource =
  | 'friend'
  | 'social'
  | 'app_store'
  | 'web_search'
  | 'press'
  | 'other';

export type ExcitedFeature =
  | 'polaroids'
  | 'live_polaroids'
  | 'memory_walls'
  | 'friend_profiles'
  | 'add_friends'
  | 'private_notes'
  | 'calendar'
  | 'music_memories'
  | 'prompts_movies'
  | 'ai_captions'
  | 'all_of_the_above'
  | 'not_sure';

interface OnboardingContextValue {
  loaded: boolean;
  hasCompletedOnboarding: boolean;
  referralSource: ReferralSource | null;
  excitedFeatures: ExcitedFeature[];
  setReferralSource: (source: ReferralSource) => Promise<void>;
  setExcitedFeatures: (features: ExcitedFeature[]) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? null;

  const [loaded, setLoaded] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [referralSource, setReferralSourceState] = useState<ReferralSource | null>(null);
  const [excitedFeatures, setExcitedFeaturesState] = useState<ExcitedFeature[]>([]);

  // Reload the per-user flags whenever the signed-in user changes.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setHasCompletedOnboarding(false);
    setReferralSourceState(null);
    setExcitedFeaturesState([]);

    if (!userId) {
      // No user — nothing to load. Mark loaded so the index gate can render.
      setLoaded(true);
      return;
    }

    (async () => {
      try {
        const [done, referral, features] = await Promise.all([
          AsyncStorage.getItem(doneKey(userId)),
          AsyncStorage.getItem(referralKey(userId)),
          AsyncStorage.getItem(excitedFeaturesKey(userId)),
        ]);
        if (cancelled) return;
        if (done === '1') setHasCompletedOnboarding(true);
        if (referral) setReferralSourceState(referral as ReferralSource);
        if (features) setExcitedFeaturesState(parseExcitedFeatures(features));
      } catch {
        // Ignore — defaults are fine.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setReferralSource = useCallback(async (source: ReferralSource) => {
    setReferralSourceState(source);
    if (!userId) return;
    try {
      await AsyncStorage.setItem(referralKey(userId), source);
    } catch {
      // Best-effort; UI already updated.
    }
  }, [userId]);

  const setExcitedFeatures = useCallback(async (features: ExcitedFeature[]) => {
    const normalized = normalizeExcitedFeatures(features);
    setExcitedFeaturesState(normalized);
    if (!userId) return;
    try {
      await AsyncStorage.setItem(excitedFeaturesKey(userId), JSON.stringify(normalized));
    } catch {
      // Best-effort; UI already updated.
    }
  }, [userId]);

  const completeOnboarding = useCallback(async () => {
    setHasCompletedOnboarding(true);
    if (!userId) return;
    try {
      await AsyncStorage.setItem(doneKey(userId), '1');
    } catch {
      // Best-effort; UI already updated.
    }
  }, [userId]);

  const resetOnboarding = useCallback(async () => {
    setHasCompletedOnboarding(false);
    setReferralSourceState(null);
    if (!userId) return;
    try {
      await Promise.all([
        AsyncStorage.removeItem(doneKey(userId)),
        AsyncStorage.removeItem(referralKey(userId)),
        AsyncStorage.removeItem(excitedFeaturesKey(userId)),
      ]);
    } catch {
      // Best-effort.
    }
  }, [userId]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      loaded,
      hasCompletedOnboarding,
      referralSource,
      excitedFeatures,
      setReferralSource,
      setExcitedFeatures,
      completeOnboarding,
      resetOnboarding,
    }),
    [
      loaded,
      hasCompletedOnboarding,
      referralSource,
      excitedFeatures,
      setReferralSource,
      setExcitedFeatures,
      completeOnboarding,
      resetOnboarding,
    ],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}

const VALID_EXCITED_FEATURES = new Set<ExcitedFeature>([
  'polaroids',
  'live_polaroids',
  'memory_walls',
  'friend_profiles',
  'add_friends',
  'private_notes',
  'calendar',
  'music_memories',
  'prompts_movies',
  'ai_captions',
  'all_of_the_above',
  'not_sure',
]);

function parseExcitedFeatures(raw: string): ExcitedFeature[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeExcitedFeatures(parsed.filter((item): item is ExcitedFeature => VALID_EXCITED_FEATURES.has(item)));
  } catch {
    return [];
  }
}

function normalizeExcitedFeatures(features: ExcitedFeature[]): ExcitedFeature[] {
  const unique = Array.from(new Set(features.filter((feature) => VALID_EXCITED_FEATURES.has(feature))));
  return unique.includes('not_sure') ? ['not_sure'] : unique;
}
