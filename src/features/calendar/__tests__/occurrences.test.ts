import { describe, expect, it } from '@jest/globals';

import { getEventOccurrenceKey, groupEventsByMonth } from '../occurrences';
import type { CalendarEvent } from '../../../types/domain';

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'event-1',
    ownerUserId: 'owner-1',
    subjectUserId: 'friend-1',
    subjectContactId: null,
    type: 'custom',
    title: 'Plan',
    eventDate: '2026-05-14',
    eventTime: null,
    allDay: true,
    recurrence: 'none',
    reminderOffsets: [],
    completedOccurrenceKeys: [],
    note: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('calendar occurrences', () => {
  it('does not show recurring events before their original date', () => {
    expect(getEventOccurrenceKey(event({ recurrence: 'yearly' }), 2025, 4)).toBe('');
    expect(getEventOccurrenceKey(event({ recurrence: 'monthly' }), 2026, 3)).toBe('');
  });

  it('clamps monthly events to the last day of short months', () => {
    const key = getEventOccurrenceKey(event({ eventDate: '2026-01-31', recurrence: 'monthly' }), 2026, 1);
    expect(key).toBe('2026-02-28');
  });

  it('groups shared events on the same recurrence day as owned events', () => {
    const grouped = groupEventsByMonth(
      [
        event({ id: 'owned', title: 'Owned', eventDate: '2026-05-14', recurrence: 'yearly' }),
        event({
          id: 'shared',
          title: 'Shared',
          eventDate: '2026-05-14',
          recurrence: 'yearly',
          shareId: 'share-1',
          sharedByUserId: 'owner-2',
          sharedWithUserId: 'friend-1',
          sharedRemindersEnabled: true,
        }),
      ],
      new Date(2027, 4, 1),
    );

    expect(grouped['2027-05-14'].map((entry) => entry.id)).toEqual(['owned', 'shared']);
  });
});
