import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { themeNames, type ThemeName } from '../theme/themes';

const STORAGE_KEY_THEMES = 'yourfriends:purchasedThemes';
const STORAGE_KEY_FRIENDS = 'yourfriends:friendsUnlocked';
// Legacy key — if present with value 'true', migrate to full unlock for back-compat.
const STORAGE_KEY_LEGACY = 'yourfriends:premium';

export const FREE_FRIEND_LIMIT = 12;

// The 'default' theme is always free.
const FREE_THEMES: ReadonlySet<ThemeName> = new Set<ThemeName>(['default']);

/** Price per theme (display only — not a real IAP). */
export const THEME_PRICE = '$0.99';
/** Price for the unlimited-friends unlock. */
export const FRIENDS_UNLOCK_PRICE = '$2.99';

interface PremiumContextValue {
  /** Set of theme keys the user has unlocked (always includes free themes). */
  purchasedThemes: ThemeName[];
  /** Whether the user has unlocked unlimited friends. */
  friendsUnlocked: boolean;
  /** True if the user owns every paid theme and the friends unlock. */
  isPremium: boolean;
  /** Check if a specific theme is available to the user. */
  hasTheme: (name: ThemeName) => boolean;
  /** Simulate buying a single theme. */
  purchaseTheme: (name: ThemeName) => Promise<void>;
  /** Simulate buying the unlimited-friends unlock. */
  unlockFriends: () => Promise<void>;
  /** Restore all purchases from storage. */
  restore: () => Promise<void>;
  /**
   * Legacy "unlock everything" purchase kept so older code paths keep working.
   * Grants every theme and the friends unlock.
   */
  purchase: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextValue | undefined>(undefined);

function normalizeThemes(list: string[] | null | undefined): ThemeName[] {
  const valid = new Set<ThemeName>(themeNames);
  const out = new Set<ThemeName>(FREE_THEMES);
  for (const t of list ?? []) {
    if (valid.has(t as ThemeName)) out.add(t as ThemeName);
  }
  return Array.from(out);
}

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  // For local testing every unlock is granted by default. Storage values override this
  // after mount when present, but startup should not block on reading or writing storage.
  const [purchasedThemes, setPurchasedThemes] = useState<ThemeName[]>(() => [...themeNames]);
  const [friendsUnlocked, setFriendsUnlocked] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rawThemes, rawFriends] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_THEMES),
          AsyncStorage.getItem(STORAGE_KEY_FRIENDS),
        ]);

        if (rawThemes) {
          try {
            const parsed = JSON.parse(rawThemes);
            if (Array.isArray(parsed)) setPurchasedThemes(normalizeThemes(parsed));
          } catch {
            // Ignore malformed storage value.
          }
        }

        if (rawFriends != null) setFriendsUnlocked(rawFriends === 'true');
      } catch {
        // Ignore storage errors and keep defaults.
      }
    })();
  }, []);

  const persistThemes = useCallback(async (next: ThemeName[]) => {
    setPurchasedThemes(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_THEMES, JSON.stringify(next));
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const purchaseTheme = useCallback(async (name: ThemeName) => {
    // TODO: Replace with real IAP via RevenueCat or expo-iap.
    setPurchasedThemes((prev) => {
      if (prev.includes(name)) return prev;
      const next = normalizeThemes([...prev, name]);
      AsyncStorage.setItem(STORAGE_KEY_THEMES, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const unlockFriends = useCallback(async () => {
    // TODO: Replace with real IAP via RevenueCat or expo-iap.
    setFriendsUnlocked(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, 'true');
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const purchase = useCallback(async () => {
    await persistThemes([...themeNames]);
    await unlockFriends();
  }, [persistThemes, unlockFriends]);

  const restore = useCallback(async () => {
    try {
      const [rawThemes, rawFriends] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_THEMES),
        AsyncStorage.getItem(STORAGE_KEY_FRIENDS),
      ]);
      if (rawThemes) {
        try {
          const parsed = JSON.parse(rawThemes);
          if (Array.isArray(parsed)) setPurchasedThemes(normalizeThemes(parsed));
        } catch {
          // Ignore malformed storage value.
        }
      }
      if (rawFriends != null) setFriendsUnlocked(rawFriends === 'true');
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const hasTheme = useCallback(
    (name: ThemeName) => FREE_THEMES.has(name) || purchasedThemes.includes(name),
    [purchasedThemes],
  );

  const isPremium = useMemo(
    () => friendsUnlocked && themeNames.every((n) => FREE_THEMES.has(n) || purchasedThemes.includes(n)),
    [purchasedThemes, friendsUnlocked],
  );

  const value = useMemo<PremiumContextValue>(
    () => ({
      purchasedThemes,
      friendsUnlocked,
      isPremium,
      hasTheme,
      purchaseTheme,
      unlockFriends,
      restore,
      purchase,
    }),
    [purchasedThemes, friendsUnlocked, isPremium, hasTheme, purchaseTheme, unlockFriends, restore, purchase],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used inside PremiumProvider');
  return ctx;
}
