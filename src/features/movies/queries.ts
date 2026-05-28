import { createNotification } from '../../lib/notifications';
import { getPromptExpiresAt, isPromptExpired } from '../../lib/promptExpiration';
import { supabase } from '../../lib/supabase';
import type { CompleteMovieReviewRequestInput, CreateMovieReviewRequestInput, MovieReviewRequest, WallPost } from '../../types/domain';
import { rowToWallPost } from '../social/mappers';
import { moviePromptVoiceToDbColumns, movieReviewVoiceToDbColumns, movieReviewVoiceToWallPostDbColumns, movieToDbColumns, rowToMovieReviewRequest } from './mappers';

export const movieQueryKeys = {
  requests: ['movies', 'requests'] as const,
};

export async function fetchMovieReviewRequests(): Promise<MovieReviewRequest[]> {
  const { data, error } = await supabase.from('movie_review_requests').select('*').order('created_at', { ascending: false });
  if (error) {
    if (isMissingTable(error.message, 'movie_review_requests')) return [];
    throw error;
  }
  return (data ?? []).map(rowToMovieReviewRequest);
}

export async function createMovieReviewRequest(requesterUserId: string, input: CreateMovieReviewRequestInput): Promise<MovieReviewRequest> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('movie_review_requests')
    .insert({
      requester_user_id: requesterUserId,
      recipient_user_id: input.recipientUserId,
      ...movieToDbColumns(input.movie),
      prompt: cleanOptionalText(input.prompt),
      ...moviePromptVoiceToDbColumns(input.promptVoice),
      status: 'pending',
      expires_at: getPromptExpiresAt(now),
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not send movie request.');
  const request = rowToMovieReviewRequest(data);
  const requesterName = await getDisplayName(requesterUserId);

  createNotification({
    recipientUserId: request.recipientUserId,
    actorUserId: request.requesterUserId,
    type: 'movie_review_request',
    referenceId: request.id,
    metadata: {
      movieReviewRequestId: request.id,
      source: 'movie_review_request',
    },
    message: `${requesterName} wants your take on ${request.movie.title}`,
  }).catch((notificationError) => console.warn('[notification] movie request insert failed:', notificationError));

  return request;
}

export async function cancelMovieReviewRequest(requestId: string, requesterUserId: string): Promise<MovieReviewRequest> {
  const { data, error } = await supabase
    .from('movie_review_requests')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('requester_user_id', requesterUserId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not cancel movie request.');
  return rowToMovieReviewRequest(data);
}

export async function completeMovieReviewRequest(reviewerUserId: string, input: CompleteMovieReviewRequestInput): Promise<{ request: MovieReviewRequest; wallPost: WallPost }> {
  const body = cleanOptionalText(input.body, 1200) ?? '';
  const reviewVoice = input.voice ?? null;
  const rating = Math.round(input.rating * 2) / 2;
  if (rating < 0.5 || rating > 5 || Math.abs(rating - input.rating) > 0.001) throw new Error('Choose a rating from half a star to 5 stars.');

  const { data: requestRow, error: requestError } = await supabase
    .from('movie_review_requests')
    .select('*')
    .eq('id', input.requestId)
    .eq('recipient_user_id', reviewerUserId)
    .eq('status', 'pending')
    .single();

  if (requestError || !requestRow) throw new Error(requestError?.message ?? 'Movie request is no longer available.');
  const request = rowToMovieReviewRequest(requestRow);
  if (isPromptExpired(request)) throw new Error('This movie prompt has expired.');

  const { data: wallPostRow, error: wallPostError } = await supabase
    .from('wall_posts')
    .insert({
      author_user_id: reviewerUserId,
      subject_user_id: request.requesterUserId,
      subject_contact_id: null,
      visibility: 'visible_to_subject',
      post_type: 'movie',
      body,
      memory_date: new Date().toISOString().slice(0, 10),
      movie_tmdb_id: request.movie.tmdbId,
      movie_title: request.movie.title,
      movie_year: request.movie.year,
      movie_poster_url: request.movie.posterUrl,
      movie_overview: request.movie.overview,
      movie_release_date: request.movie.releaseDate,
      movie_vote_average: request.movie.voteAverage,
      movie_review_rating: rating,
      movie_review_request_id: request.id,
      prompt_text: request.prompt ?? (request.promptVoice ? 'Voice prompt' : null),
      prompt_type: request.prompt || request.promptVoice ? 'text' : null,
      ...moviePromptVoiceToDbColumns(request.promptVoice),
      ...movieReviewVoiceToWallPostDbColumns(reviewVoice),
    })
    .select()
    .single();

  if (wallPostError || !wallPostRow) throw new Error(wallPostError?.message ?? 'Could not create movie review.');
  const wallPost = rowToWallPost(wallPostRow);

  const { data: completedRow, error: updateError } = await supabase
    .from('movie_review_requests')
    .update({
      status: 'completed',
      review_rating: rating,
      review_body: body,
      ...movieReviewVoiceToDbColumns(reviewVoice),
      completed_wall_post_id: wallPost.id,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', request.id)
    .eq('recipient_user_id', reviewerUserId)
    .eq('status', 'pending')
    .select()
    .single();

  if (updateError || !completedRow) throw new Error(updateError?.message ?? 'Could not finish movie request.');
  const completedRequest = rowToMovieReviewRequest(completedRow);
  const reviewerName = await getDisplayName(reviewerUserId);

  createNotification({
    recipientUserId: completedRequest.requesterUserId,
    actorUserId: reviewerUserId,
    type: 'wall_post',
    referenceId: wallPost.id,
    metadata: {
      wallPostId: wallPost.id,
      movieReviewRequestId: completedRequest.id,
      postType: 'movie',
      source: 'movie_review',
    },
    message: `${reviewerName} rated ${completedRequest.movie.title}`,
  }).catch((notificationError) => console.warn('[notification] movie review insert failed:', notificationError));

  return { request: completedRequest, wallPost };
}

async function getDisplayName(userId: string) {
  const { data } = await supabase.from('profiles').select('display_name').eq('id', userId).single();
  return data?.display_name || 'Someone';
}

function cleanOptionalText(value: string | null | undefined, maxLength = 240) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function isMissingTable(message: string, tableName: string) {
  return new RegExp(tableName, 'i').test(message) && /(does not exist|schema cache|not find|not found)/i.test(message);
}
