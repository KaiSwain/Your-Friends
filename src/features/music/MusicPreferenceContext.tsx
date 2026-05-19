import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { SongProvider } from '../../types/domain';

const STORAGE_KEY = 'yourfriends:musicOpenPreference';

export type MusicOpenPreference = Extract<SongProvider, 'apple' | 'spotify'>;

interface MusicPreferenceContextValue {
  musicOpenPreference: MusicOpenPreference;
  setMusicOpenPreference: (preference: MusicOpenPreference) => void;
}

const MusicPreferenceContext = createContext<MusicPreferenceContextValue | undefined>(undefined);

function isMusicOpenPreference(value: string | null): value is MusicOpenPreference {
  return value === 'apple' || value === 'spotify';
}

export function MusicPreferenceProvider({ children }: { children: React.ReactNode }) {
  const [musicOpenPreference, setMusicOpenPreferenceState] = useState<MusicOpenPreference>('apple');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((savedPreference) => {
        if (isMusicOpenPreference(savedPreference)) setMusicOpenPreferenceState(savedPreference);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  const setMusicOpenPreference = useCallback((preference: MusicOpenPreference) => {
    setMusicOpenPreferenceState(preference);
    AsyncStorage.setItem(STORAGE_KEY, preference).catch(() => undefined);
  }, []);

  const value = useMemo<MusicPreferenceContextValue>(
    () => ({ musicOpenPreference, setMusicOpenPreference }),
    [musicOpenPreference, setMusicOpenPreference],
  );

  if (!loaded) return null;
  return <MusicPreferenceContext.Provider value={value}>{children}</MusicPreferenceContext.Provider>;
}

export function useMusicPreference(): MusicPreferenceContextValue {
  const context = useContext(MusicPreferenceContext);
  if (!context) throw new Error('useMusicPreference must be used inside MusicPreferenceProvider');
  return context;
}