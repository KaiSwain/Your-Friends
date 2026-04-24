/** How long (in ms) a polaroid takes to fully develop. */
export const CURE_DURATION_MS = 2 * 60 * 1000; // 2 minutes

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Return a 0-to-1 progress value for how "developed" a post is.
 * 0 = just posted (fully blurred), 1 = fully developed.
 */
export function getCureProgress(createdAt: string, now: number = Date.now()): number {
  const elapsed = now - new Date(createdAt).getTime();
  if (elapsed >= CURE_DURATION_MS) return 1;
  if (elapsed <= 0) return 0;
  return elapsed / CURE_DURATION_MS;
}

/**
 * Return style values to reflect the current development stage.
 * Real Polaroids start black — the image emerges from darkness.
 * We layer a black overlay that fades out as the photo develops.
 */
export function getCureStyles(progress: number) {
  const p = clamp01(progress);
  // Hold the photo close to black for the first ~10% of the cure, then let it emerge.
  const reveal = smoothstep(0.1, 0.98, p);
  const warmRise = smoothstep(0.12, 0.42, p);
  const warmFall = 1 - smoothstep(0.52, 0.92, p);

  return {
    /** Black overlay stays rich a little longer, then peels back more dramatically near the middle. */
    darkOverlay: 0.96 * Math.pow(1 - reveal, 1.65),
    /** Warm chemistry tint blooms sooner and stronger, then fades out smoothly as the image settles. */
    warmOverlay: 0.24 * warmRise * warmFall,
    /** A subtle optical blur clears with the same reveal curve so the image settles into focus. */
    imageBlur: 7 * Math.pow(1 - reveal, 1.1),
    /** Whether the card is still developing */
    developing: p < 1,
  };
}
