import type { ColorTokens } from '../features/theme/themes';

type Rgb = { r: number; g: number; b: number };

export interface ReadableSurfaceColors {
  text: string;
  mutedText: string;
  icon: string;
  border: string;
}

/**
 * Return '#000000' or '#FFFFFF' depending on which contrasts better
 * against the given hex background color.
 */
export function contrastText(hex: string | null | undefined): '#000000' | '#FFFFFF' {
  const readable = getReadableTextColor(hex, '#FFFFFF', '#000000');
  return readable === '#000000' ? '#000000' : '#FFFFFF';
}

/**
 * Return a lighter/darker muted variant for secondary text.
 */
export function contrastTextSoft(hex: string | null | undefined): string {
  return contrastText(hex);
}

export function getReadableTextColor(
  backgroundHex: string | null | undefined,
  lightText = '#FFFFFF',
  darkText = '#000000',
): string {
  const background = parseHexColor(backgroundHex);
  const light = parseHexColor(lightText);
  const dark = parseHexColor(darkText);
  if (!background || !light || !dark) return lightText;

  return contrastRatio(background, light) >= contrastRatio(background, dark) ? lightText : darkText;
}

export function getReadableSurfaceColors(backgroundHex: string | null | undefined, colors: ColorTokens): ReadableSurfaceColors {
  const text = backgroundHex ? getReadableTextColor(backgroundHex, colors.white, colors.ink) : colors.ink;
  return {
    text,
    // Keep secondary copy readable; transparency should be applied to the surface, not the text.
    mutedText: text,
    icon: text,
    border: text === colors.white ? colors.white : colors.line,
  };
}

/**
 * Return an accent-like color that works on the given background.
 * On light backgrounds, use a darker accent; on dark, use the normal accent.
 */
export function contrastAccent(hex: string | null | undefined, accent: string): string {
  if (!hex) return accent;
  const raw = hex.replace('#', '');
  const r = parseInt(raw.substring(0, 2), 16);
  const g = parseInt(raw.substring(2, 4), 16);
  const b = parseInt(raw.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.5) {
    // Darken accent for light backgrounds
    const ar = parseInt(accent.replace('#', '').substring(0, 2), 16);
    const ag = parseInt(accent.replace('#', '').substring(2, 4), 16);
    const ab = parseInt(accent.replace('#', '').substring(4, 6), 16);
    const dr = Math.round(ar * 0.6);
    const dg = Math.round(ag * 0.6);
    const db = Math.round(ab * 0.6);
    return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
  }
  return accent;
}

function parseHexColor(hex: string | null | undefined): Rgb | null {
  if (!hex) return null;
  const raw = hex.replace('#', '').trim();
  if (raw.length !== 3 && raw.length !== 6 && raw.length !== 8) return null;

  const normalized = raw.length === 3
    ? raw.split('').map((digit) => digit + digit).join('')
    : raw.slice(0, 6);
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return null;
  return { r, g, b };
}

function contrastRatio(a: Rgb, b: Rgb) {
  const light = Math.max(relativeLuminance(a), relativeLuminance(b));
  const dark = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance(color: Rgb) {
  const [r, g, b] = [color.r, color.g, color.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
