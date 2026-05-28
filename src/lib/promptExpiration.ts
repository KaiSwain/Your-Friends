import type { MemoryPromptRequest, MovieReviewRequest } from '../types/domain';

export const PROMPT_EXPIRATION_DAYS = 7;
export const PROMPT_EXPIRING_SOON_MS = 24 * 60 * 60 * 1000;

export function getPromptExpiresAt(createdAt: string) {
  const created = new Date(createdAt).getTime();
  const base = Number.isFinite(created) ? created : Date.now();
  return new Date(base + PROMPT_EXPIRATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function getPromptExpirationLabel(expiresAt: string | null | undefined, nowMs = Date.now()) {
  if (!expiresAt) return 'Expires in 7 days';
  const diffMs = new Date(expiresAt).getTime() - nowMs;
  if (!Number.isFinite(diffMs)) return 'Expires in 7 days';
  if (diffMs <= 0) return 'Expired';

  const minutes = Math.ceil(diffMs / 60000);
  if (minutes < 60) return `Expires in ${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `Expires in ${hours}h`;
  const days = Math.ceil(hours / 24);
  return `Expires in ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function isPromptExpired(request: Pick<MemoryPromptRequest | MovieReviewRequest, 'expiresAt' | 'createdAt'>, nowMs = Date.now()) {
  return new Date(request.expiresAt ?? getPromptExpiresAt(request.createdAt)).getTime() <= nowMs;
}
