import { useMemo } from 'react';

import { useTheme } from '../features/theme/ThemeContext';
import { createCustomThemePair, decodeProfileCustomTheme } from '../features/theme/customTheme';
import { themes, themeNames, type ColorTokens, type ThemeName } from '../features/theme/themes';
import { fontSets, type FontSet } from '../theme/typography';

export function useEffectiveProfileTheme(profileBg?: string | null, options?: { profileMode?: 'current' | 'light' }) {
  const { colors, fonts, resolvedMode } = useTheme();
  const profileResolvedMode = options?.profileMode === 'light' ? 'light' : resolvedMode;
  const profileCustomTheme = useMemo(() => decodeProfileCustomTheme(profileBg), [profileBg]);
  const profileThemeName = useMemo(
    () => !profileCustomTheme && profileBg && (themeNames as string[]).includes(profileBg) ? (profileBg as ThemeName) : null,
    [profileBg, profileCustomTheme],
  );
  const profileCustomThemePair = useMemo(
    () => profileCustomTheme ? createCustomThemePair(profileCustomTheme) : null,
    [profileCustomTheme],
  );
  const themedColors = useMemo(
    () => profileCustomThemePair ? profileCustomThemePair[profileResolvedMode] : profileThemeName ? themes[profileThemeName][profileResolvedMode] : null,
    [profileCustomThemePair, profileResolvedMode, profileThemeName],
  );
  const effectiveColors = useMemo(
    () => themedColors
      ? {
        ...colors,
        ...themedColors,
        ink: colors.ink,
        inkSoft: colors.inkSoft,
        inkMuted: colors.inkMuted,
        line: colors.line,
        success: colors.success,
        error: colors.error,
      }
      : colors,
    [colors, themedColors],
  );
  const effectiveFonts = useMemo(
    () => profileCustomTheme ? (fontSets[fontThemeForCustom(profileCustomTheme.fontKey)] ?? fonts) : profileThemeName ? (fontSets[profileThemeName] ?? fonts) : fonts,
    [fonts, profileCustomTheme, profileThemeName],
  );
  const tint = themedColors?.accent ?? colors.accent;

  return {
    baseColors: colors,
    baseFonts: fonts,
    effectiveColors,
    effectiveFonts,
    profileThemeName,
    resolvedMode: profileResolvedMode,
    themedColors,
    tint,
  };
}

function fontThemeForCustom(fontKey: NonNullable<ReturnType<typeof decodeProfileCustomTheme>>['fontKey']) {
  if (fontKey === 'modern') return 'neon';
  if (fontKey === 'playful') return 'bubblegum';
  if (fontKey === 'editorial') return 'vintage';
  return 'default';
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
