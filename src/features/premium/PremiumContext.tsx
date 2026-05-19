import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import {
  deepLinkToSubscriptions,
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type Product,
  type Purchase,
} from 'expo-iap';

import { useAuth } from '../auth/AuthContext';
import { themeNames, type ThemeName } from '../theme/themes';
import {
  applyReferralRewardForUser,
  clearIncomingReferralCode,
  getPremiumDaysRemaining,
  isPremiumUntilActive,
  peekIncomingReferralCode,
  readLocalPremiumUntil,
  REFERRAL_REWARD_DAYS,
  REFERRAL_REWARD_LABEL,
  referralRewardCountKey,
  referrerCodeKey,
  setLocalPremiumUntil,
} from '../../lib/referrals';
import { supabase } from '../../lib/supabase';

const friendBoostKey = (userId: string) => `yourfriends:premium:friendBoost:${userId}`;

const LEGACY_GLOBAL_KEYS = [
  'yourfriends:purchasedThemes',
  'yourfriends:friendsUnlocked',
  'yourfriends:premium',
  'yourfriends:premium:giftedThemes',
];

export const PREMIUM_PRODUCT_IDS = {
  monthly: 'yourfriends_premium_monthly',
  sixMonths: 'yourfriends_premium_6_months',
  yearly: 'yourfriends_premium_yearly',
} as const;
export type PremiumPlanId = typeof PREMIUM_PRODUCT_IDS[keyof typeof PREMIUM_PRODUCT_IDS];
export interface PremiumPlan {
  id: PremiumPlanId;
  label: string;
  period: string;
  displayPrice: string;
  savingsLabel?: string;
  bestValue?: boolean;
}
export const PREMIUM_PLANS: PremiumPlan[] = [
  { id: PREMIUM_PRODUCT_IDS.monthly, label: 'Monthly', period: 'month', displayPrice: '$4.99' },
  { id: PREMIUM_PRODUCT_IDS.sixMonths, label: '6 months', period: '6 months', displayPrice: '$19.99', savingsLabel: 'Save 33% vs monthly' },
  { id: PREMIUM_PRODUCT_IDS.yearly, label: 'Yearly', period: 'year', displayPrice: '$29.99', savingsLabel: 'Best deal: save 50% vs monthly', bestValue: true },
];
export const PREMIUM_SUBSCRIPTION_PRICE = '$29.99 / year';
export { REFERRAL_REWARD_DAYS, REFERRAL_REWARD_LABEL };

const FREE_THEMES: ReadonlySet<ThemeName> = new Set<ThemeName>(['default']);
const IAP_UNAVAILABLE_MESSAGE = 'Premium purchases require a development build or TestFlight build.';

function isIapNativeRuntime() {
  return Constants.appOwnership !== 'expo';
}

