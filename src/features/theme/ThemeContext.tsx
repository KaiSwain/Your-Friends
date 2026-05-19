import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import type { FontSet } from '../../theme/typography';
import { getFontSet } from '../../theme/typography';
import type { EmojiSet, ThemePersonality } from './personality';
import { getPersonality } from './personality';
import type { ColorTokens, ThemeMode, ThemeName } from './themes';
import { themes } from './themes';

const STORAGE_KEY_MODE = 'yourfriends:themeMode';
const STORAGE_KEY_NAME = 'yourfriends:themeName';
const STORAGE_KEY_BACKGROUND_BLUR = 'yourfriends:backgroundBlur';
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
  backgroundBlur: number;
  resolvedMode: 'light' | 'dark';
  setBackgroundBlur: (blur: number) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [themeName, setThemeNameState] = useState<ThemeName>('default');
  const [backgroundBlur, setBackgroundBlurState] = useState(DEFAULT_BACKGROUND_BLUR);
  const [loaded, setLoaded] = useState(false);

  // Restore saved preferences on mount.
  useEffect(() => {
    (async () => {
      try {
        const [savedMode, savedName, savedBackgroundBlur] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_MODE),
          AsyncStorage.getItem(STORAGE_KEY_NAME),
          AsyncStorage.getItem(STORAGE_KEY_BACKGROUND_BLUR),
        ]);
        if (savedMode) setThemeModeState(savedMode as ThemeMode);
        if (savedName) setThemeNameState(savedName as ThemeName);
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

  const setBackgroundBlur = useCallback((blur: number) => {
    const nextBlur = clampBackgroundBlur(blur);
    setBackgroundBlurState(nextBlur);
    AsyncStorage.setItem(STORAGE_KEY_BACKGROUND_BLUR, String(nextBlur)).catch(() => {});
  }, []);

  // Resolve 'system' → actual light or dark.
  const resolvedMode: 'light' | 'dark' =
    themeMode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : themeMode;

  const colors = useMemo(
    () => (themes[themeName] ?? themes.default)[resolvedMode],
    [themeName, resolvedMode],
  );

  const fonts = useMemo(() => getFontSet(themeName), [themeName]);
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
      backgroundBlur,
      resolvedMode,
      setBackgroundBlur,
      setThemeMode,
      setThemeName,
    }),
    [colors, fonts, emojis, personality, themeMode, themeName, backgroundBlur, resolvedMode, setBackgroundBlur, setThemeMode, setThemeName],
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
