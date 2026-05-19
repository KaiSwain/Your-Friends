import type { AppUser, CalendarEvent } from '../../types/domain';
import { getEventOccurrenceKey } from '../calendar/occurrences';

export interface BirthdayMoment {
  event: CalendarEvent;
  friend: AppUser;
  occurrenceDate: string;
}

export function getBirthdayMomentsForDate({
  currentUserId,
  events,
  getUserById,
  date = new Date(),
}: {
  currentUserId: string;
  events: readonly CalendarEvent[];
  getUserById: (userId: string) => AppUser | undefined;
  date?: Date;
}): BirthdayMoment[] {
  const occurrenceDate = getLocalDateKey(date);
  const seenFriendIds = new Set<string>();
  const moments: BirthdayMoment[] = [];

  for (const event of events) {
    if (event.type !== 'birthday') continue;
    const birthdayUserId = getBirthdayEventUserId(event, currentUserId);
    if (!birthdayUserId || birthdayUserId === currentUserId || seenFriendIds.has(birthdayUserId)) continue;
    const eventOccurrenceDate = getEventOccurrenceKey(event, date.getFullYear(), date.getMonth());
    if (eventOccurrenceDate !== occurrenceDate) continue;
    const friend = getUserById(birthdayUserId);
    if (!friend) continue;

    seenFriendIds.add(birthdayUserId);
    moments.push({ event, friend, occurrenceDate });
  }

  return moments.sort((left, right) => left.friend.displayName.localeCompare(right.friend.displayName));
}

export function getBirthdayEventUserId(event: CalendarEvent, currentUserId: string) {
  if (event.sharedByUserId && event.sharedByUserId !== currentUserId) return event.sharedByUserId;
  if (event.subjectUserId && event.subjectUserId !== currentUserId) return event.subjectUserId;
  return null;
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
