import { describe, expect, it } from '@jest/globals';

import { getBirthdayMomentsForDate } from '../birthdayMoments';
import type { AppUser, CalendarEvent } from '../../../types/domain';

function user(overrides: Partial<AppUser>): AppUser {
  return {
    id: 'friend-1',
    email: 'friend@test.com',
    displayName: 'Avery',
    friendCode: 'FRIEND1',
    avatarColor: '#111111',
    birthday: '1998-05-19',
    profileBgImagePublic: false,
    profileFacts: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'birthday-1',
    ownerUserId: 'friend-1',
    subjectUserId: 'friend-1',
    subjectContactId: null,
    type: 'birthday',
    title: "Avery's birthday",
    eventDate: '1998-05-19',
    eventTime: null,
    allDay: true,
    recurrence: 'yearly',
    reminderOffsets: [],
    completedOccurrenceKeys: [],
    note: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('getBirthdayMomentsForDate', () => {
  it('returns shared friend birthdays happening today', () => {
    const friend = user({ id: 'friend-1', displayName: 'Avery' });
    const moments = getBirthdayMomentsForDate({
      currentUserId: 'me',
      date: new Date(2026, 4, 19),
      events: [
        event({
          id: 'shared-birthday',
          sharedByUserId: friend.id,
          sharedWithUserId: 'me',
          shareId: 'share-1',
        }),
      ],
      getUserById: (userId) => (userId === friend.id ? friend : undefined),
    });

    expect(moments).toHaveLength(1);
    expect(moments[0]).toMatchObject({
      occurrenceDate: '2026-05-19',
      friend: { id: 'friend-1' },
      event: { id: 'shared-birthday' },
    });
  });

  it('ignores non-birthday events, future occurrences, and the current user birthday', () => {
    const friend = user({ id: 'friend-1' });
    const moments = getBirthdayMomentsForDate({
      currentUserId: 'me',
      date: new Date(2026, 4, 19),
      events: [
        event({ id: 'custom', type: 'custom' }),
        event({ id: 'tomorrow', eventDate: '1998-05-20', sharedByUserId: friend.id }),
        event({ id: 'mine', ownerUserId: 'me', subjectUserId: 'me' }),
      ],
      getUserById: (userId) => (userId === friend.id ? friend : undefined),
    });

    expect(moments).toEqual([]);
  });

  it('dedupes multiple birthday events for the same friend', () => {
    const friend = user({ id: 'friend-1' });
    const moments = getBirthdayMomentsForDate({
      currentUserId: 'me',
      date: new Date(2026, 4, 19),
      events: [
        event({ id: 'shared-1', sharedByUserId: friend.id, shareId: 'share-1' }),
        event({ id: 'shared-2', sharedByUserId: friend.id, shareId: 'share-2' }),
      ],
      getUserById: (userId) => (userId === friend.id ? friend : undefined),
    });

    expect(moments).toHaveLength(1);
    expect(moments[0].event.id).toBe('shared-1');
  });
});
