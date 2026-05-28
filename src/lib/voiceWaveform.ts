export function buildVoiceWaveform(seed: string, count = 42) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Array.from({ length: count }, (_, index) => {
    hash ^= index + 13;
    hash = Math.imul(hash, 16777619);
    const normalized = Math.abs(hash % 100) / 100;
    const curve = 0.45 + Math.sin(index / 2.8) * 0.18;
    return 12 + Math.round(Math.max(0.12, normalized * curve) * 44);
  });
}

export function formatVoiceDuration(milliseconds: number | null | undefined) {
  const totalSeconds = Math.max(0, Math.round((milliseconds ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
