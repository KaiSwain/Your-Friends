import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import type { CalendarEvent } from '../../types/domain';

const reminderIdsKey = (userId: string, eventId: string) => `yourfriends:calendar:reminders:${userId}:${eventId}`;
const reminderIndexKey = (userId: string) => `yourfriends:calendar:reminderIndex:${userId}`;
const DEFAULT_ALL_DAY_HOUR = 9;

export async function scheduleCalendarEventReminders(userId: string, event: CalendarEvent): Promise<string[]> {
  await cancelCalendarEventReminders(userId, event.id);
  const reminderOffsets = event.reminderOffsets ?? [];
  if (reminderOffsets.length === 0) return [];

  const permission = await ensureNotificationPermission();
  if (!permission) return [];

  const scheduledIds: string[] = [];
  const triggerDates = getFutureReminderDates(event);
  for (const triggerDate of triggerDates) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: getReminderTitle(event),
        body: getReminderBody(event, triggerDate.offsetDays),
        sound: true,
        data: { eventId: event.id, type: 'calendar_event' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate.date,
      },
    });
    scheduledIds.push(id);
  }

  if (scheduledIds.length > 0) {
    await AsyncStorage.setItem(reminderIdsKey(userId, event.id), JSON.stringify(scheduledIds));
    await addEventToReminderIndex(userId, event.id);
  }
  return scheduledIds;
}

export async function cancelCalendarEventReminders(userId: string, eventId: string): Promise<void> {
  const key = reminderIdsKey(userId, eventId);
  const raw = await AsyncStorage.getItem(key);
  const ids = parseStoredIds(raw);
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  await AsyncStorage.removeItem(key);
  await removeEventFromReminderIndex(userId, eventId);
}

export async function resyncCalendarReminders(userId: string, events: readonly CalendarEvent[], isPremium: boolean): Promise<void> {
  await cancelAllCalendarReminders(userId);
  if (!isPremium) return;
  for (const event of events) {
    await scheduleCalendarEventReminders(userId, event).catch(() => undefined);
  }
}

export async function cancelAllCalendarReminders(userId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(reminderIndexKey(userId));
  const eventIds = parseStoredIds(raw);
  for (const eventId of eventIds) {
    const key = reminderIdsKey(userId, eventId);
    const ids = parseStoredIds(await AsyncStorage.getItem(key));
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
    await AsyncStorage.removeItem(key);
  }
  await AsyncStorage.removeItem(reminderIndexKey(userId));
}

async function ensureNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.status === 'granted';
}

function getFutureReminderDates(event: CalendarEvent) {
  const eventDate = getNextOccurrenceDate(event);
  if (!eventDate) return [];
  if ((event.completedOccurrenceKeys ?? []).includes(formatDateKey(eventDate))) return [];

  return (event.reminderOffsets ?? [])
    .map((offsetDays) => {
      const date = new Date(eventDate);
      date.setDate(date.getDate() - offsetDays);
      return { date, offsetDays };
    })
    .filter(({ date }) => date.getTime() > Date.now())
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getNextOccurrenceDate(event: CalendarEvent): Date | null {
  const [year, month, day] = event.eventDate.split('-').map(Number);
  if (!year || !month || !day) return null;

  const [hour, minute] = event.eventTime && !event.allDay
    ? event.eventTime.split(':').map(Number)
    : [DEFAULT_ALL_DAY_HOUR, 0];

  const now = new Date();
  const date = new Date(year, month - 1, day, hour || DEFAULT_ALL_DAY_HOUR, minute || 0, 0, 0);
  if (event.recurrence === 'none') return date;

  if (event.recurrence === 'monthly') {
    date.setFullYear(now.getFullYear());
    date.setMonth(now.getMonth());
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
    if (date.getTime() <= now.getTime()) {
      date.setMonth(date.getMonth() + 1);
      const nextLastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      date.setDate(Math.min(day, nextLastDay));
    }
    return date;
  }

  date.setFullYear(now.getFullYear());
  if (date.getTime() <= now.getTime()) date.setFullYear(now.getFullYear() + 1);
  return date;
}

function getReminderTitle(event: CalendarEvent) {
  if (event.type === 'birthday') return `Birthday reminder: ${event.title}`;
  if (event.type === 'anniversary') return `Anniversary reminder: ${event.title}`;
  return event.title;
}

function getReminderBody(event: CalendarEvent, offsetDays: number) {
  if (offsetDays === 0) return 'This is today.';
  if (offsetDays === 1) return 'This is tomorrow.';
  return `Coming up in ${offsetDays} days.`;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseStoredIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

async function addEventToReminderIndex(userId: string, eventId: string) {
  const raw = await AsyncStorage.getItem(reminderIndexKey(userId));
  const ids = new Set(parseStoredIds(raw));
  ids.add(eventId);
  await AsyncStorage.setItem(reminderIndexKey(userId), JSON.stringify([...ids]));
}

async function removeEventFromReminderIndex(userId: string, eventId: string) {
  const raw = await AsyncStorage.getItem(reminderIndexKey(userId));
  const ids = parseStoredIds(raw).filter((id) => id !== eventId);
  if (ids.length === 0) await AsyncStorage.removeItem(reminderIndexKey(userId));
  else await AsyncStorage.setItem(reminderIndexKey(userId), JSON.stringify(ids));
}
