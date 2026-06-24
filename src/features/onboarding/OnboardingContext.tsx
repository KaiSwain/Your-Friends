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
  // True while the user is re-watching the intro tour from Help/Settings. In
  // this mode the setup-only screens (survey, photo, fact) are skipped so the
  // tour is purely informational.
  tourReplay: boolean;
  beginTourReplay: () => void;
  endTourReplay: () => void;
  setReferralSource: (source: ReferralSource) => Promise<void>;
  setExcitedFeatures: (features: ExcitedFeature[]) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// Sentinel meaning "we have not resolved flags for any identity yet". Kept at
// module scope so its identity is stable across renders.
const UNRESOLVED = Symbol('yourfriends.onboarding.unresolved');

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? null;

  // Track which user id the currently-held flags were loaded for. `loaded` is
  // DERIVED from this during render (see below) rather than being its own piece
  // of state. This matters: on a cold start `userId` flips null -> id in a
  // single render commit, but the reload effect only runs AFTER that commit. If
  // `loaded` were independent state left over as `true` from the no-user pass,
  // the auth layout would briefly see "loaded + not completed + signed in" and
  // wrongly redirect into the onboarding walkthrough (the intermittent
  // "walkthrough retriggers until I restart" bug). Deriving it keeps `loaded`
  // false the instant the identity changes, so the gate shows a spinner instead.
  const [dataUserId, setDataUserId] = useState<string | null | typeof UNRESOLVED>(UNRESOLVED);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [referralSource, setReferralSourceState] = useState<ReferralSource | null>(null);
  const [excitedFeatures, setExcitedFeaturesState] = useState<ExcitedFeature[]>([]);
  // In-memory only — a replay never persists, so it resets on relaunch.
  const [tourReplay, setTourReplay] = useState(false);

  const loaded = dataUserId === userId;

  // Reload the per-user flags whenever the signed-in user changes.
  useEffect(() => {
    let cancelled = false;
    setHasCompletedOnboarding(false);
    setReferralSourceState(null);
    setExcitedFeaturesState([]);
    setTourReplay(false);

    if (!userId) {
      // No user — nothing to load. Mark the flags as resolved for the null
      // identity so the gate can render (derived `loaded` becomes true).
      setDataUserId(null);
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
        // Mark the flags as resolved for THIS user last, so by the time the
        // derived `loaded` flips true the completion flag is already set.
        if (!cancelled) setDataUserId(userId);
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

  const beginTourReplay = useCallback(() => setTourReplay(true), []);
  const endTourReplay = useCallback(() => setTourReplay(false), []);

  const completeOnboarding = useCallback(async () => {
    setHasCompletedOnboarding(true);
    setTourReplay(false);
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
      tourReplay,
      beginTourReplay,
      endTourReplay,
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
      tourReplay,
      beginTourReplay,
      endTourReplay,
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
