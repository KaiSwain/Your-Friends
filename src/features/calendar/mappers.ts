import type { CalendarEvent, CalendarEventInput, UpdateCalendarEventInput } from '../../types/domain';

export function rowToCalendarEvent(row: any): CalendarEvent {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    subjectUserId: row.subject_user_id ?? null,
    subjectContactId: row.subject_contact_id ?? null,
    type: row.event_type ?? 'custom',
    title: row.title ?? '',
    eventDate: row.event_date,
    eventTime: row.event_time ?? null,
    allDay: row.all_day ?? true,
    recurrence: row.recurrence ?? 'none',
    reminderOffsets: Array.isArray(row.reminder_offsets) ? row.reminder_offsets : [],
    completedOccurrenceKeys: Array.isArray(row.completed_occurrence_keys) ? row.completed_occurrence_keys : [],
    note: row.note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export function calendarEventInputToInsert(ownerUserId: string, input: CalendarEventInput) {
  return {
    owner_user_id: ownerUserId,
    subject_user_id: input.subjectUserId ?? null,
    subject_contact_id: input.subjectContactId ?? null,
    event_type: input.type,
    title: input.title.trim(),
    event_date: input.eventDate,
    event_time: input.eventTime ?? null,
    all_day: input.allDay ?? true,
    recurrence: input.recurrence ?? 'none',
    reminder_offsets: input.reminderOffsets ?? [],
    note: input.note?.trim() || null,
  };
}

export function calendarEventUpdatesToRow(updates: UpdateCalendarEventInput) {
  const row: Record<string, unknown> = {};
  if (updates.subjectUserId !== undefined) row.subject_user_id = updates.subjectUserId;
  if (updates.subjectContactId !== undefined) row.subject_contact_id = updates.subjectContactId;
  if (updates.type !== undefined) row.event_type = updates.type;
  if (updates.title !== undefined) row.title = updates.title.trim();
  if (updates.eventDate !== undefined) row.event_date = updates.eventDate;
  if (updates.eventTime !== undefined) row.event_time = updates.eventTime;
  if (updates.allDay !== undefined) row.all_day = updates.allDay;
  if (updates.recurrence !== undefined) row.recurrence = updates.recurrence;
  if (updates.reminderOffsets !== undefined) row.reminder_offsets = updates.reminderOffsets;
  if (updates.completedOccurrenceKeys !== undefined) row.completed_occurrence_keys = updates.completedOccurrenceKeys;
  if (updates.note !== undefined) row.note = updates.note?.trim() || null;
  if (Object.keys(row).length > 0) row.updated_at = new Date().toISOString();
  return row;
}
