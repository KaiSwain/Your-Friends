import { handleCors, jsonResponse, readJsonBody, requirePost } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const methodError = requirePost(req);
  if (methodError) return methodError;

  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET') ?? '';
  if (!clientId || !clientSecret) return jsonResponse({ error: 'Spotify lookup is not configured.' }, 501);

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const payload = body.value;

  const title = cleanString(payload?.title, 120);
  const artist = cleanString(payload?.artist, 120);
  if (!title || !artist) return jsonResponse({ error: 'Song title and artist are required.' }, 400);

  const accessToken = await getSpotifyAccessToken(clientId, clientSecret);
  if (!accessToken) return jsonResponse({ error: 'Could not connect to Spotify.' }, 502);

  const spotifyUrl = await findSpotifyTrackUrl(accessToken, title, artist);
  if (!spotifyUrl) return jsonResponse({ spotifyUrl: null }, 404);
  return jsonResponse({ spotifyUrl });
});

async function getSpotifyAccessToken(clientId: string, clientSecret: string) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return typeof payload?.access_token === 'string' ? payload.access_token : null;
}

async function findSpotifyTrackUrl(accessToken: string, title: string, artist: string) {
  const queries = [
    `track:"${title}" artist:"${artist}"`,
    `${title} ${artist}`,
    `${stripVersionText(title)} ${artist}`,
  ].filter((query, index, all) => query.trim() && all.indexOf(query) === index);

  for (const query of queries) {
    const tracks = await searchSpotifyTracks(accessToken, query);
    const exactTrack = tracks.find((track: any) => isSpotifyTrackMatch(track, title, artist));
    const fallbackTrack = tracks.find((track: any) => isReasonableSpotifyTrackMatch(track, title, artist));
    const spotifyUrl = (exactTrack ?? fallbackTrack ?? tracks[0])?.external_urls?.spotify;
    if (typeof spotifyUrl === 'string' && spotifyUrl.includes('open.spotify.com/track/')) return spotifyUrl;
  }

  return null;
}

async function searchSpotifyTracks(accessToken: string, query: string) {
  const response = await fetch(`https://api.spotify.com/v1/search?${new URLSearchParams({ q: query, type: 'track', limit: '10', market: 'US' }).toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return [];

  const payload = await response.json();
  return Array.isArray(payload?.tracks?.items) ? payload.tracks.items : [];
}

function isSpotifyTrackMatch(track: any, title: string, artist: string) {
  const trackName = normalizeForMatch(track?.name);
  const songTitle = normalizeForMatch(title);
  const artistNames = Array.isArray(track?.artists) ? track.artists.map((item: any) => normalizeForMatch(item?.name)) : [];
  const songArtist = normalizeForMatch(artist);
  return !!trackName && trackName === songTitle && artistNames.some((artistName: string) => artistName === songArtist);
}

function isReasonableSpotifyTrackMatch(track: any, title: string, artist: string) {
  const trackName = normalizeForMatch(track?.name);
  const songTitle = normalizeForMatch(stripVersionText(title));
  const artistNames = Array.isArray(track?.artists) ? track.artists.map((item: any) => normalizeForMatch(item?.name)) : [];
  const songArtist = normalizeForMatch(artist);
  if (!trackName || !songTitle) return false;
  const titleMatches = trackName.includes(songTitle) || songTitle.includes(trackName);
  const artistMatches = artistNames.some((artistName: string) => artistName && (artistName.includes(songArtist) || songArtist.includes(artistName)));
  return titleMatches && artistMatches;
}

function stripVersionText(value: string) {
  return value.replace(/\s*[-(]\s*(remaster(?:ed)?|radio edit|single version|album version|feat\.?|featuring|with)\b.*$/i, '').trim();
}

function normalizeForMatch(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}
