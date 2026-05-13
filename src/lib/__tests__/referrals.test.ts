const mockStorage = new Map<string, string>();

const mockAsyncStorage = {
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStorage.delete(key);
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((key) => mockStorage.delete(key));
  }),
};

const mockMaybeSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockUpdateEq = jest.fn();
const mockUpdate = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockAsyncStorage,
}));

jest.mock('../supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  applyReferralRewardForUser,
  clearIncomingReferralCode,
  consumeIncomingReferralCode,
  extendIsoByDays,
  getPremiumDaysRemaining,
  grantLocalPremiumDays,
  isPremiumUntilActive,
  peekIncomingReferralCode,
  premiumUntilKey,
  readLocalPremiumUntil,
  referralRewardCountKey,
  referralRewardGrantedKey,
  referrerCodeKey,
  setLocalPremiumUntil,
  storeIncomingReferralCode,
} from '../referrals';

const FIXED_NOW = Date.parse('2026-05-07T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function isoFromFixedNow(daysFromNow: number) {
  return new Date(FIXED_NOW + daysFromNow * DAY_MS).toISOString();
}

function expectOk<T extends { ok: boolean }>(result: T): asserts result is Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
}

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();

  jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);

  mockMaybeSingle.mockResolvedValue({
    data: { id: 'referrer-user', friend_code: 'REFCODE1' },
    error: null,
  });
  mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockUpdateEq.mockResolvedValue({ data: null, error: null });
  mockUpdate.mockReturnValue({ eq: mockUpdateEq });
  mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
  mockRpc.mockResolvedValue({
    data: [
      {
        referrer_user_id: 'referrer-user',
        referee_premium_until: isoFromFixedNow(7),
        referrer_premium_until: isoFromFixedNow(10),
      },
    ],
    error: null,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Premium expiry helpers', () => {
  it('detects only future ISO timestamps as active', () => {
    expect(isPremiumUntilActive(null, FIXED_NOW)).toBe(false);
    expect(isPremiumUntilActive('not-a-date', FIXED_NOW)).toBe(false);
    expect(isPremiumUntilActive(isoFromFixedNow(-1), FIXED_NOW)).toBe(false);
    expect(isPremiumUntilActive(isoFromFixedNow(1), FIXED_NOW)).toBe(true);
  });

  it('rounds active Premium time up to at least one day remaining', () => {
    expect(getPremiumDaysRemaining(isoFromFixedNow(-1), FIXED_NOW)).toBe(0);
    expect(getPremiumDaysRemaining(new Date(FIXED_NOW + 60 * 60 * 1000).toISOString(), FIXED_NOW)).toBe(1);
    expect(getPremiumDaysRemaining(new Date(FIXED_NOW + 8.25 * DAY_MS).toISOString(), FIXED_NOW)).toBe(9);
  });

  it('extends from the later of now or the existing Premium expiry', () => {
    expect(extendIsoByDays(null, 7, FIXED_NOW)).toBe(isoFromFixedNow(7));
    expect(extendIsoByDays(isoFromFixedNow(-3), 7, FIXED_NOW)).toBe(isoFromFixedNow(7));
    expect(extendIsoByDays(isoFromFixedNow(4), 7, FIXED_NOW)).toBe(isoFromFixedNow(11));
  });
});

describe('local Premium and incoming referral storage', () => {
  it('normalizes, peeks, consumes, and clears incoming referral codes', async () => {
    await expect(storeIncomingReferralCode(' ref-code 1! ')).resolves.toBe('REFCODE1');
    await expect(peekIncomingReferralCode()).resolves.toBe('REFCODE1');
    await expect(consumeIncomingReferralCode()).resolves.toBe('REFCODE1');
    await expect(peekIncomingReferralCode()).resolves.toBeNull();

    await storeIncomingReferralCode('another');
    await clearIncomingReferralCode();
    await expect(peekIncomingReferralCode()).resolves.toBeNull();
  });

  it('reads, writes, removes, and extends local Premium expiry', async () => {
    await setLocalPremiumUntil('user-a', isoFromFixedNow(3));
    await expect(readLocalPremiumUntil('user-a')).resolves.toBe(isoFromFixedNow(3));

    await expect(grantLocalPremiumDays('user-a', 7)).resolves.toBe(isoFromFixedNow(10));
    await expect(readLocalPremiumUntil('user-a')).resolves.toBe(isoFromFixedNow(10));

    await setLocalPremiumUntil('user-a', null);
    await expect(readLocalPremiumUntil('user-a')).resolves.toBeNull();
  });
});

