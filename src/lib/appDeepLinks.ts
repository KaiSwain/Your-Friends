import { extractFriendCode } from './friendCode';

export type AppDeepLink =
  | { type: 'password-recovery'; recoveryUrl: string }
  | { type: 'friend-invite'; code: string }
  | { type: 'unknown' };

export function parseAppDeepLink(url: string | null | undefined): AppDeepLink {
  const value = url ?? '';
  if (!value) return { type: 'unknown' };
  if (isPasswordRecoveryLink(value)) return { type: 'password-recovery', recoveryUrl: value };

  const looksLikeInvite = /[?&]code=/i.test(value) || /\/add-friend(?:[/?#]|$)/i.test(value);
  if (!looksLikeInvite) return { type: 'unknown' };

  const code = extractFriendCode(value);
  if (code && /^[A-Z0-9]{6,12}$/.test(code)) return { type: 'friend-invite', code };
  return { type: 'unknown' };
}

export function isPasswordRecoveryLink(url: string) {
  return /type=recovery/i.test(url) || /\/reset-password(?:[/?#]|$)/i.test(url);
}
