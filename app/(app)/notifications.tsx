import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../src/components/AppScreen';
import { ListRowSkeleton } from '../../src/components/Skeleton';
import { ThemedIcon } from '../../src/components/ThemedIcon';
import { useAuth } from '../../src/features/auth/AuthContext';
import { useCalendar } from '../../src/features/calendar/CalendarContext';
import { getEventOccurrenceKey } from '../../src/features/calendar/occurrences';
import { useSocialGraph } from '../../src/features/social/SocialGraphContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import { backOnce, pushOnce } from '../../src/lib/navigationGuard';
import { useSyntheticNotificationReads } from '../../src/hooks/useSyntheticNotificationReads';
import type { ColorTokens } from '../../src/features/theme/themes';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';
import type { CalendarEvent, Notification } from '../../src/types/domain';

export default function NotificationsScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { events } = useCalendar();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const {
    loading,
    notifications,
    contacts,
    getUserById,
    getCalendarEventReactionSummary,
    setCalendarEventReaction,
    markNotificationRead,
    markAllNotificationsRead,
    refresh,
  } = useSocialGraph();
  const [refreshing, setRefreshing] = useState(false);
  const [reactingNotificationId, setReactingNotificationId] = useState<string | null>(null);
  const { readIds: syntheticNotificationReadIds, markSyntheticRead, markSyntheticManyRead } = useSyntheticNotificationReads(currentUser?.id ?? null);
  const visibleNotifications = useMemo(
    () => mergeCalendarEventFallbacks(notifications, events, currentUser?.id ?? null, getUserById, syntheticNotificationReadIds),
    [notifications, events, currentUser?.id, getUserById, syntheticNotificationReadIds],
  );
  const hasUnread = visibleNotifications.some((n) => !n.read);

  async function markAllVisibleNotificationsRead() {
    await markAllNotificationsRead();
    await markSyntheticManyRead(visibleNotifications.map((notification) => notification.id));
  }

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => backOnce(router)} style={[styles.backButton, { flexDirection: 'row', alignItems: 'center', gap: 2 }]} accessibilityRole="button" accessibilityLabel="Go back">
        <ThemedIcon name="back" size={16} color={colors.inkSoft} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
      {hasUnread && (
        <Pressable onPress={markAllVisibleNotificationsRead} accessibilityRole="button" accessibilityLabel="Mark all notifications as read">
          <Text style={styles.markAllLabel}>Mark all read</Text>
        </Pressable>
      )}
    </View>
  );

  function handlePress(n: Notification) {
    if (!n.read) markNotificationRead(n.id);
    if (!n.read) markSyntheticRead(n.id);
    if (n.type === 'movie_review_request') {
      const requestId = typeof n.metadata.movieReviewRequestId === 'string' ? n.metadata.movieReviewRequestId : n.referenceId;
      if (requestId) pushOnce(router, `/(app)/movies/review/${requestId}`);
    } else if (n.type === 'memory_prompt_request') {
      const requestId = typeof n.metadata.memoryPromptRequestId === 'string' ? n.metadata.memoryPromptRequestId : n.referenceId;
      if (requestId) pushOnce(router, `/(app)/prompts/respond/${requestId}`);
    } else if (n.type === 'memory_reply') {
      const postId = typeof n.metadata.wallPostId === 'string' ? n.metadata.wallPostId : n.referenceId;
      if (postId) pushOnce(router, `/(app)/memories/replies/${postId}`);
    } else if (n.type === 'wall_post' && n.actorUserId) {
      pushOnce(router, `/(app)/wall/${n.actorUserId}`);
    } else if ((n.type === 'friend_request' || n.type === 'contact_update') && n.actorUserId) {
      if (n.type === 'friend_request' && n.metadata.action === 'requested') {
        pushOnce(router, '/(app)/friends/add');
      } else {
        const linkedContactId = contacts.find((contact) => contact.linkedUserId === n.actorUserId)?.id;
        pushOnce(router, linkedContactId ? `/(app)/profiles/contact/${linkedContactId}` : `/(app)/profiles/user/${n.actorUserId}`);
      }
    } else if (n.type === 'calendar_event' || n.type === 'calendar_event_reaction') {
      if (n.metadata.source === 'birthday_moment' && typeof n.metadata.birthdayUserId === 'string') {
        pushOnce(router, {
          pathname: '/(app)/memories/add',
          params: {
            subjectId: n.metadata.birthdayUserId,
            subjectType: 'user',
            targetKeys: `user:${n.metadata.birthdayUserId}`,
            backTo: '/(app)/notifications',
          },
        });
        return;
      }
      const date = typeof n.metadata.date === 'string' ? n.metadata.date : undefined;
      const eventId = typeof n.metadata.eventId === 'string' ? n.metadata.eventId : n.referenceId ?? undefined;
      pushOnce(router, date ? { pathname: '/calendar', params: { date, eventId } } : '/calendar');
    }
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  async function toggleReaction(n: Notification, value: 'up' | 'down') {
    const eventId = getCalendarNotificationEventId(n);
    if (!eventId || reactingNotificationId) return;
    const summary = getCalendarEventReactionSummary(eventId);
    setReactingNotificationId(n.id);
    try {
      await setCalendarEventReaction(n, summary.myReaction === value ? null : value);
    } finally {
      setReactingNotificationId(null);
    }
  }

  return (
    <AppScreen header={topBar} floatingHeaderOnScroll onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} refreshing={refreshing}>

      <View style={styles.titleSpacer} />
      <Text style={styles.title}>Notifications</Text>

      {loading ? (
        <View style={styles.list}>
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
        </View>
      ) : visibleNotifications.length > 0 ? (
        <View style={styles.list}>
          {visibleNotifications.map((n) => {
            const actor = getUserById(n.actorUserId);
            const eventId = getCalendarNotificationEventId(n);
            const showReactions = n.type === 'calendar_event' && !!eventId;
            const reactionSummary = eventId ? getCalendarEventReactionSummary(eventId) : null;
            const reacting = reactingNotificationId === n.id;
            return (
              <Pressable key={n.id} onPress={() => handlePress(n)} style={[styles.row, !n.read && styles.rowUnread]} accessibilityRole="button" accessibilityLabel={`${n.read ? '' : 'Unread: '}${n.message}`}>
                <View style={styles.avatarCircle}>
                  {actor?.avatarPath ? (
                    <Image source={{ uri: actor.avatarPath }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>
                      {(actor?.displayName ?? '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
                    </Text>
                  )}
                </View>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowMessage, !n.read && styles.rowMessageUnread]} numberOfLines={2}>{n.message}</Text>
                  <Text style={styles.rowTime}>{timeAgo(n.createdAt)}</Text>
                  {showReactions && reactionSummary ? (
                    <View style={styles.reactionPanel}>
                      <View style={styles.reactionButtons}>
                        <Pressable
                          onPress={() => toggleReaction(n, 'up')}
                          disabled={reacting}
                          style={[styles.reactionButton, reactionSummary.myReaction === 'up' && styles.reactionButtonActive]}
                          accessibilityRole="button"
                          accessibilityLabel="Thumbs up this event"
                        >
                          <Ionicons name="thumbs-up-outline" size={14} color={reactionSummary.myReaction === 'up' ? colors.white : colors.inkSoft} />
                          <Text style={[styles.reactionButtonText, reactionSummary.myReaction === 'up' && styles.reactionButtonTextActive]}>
                            {reactionSummary.upCount}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => toggleReaction(n, 'down')}
                          disabled={reacting}
                          style={[styles.reactionButton, reactionSummary.myReaction === 'down' && styles.reactionButtonActive]}
                          accessibilityRole="button"
                          accessibilityLabel="Thumbs down this event"
                        >
                          <Ionicons name="thumbs-down-outline" size={14} color={reactionSummary.myReaction === 'down' ? colors.white : colors.inkSoft} />
                          <Text style={[styles.reactionButtonText, reactionSummary.myReaction === 'down' && styles.reactionButtonTextActive]}>
                            {reactionSummary.downCount}
                          </Text>
                        </Pressable>
                      </View>
                      <Text style={styles.reactionCountText}>
                        {reactionSummary.upCount} thumbs up · {reactionSummary.downCount} thumbs down
                      </Text>
                    </View>
                  ) : null}
                </View>
                {!n.read && <View style={styles.unreadDot} />}
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <ThemedIcon name="bell" size={40} color={colors.inkMuted} />
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptySubtitle}>
            Notifications will appear here when friends share memories about you.
          </Text>
        </View>
      )}
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 0 },
    backButton: { paddingVertical: 0 },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    markAllLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent },
    titleSpacer: { height: spacing.lg },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 28) },
    list: { gap: 0 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: colors.line,
    },
    rowUnread: {
      backgroundColor: colors.accent + '0F',
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    avatarCircle: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarInitials: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
    rowContent: { flex: 1, gap: 2 },
    rowMessage: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, lineHeight: 20 },
    rowMessageUnread: { fontFamily: fonts.bodyBold },
    rowTime: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted },
    reactionPanel: { gap: spacing.xs, marginTop: spacing.xs },
    reactionButtons: { flexDirection: 'row', gap: spacing.xs },
    reactionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      backgroundColor: colors.paper,
    },
    reactionButtonActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    reactionButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
    reactionButtonTextActive: { color: colors.white },
    reactionCountText: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted },
    unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
    emptyState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 22) },
    emptySubtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft, textAlign: 'center' },
  });

