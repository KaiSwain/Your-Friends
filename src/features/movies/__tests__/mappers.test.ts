import { describe, expect, it } from '@jest/globals';

import { moviePromptVoiceToDbColumns, movieReviewVoiceToDbColumns, movieToDbColumns, rowToMovieReviewRequest } from '../mappers';

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
      prompt_audio_path: 'https://audio.test/movie-prompt.m4a',
      prompt_audio_duration_ms: 7000,
      status: 'completed',
      review_rating: 5,
      review_body: 'Perfect chaos.',
      review_audio_path: 'https://audio.test/movie-review.m4a',
      review_audio_duration_ms: '22000',
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
      promptVoice: {
        uri: 'https://audio.test/movie-prompt.m4a',
        durationMs: 7000,
      },
      status: 'completed',
      reviewRating: 5,
      reviewBody: 'Perfect chaos.',
      reviewVoice: {
        uri: 'https://audio.test/movie-review.m4a',
        durationMs: 22000,
      },
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

describe('movie voice db helpers', () => {
  const voice = {
    uri: 'https://audio.test/movie-note.m4a',
    durationMs: 13000,
  };

  it('maps movie prompt voice columns', () => {
    expect(moviePromptVoiceToDbColumns(voice)).toEqual({
      prompt_audio_path: 'https://audio.test/movie-note.m4a',
      prompt_audio_duration_ms: 13000,
    });
  });

  it('maps movie review voice columns', () => {
    expect(movieReviewVoiceToDbColumns(voice)).toEqual({
      review_audio_path: 'https://audio.test/movie-note.m4a',
      review_audio_duration_ms: 13000,
    });
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
