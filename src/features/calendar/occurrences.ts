import type { CalendarEvent } from '../../types/domain';

export function groupEventsByMonth(
  events: readonly CalendarEvent[],
  month: Date,
): Record<string, CalendarEvent[]> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const grouped: Record<string, CalendarEvent[]> = {};
  for (const event of events) {
    const key = getEventOccurrenceKey(event, year, monthIndex);
    if (!key) continue;
    grouped[key] = [...(grouped[key] ?? []), event];
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort(
      (a, b) =>
        (a.eventTime ?? '').localeCompare(b.eventTime ?? '') || a.title.localeCompare(b.title),
    );
  }
  return grouped;
}

export function getEventOccurrenceKey(event: CalendarEvent, year: number, monthIndex: number) {
  const parts = parseDateParts(event.eventDate);
  if (!parts) return '';
  const { year: eventYear, month, day } = parts;
  if (event.recurrence === 'none') {
    return eventYear === year && month === monthIndex + 1 ? event.eventDate : '';
  }

  const requestedMonth = monthIndex + 1;
  const requestedMonthStart = year * 12 + requestedMonth;
  const eventMonthStart = eventYear * 12 + month;
  if (requestedMonthStart < eventMonthStart) return '';

  if (event.recurrence === 'yearly' && month !== requestedMonth) return '';
  const maxDay = new Date(year, requestedMonth, 0).getDate();
  const occurrenceDay = Math.min(day, maxDay);
  if (event.recurrence === 'monthly' || event.recurrence === 'yearly') {
    return formatDateKey(year, requestedMonth, occurrenceDay);
  }
  return '';
}

function parseDateParts(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
