import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { themeNames, type ThemeName } from '../theme/themes';
import {
  applyReferralRewardForUser,
  clearIncomingReferralCode,
  getPremiumDaysRemaining,
  isPremiumUntilActive,
  peekIncomingReferralCode,
  premiumUntilKey,
  readLocalPremiumUntil,
  REFERRAL_REWARD_DAYS,
  REFERRAL_REWARD_LABEL,
  referralRewardCountKey,
  referrerCodeKey,
  setLocalPremiumUntil,
  subscribedKey,
} from '../../lib/referrals';
import { supabase } from '../../lib/supabase';

const friendBoostKey = (userId: string) => `yourfriends:premium:friendBoost:${userId}`;

const LEGACY_GLOBAL_KEYS = [
  'yourfriends:purchasedThemes',
  'yourfriends:friendsUnlocked',
  'yourfriends:premium',
  'yourfriends:premium:giftedThemes',
];

export const FREE_FRIEND_LIMIT = 12;
export const PREMIUM_SUBSCRIPTION_PRICE = '$14.99 / 3 months';
export { REFERRAL_REWARD_DAYS, REFERRAL_REWARD_LABEL };

const FREE_THEMES: ReadonlySet<ThemeName> = new Set<ThemeName>(['default']);

interface PremiumContextValue {
  isPremium: boolean;
  premiumUntil: string | null;
  premiumDaysRemaining: number;
  premiumFriendIds: ReadonlySet<string>;
  isUserPremium: (userId: string | null | undefined) => boolean;
  purchasedThemes: ThemeName[];
  friendsUnlocked: boolean;
  hasTheme: (name: ThemeName) => boolean;
  purchase: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
  recheckPremiumFriends: (friendUserIds: readonly string[]) => Promise<void>;
  restore: () => Promise<void>;
  referralRewardCount: number;
  referrerCode: string | null;
  pendingReferralCode: string | null;
  applyReferralCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
}

