import {
  getPromptExpirationLabel,
  getPromptExpiresAt,
  isPromptExpired,
  PROMPT_EXPIRATION_DAYS,
} from '../promptExpiration';

describe('prompt expiration', () => {
  const now = Date.parse('2026-05-26T12:00:00.000Z');

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sets new prompts to expire one week after creation', () => {
    expect(getPromptExpiresAt('2026-05-26T12:00:00.000Z')).toBe('2026-06-02T12:00:00.000Z');
    expect(PROMPT_EXPIRATION_DAYS).toBe(7);
  });

  it('formats active and expired countdown labels', () => {
    expect(getPromptExpirationLabel('2026-05-27T12:00:00.000Z')).toBe('Expires in 1 day');
    expect(getPromptExpirationLabel('2026-05-26T15:00:00.000Z')).toBe('Expires in 3h');
    expect(getPromptExpirationLabel('2026-05-26T11:59:00.000Z')).toBe('Expired');
  });

  it('detects expired requests', () => {
    expect(isPromptExpired({ createdAt: '2026-05-19T12:00:00.000Z', expiresAt: '2026-05-26T11:59:00.000Z' })).toBe(true);
    expect(isPromptExpired({ createdAt: '2026-05-20T12:00:00.000Z', expiresAt: '2026-05-27T12:00:00.000Z' })).toBe(false);
  });
});
