import type { SongAttachment } from '../types/domain';

interface ITunesSearchResponse {
  resultCount: number;
  results: ITunesSongResult[];
}

interface ITunesSongResult {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackViewUrl?: string;
}

export async function searchSongPreviews(query: string, limit = 12): Promise<SongAttachment[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];

  const params = new URLSearchParams({
    term: trimmedQuery,
    media: 'music',
    entity: 'song',
    limit: String(limit),
  });
  const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
  if (!response.ok) throw new Error('Could not search songs right now.');

  const data = (await response.json()) as ITunesSearchResponse;
  return data.results
    .filter((result) => result.trackId && result.trackName && result.artistName && result.previewUrl)
    .map((result) => ({
      provider: 'apple',
      providerTrackId: String(result.trackId),
      title: result.trackName ?? 'Unknown Song',
      artist: result.artistName ?? 'Unknown Artist',
      artworkUrl: upgradeArtworkUrl(result.artworkUrl100 ?? null),
      previewUrl: result.previewUrl ?? null,
      externalUrl: result.trackViewUrl ?? null,
    }));
}

function upgradeArtworkUrl(artworkUrl: string | null): string | null {
  if (!artworkUrl) return null;
  return artworkUrl.replace(/100x100bb\.jpg$/, '600x600bb.jpg');
}