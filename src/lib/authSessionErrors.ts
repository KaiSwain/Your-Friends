export function isInvalidRefreshTokenError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /refresh token/i.test(message) && /(not found|invalid|revoked|expired)/i.test(message);
}
