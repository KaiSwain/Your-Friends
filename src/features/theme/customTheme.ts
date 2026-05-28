import type { ColorTokens } from './themes';

export type CustomThemeFontKey = 'classic' | 'modern' | 'playful' | 'editorial';

export interface CustomThemeSettings {
  accentHue: number;
  backgroundHue: number;
  backgroundIntensity: number;
  fontKey: CustomThemeFontKey;
}

export const DEFAULT_CUSTOM_THEME_SETTINGS: CustomThemeSettings = {
  accentHue: 258,
  backgroundHue: 34,
  backgroundIntensity: 48,
  fontKey: 'classic',
};

export const CUSTOM_THEME_PROFILE_PREFIX = 'custom-theme:';

export const CUSTOM_THEME_HUE_PRESETS = [
  { label: 'Rose', hue: 346 },
  { label: 'Coral', hue: 16 },
  { label: 'Gold', hue: 42 },
  { label: 'Olive', hue: 88 },
  { label: 'Mint', hue: 152 },
  { label: 'Sky', hue: 204 },
  { label: 'Blue', hue: 226 },
  { label: 'Violet', hue: 258 },
  { label: 'Grape', hue: 286 },
  { label: 'Pink', hue: 322 },
] as const;

const shared = {
  terracotta: '#CC8B74',
  apricot: '#E5B28F',
  gold: '#D4B178',
  sage: '#AEBFAD',
  sky: '#9AB7C9',
  plum: '#8A6D7D',
  white: '#FFFFFF',
  black: '#000000',
  success: '#34C759',
  error: '#FF453A',
};

export function createCustomThemePair(settings: CustomThemeSettings): { light: ColorTokens; dark: ColorTokens } {
  const normalized = normalizeCustomThemeSettings(settings);
  const backgroundSaturation = 10 + normalized.backgroundIntensity * 0.32;
  const accentSaturation = 62 + normalized.backgroundIntensity * 0.14;

  return {
    light: {
      canvas: hslToHex(normalized.backgroundHue, backgroundSaturation, 96),
      canvasAlt: hslToHex(normalized.backgroundHue, backgroundSaturation, 90),
      paper: hslToHex(normalized.backgroundHue, Math.max(8, backgroundSaturation - 8), 99),
      paperMuted: hslToHex(normalized.backgroundHue, backgroundSaturation, 93),
      ink: hslToHex(normalized.backgroundHue, 28, 14),
      inkSoft: hslToHex(normalized.backgroundHue, 18, 34),
      inkMuted: hslToHex(normalized.backgroundHue, 14, 58),
      line: hslToHex(normalized.backgroundHue, 18, 84),
      accent: hslToHex(normalized.accentHue, accentSaturation, 48),
      accentSoft: hslToHex(normalized.accentHue, accentSaturation - 6, 58),
      accentAlt: hslToHex(normalized.accentHue, accentSaturation - 12, 70),
      accentTertiary: hslToHex(normalized.backgroundHue, backgroundSaturation + 8, 66),
      ...shared,
    },
    dark: {
      canvas: hslToHex(normalized.backgroundHue, 22 + normalized.backgroundIntensity * 0.22, 7),
      canvasAlt: hslToHex(normalized.backgroundHue, 22 + normalized.backgroundIntensity * 0.22, 11),
      paper: hslToHex(normalized.backgroundHue, 18 + normalized.backgroundIntensity * 0.2, 15),
      paperMuted: hslToHex(normalized.backgroundHue, 18 + normalized.backgroundIntensity * 0.2, 20),
      ink: hslToHex(normalized.backgroundHue, 30, 94),
      inkSoft: hslToHex(normalized.backgroundHue, 20, 78),
      inkMuted: hslToHex(normalized.backgroundHue, 14, 58),
      line: hslToHex(normalized.backgroundHue, 18, 24),
      accent: hslToHex(normalized.accentHue, accentSaturation, 68),
      accentSoft: hslToHex(normalized.accentHue, accentSaturation - 8, 56),
      accentAlt: hslToHex(normalized.accentHue, accentSaturation - 16, 78),
      accentTertiary: hslToHex(normalized.backgroundHue, backgroundSaturation + 10, 62),
      ...shared,
    },
  };
}

export function encodeProfileCustomTheme(settings: CustomThemeSettings) {
  return `${CUSTOM_THEME_PROFILE_PREFIX}${encodeURIComponent(JSON.stringify(normalizeCustomThemeSettings(settings)))}`;
}

export function decodeProfileCustomTheme(value: string | null | undefined): CustomThemeSettings | null {
  if (!value?.startsWith(CUSTOM_THEME_PROFILE_PREFIX)) return null;
  try {
    return normalizeCustomThemeSettings(JSON.parse(decodeURIComponent(value.slice(CUSTOM_THEME_PROFILE_PREFIX.length))));
  } catch {
    return null;
  }
}

export function isProfileCustomTheme(value: string | null | undefined) {
  return Boolean(decodeProfileCustomTheme(value));
}

export function normalizeCustomThemeSettings(value: Partial<CustomThemeSettings> | null | undefined): CustomThemeSettings {
  return {
    accentHue: normalizeHue(value?.accentHue ?? DEFAULT_CUSTOM_THEME_SETTINGS.accentHue),
    backgroundHue: normalizeHue(value?.backgroundHue ?? DEFAULT_CUSTOM_THEME_SETTINGS.backgroundHue),
    backgroundIntensity: clamp(value?.backgroundIntensity ?? DEFAULT_CUSTOM_THEME_SETTINGS.backgroundIntensity, 0, 100),
    fontKey: isCustomFontKey(value?.fontKey) ? value.fontKey : DEFAULT_CUSTOM_THEME_SETTINGS.fontKey,
  };
}

export function customThemeHueToHex(hue: number, saturation = 72, lightness = 56) {
  return hslToHex(hue, saturation, lightness);
}

function isCustomFontKey(value: unknown): value is CustomThemeFontKey {
  return value === 'classic' || value === 'modern' || value === 'playful' || value === 'editorial';
}

function normalizeHue(value: number) {
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value) % 360) + 360) % 360;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function hslToHex(h: number, s: number, l: number) {
  const hue = normalizeHue(h) / 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  if (saturation === 0) {
    const value = toHex(Math.round(lightness * 255));
    return `#${value}${value}${value}`;
  }
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const r = hueToRgb(p, q, hue + 1 / 3);
  const g = hueToRgb(p, q, hue);
  const b = hueToRgb(p, q, hue - 1 / 3);
  return `#${toHex(Math.round(r * 255))}${toHex(Math.round(g * 255))}${toHex(Math.round(b * 255))}`;
}

function hueToRgb(p: number, q: number, t: number) {
  let next = t;
  if (next < 0) next += 1;
  if (next > 1) next -= 1;
  if (next < 1 / 6) return p + (q - p) * 6 * next;
  if (next < 1 / 2) return q;
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
  return p;
}

function toHex(value: number) {
  return value.toString(16).padStart(2, '0');
}