interface PremiumContextValue {
  isPremium: boolean;
  premiumUntil: string | null;
  premiumDaysRemaining: number;
  premiumFriendIds: ReadonlySet<string>;
  isUserPremium: (userId: string | null | undefined) => boolean;
  purchasedThemes: ThemeName[];
  friendsUnlocked: boolean;
  hasTheme: (name: ThemeName) => boolean;
  premiumPlans: PremiumPlan[];
  purchaseLoading: boolean;
  purchaseError: string | null;
  storeProductsLoaded: boolean;
  purchase: (planId?: PremiumPlanId) => Promise<void>;
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
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [storeProductsLoaded, setStoreProductsLoaded] = useState(false);
  const [iapConnected, setIapConnected] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

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
      setStoreProductsLoaded(false);
      return null;
    }
  }, []);

  const loadPremiumState = useCallback(async () => {
    if (!userId) return;
    try {
      AsyncStorage.removeItem(friendBoostKey(userId)).catch(() => {});
      const [rawUntil, rawRewardCount, rawReferrer] = await Promise.all([
        readLocalPremiumUntil(userId),
        AsyncStorage.getItem(referralRewardCountKey(userId)),
        AsyncStorage.getItem(referrerCodeKey(userId)),
      ]);
      const activeUntil = isPremiumUntilActive(profilePremiumUntil)
        ? profilePremiumUntil
        : isPremiumUntilActive(rawUntil)
          ? rawUntil
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

  const validateAndApplyPurchase = useCallback(async (purchase: Purchase) => {
    if (!userId) throw new Error('Sign in before purchasing Premium.');
    const productId = getPurchaseProductId(purchase);
    if (!isPremiumProductId(productId)) return;

    const { data, error } = await supabase.functions.invoke<{ premiumUntil?: string }>('validate-apple-subscription', {
      method: 'POST',
      body: { productId, purchase },
    });
    if (error) throw new Error(error.message);
    const nextPremiumUntil = data?.premiumUntil ?? null;
    if (!nextPremiumUntil) throw new Error('The purchase could not be validated.');
    setPremiumUntil(nextPremiumUntil);
    await setLocalPremiumUntil(userId, nextPremiumUntil).catch(() => {});
    await finishTransaction({ purchase, isConsumable: false });
  }, [userId]);

  useEffect(() => {
    if (!isIapNativeRuntime()) {
      setPurchaseError(IAP_UNAVAILABLE_MESSAGE);
      return;
    }

    let mounted = true;
    const productIds = PREMIUM_PLANS.map((plan) => plan.id);
    initConnection()
      .then(async () => {
        if (!mounted) return;
        setIapConnected(true);
        const products = await fetchProducts({ skus: productIds, type: 'subs' });
        if (mounted) {
          setStoreProducts(products as Product[]);
          setStoreProductsLoaded(true);
          const foundIds = new Set((products as Product[]).map(getStoreProductId));
          const missingIds = productIds.filter((id) => !foundIds.has(id));
          if (missingIds.length > 0) {
            setPurchaseError(`App Store products not found yet: ${missingIds.join(', ')}`);
          }
        }
      })
      .catch((error) => {
        if (mounted) setPurchaseError(error instanceof Error ? error.message : 'Could not connect to the App Store.');
      });

    const purchaseUpdate = purchaseUpdatedListener((purchase) => {
      setPurchaseLoading(true);
      setPurchaseError(null);
      validateAndApplyPurchase(purchase)
        .catch((error) => setPurchaseError(error instanceof Error ? error.message : 'Could not validate the purchase.'))
        .finally(() => setPurchaseLoading(false));
    });
    const purchaseErrorSub = purchaseErrorListener((error) => {
      setPurchaseLoading(false);
      if (String(error.code).toLowerCase().includes('cancel')) return;
      setPurchaseError(error.message ?? 'Purchase failed.');
    });

    return () => {
      mounted = false;
      purchaseUpdate.remove();
      purchaseErrorSub.remove();
      endConnection().catch(() => {});
    };
  }, [validateAndApplyPurchase]);

  const purchase = useCallback<PremiumContextValue['purchase']>(async (planId = PREMIUM_PRODUCT_IDS.yearly) => {
    if (!userId) throw new Error('Sign in before purchasing Premium.');
    if (Platform.OS !== 'ios') throw new Error('Premium subscriptions are currently available on iOS.');
    if (!isIapNativeRuntime()) throw new Error(IAP_UNAVAILABLE_MESSAGE);
    setPurchaseLoading(true);
    setPurchaseError(null);
    try {
      if (!iapConnected) await initConnection();
      if (storeProductsLoaded && !storeProducts.some((product) => getStoreProductId(product) === planId)) {
        throw new Error(`App Store product not found: ${planId}. Check the subscription Product ID in App Store Connect.`);
      }
      await requestPurchase({
        request: {
          apple: { sku: planId },
          google: { skus: [planId], subscriptionOffers: [] },
        },
        type: 'subs',
      });
    } catch (error) {
      setPurchaseLoading(false);
      throw error;
    }
  }, [iapConnected, storeProducts, storeProductsLoaded, userId]);

  const cancelSubscription = useCallback(async () => {
    if (!isIapNativeRuntime()) throw new Error(IAP_UNAVAILABLE_MESSAGE);
    await deepLinkToSubscriptions({
      skuAndroid: PREMIUM_PRODUCT_IDS.yearly,
      packageNameAndroid: 'com.yourfriends.app',
    });
  }, []);

  const restore = useCallback(async () => {
    if (!userId) return;
    if (!isIapNativeRuntime()) throw new Error(IAP_UNAVAILABLE_MESSAGE);
    setPurchaseLoading(true);
    setPurchaseError(null);
    try {
      await restorePurchases();
      const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true } as any);
      const premiumPurchases = (purchases as Purchase[]).filter((purchase) => isPremiumProductId(getPurchaseProductId(purchase)));
      if (premiumPurchases.length === 0) throw new Error('No active Premium purchase was found.');
      for (const purchase of premiumPurchases) {
        await validateAndApplyPurchase(purchase);
      }
    } catch (error) {
      setPurchaseError(error instanceof Error ? error.message : 'Could not restore purchases.');
      throw error;
    } finally {
      setPurchaseLoading(false);
    }
    await loadPremiumState();
  }, [loadPremiumState, userId, validateAndApplyPurchase]);

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

  const premiumPlans = useMemo<PremiumPlan[]>(() => PREMIUM_PLANS.map((plan) => {
    const product = storeProducts.find((candidate) => getStoreProductId(candidate) === plan.id);
    return {
      ...plan,
      displayPrice: getStoreProductPrice(product) ?? plan.displayPrice,
    };
  }), [storeProducts]);

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
      friendsUnlocked: true,
      hasTheme,
      premiumPlans,
      purchaseLoading,
      purchaseError,
      storeProductsLoaded,
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
      premiumPlans,
      purchaseLoading,
      purchaseError,
      storeProductsLoaded,
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

function getPurchaseProductId(purchase: Purchase) {
  const value = (purchase as any).productId ?? (purchase as any).id;
  return typeof value === 'string' ? value : '';
}

function getStoreProductId(product: Product | undefined) {
  const value = (product as any)?.id ?? (product as any)?.productId;
  return typeof value === 'string' ? value : '';
}

function getStoreProductPrice(product: Product | undefined) {
  const value = (product as any)?.displayPrice ?? (product as any)?.localizedPrice ?? (product as any)?.price;
  return typeof value === 'string' ? value : null;
}

function isPremiumProductId(productId: string): productId is PremiumPlanId {
  return (PREMIUM_PLANS as readonly PremiumPlan[]).some((plan) => plan.id === productId);
}

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used inside PremiumProvider');
  return ctx;
}