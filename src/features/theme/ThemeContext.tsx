import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import type { FontSet } from '../../theme/typography';
import { getFontSet } from '../../theme/typography';
import type { EmojiSet, ThemePersonality } from './personality';
import { getPersonality } from './personality';
import { createCustomThemePair, DEFAULT_CUSTOM_THEME_SETTINGS, normalizeCustomThemeSettings, type CustomThemeSettings } from './customTheme';
import type { ColorTokens, ThemeMode, ThemeName } from './themes';
import { themes } from './themes';

const STORAGE_KEY_MODE = 'yourfriends:themeMode';
const STORAGE_KEY_NAME = 'yourfriends:themeName';
const STORAGE_KEY_BACKGROUND_BLUR = 'yourfriends:backgroundBlur';
const STORAGE_KEY_CUSTOM_THEME = 'yourfriends:customTheme';
export const DEFAULT_BACKGROUND_BLUR = 8;
export const MIN_BACKGROUND_BLUR = 0;
export const MAX_BACKGROUND_BLUR = 24;

interface ThemeContextValue {
  colors: ColorTokens;
  fonts: FontSet;
  emojis: EmojiSet;
  personality: ThemePersonality;
  themeMode: ThemeMode;
  themeName: ThemeName;
  customTheme: CustomThemeSettings;
  backgroundBlur: number;
  /** The visual palette mode currently rendered by the app. */
  resolvedMode: 'light' | 'dark';
  setBackgroundBlur: (blur: number) => void;
  setCustomTheme: (settings: CustomThemeSettings) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [themeName, setThemeNameState] = useState<ThemeName>('yourFriends');
  const [customTheme, setCustomThemeState] = useState<CustomThemeSettings>(DEFAULT_CUSTOM_THEME_SETTINGS);
  const [backgroundBlur, setBackgroundBlurState] = useState(DEFAULT_BACKGROUND_BLUR);
  const [loaded, setLoaded] = useState(false);

  // Restore saved preferences on mount.
  useEffect(() => {
    (async () => {
      try {
        const [savedMode, savedName, savedBackgroundBlur, savedCustomTheme] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_MODE),
          AsyncStorage.getItem(STORAGE_KEY_NAME),
          AsyncStorage.getItem(STORAGE_KEY_BACKGROUND_BLUR),
          AsyncStorage.getItem(STORAGE_KEY_CUSTOM_THEME),
        ]);
        if (savedMode) setThemeModeState(savedMode as ThemeMode);
        if (savedName) setThemeNameState(savedName as ThemeName);
        if (savedCustomTheme) setCustomThemeState(normalizeCustomThemeSettings(JSON.parse(savedCustomTheme)));
        const parsedBackgroundBlur = Number(savedBackgroundBlur);
        if (Number.isFinite(parsedBackgroundBlur)) {
          setBackgroundBlurState(clampBackgroundBlur(parsedBackgroundBlur));
        }
      } catch {
        // Fall through to defaults.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY_MODE, mode).catch(() => {});
  }, []);

  const setThemeName = useCallback((name: ThemeName) => {
    setThemeNameState(name);
    AsyncStorage.setItem(STORAGE_KEY_NAME, name).catch(() => {});
  }, []);

  const setCustomTheme = useCallback((settings: CustomThemeSettings) => {
    const normalized = normalizeCustomThemeSettings(settings);
    setCustomThemeState(normalized);
    AsyncStorage.setItem(STORAGE_KEY_CUSTOM_THEME, JSON.stringify(normalized)).catch(() => {});
  }, []);

  const setBackgroundBlur = useCallback((blur: number) => {
    const nextBlur = clampBackgroundBlur(blur);
    setBackgroundBlurState(nextBlur);
    AsyncStorage.setItem(STORAGE_KEY_BACKGROUND_BLUR, String(nextBlur)).catch(() => {});
  }, []);

  // Resolve 'system' → actual light or dark.
  const requestedMode: 'light' | 'dark' =
    themeMode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : themeMode;
  const resolvedMode: 'light' | 'dark' = requestedMode;

  const colors = useMemo(() => {
    const theme = themeName === 'custom' ? createCustomThemePair(customTheme) : themes[themeName] ?? themes.default;
    return ensureReadableTextColors(theme[resolvedMode], resolvedMode);
  }, [customTheme, themeName, resolvedMode]);

  const fonts = useMemo(() => getFontSet(themeName === 'custom' ? fontThemeForCustom(customTheme.fontKey) : themeName), [customTheme.fontKey, themeName]);
  const personality = useMemo(() => getPersonality(themeName), [themeName]);
  const emojis = personality.emojis;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      fonts,
      emojis,
      personality,
      themeMode,
      themeName,
      customTheme,
      backgroundBlur,
      resolvedMode,
      setBackgroundBlur,
      setCustomTheme,
      setThemeMode,
      setThemeName,
    }),
    [colors, fonts, emojis, personality, themeMode, themeName, customTheme, backgroundBlur, resolvedMode, setBackgroundBlur, setCustomTheme, setThemeMode, setThemeName],
  );

  // Don't render children until saved prefs have been loaded so there's no flash.
  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

function clampBackgroundBlur(value: number) {
  return Math.min(MAX_BACKGROUND_BLUR, Math.max(MIN_BACKGROUND_BLUR, Math.round(value)));
}

function fontThemeForCustom(fontKey: CustomThemeSettings['fontKey']) {
  if (fontKey === 'modern') return 'neon';
  if (fontKey === 'playful') return 'bubblegum';
  if (fontKey === 'editorial') return 'vintage';
  return 'default';
}

function ensureReadableTextColors(colors: ColorTokens, resolvedMode: 'light' | 'dark'): ColorTokens {
  return {
    ...colors,
    line: resolvedMode === 'light'
      ? blendHex(colors.paper, colors.canvasAlt, 0.42)
      : blendHex(colors.paper, colors.canvasAlt, 0.28),
  };
}

function blendHex(base: string, overlay: string, amount: number) {
  const baseRgb = parseHex(base);
  const overlayRgb = parseHex(overlay);
  if (!baseRgb || !overlayRgb) return base;
  const mix = (left: number, right: number) => Math.round(left + (right - left) * amount);
  return `#${toHex(mix(baseRgb.r, overlayRgb.r))}${toHex(mix(baseRgb.g, overlayRgb.g))}${toHex(mix(baseRgb.b, overlayRgb.b))}`;
}

function parseHex(value: string) {
  const normalized = value.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function toHex(value: number) {
  return value.toString(16).padStart(2, '0');
}
