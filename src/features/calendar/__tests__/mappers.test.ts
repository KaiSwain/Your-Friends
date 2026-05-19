import { describe, expect, it } from '@jest/globals';

import { rowToCalendarEventShare, rowToSharedCalendarEvent } from '../mappers';

describe('calendar share mappers', () => {
  it('maps share rows', () => {
    const share = rowToCalendarEventShare({
      id: 'share-1',
      event_id: 'event-1',
      owner_user_id: 'owner-1',
      recipient_user_id: 'friend-1',
      reminders_enabled: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    });

    expect(share).toEqual({
      id: 'share-1',
      eventId: 'event-1',
      ownerUserId: 'owner-1',
      recipientUserId: 'friend-1',
      remindersEnabled: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    });
  });

  it('attaches share metadata to shared calendar events', () => {
    const event = rowToSharedCalendarEvent({
      id: 'share-1',
      owner_user_id: 'owner-1',
      recipient_user_id: 'friend-1',
      reminders_enabled: true,
      calendar_events: {
        id: 'event-1',
        owner_user_id: 'owner-1',
        subject_user_id: 'friend-1',
        subject_contact_id: null,
        event_type: 'birthday',
        title: 'Friend birthday',
        event_date: '2026-05-14',
        event_time: null,
        all_day: true,
        recurrence: 'yearly',
        reminder_offsets: [1],
        completed_occurrence_keys: [],
        note: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      },
    });

    expect(event).toMatchObject({
      id: 'event-1',
      ownerUserId: 'owner-1',
      shareId: 'share-1',
      sharedByUserId: 'owner-1',
      sharedWithUserId: 'friend-1',
      sharedRemindersEnabled: true,
    });
  });
});
