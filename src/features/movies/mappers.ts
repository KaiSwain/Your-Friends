import type { MovieAttachment, MovieReviewRequest, MovieReviewRequestStatus } from '../../types/domain';

export function rowToMovieReviewRequest(row: any): MovieReviewRequest {
  return {
    id: row.id,
    requesterUserId: row.requester_user_id,
    recipientUserId: row.recipient_user_id,
    movie: rowToMovieSnapshot(row),
    prompt: row.prompt ?? null,
    status: normalizeMovieReviewRequestStatus(row.status),
    reviewRating: row.review_rating == null ? null : Number(row.review_rating),
    reviewBody: row.review_body ?? null,
    completedWallPostId: row.completed_wall_post_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    completedAt: row.completed_at ?? null,
  };
}

export function movieToDbColumns(movie: MovieAttachment) {
  return {
    movie_tmdb_id: movie.tmdbId,
    movie_title: movie.title,
    movie_year: movie.year ?? null,
    movie_poster_url: movie.posterUrl ?? null,
    movie_overview: movie.overview ?? null,
    movie_release_date: movie.releaseDate ?? null,
    movie_vote_average: movie.voteAverage ?? null,
  };
}

function rowToMovieSnapshot(row: any): MovieAttachment {
  return {
    tmdbId: String(row.movie_tmdb_id),
    title: String(row.movie_title),
    year: row.movie_year ? String(row.movie_year) : null,
    posterUrl: row.movie_poster_url ?? null,
    overview: row.movie_overview ?? null,
    releaseDate: row.movie_release_date ?? null,
    voteAverage: row.movie_vote_average == null ? null : Number(row.movie_vote_average),
    reviewRating: row.review_rating == null ? null : Number(row.review_rating),
    reviewRequestId: row.id ?? null,
  };
}

function normalizeMovieReviewRequestStatus(value: unknown): MovieReviewRequestStatus {
  if (value === 'completed' || value === 'cancelled') return value;
  return 'pending';
}
