import { describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn() },
}));

import { getSongExternalUrl, resolveSongExternalUrl } from '../musicLinks';
import type { SongAttachment } from '../../types/domain';

const supabaseEnvKeys = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_KEY',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

function withSupabaseEnv(values: Record<string, string | undefined>) {
  const previousValues = new Map(supabaseEnvKeys.map((key) => [key, process.env[key]]));
  supabaseEnvKeys.forEach((key) => {
    delete process.env[key];
  });
  Object.entries(values).forEach(([key, value]) => {
    if (value) process.env[key] = value;
  });

  return () => {
    previousValues.forEach((value, key) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  };
}

const appleSong: SongAttachment = {
  provider: 'apple',
  providerTrackId: '12345',
  title: 'Golden Hour',
  artist: 'Friend Band',
  artworkUrl: null,
  previewUrl: 'https://audio.test/preview.m4a',
  externalUrl: 'https://music.apple.com/us/album/golden-hour/12345?i=12345',
};

describe('getSongExternalUrl', () => {
  it('uses the exact Apple Music URL when Apple Music is selected', () => {
    expect(getSongExternalUrl(appleSong, 'apple')).toBe('https://music.apple.com/us/album/golden-hour/12345?i=12345');
  });

  it('uses a Spotify track search URL when Spotify is selected for an Apple song', () => {
    expect(getSongExternalUrl(appleSong, 'spotify')).toBe('https://open.spotify.com/search/track%3AGolden%20Hour%20artist%3AFriend%20Band');
  });

  it('uses an exact Spotify track URL when the song came from Spotify', () => {
    expect(getSongExternalUrl({ ...appleSong, provider: 'spotify', providerTrackId: 'spotify-track-id', externalUrl: null }, 'spotify'))
      .toBe('https://open.spotify.com/track/spotify-track-id');
  });

  it('resolves an Apple song to an exact Spotify track URL from the Supabase function', async () => {
    const restoreEnv = withSupabaseEnv({
      EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co/',
      EXPO_PUBLIC_SUPABASE_KEY: 'public-key',
    });
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ spotifyUrl: 'https://open.spotify.com/track/edge-track' }),
    } as Response);

    try {
      await expect(resolveSongExternalUrl({ ...appleSong, providerTrackId: 'edge-test' }, 'spotify'))
        .resolves.toBe('https://open.spotify.com/track/edge-track');
      expect(fetchMock).toHaveBeenCalledWith('https://project.supabase.co/functions/v1/resolve-spotify-track', expect.objectContaining({
        method: 'POST',
      }));
    } finally {
      fetchMock.mockRestore();
      restoreEnv();
    }
  });

  it('resolves an Apple song to an exact Spotify track URL when Songlink returns one', async () => {
    const restoreEnv = withSupabaseEnv({});
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        linksByPlatform: {
          spotify: { url: 'https://open.spotify.com/track/resolved-track' },
        },
      }),
    } as Response);

    try {
      await expect(resolveSongExternalUrl({ ...appleSong, providerTrackId: 'songlink-test' }, 'spotify'))
        .resolves.toBe('https://open.spotify.com/track/resolved-track');
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('api.song.link'));
    } finally {
      fetchMock.mockRestore();
      restoreEnv();
    }
  });

  it('falls back to Spotify track search when no exact resolver can match', async () => {
    const restoreEnv = withSupabaseEnv({});
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    try {
      await expect(resolveSongExternalUrl({ ...appleSong, providerTrackId: 'fallback-test' }, 'spotify'))
        .resolves.toBe('https://open.spotify.com/search/track%3AGolden%20Hour%20artist%3AFriend%20Band');
    } finally {
      fetchMock.mockRestore();
      restoreEnv();
    }
  });
});