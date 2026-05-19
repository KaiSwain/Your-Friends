import { useMemo } from 'react';

import { useTheme } from '../features/theme/ThemeContext';
import { themes, themeNames, type ColorTokens, type ThemeName } from '../features/theme/themes';
import { fontSets, type FontSet } from '../theme/typography';

export function useEffectiveProfileTheme(profileBg?: string | null) {
  const { colors, fonts, resolvedMode } = useTheme();
  const profileThemeName = useMemo(
    () => profileBg && (themeNames as string[]).includes(profileBg) ? (profileBg as ThemeName) : null,
    [profileBg],
  );
  const themedColors = profileThemeName ? themes[profileThemeName][resolvedMode] : null;
  const effectiveColors = themedColors ?? colors;
  const effectiveFonts = profileThemeName ? (fontSets[profileThemeName] ?? fonts) : fonts;
  const tint = themedColors?.accent ?? colors.accent;

  return {
    baseColors: colors,
    baseFonts: fonts,
    effectiveColors,
    effectiveFonts,
    profileThemeName,
    resolvedMode,
    themedColors,
    tint,
  };
}

export function getProfileScreenGradientColors(imageUri: string | null | undefined, themedColors: ColorTokens | null) {
  if (imageUri) return ['transparent', 'transparent'] as const;
  if (themedColors) return [themedColors.canvas, themedColors.canvasAlt, themedColors.canvas] as const;
  return undefined;
}

export type EffectiveProfileTheme = {
  baseColors: ColorTokens;
  baseFonts: FontSet;
  effectiveColors: ColorTokens;
  effectiveFonts: FontSet;
  profileThemeName: ThemeName | null;
  resolvedMode: 'light' | 'dark';
  themedColors: ColorTokens | null;
  tint: string;
};
