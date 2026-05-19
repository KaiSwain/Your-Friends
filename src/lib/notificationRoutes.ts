import type { Href } from 'expo-router';

type NotificationData = Record<string, unknown> | null | undefined;

export function getNotificationRoute(data: NotificationData): Href | null {
  if (!data || typeof data !== 'object') return null;
  const type = typeof data.type === 'string' ? data.type : null;

  if (type === 'memory_developed') return '/friends';
  if (type === 'friend_request') return '/(app)/friends/add';
  if (type === 'wall_post' || type === 'contact_update') return '/(app)/notifications';
  if (type !== 'calendar_event' && type !== 'calendar_event_reaction') return null;

  const date = typeof data.date === 'string' ? data.date : undefined;
  const eventId = typeof data.eventId === 'string'
    ? data.eventId
    : typeof data.referenceId === 'string'
      ? data.referenceId
      : undefined;

  return date ? { pathname: '/calendar', params: { date, eventId } } : '/calendar';
}
