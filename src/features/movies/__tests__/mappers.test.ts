import { describe, expect, it } from '@jest/globals';

import { movieToDbColumns, rowToMovieReviewRequest } from '../mappers';

describe('rowToMovieReviewRequest', () => {
  it('maps snake_case rows to MovieReviewRequest', () => {
    expect(rowToMovieReviewRequest({
      id: 'request-1',
      requester_user_id: 'requester-1',
      recipient_user_id: 'recipient-1',
      movie_tmdb_id: '550',
      movie_title: 'Fight Club',
      movie_year: '1999',
      movie_poster_url: 'https://image.test/poster.jpg',
      movie_overview: 'A movie overview.',
      movie_release_date: '1999-10-15',
      movie_vote_average: 8.4,
      prompt: 'Need your take.',
      status: 'completed',
      review_rating: 5,
      review_body: 'Perfect chaos.',
      completed_wall_post_id: 'post-1',
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-02T00:00:00Z',
      completed_at: '2026-05-02T00:00:00Z',
    })).toEqual({
      id: 'request-1',
      requesterUserId: 'requester-1',
      recipientUserId: 'recipient-1',
      movie: {
        tmdbId: '550',
        title: 'Fight Club',
        year: '1999',
        posterUrl: 'https://image.test/poster.jpg',
        overview: 'A movie overview.',
        releaseDate: '1999-10-15',
        voteAverage: 8.4,
        reviewRating: 5,
        reviewRequestId: 'request-1',
      },
      prompt: 'Need your take.',
      status: 'completed',
      reviewRating: 5,
      reviewBody: 'Perfect chaos.',
      completedWallPostId: 'post-1',
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-02T00:00:00Z',
      completedAt: '2026-05-02T00:00:00Z',
    });
  });

  it('defaults unknown status to pending', () => {
    expect(rowToMovieReviewRequest({
      id: 'request-1',
      requester_user_id: 'requester-1',
      recipient_user_id: 'recipient-1',
      movie_tmdb_id: '550',
      movie_title: 'Fight Club',
      status: 'weird',
      created_at: '2026-05-01T00:00:00Z',
    }).status).toBe('pending');
  });
});

describe('movieToDbColumns', () => {
  it('maps movie snapshots to DB columns', () => {
    expect(movieToDbColumns({
      tmdbId: '550',
      title: 'Fight Club',
      year: '1999',
      posterUrl: null,
      overview: null,
      releaseDate: '1999-10-15',
      voteAverage: 8.4,
      reviewRating: null,
    })).toEqual({
      movie_tmdb_id: '550',
      movie_title: 'Fight Club',
      movie_year: '1999',
      movie_poster_url: null,
      movie_overview: null,
      movie_release_date: '1999-10-15',
      movie_vote_average: 8.4,
    });
  });
});
