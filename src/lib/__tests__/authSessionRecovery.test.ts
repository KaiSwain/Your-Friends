import { isInvalidRefreshTokenError } from '../authSessionErrors';

describe('isInvalidRefreshTokenError', () => {
  it('detects Supabase refresh token not found errors', () => {
    expect(isInvalidRefreshTokenError(new Error('Invalid Refresh Token: Refresh Token Not Found'))).toBe(true);
  });

  it('ignores unrelated auth errors', () => {
    expect(isInvalidRefreshTokenError(new Error('Invalid login credentials'))).toBe(false);
  });
});
