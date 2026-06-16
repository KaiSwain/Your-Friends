const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

import { AD_DISMISS_TTL_MS, dismissAd, isAdDismissed } from '../adDismissal';

describe('adDismissal', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('returns false when nothing was dismissed', async () => {
    await expect(isAdDismissed('user-1', 'store')).resolves.toBe(false);
  });

  it('returns true until the dismiss window expires', async () => {
    const now = 1_700_000_000_000;
    await dismissAd('user-1', 'store', AD_DISMISS_TTL_MS, now);
    await expect(isAdDismissed('user-1', 'store', now + 1)).resolves.toBe(true);
    await expect(isAdDismissed('user-1', 'store', now + AD_DISMISS_TTL_MS + 1)).resolves.toBe(false);
  });
});
