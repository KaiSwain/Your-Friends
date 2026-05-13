import { supabase } from '../../lib/supabase';
import type { CalendarEvent, CalendarEventInput, UpdateCalendarEventInput } from '../../types/domain';
import { calendarEventInputToInsert, calendarEventUpdatesToRow, rowToCalendarEvent } from './mappers';

export const calendarQueryKeys = {
  all: ['calendar'] as const,
  events: (userId: string) => ['calendar', 'events', userId] as const,
};

export async function fetchCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('owner_user_id', userId)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });

  if (error) {
    if (isCalendarTableMissing(error.message)) return [];
    throw error;
  }
  return (data ?? []).map(rowToCalendarEvent);
}

export async function insertCalendarEvent(ownerUserId: string, input: CalendarEventInput): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert(calendarEventInputToInsert(ownerUserId, input))
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to create calendar event.');
  return rowToCalendarEvent(data);
}

export async function updateCalendarEvent(eventId: string, ownerUserId: string, updates: UpdateCalendarEventInput): Promise<CalendarEvent> {
  const row = calendarEventUpdatesToRow(updates);
  if (Object.keys(row).length === 0) throw new Error('No calendar changes to save.');

  const { data, error } = await supabase
    .from('calendar_events')
    .update(row)
    .eq('id', eventId)
    .eq('owner_user_id', ownerUserId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to update calendar event.');
  return rowToCalendarEvent(data);
}

export async function deleteCalendarEvent(eventId: string, ownerUserId: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', eventId)
    .eq('owner_user_id', ownerUserId);
  if (error) throw new Error(error.message);
}

function isCalendarTableMissing(message: string) {
  return /calendar_events/i.test(message) && /(does not exist|schema cache|not find|not found)/i.test(message);
}
