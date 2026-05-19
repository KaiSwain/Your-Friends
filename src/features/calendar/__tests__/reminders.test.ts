import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { CalendarEvent } from '../../../types/domain';

const mockStorage = new Map<string, string>();
const mockScheduleNotificationAsync = jest.fn<(...args: unknown[]) => Promise<string>>();
const mockCancelScheduledNotificationAsync = jest.fn<(...args: unknown[]) => Promise<void>>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
  },
}));

jest.mock('expo-notifications', () => ({
  __esModule: true,
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancelScheduledNotificationAsync(...args),
}));

import { resyncCalendarReminders } from '../reminders';

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: 'event-1',
    ownerUserId: 'owner-1',
    subjectUserId: 'friend-1',
    subjectContactId: null,
    type: 'custom',
    title: 'Future plan',
    eventDate: '9999-05-14',
    eventTime: '09:00',
    allDay: false,
    recurrence: 'none',
    reminderOffsets: [0],
    completedOccurrenceKeys: [],
    note: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('calendar reminder sync', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockScheduleNotificationAsync.mockReset();
    mockScheduleNotificationAsync.mockResolvedValue('notification-1');
    mockCancelScheduledNotificationAsync.mockReset();
    mockCancelScheduledNotificationAsync.mockResolvedValue(undefined);
  });

  it('schedules enabled shared reminders even when the recipient is not premium', async () => {
    await resyncCalendarReminders('friend-1', [
      event({ id: 'owned' }),
      event({ id: 'shared', shareId: 'share-1', sharedRemindersEnabled: true }),
    ], false);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockScheduleNotificationAsync.mock.calls[0][0]).toMatchObject({
      content: {
        data: { eventId: 'shared', shareId: 'share-1', type: 'calendar_event' },
      },
    });
  });

  it('does not schedule muted shared reminders', async () => {
    await resyncCalendarReminders('friend-1', [
      event({ id: 'shared', shareId: 'share-1', sharedRemindersEnabled: false }),
    ], false);

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
