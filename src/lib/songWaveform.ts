export function buildSongWaveform(seed: string, count = 36) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Array.from({ length: count }, (_, index) => {
    hash ^= index + 1;
    hash = Math.imul(hash, 16777619);
    const normalized = Math.abs(hash % 100) / 100;
    return 14 + Math.round(normalized * 42);
  });
}
