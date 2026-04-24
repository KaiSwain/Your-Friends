import type { TextStyle } from 'react-native';

import type { FontSet } from '../theme/typography';
import { colors as paletteColors } from '../theme/tokens';
import type { ColorTokens } from '../theme/tokens';
import type { WallPostTextColor, WallPostTextEffect, WallPostTextFont, WallPostTextSize } from '../types/domain';

export const defaultWallPostTextFont: WallPostTextFont = 'handwritten';
export const defaultWallPostTextSize: WallPostTextSize = 20;
export const minWallPostTextSize = 16;
export const maxWallPostTextSize = 38;
export const defaultWallPostTextEffect: WallPostTextEffect = 'none';
export const defaultWallPostTextColor: WallPostTextColor = 'ink';

export const wallPostTextFontOptions: Array<{ key: WallPostTextFont; label: string }> = [
  { key: 'handwritten', label: 'Script' },
  { key: 'handwrittenBold', label: 'Bold Script' },
  { key: 'marker', label: 'Marker' },
  { key: 'editorial', label: 'Editorial' },
  { key: 'modern', label: 'Modern' },
  { key: 'body', label: 'Body' },
  { key: 'heading', label: 'Classic' },
];

export const wallPostTextEffectOptions: Array<{ key: WallPostTextEffect; label: string }> = [
  { key: 'none', label: 'Plain' },
  { key: 'shadow', label: 'Shadow' },
  { key: 'glow', label: 'Glow' },
  { key: 'echo', label: 'Echo' },
  { key: 'dreamy', label: 'Dreamy' },
];

export const wallPostTextColorOptions: Array<{ key: WallPostTextColor; label: string }> = [
  { key: 'ink', label: 'Ink' },
  { key: 'accent', label: 'Accent' },
  { key: 'terracotta', label: 'Warm' },
  { key: 'rose', label: 'Rose' },
  { key: 'plum', label: 'Plum' },
  { key: 'lavender', label: 'Lavender' },
  { key: 'sky', label: 'Sky' },
];

const WALL_POST_TEXT_STYLE_PREFIX = '__yf_text_style__:';
const LEGACY_SIZE_MAP = {
  sm: 16,
  md: 20,
  lg: 26,
  xl: 32,
} as const;

function clampWallPostTextSize(value: number): number {
  return Math.max(minWallPostTextSize, Math.min(maxWallPostTextSize, Math.round(value)));
}

function normalizeWallPostTextFont(value: string | null | undefined): WallPostTextFont | null {
  switch (value) {
    case 'handwritten':
    case 'handwrittenBold':
    case 'marker':
    case 'editorial':
    case 'modern':
    case 'body':
    case 'heading':
      return value;
    default:
      return null;
  }
}

function normalizeWallPostTextEffect(value: string | null | undefined): WallPostTextEffect | null {
  switch (value) {
    case 'none':
    case 'shadow':
    case 'glow':
    case 'echo':
    case 'dreamy':
      return value;
    default:
      return null;
  }
}

function normalizeWallPostTextColor(value: string | null | undefined): WallPostTextColor | null {
  switch (value) {
    case 'ink':
    case 'accent':
    case 'terracotta':
    case 'rose':
    case 'plum':
    case 'lavender':
    case 'sky':
      return value;
    default:
      return null;
  }
}

function normalizeWallPostTextSize(value: unknown): WallPostTextSize | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampWallPostTextSize(value);
  }
  if (typeof value === 'string') {
    if (value in LEGACY_SIZE_MAP) {
      return LEGACY_SIZE_MAP[value as keyof typeof LEGACY_SIZE_MAP];
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return clampWallPostTextSize(parsed);
  }
  return null;
}

export function formatWallPostTextSizeLabel(size: WallPostTextSize | null | undefined): string {
  return `${normalizeWallPostTextSize(size) ?? defaultWallPostTextSize}px`;
}

export function getWallPostTextFontFamily(fonts: FontSet, font: WallPostTextFont): string {
  switch (font) {
    case 'handwritten':
      return fonts.handwritten;
    case 'handwrittenBold':
      return fonts.handwrittenBold;
    case 'marker':
      return 'PermanentMarker_400Regular';
    case 'editorial':
      return 'PlayfairDisplay_600SemiBold';
    case 'modern':
      return 'SpaceGrotesk_500Medium';
    case 'body':
      return fonts.body;
    case 'heading':
      return fonts.heading;
  }
}

export function getWallPostTextSizeScale(size: WallPostTextSize): { fontSize: number; lineHeight: number } {
  const fontSize = clampWallPostTextSize(size);
  return {
    fontSize,
    lineHeight: Math.round(fontSize * 1.34),
  };
}

export function resolveWallPostTextStyle(
  fonts: FontSet,
  font: WallPostTextFont | null | undefined,
  size: WallPostTextSize | null | undefined,
): Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'> {
  const resolvedFont = font ?? defaultWallPostTextFont;
  const resolvedSize = normalizeWallPostTextSize(size) ?? defaultWallPostTextSize;
  const scale = getWallPostTextSizeScale(resolvedSize);

  return {
    fontFamily: getWallPostTextFontFamily(fonts, resolvedFont),
    fontSize: scale.fontSize,
    lineHeight: scale.lineHeight,
    letterSpacing: resolvedFont === 'modern' ? 0.2 : resolvedFont === 'editorial' ? 0.1 : 0,
  };
}

