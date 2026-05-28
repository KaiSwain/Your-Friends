import type { VoiceAttachment } from '../types/domain';

export function rowToVoiceAttachment(row: Record<string, unknown>, prefix = ''): VoiceAttachment | null {
  const pathKey = prefix ? `${prefix}_audio_path` : 'audio_path';
  const durationKey = prefix ? `${prefix}_audio_duration_ms` : 'audio_duration_ms';
  const uri = row[pathKey];
  if (!uri) return null;
  return {
    uri: String(uri),
    durationMs: normalizeDurationMs(row[durationKey]),
  };
}

export function voiceToDbColumns(prefix: string, voice: VoiceAttachment | null | undefined) {
  const pathKey = prefix ? `${prefix}_audio_path` : 'audio_path';
  const durationKey = prefix ? `${prefix}_audio_duration_ms` : 'audio_duration_ms';
  return {
    [pathKey]: voice?.uri ?? null,
    [durationKey]: voice?.durationMs ?? null,
  };
}

export function hasTextOrVoice(text: string | null | undefined, voice: VoiceAttachment | null | undefined) {
  return Boolean(text?.trim() || voice);
}

function normalizeDurationMs(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  }
  return null;
}
