/** Strip display suffixes like "(2021)" so TMDB search gets the title only. */
export function normalizeMovieSearchQuery(rawQuery: string) {
  return rawQuery
    .trim()
    .replace(/\s*\(\d{4}\)\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}
