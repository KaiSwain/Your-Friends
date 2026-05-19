import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';

import { useAuth } from '../auth/AuthContext';
import { usePremium } from '../premium/PremiumContext';
import { supabase } from '../../lib/supabase';
import type { CalendarEvent, CalendarEventInput, CalendarEventShare, UpdateCalendarEventInput } from '../../types/domain';
import {
  calendarQueryKeys,
  deleteCalendarEvent,
  deleteCalendarEventShare,
  fetchCalendarEvents,
  fetchCalendarEventSharesForOwner,
  insertCalendarEvent,
  setCalendarEventShareReminders,
  sortCalendarEvents,
  updateCalendarEvent,
  upsertCalendarEventShare,
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
  ownerShares: CalendarEventShare[];
  addEvent: (input: CalendarEventInput) => Promise<CalendarEvent>;
  updateEvent: (eventId: string, updates: UpdateCalendarEventInput) => Promise<CalendarEvent>;
  deleteEvent: (eventId: string) => Promise<void>;
  shareEventWithFriend: (eventId: string, recipientUserId: string) => Promise<CalendarEventShare>;
  unshareEventWithFriend: (eventId: string, recipientUserId: string) => Promise<void>;
  setSharedEventRemindersEnabled: (shareId: string, remindersEnabled: boolean) => Promise<void>;
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
    refetchInterval: userId ? 5000 : false,
  });
  const ownerSharesQuery = useQuery({
    queryKey: calendarQueryKeys.ownerShares(userId ?? 'anonymous'),
    queryFn: () => fetchCalendarEventSharesForOwner(userId!),
    enabled: Boolean(userId),
    refetchInterval: userId ? 5000 : false,
  });

  const events = query.data ?? [];
  const ownerShares = ownerSharesQuery.data ?? [];

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`calendar-events-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events', filter: `owner_user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: calendarQueryKeys.events(userId) }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_event_shares', filter: `recipient_user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: calendarQueryKeys.events(userId) }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_event_shares', filter: `owner_user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: calendarQueryKeys.ownerShares(userId) });
          queryClient.invalidateQueries({ queryKey: calendarQueryKeys.events(userId) });
        },
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
      return `${event.id}:${event.shareId ?? 'owner'}:${event.updatedAt}:${event.sharedRemindersEnabled ?? 'own'}:${reminderOffsets.join(',')}:${completedOccurrenceKeys.join(',')}:${event.eventDate}:${event.eventTime ?? ''}:${event.recurrence}`;
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
      (old ?? []).map((entry) => (entry.id === eventId && !entry.shareId ? event : entry)),
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

  async function shareEventWithFriend(eventId: string, recipientUserId: string) {
    if (!userId) throw new Error('Sign in to share calendar events.');
    if (!isPremium) throw new Error('Calendar sharing requires Premium.');
    const share = await upsertCalendarEventShare(eventId, userId, recipientUserId);
    queryClient.setQueryData<CalendarEventShare[]>(calendarQueryKeys.ownerShares(userId), (old) => {
      const existing = old ?? [];
      return [share, ...existing.filter((entry) => entry.id !== share.id)];
    });
    return share;
  }

  async function unshareEventWithFriend(eventId: string, recipientUserId: string) {
    if (!userId) throw new Error('Sign in to update calendar sharing.');
    if (!isPremium) throw new Error('Calendar sharing requires Premium.');
    await deleteCalendarEventShare(eventId, userId, recipientUserId);
    queryClient.setQueryData<CalendarEventShare[]>(calendarQueryKeys.ownerShares(userId), (old) =>
      (old ?? []).filter((share) => !(share.eventId === eventId && share.recipientUserId === recipientUserId)),
    );
  }

  async function setSharedEventRemindersEnabled(shareId: string, remindersEnabled: boolean) {
    if (!userId) throw new Error('Sign in to update shared reminders.');
    const share = await setCalendarEventShareReminders(shareId, remindersEnabled);
    queryClient.setQueryData<CalendarEvent[]>(calendarQueryKeys.events(userId), (old) =>
      (old ?? [])
        .map((event) =>
          event.shareId === share.id
            ? { ...event, sharedRemindersEnabled: share.remindersEnabled, updatedAt: share.updatedAt }
            : event,
        )
        .sort(sortCalendarEvents),
    );
  }

  async function refresh() {
    if (!userId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.events(userId) }),
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.ownerShares(userId) }),
    ]);
  }

  const value = useMemo<CalendarContextValue>(
    () => ({
      loading: query.isPending,
      events,
      ownerShares,
      getEventById: (eventId) => events.find((event) => event.id === eventId),
      addEvent,
      updateEvent,
      deleteEvent,
      shareEventWithFriend,
      unshareEventWithFriend,
      setSharedEventRemindersEnabled,
      refresh,
    }),
    [events, ownerShares, query.isPending, userId, isPremium],
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendar(): CalendarContextValue {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error('useCalendar must be used inside CalendarProvider');
  return ctx;
}
