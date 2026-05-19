import { handleCors, jsonResponse, readJsonBody, requireAuthenticatedUser, requirePost } from '../_shared/http.ts';

const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w342';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const methodError = requirePost(req);
  if (methodError) return methodError;

  const auth = await requireAuthenticatedUser(req, 'Sign in to search movies.');
  if (!auth.ok) return auth.response;

  const bearerToken = Deno.env.get('TMDB_ACCESS_TOKEN') ?? '';
  const apiKey = Deno.env.get('TMDB_API_KEY') ?? '';
  if (!bearerToken && !apiKey) return jsonResponse({ error: 'Movie search is not configured.' }, 501);

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const query = cleanString(body.value?.query, 120);
  const mode = cleanString(body.value?.mode, 24);
  const usePopularMovies = mode === 'popular' || !query;
  const params = new URLSearchParams(
    usePopularMovies
      ? {
          include_adult: 'false',
          language: 'en-US',
          page: '1',
        }
      : {
          query,
          include_adult: 'false',
          language: 'en-US',
          page: '1',
        },
  );
  if (!bearerToken) params.set('api_key', apiKey);

  const endpoint = usePopularMovies ? 'movie/popular' : 'search/movie';
  const response = await fetch(`https://api.themoviedb.org/3/${endpoint}?${params.toString()}`, {
    headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined,
  });

  if (!response.ok) return jsonResponse({ error: 'Could not load movies.' }, 502);

  const payload = await response.json();
  const movies = Array.isArray(payload?.results)
    ? payload.results.slice(0, 12).map(mapMovieResult).filter(Boolean)
    : [];

  return jsonResponse({ movies });
});

function mapMovieResult(result: any) {
  const tmdbId = result?.id == null ? '' : String(result.id);
  const title = cleanString(result?.title || result?.original_title, 160);
  if (!tmdbId || !title) return null;

  const releaseDate = cleanDate(result?.release_date);
  return {
    tmdbId,
    title,
    year: releaseDate ? releaseDate.slice(0, 4) : null,
    posterUrl: typeof result?.poster_path === 'string' ? `${TMDB_IMAGE_BASE_URL}${result.poster_path}` : null,
    overview: cleanString(result?.overview, 600) || null,
    releaseDate,
    voteAverage: typeof result?.vote_average === 'number' ? result.vote_average : null,
    reviewRating: null,
  };
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function cleanDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
