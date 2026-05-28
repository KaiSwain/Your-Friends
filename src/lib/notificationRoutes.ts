import type { Href } from 'expo-router';

type NotificationData = Record<string, unknown> | null | undefined;

export function getNotificationRoute(data: NotificationData): Href | null {
  if (!data || typeof data !== 'object') return null;
  const type = typeof data.type === 'string' ? data.type : null;

  if (type === 'memory_developed') return '/friends';
  if (type === 'gift_note_unlock' || type === 'incoming_polaroid_waiting') return '/friends';
  if (type === 'friend_request') return '/(app)/friends/add';
  if (type === 'memory_prompt_request') {
    const requestId = typeof data.memoryPromptRequestId === 'string'
      ? data.memoryPromptRequestId
      : typeof data.referenceId === 'string'
        ? data.referenceId
        : null;
    return requestId ? `/(app)/prompts/respond/${requestId}` : '/(app)/notifications';
  }
  if (type === 'movie_review_request') {
    const requestId = typeof data.movieReviewRequestId === 'string'
      ? data.movieReviewRequestId
      : typeof data.referenceId === 'string'
        ? data.referenceId
        : null;
    return requestId ? `/(app)/movies/review/${requestId}` : '/(app)/notifications';
  }
  if (type === 'wall_post') {
    const wallPostId = typeof data.wallPostId === 'string'
      ? data.wallPostId
      : typeof data.referenceId === 'string'
        ? data.referenceId
        : null;
    return wallPostId ? `/(app)/memories/replies/${wallPostId}` : '/(app)/notifications';
  }
  if (type === 'contact_update') return '/(app)/notifications';
  if (type !== 'calendar_event' && type !== 'calendar_event_reaction') return null;

  const date = typeof data.date === 'string' ? data.date : undefined;
  const eventId = typeof data.eventId === 'string'
    ? data.eventId
    : typeof data.referenceId === 'string'
      ? data.referenceId
      : undefined;

  return date ? { pathname: '/calendar', params: { date, eventId } } : '/calendar';
}
