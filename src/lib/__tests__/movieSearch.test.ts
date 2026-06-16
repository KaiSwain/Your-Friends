import { normalizeMovieSearchQuery } from '../movieSearchQuery';

describe('normalizeMovieSearchQuery', () => {
  it('strips a trailing release year in parentheses', () => {
    expect(normalizeMovieSearchQuery('Fight Club (1999)')).toBe('Fight Club');
  });

  it('trims whitespace', () => {
    expect(normalizeMovieSearchQuery('  dune  ')).toBe('dune');
  });

  it('leaves titles without a year suffix unchanged', () => {
    expect(normalizeMovieSearchQuery('The Matrix')).toBe('The Matrix');
  });
});