const PremiumContext = createContext<PremiumContextValue | undefined>(undefined);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? null;
  const ownFriendCode = currentUser?.friendCode ?? null;
  const profilePremiumUntil = currentUser?.premiumUntil ?? null;

  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [premiumFriendIds, setPremiumFriendIds] = useState<ReadonlySet<string>>(() => new Set());
  const [referralRewardCount, setReferralRewardCount] = useState(0);
  const [referrerCode, setReferrerCode] = useState<string | null>(null);
  const [pendingReferralCode, setPendingReferralCode] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.multiRemove(LEGACY_GLOBAL_KEYS).catch(() => {});
  }, []);

  const refreshIncomingReferralCode = useCallback(async () => {
    try {
      const code = await peekIncomingReferralCode();
      setPendingReferralCode(code);
      return code;
    } catch {
      setPendingReferralCode(null);
      return null;
    }
  }, []);

  const loadPremiumState = useCallback(async () => {
    if (!userId) return;
    try {
      AsyncStorage.removeItem(friendBoostKey(userId)).catch(() => {});
      const [rawSub, rawUntil, rawRewardCount, rawReferrer] = await Promise.all([
        AsyncStorage.getItem(subscribedKey(userId)),
        readLocalPremiumUntil(userId),
        AsyncStorage.getItem(referralRewardCountKey(userId)),
        AsyncStorage.getItem(referrerCodeKey(userId)),
      ]);
      const activeUntil = isPremiumUntilActive(profilePremiumUntil)
        ? profilePremiumUntil
        : isPremiumUntilActive(rawUntil)
          ? rawUntil
          : rawSub === 'true'
            ? '9999-12-31T23:59:59.999Z'
            : null;
      setPremiumUntil(activeUntil);
      if (activeUntil) {
        setLocalPremiumUntil(userId, activeUntil).catch(() => {});
        if (!isPremiumUntilActive(profilePremiumUntil)) {
          supabase.from('profiles').update({ premium_until: activeUntil }).eq('id', userId).then(() => undefined, () => undefined);
        }
      }
      setReferralRewardCount(rawRewardCount ? Number(rawRewardCount) || 0 : 0);
      setReferrerCode(rawReferrer ?? null);
      await refreshIncomingReferralCode();
    } catch {
      // Ignore storage errors and keep defaults.
    }
  }, [userId, profilePremiumUntil, refreshIncomingReferralCode]);

  useEffect(() => {
    setPremiumUntil(null);
    setPremiumFriendIds(new Set());
    setReferralRewardCount(0);
    setReferrerCode(null);
    setPendingReferralCode(null);
    if (!userId) {
      refreshIncomingReferralCode();
      return;
    }

    loadPremiumState();
  }, [userId, loadPremiumState, refreshIncomingReferralCode]);

  const purchase = useCallback(async () => {
    if (!userId) return;
    const until = '9999-12-31T23:59:59.999Z';
    setPremiumUntil(until);
    try {
      await Promise.all([
        AsyncStorage.setItem(subscribedKey(userId), 'true'),
        setLocalPremiumUntil(userId, until),
        supabase.from('profiles').update({ premium_until: until }).eq('id', userId),
      ]);
    } catch {
      // Ignore storage errors.
    }
  }, [userId]);

  const cancelSubscription = useCallback(async () => {
    setPremiumUntil(null);
    if (!userId) return;
    try {
      await Promise.all([
        AsyncStorage.removeItem(subscribedKey(userId)),
        AsyncStorage.removeItem(premiumUntilKey(userId)),
        supabase.from('profiles').update({ premium_until: null }).eq('id', userId),
      ]);
    } catch {
      // Ignore storage errors.
    }
  }, [userId]);

  const restore = useCallback(async () => {
    await loadPremiumState();
  }, [loadPremiumState]);

  const recheckPremiumFriends = useCallback<PremiumContextValue['recheckPremiumFriends']>(
    async (friendUserIds) => {
      if (!userId) return;
      const premiumIds = new Set<string>();
      try {
        if (friendUserIds.length > 0) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, premium_until')
            .in('id', [...friendUserIds]);
          if (!error && data) {
            for (const row of data) {
              if (isPremiumUntilActive(row.premium_until)) premiumIds.add(row.id);
            }
          }
        }
        for (const friendUserId of friendUserIds) {
          if (!friendUserId) continue;
          const [rawSub, rawUntil] = await Promise.all([
            AsyncStorage.getItem(subscribedKey(friendUserId)),
            readLocalPremiumUntil(friendUserId),
          ]);
          if (rawSub === 'true' || isPremiumUntilActive(rawUntil)) premiumIds.add(friendUserId);
        }
      } catch {
        // Treat read failures as "no premium friends" rather than crashing.
      }
      setPremiumFriendIds(premiumIds);
    },
    [userId],
  );

  const applyReferralCode = useCallback<PremiumContextValue['applyReferralCode']>(
    async (rawCode) => {
      if (!userId || !ownFriendCode) return { ok: false, error: 'Sign in first.' };
      const result = await applyReferralRewardForUser({
        refereeUserId: userId,
        refereeFriendCode: ownFriendCode,
        referrerCode: rawCode,
      });
      if (!result.ok) return result;
      setPremiumUntil(result.refereePremiumUntil);
      setReferrerCode(result.code);
      setPendingReferralCode(null);
      await clearIncomingReferralCode().catch(() => {});
      return { ok: true };
    },
    [userId, ownFriendCode],
  );

  const isPremium = isPremiumUntilActive(premiumUntil);
  const premiumDaysRemaining = getPremiumDaysRemaining(premiumUntil);

  const purchasedThemes = useMemo<ThemeName[]>(() => {
    if (isPremium) return [...themeNames];
    return Array.from(FREE_THEMES);
  }, [isPremium]);

  const hasTheme = useCallback(
    (name: ThemeName) => isPremium || FREE_THEMES.has(name),
    [isPremium],
  );

  const isUserPremium = useCallback(
    (id: string | null | undefined) => {
      if (!id) return false;
      if (id === userId) return isPremium;
      return premiumFriendIds.has(id);
    },
    [userId, isPremium, premiumFriendIds],
  );

  const value = useMemo<PremiumContextValue>(
    () => ({
      isPremium,
      premiumUntil,
      premiumDaysRemaining,
      premiumFriendIds,
      isUserPremium,
      purchasedThemes,
      friendsUnlocked: isPremium,
      hasTheme,
      purchase,
      cancelSubscription,
      recheckPremiumFriends,
      restore,
      referralRewardCount,
      referrerCode,
      pendingReferralCode,
      applyReferralCode,
    }),
    [
      isPremium,
      premiumUntil,
      premiumDaysRemaining,
      premiumFriendIds,
      isUserPremium,
      purchasedThemes,
      hasTheme,
      purchase,
      cancelSubscription,
      recheckPremiumFriends,
      restore,
      referralRewardCount,
      referrerCode,
      pendingReferralCode,
      applyReferralCode,
    ],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used inside PremiumProvider');
  return ctx;
}