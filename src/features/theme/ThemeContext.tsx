import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import type { ColorTokens, ThemeMode, ThemeName } from './themes';
import { themes } from './themes';

const STORAGE_KEY_MODE = 'yourfriends:themeMode';
const STORAGE_KEY_NAME = 'yourfriends:themeName';

interface ThemeContextValue {
  colors: ColorTokens;
  themeMode: ThemeMode;
  themeName: ThemeName;
  resolvedMode: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [themeName, setThemeNameState] = useState<ThemeName>('default');
  const [loaded, setLoaded] = useState(false);

  // Restore saved preferences on mount.
  useEffect(() => {
    (async () => {
      try {
        const [savedMode, savedName] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_MODE),
          AsyncStorage.getItem(STORAGE_KEY_NAME),
        ]);
        if (savedMode) setThemeModeState(savedMode as ThemeMode);
        if (savedName) setThemeNameState(savedName as ThemeName);
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

  // Resolve 'system' → actual light or dark.
  const resolvedMode: 'light' | 'dark' =
    themeMode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : themeMode;

  const colors = useMemo(
    () => themes[themeName][resolvedMode],
    [themeName, resolvedMode],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ colors, themeMode, themeName, resolvedMode, setThemeMode, setThemeName }),
    [colors, themeMode, themeName, resolvedMode, setThemeMode, setThemeName],
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
