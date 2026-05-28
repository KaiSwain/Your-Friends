import { Linking } from 'react-native';

import type { MusicOpenPreference } from '../features/music/MusicPreferenceContext';
import type { SongAttachment } from '../types/domain';

export function getMusicServiceLabel(preference: MusicOpenPreference) {
  return preference === 'spotify' ? 'Spotify' : 'Apple Music';
}

export function getSongExternalUrl(song: SongAttachment, preference: MusicOpenPreference) {
  const plainQuery = `${song.title} ${song.artist}`.trim();
  if (preference === 'spotify') {
    if (song.provider === 'spotify') return song.externalUrl ?? `https://open.spotify.com/track/${encodeURIComponent(song.providerTrackId)}`;
    return `https://open.spotify.com/search/${encodeURIComponent(`track:${song.title} artist:${song.artist}`)}`;
  }
  if (song.provider === 'apple') return song.externalUrl ?? `https://music.apple.com/search?term=${encodeURIComponent(plainQuery)}`;
  return `https://music.apple.com/search?term=${encodeURIComponent(plainQuery)}`;
}

const resolvedUrlCache = new Map<string, string>();

export async function resolveSongExternalUrl(song: SongAttachment, preference: MusicOpenPreference) {
  const fallbackUrl = getSongExternalUrl(song, preference);
  if (preference !== 'spotify' || song.provider === 'spotify') return fallbackUrl;

  const cacheKey = `${preference}:${song.provider}:${song.providerTrackId}:${song.externalUrl ?? ''}`;
  const cached = resolvedUrlCache.get(cacheKey);
  if (cached) return cached;

  const resolvedUrl = await resolveSpotifyUrlFromEdgeFunction(song) ?? await resolveSpotifyUrlFromSonglink(song);
  if (!resolvedUrl) return fallbackUrl;
  resolvedUrlCache.set(cacheKey, resolvedUrl);
  return resolvedUrl;
}

export async function resolveSongForPreferredService(song: SongAttachment, preference: MusicOpenPreference): Promise<SongAttachment> {
  if (preference !== 'spotify' || song.provider === 'spotify') return song;

  const spotifyUrl = await resolveSongExternalUrl(song, preference);
  const spotifyTrackId = getSpotifyTrackIdFromUrl(spotifyUrl);
  if (!spotifyTrackId) return song;

  return {
    ...song,
    provider: 'spotify',
    providerTrackId: spotifyTrackId,
    externalUrl: spotifyUrl,
  };
}

async function resolveSpotifyUrlFromEdgeFunction(song: SongAttachment) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabasePublicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.EXPO_PUBLIC_SUPABASE_KEY
    ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? '';
  if (!supabaseUrl || !supabasePublicKey) return null;

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/resolve-spotify-track`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabasePublicKey}`,
        apikey: supabasePublicKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: song.title,
        artist: song.artist,
        appleUrl: song.provider === 'apple' ? song.externalUrl : null,
        providerTrackId: song.providerTrackId,
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const spotifyUrl = payload?.spotifyUrl;
    return isSpotifyTrackUrl(spotifyUrl) ? spotifyUrl : null;
  } catch {
    return null;
  }
}

async function resolveSpotifyUrlFromSonglink(song: SongAttachment) {
  if (!song.externalUrl) return null;
  try {
    const response = await fetch(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(song.externalUrl)}`);
    if (!response.ok) return null;
    const payload = await response.json();
    const spotifyUrl = payload?.linksByPlatform?.spotify?.url;
    return isSpotifyTrackUrl(spotifyUrl) ? spotifyUrl : null;
  } catch {
    return null;
  }
}

function isSpotifyTrackUrl(value: unknown): value is string {
  return typeof value === 'string' && value.includes('open.spotify.com/track/');
}

function getSpotifyTrackIdFromUrl(value: string) {
  const match = /open\.spotify\.com\/track\/([^?/#]+)/i.exec(value);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function openSongInPreferredService(song: SongAttachment, preference: MusicOpenPreference) {
  await Linking.openURL(await resolveSongExternalUrl(song, preference));
}