import { getCureProgress, getCureStyles, CURE_DURATION_MS } from '../polaroidCure';

describe('getCureProgress', () => {
  it('returns 0 for a post created right now', () => {
    const now = Date.now();
    expect(getCureProgress(new Date(now).toISOString(), now)).toBe(0);
  });

  it('returns 1 for a post older than the cure duration', () => {
    const now = Date.now();
    const old = new Date(now - CURE_DURATION_MS - 1000).toISOString();
    expect(getCureProgress(old, now)).toBe(1);
  });

  it('returns ~0.5 halfway through the cure duration', () => {
    const now = Date.now();
    const half = new Date(now - CURE_DURATION_MS / 2).toISOString();
    const p = getCureProgress(half, now);
    expect(p).toBeCloseTo(0.5, 1);
  });

  it('clamps negative elapsed to 0', () => {
    const now = Date.now();
    const future = new Date(now + 60_000).toISOString();
    expect(getCureProgress(future, now)).toBe(0);
  });
});

describe('getCureStyles', () => {
  it('returns developing=true when progress < 1', () => {
    expect(getCureStyles(0).developing).toBe(true);
    expect(getCureStyles(0.5).developing).toBe(true);
  });

  it('returns developing=false when progress is 1', () => {
    expect(getCureStyles(1).developing).toBe(false);
  });

  it('starts with dark overlay near 0.96', () => {
    expect(getCureStyles(0).darkOverlay).toBeCloseTo(0.96, 2);
  });

  it('dark overlay fades to 0 when fully developed', () => {
    expect(getCureStyles(1).darkOverlay).toBeCloseTo(0, 2);
  });

  it('dark overlay eases down continuously through development', () => {
    const early = getCureStyles(0.25).darkOverlay;
    const middle = getCureStyles(0.5).darkOverlay;
    const late = getCureStyles(0.75).darkOverlay;

    expect(early).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(late);
  });

  it('keeps the image near-black through the opening part of the cure', () => {
    const opening = getCureStyles(0.08);

    expect(opening.darkOverlay).toBeGreaterThan(0.9);
    expect(opening.warmOverlay).toBeCloseTo(0, 3);
  });

  it('warm overlay stays at 0 on the endpoints', () => {
    expect(getCureStyles(0).warmOverlay).toBeCloseTo(0, 5);
    expect(getCureStyles(1).warmOverlay).toBeCloseTo(0, 2);
  });

  it('warm overlay rises smoothly through the middle of development', () => {
    const early = getCureStyles(0.25).warmOverlay;
    const middle = getCureStyles(0.5).warmOverlay;
    const late = getCureStyles(0.75).warmOverlay;

    expect(early).toBeGreaterThan(0);
    expect(middle).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(0);
    expect(late).toBeLessThan(middle);
  });

  it('image blur clears continuously as the polaroid develops', () => {
    const opening = getCureStyles(0.08).imageBlur;
    const middle = getCureStyles(0.5).imageBlur;
    const late = getCureStyles(0.85).imageBlur;

    expect(opening).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(late);
    expect(getCureStyles(1).imageBlur).toBeCloseTo(0, 2);
  });
});
