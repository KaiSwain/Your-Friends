import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';

import { useAuth } from '../auth/AuthContext';
import { usePremium } from '../premium/PremiumContext';
import { supabase } from '../../lib/supabase';
import type { CalendarEvent, CalendarEventInput, UpdateCalendarEventInput } from '../../types/domain';
import {
  calendarQueryKeys,
  deleteCalendarEvent,
  fetchCalendarEvents,
  insertCalendarEvent,
  updateCalendarEvent,
} from './queries';
import {
  cancelCalendarEventReminders,
  resyncCalendarReminders,
  scheduleCalendarEventReminders,
} from './reminders';

interface CalendarContextValue {
  loading: boolean;
  events: CalendarEvent[];
  getEventById: (eventId: string) => CalendarEvent | undefined;
  addEvent: (input: CalendarEventInput) => Promise<CalendarEvent>;
  updateEvent: (eventId: string, updates: UpdateCalendarEventInput) => Promise<CalendarEvent>;
  deleteEvent: (eventId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const { isPremium } = usePremium();
  const userId = currentUser?.id ?? null;

  const query = useQuery({
    queryKey: calendarQueryKeys.events(userId ?? 'anonymous'),
    queryFn: () => fetchCalendarEvents(userId!),
    enabled: Boolean(userId),
  });

  const events = query.data ?? [];

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`calendar-events-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events', filter: `owner_user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: calendarQueryKeys.events(userId) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  const reminderSignature = useMemo(
    () => events.map((event) => {
      const reminderOffsets = event.reminderOffsets ?? [];
      const completedOccurrenceKeys = event.completedOccurrenceKeys ?? [];
      return `${event.id}:${event.updatedAt}:${reminderOffsets.join(',')}:${completedOccurrenceKeys.join(',')}:${event.eventDate}:${event.eventTime ?? ''}:${event.recurrence}`;
    }).join('|'),
    [events],
  );

  useEffect(() => {
    if (!userId || query.isPending) return;
    resyncCalendarReminders(userId, events, isPremium).catch(() => undefined);
  }, [events, isPremium, query.isPending, reminderSignature, userId]);

  async function addEvent(input: CalendarEventInput) {
    if (!userId) throw new Error('Sign in to add calendar events.');
    if (!isPremium) throw new Error('Calendar events require Premium.');
    const event = await insertCalendarEvent(userId, input);
    queryClient.setQueryData<CalendarEvent[]>(calendarQueryKeys.events(userId), (old) => [...(old ?? []), event]);
    await scheduleCalendarEventReminders(userId, event).catch(() => undefined);
    return event;
  }

  async function updateEvent(eventId: string, updates: UpdateCalendarEventInput) {
    if (!userId) throw new Error('Sign in to update calendar events.');
    if (!isPremium) throw new Error('Calendar edits require Premium.');
    const event = await updateCalendarEvent(eventId, userId, updates);
    queryClient.setQueryData<CalendarEvent[]>(calendarQueryKeys.events(userId), (old) =>
      (old ?? []).map((entry) => (entry.id === eventId ? event : entry)),
    );
    await scheduleCalendarEventReminders(userId, event).catch(() => undefined);
    return event;
  }

  async function deleteEvent(eventId: string) {
    if (!userId) throw new Error('Sign in to delete calendar events.');
    if (!isPremium) throw new Error('Calendar edits require Premium.');
    await deleteCalendarEvent(eventId, userId);
    queryClient.setQueryData<CalendarEvent[]>(calendarQueryKeys.events(userId), (old) =>
      (old ?? []).filter((event) => event.id !== eventId),
    );
    await cancelCalendarEventReminders(userId, eventId).catch(() => undefined);
  }

  async function refresh() {
    if (!userId) return;
    await queryClient.invalidateQueries({ queryKey: calendarQueryKeys.events(userId) });
  }

  const value = useMemo<CalendarContextValue>(
    () => ({
      loading: query.isPending,
      events,
      getEventById: (eventId) => events.find((event) => event.id === eventId),
      addEvent,
      updateEvent,
      deleteEvent,
      refresh,
    }),
    [events, query.isPending, userId, isPremium],
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used inside CalendarProvider');
  return ctx;
}
