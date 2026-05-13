import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeFriendCode } from './friendCode';
import { supabase } from './supabase';

const DAY_MS = 24 * 60 * 60 * 1000;

export const REFERRAL_REWARD_DAYS = 7;
export const REFERRAL_REWARD_LABEL = '7 days of Premium';

export const subscribedKey = (userId: string) => `yourfriends:premium:subscribed:${userId}`;
export const premiumUntilKey = (userId: string) => `yourfriends:premium:until:${userId}`;
export const referrerCodeKey = (userId: string) => `yourfriends:premium:referrerCode:${userId}`;
export const referralRewardCountKey = (userId: string) => `yourfriends:premium:referralRewardCount:${userId}`;
export const referralRewardGrantedKey = (userId: string) => `yourfriends:premium:referralRewardGranted:${userId}`;

const INCOMING_REFERRAL_CODE_KEY = 'yourfriends:referral:incoming';

export function isPremiumUntilActive(value: string | null | undefined, now = Date.now()) {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time > now;
}

export function getPremiumDaysRemaining(value: string | null | undefined, now = Date.now()) {
  if (!isPremiumUntilActive(value, now)) return 0;
  return Math.max(1, Math.ceil((Date.parse(value!) - now) / DAY_MS));
}

export function extendIsoByDays(value: string | null | undefined, days: number, now = Date.now()) {
  const existing = value ? Date.parse(value) : NaN;
  const base = Number.isFinite(existing) && existing > now ? existing : now;
  return new Date(base + days * DAY_MS).toISOString();
}

export async function storeIncomingReferralCode(rawCode: string) {
  const code = normalizeFriendCode(rawCode);
  if (!code) return null;
  await AsyncStorage.setItem(INCOMING_REFERRAL_CODE_KEY, code);
  return code;
}

export async function peekIncomingReferralCode() {
  const raw = await AsyncStorage.getItem(INCOMING_REFERRAL_CODE_KEY);
  return raw ? normalizeFriendCode(raw) : null;
}

export async function clearIncomingReferralCode() {
  await AsyncStorage.removeItem(INCOMING_REFERRAL_CODE_KEY);
}

export async function consumeIncomingReferralCode() {
  const code = await peekIncomingReferralCode();
  if (code) await clearIncomingReferralCode();
  return code;
}

export async function readLocalPremiumUntil(userId: string) {
  return AsyncStorage.getItem(premiumUntilKey(userId));
}

export async function setLocalPremiumUntil(userId: string, value: string | null) {
  if (value) await AsyncStorage.setItem(premiumUntilKey(userId), value);
  else await AsyncStorage.removeItem(premiumUntilKey(userId));
}

export async function grantLocalPremiumDays(userId: string, days = REFERRAL_REWARD_DAYS) {
  const raw = await readLocalPremiumUntil(userId);
  const next = extendIsoByDays(raw, days);
  await setLocalPremiumUntil(userId, next);
  return next;
}

async function setOwnProfilePremiumUntil(userId: string, premiumUntil: string) {
  try {
    await supabase.from('profiles').update({ premium_until: premiumUntil }).eq('id', userId);
  } catch {
    // The production database may not have `premium_until` until the schema is applied.
  }
}

async function incrementLocalReferralRewardCount(userId: string) {
  const raw = await AsyncStorage.getItem(referralRewardCountKey(userId));
  const next = (raw ? Number(raw) || 0 : 0) + 1;
  await AsyncStorage.setItem(referralRewardCountKey(userId), String(next));
  return next;
}

function isMissingReferralBackend(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return code === '42883' || message.includes('function') || message.includes('schema cache') || message.includes('premium_until');
}

type ReferralRpcResult = {
  referrer_user_id?: string | null;
  referee_premium_until?: string | null;
  referrer_premium_until?: string | null;
};

type ApplyReferralRewardInput = {
  refereeUserId: string;
  refereeFriendCode: string;
  referrerCode: string;
};

export async function applyReferralRewardForUser({
  refereeUserId,
  refereeFriendCode,
  referrerCode,
}: ApplyReferralRewardInput): Promise<{
  ok: true;
  code: string;
  referrerUserId: string;
  refereePremiumUntil: string;
  referrerPremiumUntil: string;
} | { ok: false; error: string }> {
  const code = normalizeFriendCode(referrerCode);
  const ownCode = normalizeFriendCode(refereeFriendCode);
  if (!code) return { ok: false, error: 'Enter a referral code.' };
  if (ownCode && code === ownCode) return { ok: false, error: "That's your own referral code." };

  const [existingReferrer, rewardGranted] = await Promise.all([
    AsyncStorage.getItem(referrerCodeKey(refereeUserId)),
    AsyncStorage.getItem(referralRewardGrantedKey(refereeUserId)),
  ]);
  if (existingReferrer) return { ok: false, error: 'You already used a referral code.' };
  if (rewardGranted === 'true') return { ok: false, error: 'This account already received a referral reward.' };

  const { data: referrer, error: referrerError } = await supabase
    .from('profiles')
    .select('id, friend_code')
    .eq('friend_code', code)
    .maybeSingle();

  if (referrerError || !referrer?.id) return { ok: false, error: 'Referral code not found.' };
  if (referrer.id === refereeUserId) return { ok: false, error: "That's your own referral code." };

  let refereePremiumUntil: string | null = null;
  let referrerPremiumUntil: string | null = null;
  let appliedByBackend = false;

  try {
    const { data, error } = await supabase.rpc('apply_referral_reward', {
      referee_id: refereeUserId,
      referral_code: code,
    });
    if (error) {
      if (!isMissingReferralBackend(error)) return { ok: false, error: error.message };
    } else {
      const row = (Array.isArray(data) ? data[0] : data) as ReferralRpcResult | null;
      refereePremiumUntil = row?.referee_premium_until ?? null;
      referrerPremiumUntil = row?.referrer_premium_until ?? null;
      appliedByBackend = true;
    }
  } catch {
    // Fall through to the local prototype grant when the backend function is unavailable.
  }

  if (!refereePremiumUntil) {
    refereePremiumUntil = await grantLocalPremiumDays(refereeUserId, REFERRAL_REWARD_DAYS);
  } else {
    await setLocalPremiumUntil(refereeUserId, refereePremiumUntil);
  }

  if (!referrerPremiumUntil) {
    referrerPremiumUntil = await grantLocalPremiumDays(referrer.id, REFERRAL_REWARD_DAYS);
  } else {
    await setLocalPremiumUntil(referrer.id, referrerPremiumUntil);
  }

  if (!appliedByBackend) {
    await setOwnProfilePremiumUntil(refereeUserId, refereePremiumUntil);
  }

  await Promise.all([
    AsyncStorage.setItem(referrerCodeKey(refereeUserId), code),
    AsyncStorage.setItem(referralRewardGrantedKey(refereeUserId), 'true'),
    incrementLocalReferralRewardCount(referrer.id),
  ]);

  return {
    ok: true,
    code,
    referrerUserId: referrer.id,
    refereePremiumUntil,
    referrerPremiumUntil,
  };
}
