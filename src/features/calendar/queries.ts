import { supabase } from '../../lib/supabase';
import type { CalendarEvent, CalendarEventInput, CalendarEventShare, UpdateCalendarEventInput } from '../../types/domain';
import { calendarEventInputToInsert, calendarEventUpdatesToRow, rowToCalendarEvent, rowToCalendarEventShare, rowToSharedCalendarEvent } from './mappers';

export const calendarQueryKeys = {
  all: ['calendar'] as const,
  events: (userId: string) => ['calendar', 'events', userId] as const,
  ownerShares: (userId: string) => ['calendar', 'ownerShares', userId] as const,
};

export async function fetchCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  const { data: ownedData, error: ownedError } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('owner_user_id', userId)
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true });

  if (ownedError) {
    if (isCalendarTableMissing(ownedError.message)) return [];
    throw ownedError;
  }

  const { data: shareData, error: shareError } = await supabase
    .from('calendar_event_shares')
    .select('*, calendar_events(*)')
    .eq('recipient_user_id', userId);

  if (shareError) {
    if (isCalendarShareTableMissing(shareError.message)) return (ownedData ?? []).map(rowToCalendarEvent);
    throw shareError;
  }

  const ownedEvents = (ownedData ?? []).map(rowToCalendarEvent);
  const sharedEvents = (shareData ?? [])
    .map(rowToSharedCalendarEvent)
    .filter((event): event is CalendarEvent => Boolean(event));
  return [...ownedEvents, ...sharedEvents].sort(sortCalendarEvents);
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

export async function fetchCalendarEventSharesForOwner(ownerUserId: string): Promise<CalendarEventShare[]> {
  const { data, error } = await supabase
    .from('calendar_event_shares')
    .select('*')
    .eq('owner_user_id', ownerUserId);
  if (error) {
    if (isCalendarShareTableMissing(error.message)) return [];
    throw error;
  }
  return (data ?? []).map(rowToCalendarEventShare);
}

export async function upsertCalendarEventShare(eventId: string, ownerUserId: string, recipientUserId: string): Promise<CalendarEventShare> {
  const { data: existing, error: existingError } = await supabase
    .from('calendar_event_shares')
    .select('*')
    .eq('event_id', eventId)
    .eq('owner_user_id', ownerUserId)
    .eq('recipient_user_id', recipientUserId)
    .maybeSingle();
  if (existingError) {
    if (isCalendarShareTableMissing(existingError.message)) throw new Error(existingError.message);
    throw existingError;
  }
  if (existing) return rowToCalendarEventShare(existing);

  const { data, error } = await supabase
    .from('calendar_event_shares')
    .insert({
      event_id: eventId,
      owner_user_id: ownerUserId,
      recipient_user_id: recipientUserId,
      reminders_enabled: true,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to share calendar event.');
  return rowToCalendarEventShare(data);
}

export async function deleteCalendarEventShare(eventId: string, ownerUserId: string, recipientUserId: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_event_shares')
    .delete()
    .eq('event_id', eventId)
    .eq('owner_user_id', ownerUserId)
    .eq('recipient_user_id', recipientUserId);
  if (error) {
    if (isCalendarShareTableMissing(error.message)) return;
    throw new Error(error.message);
  }
}

export async function setCalendarEventShareReminders(shareId: string, remindersEnabled: boolean): Promise<CalendarEventShare> {
  const { data, error } = await supabase.rpc('set_calendar_event_share_reminders', {
    p_share_id: shareId,
    p_reminders_enabled: remindersEnabled,
  });
  if (error || !data) throw new Error(error?.message ?? 'Failed to update shared reminder settings.');
  return rowToCalendarEventShare(data);
}

export async function syncProfileBirthdayCalendarEvent(input: {
  birthday: string;
  displayName: string;
  friendUserIds: string[];
  ownerUserId: string;
}): Promise<void> {
  const title = `${input.displayName.trim() || 'Friend'}'s birthday`;
  const { data: existingEvent, error: existingError } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('owner_user_id', input.ownerUserId)
    .eq('subject_user_id', input.ownerUserId)
    .eq('event_type', 'birthday')
    .maybeSingle();
  if (existingError) {
    if (isCalendarTableMissing(existingError.message)) return;
    throw existingError;
  }

  const eventId = existingEvent?.id as string | undefined;
  let resolvedEventId = eventId;

  if (resolvedEventId) {
    const { error } = await supabase
      .from('calendar_events')
      .update({
        title,
        event_date: input.birthday,
        all_day: true,
        recurrence: 'yearly',
        reminder_offsets: [0, 7],
        updated_at: new Date().toISOString(),
      })
      .eq('id', resolvedEventId)
      .eq('owner_user_id', input.ownerUserId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        owner_user_id: input.ownerUserId,
        subject_user_id: input.ownerUserId,
        subject_contact_id: null,
        event_type: 'birthday',
        title,
        event_date: input.birthday,
        event_time: null,
        all_day: true,
        recurrence: 'yearly',
        reminder_offsets: [0, 7],
        note: 'Birthday from profile setup.',
      })
      .select('id')
      .single();
    if (error || !data?.id) throw new Error(error?.message ?? 'Failed to create birthday event.');
    resolvedEventId = data.id;
  }

  const friendIds = Array.from(new Set(input.friendUserIds.filter((id) => id && id !== input.ownerUserId)));
  const { data: existingShares, error: sharesError } = await supabase
    .from('calendar_event_shares')
    .select('*')
    .eq('event_id', resolvedEventId);
  if (sharesError) {
    if (isCalendarShareTableMissing(sharesError.message)) return;
    throw sharesError;
  }

  const existingRecipientIds = new Set((existingShares ?? []).map((row) => String(row.recipient_user_id)));
  const staleShareIds = (existingShares ?? [])
    .filter((row) => !friendIds.includes(String(row.recipient_user_id)))
    .map((row) => String(row.id));
  if (staleShareIds.length) {
    const { error } = await supabase
      .from('calendar_event_shares')
      .delete()
      .in('id', staleShareIds);
    if (error) throw new Error(error.message);
  }

  const inserts = friendIds
    .filter((recipientUserId) => !existingRecipientIds.has(recipientUserId))
    .map((recipientUserId) => ({
      event_id: resolvedEventId,
      owner_user_id: input.ownerUserId,
      recipient_user_id: recipientUserId,
      reminders_enabled: true,
    }));

  if (inserts.length) {
    const { error } = await supabase
      .from('calendar_event_shares')
      .insert(inserts);
    if (error) throw new Error(error.message);
  }
}

function isCalendarTableMissing(message: string) {
  return /calendar_events/i.test(message) && /(does not exist|schema cache|not find|not found)/i.test(message);
}

function isCalendarShareTableMissing(message: string) {
  return /calendar_event_shares/i.test(message) && /(does not exist|schema cache|not find|not found|relationship)/i.test(message);
}

export function sortCalendarEvents(a: CalendarEvent, b: CalendarEvent) {
  return (
    a.eventDate.localeCompare(b.eventDate) ||
    (a.eventTime ?? '').localeCompare(b.eventTime ?? '') ||
    a.title.localeCompare(b.title) ||
    a.id.localeCompare(b.id)
  );
}