describe('applyReferralRewardForUser', () => {
  it('rejects empty and self-referral codes before hitting Supabase', async () => {
    await expect(
      applyReferralRewardForUser({ refereeUserId: 'referee-user', refereeFriendCode: 'MINE1234', referrerCode: '' }),
    ).resolves.toEqual({ ok: false, error: 'Enter a referral code.' });

    await expect(
      applyReferralRewardForUser({ refereeUserId: 'referee-user', refereeFriendCode: 'MINE1234', referrerCode: 'mine-1234' }),
    ).resolves.toEqual({ ok: false, error: "That's your own referral code." });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('keeps referral attribution immutable once a code is stored', async () => {
    await AsyncStorage.setItem(referrerCodeKey('referee-user'), 'FIRST111');

    await expect(
      applyReferralRewardForUser({ refereeUserId: 'referee-user', refereeFriendCode: 'MINE1234', referrerCode: 'SECOND22' }),
    ).resolves.toEqual({ ok: false, error: 'You already used a referral code.' });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects missing referrer profiles', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      applyReferralRewardForUser({ refereeUserId: 'referee-user', refereeFriendCode: 'MINE1234', referrerCode: 'UNKNOWN1' }),
    ).resolves.toEqual({ ok: false, error: 'Referral code not found.' });
  });

  it('uses the backend referral RPC when available and mirrors expiry locally', async () => {
    const result = await applyReferralRewardForUser({
      refereeUserId: 'referee-user',
      refereeFriendCode: 'MINE1234',
      referrerCode: 'ref-code-1',
    });

    expectOk(result);
    expect(result).toEqual({
      ok: true,
      code: 'REFCODE1',
      referrerUserId: 'referrer-user',
      refereePremiumUntil: isoFromFixedNow(7),
      referrerPremiumUntil: isoFromFixedNow(10),
    });
    expect(mockRpc).toHaveBeenCalledWith('apply_referral_reward', {
      referee_id: 'referee-user',
      referral_code: 'REFCODE1',
    });
    await expect(AsyncStorage.getItem(premiumUntilKey('referee-user'))).resolves.toBe(isoFromFixedNow(7));
    await expect(AsyncStorage.getItem(premiumUntilKey('referrer-user'))).resolves.toBe(isoFromFixedNow(10));
    await expect(AsyncStorage.getItem(referrerCodeKey('referee-user'))).resolves.toBe('REFCODE1');
    await expect(AsyncStorage.getItem(referralRewardGrantedKey('referee-user'))).resolves.toBe('true');
    await expect(AsyncStorage.getItem(referralRewardCountKey('referrer-user'))).resolves.toBe('1');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('falls back to local 7-day grants when the referral backend is not deployed yet', async () => {
    await AsyncStorage.setItem(premiumUntilKey('referee-user'), isoFromFixedNow(2));
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: '42883', message: 'function public.apply_referral_reward does not exist' },
    });

    const result = await applyReferralRewardForUser({
      refereeUserId: 'referee-user',
      refereeFriendCode: 'MINE1234',
      referrerCode: 'refcode1',
    });

    expectOk(result);
    expect(result.refereePremiumUntil).toBe(isoFromFixedNow(9));
    expect(result.referrerPremiumUntil).toBe(isoFromFixedNow(7));
    await expect(AsyncStorage.getItem(premiumUntilKey('referee-user'))).resolves.toBe(isoFromFixedNow(9));
    await expect(AsyncStorage.getItem(premiumUntilKey('referrer-user'))).resolves.toBe(isoFromFixedNow(7));
    expect(mockUpdate).toHaveBeenCalledWith({ premium_until: isoFromFixedNow(9) });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'referee-user');
  });

  it('does not grant a reward twice for the same referee account', async () => {
    await AsyncStorage.setItem(referralRewardGrantedKey('referee-user'), 'true');

    await expect(
      applyReferralRewardForUser({ refereeUserId: 'referee-user', refereeFriendCode: 'MINE1234', referrerCode: 'REFCODE1' }),
    ).resolves.toEqual({ ok: false, error: 'This account already received a referral reward.' });

    expect(mockFrom).not.toHaveBeenCalled();
  });
});