function getCalendarNotificationEventId(notification: { referenceId: string | null; metadata: { eventId?: unknown } }) {
  return typeof notification.metadata.eventId === 'string' ? notification.metadata.eventId : notification.referenceId;
}

function mergeCalendarEventFallbacks(
  notifications: Notification[],
  events: CalendarEvent[],
  currentUserId: string | null,
  getUserById: (userId: string) => { displayName: string } | undefined,
  syntheticNotificationReadIds: Set<string>,
) {
  if (!currentUserId) return notifications;

  const existingEventIds = new Set(
    notifications
      .filter((notification) => notification.type === 'calendar_event')
      .map(getCalendarNotificationEventId)
      .filter((eventId): eventId is string => Boolean(eventId)),
  );
  const synthetic: Notification[] = [];

  for (const event of events) {
    if (!event.shareId || event.sharedWithUserId !== currentUserId || !event.sharedByUserId) continue;
    if (existingEventIds.has(event.id)) continue;
    const sharer = getUserById(event.sharedByUserId);
    const isBirthdayMoment = event.type === 'birthday' && isEventToday(event);
    const id = `calendar-share-fallback:${event.shareId}`;
    synthetic.push({
      id,
      recipientUserId: currentUserId,
      actorUserId: event.sharedByUserId,
      type: 'calendar_event',
      referenceId: event.id,
      metadata: {
        eventId: event.id,
        date: event.eventDate,
        shareId: event.shareId,
        source: isBirthdayMoment ? 'birthday_moment' : 'calendar_event_shares',
        ownerUserId: event.ownerUserId,
        eventTitle: event.title?.trim() ? event.title.trim() : undefined,
        birthdayUserId: isBirthdayMoment ? event.sharedByUserId : undefined,
      },
      message: isBirthdayMoment
        ? `It's ${sharer?.displayName ?? 'your friend'}'s birthday today. Add a memory to make their wall special.`
        : `${sharer?.displayName ?? 'Someone'} added you to "${event.title || 'an event'}"`,
      read: syntheticNotificationReadIds.has(id),
      createdAt: event.createdAt,
    });
  }

  return [...notifications, ...synthetic].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function isEventToday(event: CalendarEvent) {
  const today = new Date();
  const occurrenceKey = getEventOccurrenceKey(event, today.getFullYear(), today.getMonth());
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return occurrenceKey === todayKey;
}
