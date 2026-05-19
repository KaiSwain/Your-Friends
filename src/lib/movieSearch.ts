import { supabase } from './supabase';
import type { MovieAttachment } from '../types/domain';

export async function searchMovies(query: string): Promise<MovieAttachment[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase.functions.invoke('search-movies', {
    body: { query: trimmed },
  });

  if (error) throw new Error(error.message || 'Could not search movies.');
  if (data?.error) throw new Error(String(data.error));

  const movies: unknown[] = Array.isArray(data?.movies) ? data.movies : [];
  return movies.map(normalizeMovieResult).filter((movie): movie is MovieAttachment => Boolean(movie));
}

export async function fetchPopularMovies(): Promise<MovieAttachment[]> {
  const { data, error } = await supabase.functions.invoke('search-movies', {
    // Include a harmless query so older deployed versions of the function
    // still return results instead of treating an empty query as "no movies".
    body: { mode: 'popular', query: 'a' },
  });

  if (error) throw new Error(error.message || 'Could not load popular movies.');
  if (data?.error) throw new Error(String(data.error));

  const movies: unknown[] = Array.isArray(data?.movies) ? data.movies : [];
  return movies.map(normalizeMovieResult).filter((movie): movie is MovieAttachment => Boolean(movie));
}

function normalizeMovieResult(value: any): MovieAttachment | null {
  if (!value?.tmdbId || !value?.title) return null;
  return {
    tmdbId: String(value.tmdbId),
    title: String(value.title),
    year: value.year ? String(value.year) : null,
    posterUrl: typeof value.posterUrl === 'string' ? value.posterUrl : null,
    overview: typeof value.overview === 'string' ? value.overview : null,
    releaseDate: typeof value.releaseDate === 'string' ? value.releaseDate : null,
    voteAverage: typeof value.voteAverage === 'number' ? value.voteAverage : null,
    reviewRating: null,
  };
}
