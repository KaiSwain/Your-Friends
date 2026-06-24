const mockCreateNotification = jest.fn();
const mockFrom = jest.fn();

jest.mock('../../../lib/notifications', () => ({
  createNotification: mockCreateNotification,
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import type { MovieAttachment, VoiceAttachment } from '../../../types/domain';
import { completeMovieReviewRequest, createMovieReviewRequest } from '../queries';

type BuilderCapture = {
  eq?: Array<[string, unknown]>;
  insert?: unknown;
  update?: unknown;
};

const movie: MovieAttachment = {
  tmdbId: '550',
  title: 'Fight Club',
  year: '1999',
  posterUrl: 'https://image.test/poster.jpg',
  overview: 'A movie overview.',
  releaseDate: '1999-10-15',
  voteAverage: 8.4,
  reviewRating: null,
};

const promptVoice: VoiceAttachment = { uri: 'https://audio.test/movie-prompt.m4a', durationMs: 7_000 };
const reviewVoice: VoiceAttachment = { uri: 'https://audio.test/movie-review.m4a', durationMs: 22_000 };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-05-24T12:00:00.000Z');
  mockCreateNotification.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('createMovieReviewRequest', () => {
  it('creates movie rating prompts with optional text and voice ask', async () => {
    const insertCapture: BuilderCapture = {};
    queueFromCalls(
      ['movie_review_requests', makeSingleBuilder(movieRequestRow(), insertCapture)],
      ['profiles', makeSingleBuilder({ display_name: 'Requester' })],
    );

    const request = await createMovieReviewRequest('requester-1', {
      recipientUserId: 'recipient-1',
      movie,
      prompt: '  Need your take.  ',
      promptVoice,
    });

    expect(request.movie.title).toBe('Fight Club');
    expect(request.promptVoice).toEqual(promptVoice);
    expect(insertCapture.insert).toMatchObject({
      requester_user_id: 'requester-1',
      recipient_user_id: 'recipient-1',
      movie_tmdb_id: '550',
      movie_title: 'Fight Club',
      prompt: 'Need your take.',
      prompt_audio_path: promptVoice.uri,
      prompt_audio_duration_ms: promptVoice.durationMs,
      status: 'pending',
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'recipient-1',
      type: 'movie_review_request',
    }));
  });
});

describe('completeMovieReviewRequest', () => {
  it('creates a movie wall post and completes the request with voice review columns', async () => {
    const wallPostCapture: BuilderCapture = {};
    const updateCapture: BuilderCapture = {};
    queueFromCalls(
      ['movie_review_requests', makeSingleBuilder(movieRequestRow())],
      ['wall_posts', makeSingleBuilder(wallPostRow(), wallPostCapture)],
      ['movie_review_requests', makeSingleBuilder(movieRequestRow({ status: 'completed', completed_wall_post_id: 'wall-movie' }), updateCapture)],
      ['profiles', makeSingleBuilder({ display_name: 'Reviewer' })],
    );

    const result = await completeMovieReviewRequest('recipient-1', {
      requestId: 'movie-request-1',
      rating: 4.5,
      body: '  Perfect chaos.  ',
      voice: reviewVoice,
    });

    expect(result.wallPost.postType).toBe('movie');
    expect(wallPostCapture.insert).toMatchObject({
      author_user_id: 'recipient-1',
      subject_user_id: 'requester-1',
      visibility: 'visible_to_subject',
      post_type: 'movie',
      body: 'Perfect chaos.',
      movie_tmdb_id: movie.tmdbId,
      movie_title: movie.title,
      movie_review_rating: 4.5,
      movie_review_request_id: 'movie-request-1',
      prompt_text: 'Need your take.',
      prompt_type: 'text',
      prompt_audio_path: promptVoice.uri,
      prompt_audio_duration_ms: promptVoice.durationMs,
      audio_path: reviewVoice.uri,
      audio_duration_ms: reviewVoice.durationMs,
    });
    expect(updateCapture.update).toMatchObject({
      status: 'completed',
      review_rating: 4.5,
      review_body: 'Perfect chaos.',
      review_audio_path: reviewVoice.uri,
      review_audio_duration_ms: reviewVoice.durationMs,
      completed_wall_post_id: 'wall-movie',
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'requester-1',
      type: 'wall_post',
      metadata: expect.objectContaining({
        movieReviewRequestId: 'movie-request-1',
        postType: 'movie',
      }),
    }));
  });

  it('allows rating-only movie reviews', async () => {
    const wallPostCapture: BuilderCapture = {};
    const updateCapture: BuilderCapture = {};
    queueFromCalls(
      ['movie_review_requests', makeSingleBuilder(movieRequestRow())],
      ['wall_posts', makeSingleBuilder(wallPostRow(), wallPostCapture)],
      ['movie_review_requests', makeSingleBuilder(movieRequestRow({ status: 'completed', completed_wall_post_id: 'wall-movie' }), updateCapture)],
      ['profiles', makeSingleBuilder({ display_name: 'Reviewer' })],
    );

    await completeMovieReviewRequest('recipient-1', {
      requestId: 'movie-request-1',
      rating: 5,
    });

    expect(wallPostCapture.insert).toMatchObject({
      body: '',
      movie_review_rating: 5,
    });
    expect(updateCapture.update).toMatchObject({
      review_body: '',
      review_rating: 5,
    });
  });

  it.each([
    [{ rating: 0.25, body: 'Too low.' }, 'Choose a rating from half a star to 5 stars.'],
    [{ rating: 4.25, body: 'Quarter stars are invalid.' }, 'Choose a rating from half a star to 5 stars.'],
    [{ rating: 5.5, body: 'Too high.' }, 'Choose a rating from half a star to 5 stars.'],
  ] as const)('validates invalid movie review responses', async (input, message) => {
    await expect(completeMovieReviewRequest('recipient-1', {
      requestId: 'movie-request-1',
      ...input,
    })).rejects.toThrow(message);

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

function queueFromCalls(...calls: Array<[string, ReturnType<typeof makeSingleBuilder>]>) {
  mockFrom.mockImplementation((table: string) => {
    const next = calls.shift();
    if (!next) throw new Error(`Unexpected Supabase table: ${table}`);
    const [expectedTable, builder] = next;
    expect(table).toBe(expectedTable);
    return builder;
  });
}

function makeSingleBuilder(data: unknown, capture: BuilderCapture = {}) {
  const builder = {
    insert(payload: unknown) {
      capture.insert = payload;
      return builder;
    },
    update(payload: unknown) {
      capture.update = payload;
      return builder;
    },
    select() {
      return builder;
    },
    eq(column: string, value: unknown) {
      capture.eq = [...(capture.eq ?? []), [column, value]];
      return builder;
    },
    single: jest.fn(async () => ({ data, error: null })),
  };
  return builder;
}

function movieRequestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'movie-request-1',
    requester_user_id: 'requester-1',
    recipient_user_id: 'recipient-1',
    movie_tmdb_id: movie.tmdbId,
    movie_title: movie.title,
    movie_year: movie.year,
    movie_poster_url: movie.posterUrl,
    movie_overview: movie.overview,
    movie_release_date: movie.releaseDate,
    movie_vote_average: movie.voteAverage,
    prompt: 'Need your take.',
    prompt_audio_path: promptVoice.uri,
    prompt_audio_duration_ms: promptVoice.durationMs,
    status: 'pending',
    review_rating: null,
    review_body: null,
    completed_wall_post_id: null,
    created_at: '2026-05-24T10:00:00.000Z',
    expires_at: '2999-01-01T00:00:00.000Z',
    updated_at: '2026-05-24T10:00:00.000Z',
    ...overrides,
  };
}

function wallPostRow() {
  return {
    id: 'wall-movie',
    author_user_id: 'recipient-1',
    subject_user_id: 'requester-1',
    subject_contact_id: null,
    visibility: 'visible_to_subject',
    post_type: 'movie',
    body: 'Perfect chaos.',
    movie_tmdb_id: movie.tmdbId,
    movie_title: movie.title,
    movie_year: movie.year,
    movie_poster_url: movie.posterUrl,
    movie_overview: movie.overview,
    movie_release_date: movie.releaseDate,
    movie_vote_average: movie.voteAverage,
    movie_review_rating: 4.5,
    movie_review_request_id: 'movie-request-1',
    prompt_text: 'Need your take.',
    prompt_type: 'text',
    prompt_audio_path: promptVoice.uri,
    prompt_audio_duration_ms: promptVoice.durationMs,
    audio_path: reviewVoice.uri,
    audio_duration_ms: reviewVoice.durationMs,
    created_at: '2026-05-24T12:00:00.000Z',
  };
}