export function resolveWallPostTextColor(
  color: WallPostTextColor | null | undefined,
  colors: Pick<ColorTokens, 'ink' | 'accent'>,
): string {
  switch (color ?? defaultWallPostTextColor) {
    case 'accent':
      return colors.accent;
    case 'terracotta':
      return paletteColors.terracotta;
    case 'rose':
      return paletteColors.rose;
    case 'plum':
      return paletteColors.plum;
    case 'lavender':
      return paletteColors.lavender;
    case 'sky':
      return paletteColors.sky;
    case 'ink':
    default:
      return colors.ink;
  }
}

export function resolveWallPostTextEffectStyles(
  effect: WallPostTextEffect | null | undefined,
  colors: { accent: string; paper: string; ink: string },
): { layers: TextStyle[]; front: TextStyle } {
  switch (effect ?? defaultWallPostTextEffect) {
    case 'shadow':
      return {
        layers: [
          {
            color: colors.ink,
            opacity: 0.18,
            transform: [{ translateX: 1.5 }, { translateY: 2.5 }],
          },
        ],
        front: {},
      };
    case 'glow':
      return {
        layers: [
          {
            color: colors.accent,
            opacity: 0.34,
            textShadowColor: colors.accent,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 16,
          },
        ],
        front: {
          textShadowColor: colors.accent,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        },
      };
    case 'echo':
      return {
        layers: [
          {
            color: colors.accent,
            opacity: 0.58,
            transform: [{ translateX: 3 }, { translateY: 3 }],
          },
        ],
        front: {},
      };
    case 'dreamy':
      return {
        layers: [
          {
            color: colors.paper,
            opacity: 0.95,
            transform: [{ translateX: -1 }, { translateY: -1 }],
          },
          {
            color: colors.accent,
            opacity: 0.22,
            textShadowColor: colors.accent,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 18,
          },
        ],
        front: {},
      };
    default:
      return {
        layers: [],
        front: {},
      };
  }
}

export function encodeWallPostTextStyle(
  font: WallPostTextFont | null | undefined,
  size: WallPostTextSize | null | undefined,
  effect: WallPostTextEffect | null | undefined,
  color: WallPostTextColor | null | undefined,
): string {
  const payload = {
    font: font ?? defaultWallPostTextFont,
    size: normalizeWallPostTextSize(size) ?? defaultWallPostTextSize,
    effect: effect ?? defaultWallPostTextEffect,
    color: color ?? defaultWallPostTextColor,
  };
  return `${WALL_POST_TEXT_STYLE_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeWallPostTextStyle(
  value: string | null | undefined,
): { textFont: WallPostTextFont | null; textSize: WallPostTextSize | null; textEffect: WallPostTextEffect | null; textColor: WallPostTextColor | null } | null {
  if (!value?.startsWith(WALL_POST_TEXT_STYLE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(WALL_POST_TEXT_STYLE_PREFIX.length));
    return {
      textFont: normalizeWallPostTextFont(parsed?.font) ?? defaultWallPostTextFont,
      textSize: normalizeWallPostTextSize(parsed?.size) ?? defaultWallPostTextSize,
      textEffect: normalizeWallPostTextEffect(parsed?.effect) ?? defaultWallPostTextEffect,
      textColor: normalizeWallPostTextColor(parsed?.color) ?? defaultWallPostTextColor,
    };
  } catch {
    return {
      textFont: defaultWallPostTextFont,
      textSize: defaultWallPostTextSize,
      textEffect: defaultWallPostTextEffect,
      textColor: defaultWallPostTextColor,
    };
  }
}

export function splitWallPostPresentation(
  rawFilter: string | null | undefined,
  explicitTextFont?: string | null,
  explicitTextSize?: string | number | null,
  explicitTextEffect?: string | null,
  explicitTextColor?: string | null,
): {
  filter: string | null;
  textFont: WallPostTextFont | null;
  textSize: WallPostTextSize | null;
  textEffect: WallPostTextEffect | null;
  textColor: WallPostTextColor | null;
} {
  const explicitFont = normalizeWallPostTextFont(explicitTextFont);
  const explicitSize = normalizeWallPostTextSize(explicitTextSize);
  const explicitEffect = normalizeWallPostTextEffect(explicitTextEffect);
  const explicitColor = normalizeWallPostTextColor(explicitTextColor);
  if (explicitFont || explicitSize || explicitEffect || explicitColor) {
    return {
      filter: rawFilter ?? null,
      textFont: explicitFont,
      textSize: explicitSize,
      textEffect: explicitEffect,
      textColor: explicitColor,
    };
  }

  const decoded = decodeWallPostTextStyle(rawFilter);
  if (decoded) {
    return {
      filter: null,
      textFont: decoded.textFont,
      textSize: decoded.textSize,
      textEffect: decoded.textEffect,
      textColor: decoded.textColor,
    };
  }

  return {
    filter: rawFilter ?? null,
    textFont: null,
    textSize: null,
    textEffect: null,
    textColor: null,
  };
}