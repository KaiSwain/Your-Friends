import { usePathname, useRouter } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { useSocialGraph } from '../social/SocialGraphContext';
import { useCalendar } from '../calendar/CalendarContext';
import { useTheme } from '../theme/ThemeContext';
import type { ColorTokens } from '../theme/themes';
import type { FontSet } from '../../theme/typography';
import { radius, spacing } from '../../theme/tokens';
import { ThemedIcon } from '../../components/ThemedIcon';
import type { Notification } from '../../types/domain';
import { pushOnce } from '../../lib/navigationGuard';
import { subscribeMemoryDevelopedNotifications } from '../../lib/memoryDevelopNotifications';

interface InAppNotificationContextValue {
  show: (notification: Notification) => void;
  showLocal: (message: string, options?: { referenceId?: string | null; metadata?: Notification['metadata'] }) => void;
}

const InAppNotificationContext = createContext<InAppNotificationContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;
const ENTER_MS = 180;
const EXIT_MS = 180;
const SWIPE_DISMISS_THRESHOLD = -40;

export function InAppNotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const { notifications, friendRequests, contacts, getUserById, markNotificationRead } = useSocialGraph();
  const { events } = useCalendar();
  const { colors, fonts } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [queue, setQueue] = useState<Notification[]>([]);
  const [active, setActive] = useState<Notification | null>(null);

  // Seed seen ids so historical notifications don't toast on mount.
  const seenIdsRef = useRef<Set<string> | null>(null);
  const seededRef = useRef(false);
  const seenFriendRequestEventsRef = useRef<Set<string> | null>(null);
  const friendRequestsSeededRef = useRef(false);
  const seenCalendarShareEventsRef = useRef<Set<string> | null>(null);
  const calendarSharesSeededRef = useRef(false);
  const seededUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = currentUser?.id ?? null;
    if (seededUserIdRef.current === userId) return;
    seededUserIdRef.current = userId;
    seenIdsRef.current = null;
    seededRef.current = false;
    seenFriendRequestEventsRef.current = null;
    friendRequestsSeededRef.current = false;
    seenCalendarShareEventsRef.current = null;
    calendarSharesSeededRef.current = false;
    setQueue([]);
    setActive(null);
  }, [currentUser?.id]);

  useEffect(() => {
    const unsubscribe = subscribeMemoryDevelopedNotifications(({ postId, message }) => {
      setQueue((prev) => [
        ...prev,
        {
          id: `memory-developed:${postId}:${Date.now()}`,
          recipientUserId: currentUser?.id ?? '',
          actorUserId: currentUser?.id ?? '',
          type: 'local',
          referenceId: postId,
          message,
          metadata: { source: 'memory_developed', wallPostId: postId },
          read: false,
          createdAt: new Date().toISOString(),
        },
      ]);
    });
    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (seededRef.current) return;
    // Wait until the first real notifications snapshot settles before seeding
    // so we don't miss brand-new notifications that arrive on the very first
    // render. An empty array still counts as a valid seed.
    seenIdsRef.current = new Set(notifications.map((n) => n.id));
    seededRef.current = true;
  }, [currentUser?.id, notifications]);

  // Diff new unread notifications against the seen set and enqueue toasts.
  useEffect(() => {
    if (!seededRef.current || !seenIdsRef.current) return;
    const seen = seenIdsRef.current;
    const fresh: Notification[] = [];
    for (const n of notifications) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      if (n.read) continue;
      if (currentUser?.id && n.actorUserId === currentUser.id) continue;
      fresh.push(n);
    }
    if (fresh.length === 0) return;
    // Newest first
    fresh.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setQueue((prev) => [...prev, ...fresh]);
  }, [notifications, currentUser?.id]);

  // Friend requests should toast even if the separate notifications table
  // insert is blocked by RLS. The Add Friend page remains the source of truth.
  useEffect(() => {
    if (!currentUser?.id) return;
    if (friendRequestsSeededRef.current) return;
    seenFriendRequestEventsRef.current = new Set(friendRequests.flatMap((request) => {
      const keys: string[] = [];
      if (request.recipientUserId === currentUser.id && request.status === 'pending') {
        keys.push(`incoming:${request.id}:pending`);
      }
      if (request.requesterUserId === currentUser.id && request.status === 'accepted') {
        keys.push(`outgoing:${request.id}:accepted`);
      }
      return keys;
    }));
    friendRequestsSeededRef.current = true;
  }, [currentUser?.id, friendRequests]);

  useEffect(() => {
    if (!currentUser?.id || !friendRequestsSeededRef.current || !seenFriendRequestEventsRef.current) return;
    const seen = seenFriendRequestEventsRef.current;
    const fresh: Notification[] = [];
    for (const request of friendRequests) {
      if (request.recipientUserId === currentUser.id && request.status === 'pending') {
        if (hasFriendRequestNotification(notifications, request.id, 'requested')) continue;
        const key = `incoming:${request.id}:pending`;
        if (seen.has(key)) continue;
        seen.add(key);
        const requester = getUserById(request.requesterUserId);
        fresh.push({
          id: `friend-request:${request.id}`,
          recipientUserId: currentUser.id,
          actorUserId: request.requesterUserId,
          type: 'friend_request',
          referenceId: request.id,
          metadata: { action: 'requested', friendRequestId: request.id },
          message: `${requester?.displayName ?? 'Someone'} sent you a friend request`,
          read: true,
          createdAt: request.createdAt,
        });
      }

      if (request.requesterUserId === currentUser.id && request.status === 'accepted') {
        if (hasFriendRequestNotification(notifications, request.id, 'accepted')) continue;
        const key = `outgoing:${request.id}:accepted`;
        if (seen.has(key)) continue;
        seen.add(key);
        const recipient = getUserById(request.recipientUserId);
        fresh.push({
          id: `friend-request-accepted:${request.id}`,
          recipientUserId: currentUser.id,
          actorUserId: request.recipientUserId,
          type: 'friend_request',
          referenceId: request.id,
          metadata: { action: 'accepted', friendRequestId: request.id },
          message: `${recipient?.displayName ?? 'Someone'} accepted your friend request`,
          read: true,
          createdAt: request.respondedAt ?? request.createdAt,
        });
      }
    }
    if (fresh.length === 0) return;
    fresh.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setQueue((prev) => [...prev, ...fresh]);
  }, [currentUser?.id, friendRequests, getUserById, notifications]);

  // Shared calendar events should toast from the calendar share itself, even if
  // the persisted notification is delayed or blocked.
  useEffect(() => {
    if (!currentUser?.id) return;
    if (calendarSharesSeededRef.current) return;
    seenCalendarShareEventsRef.current = new Set(
      events
        .filter((event) => event.shareId && event.sharedWithUserId === currentUser.id)
        .map((event) => `calendar-share:${event.shareId}:${event.id}`),
    );
    calendarSharesSeededRef.current = true;
  }, [currentUser?.id, events]);

  useEffect(() => {
    if (!currentUser?.id || !calendarSharesSeededRef.current || !seenCalendarShareEventsRef.current) return;
    const seen = seenCalendarShareEventsRef.current;
    const fresh: Notification[] = [];
    for (const event of events) {
      if (!event.shareId || event.sharedWithUserId !== currentUser.id || !event.sharedByUserId) continue;
      const key = `calendar-share:${event.shareId}:${event.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sharer = getUserById(event.sharedByUserId);
      fresh.push({
        id: `calendar-share:${event.shareId}`,
        recipientUserId: currentUser.id,
        actorUserId: event.sharedByUserId,
        type: 'calendar_event',
        referenceId: event.id,
        metadata: {
          eventId: event.id,
          date: event.eventDate,
          shareId: event.shareId,
          source: 'calendar_event_shares',
          ownerUserId: event.ownerUserId,
          eventTitle: event.title?.trim() ? event.title.trim() : undefined,
        },
        message: `${sharer?.displayName ?? 'Someone'} added you to "${event.title || 'an event'}"`,
        read: true,
        createdAt: event.createdAt,
      });
    }
    if (fresh.length === 0) return;
    fresh.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setQueue((prev) => [...prev, ...fresh]);
  }, [currentUser?.id, events, getUserById]);

  // Animation values for the active toast.
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  const hideActive = useCallback(
    (onDone?: () => void) => {
      clearDismissTimer();
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: EXIT_MS, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: EXIT_MS, useNativeDriver: true }),
      ]).start(() => {
        setActive(null);
        onDone?.();
      });
    },
    [clearDismissTimer, opacity, translateY],
  );

  // Promote next queued toast to active when nothing is showing.
  useEffect(() => {
    if (active) return;
    if (queue.length === 0) return;
    // Don't show toasts while user is already viewing the notifications list.
    if (pathname?.startsWith('/notifications') || pathname?.endsWith('/notifications')) {
      // Drain the queue silently — user will see them in the list.
      setQueue([]);
      return;
    }
    const [next, ...rest] = queue;
    setQueue(rest);
    setActive(next);
  }, [active, queue, pathname]);

  // When a new active toast is set, animate in + schedule auto-dismiss.
  useEffect(() => {
    if (!active) return;
    translateY.setValue(-120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: ENTER_MS, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: ENTER_MS, useNativeDriver: true }),
    ]).start();
    dismissTimerRef.current = setTimeout(() => hideActive(), AUTO_DISMISS_MS);
    return () => clearDismissTimer();
  }, [active, clearDismissTimer, hideActive, opacity, translateY]);

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  const handlePress = useCallback(() => {
    if (!active) return;
    const n = active;
    hideActive(() => {
      if (!n.read) {
        void markNotificationRead(n.id);
      }
      if (n.type === 'wall_post' && n.actorUserId) {
        pushOnce(router, `/(app)/wall/${n.actorUserId}`);
      } else if ((n.type === 'friend_request' || n.type === 'contact_update') && n.actorUserId) {
        if (n.type === 'friend_request' && n.metadata.action === 'requested') {
          pushOnce(router, '/(app)/friends/add');
        } else {
          const linkedContactId = contacts.find((contact) => contact.linkedUserId === n.actorUserId)?.id;
          pushOnce(router, linkedContactId ? `/(app)/profiles/contact/${linkedContactId}` : `/(app)/profiles/user/${n.actorUserId}`);
        }
      } else if (n.type === 'calendar_event' || n.type === 'calendar_event_reaction') {
        const date = typeof n.metadata.date === 'string' ? n.metadata.date : undefined;
        const eventId = typeof n.metadata.eventId === 'string' ? n.metadata.eventId : n.referenceId ?? undefined;
        pushOnce(router, date ? { pathname: '/calendar', params: { date, eventId } } : '/calendar');
      }
    });
  }, [active, contacts, hideActive, markNotificationRead, router]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          clearDismissTimer();
        },
        onPanResponderMove: (_e, g) => {
          if (g.dy < 0) {
            translateY.setValue(g.dy);
            opacity.setValue(Math.max(0, 1 + g.dy / 80));
          }
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy < SWIPE_DISMISS_THRESHOLD) {
            hideActive();
          } else {
            Animated.parallel([
              Animated.timing(translateY, { toValue: 0, duration: 120, useNativeDriver: true }),
              Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
            ]).start();
            dismissTimerRef.current = setTimeout(() => hideActive(), AUTO_DISMISS_MS);
          }
        },
      }),
    [clearDismissTimer, hideActive, opacity, translateY],
  );

  const show = useCallback((n: Notification) => {
    setQueue((prev) => [...prev, n]);
  }, []);

  const showLocal = useCallback(
    (message: string, options?: { referenceId?: string | null; metadata?: Notification['metadata'] }) => {
      if (!currentUser) return;
      const now = new Date().toISOString();
      show({
        id: `local:${now}:${Math.random().toString(36).slice(2)}`,
        recipientUserId: currentUser.id,
        actorUserId: currentUser.id,
        type: 'local',
        referenceId: options?.referenceId ?? null,
        metadata: options?.metadata ?? {},
        message,
        read: true,
        createdAt: now,
      });
    },
    [currentUser, show],
  );

  const value = useMemo<InAppNotificationContextValue>(() => ({ show, showLocal }), [show, showLocal]);

  const actor = active ? getUserById(active.actorUserId) : undefined;
  const activeCanOpen = !!active && active.type !== 'local';
  const initials = (actor?.displayName ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <InAppNotificationContext.Provider value={value}>
      {children}
      {active ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.hostContainer,
            { top: insets.top + spacing.xs, opacity, transform: [{ translateY }] },
          ]}
        >
          <Pressable
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel={`Notification: ${active.message}.${activeCanOpen ? ' Tap to view.' : ''}`}
            style={styles.toastShadow}
            {...panResponder.panHandlers}
          >
            <View style={styles.toastCard}>
              <View style={styles.avatarCircle}>
                {actor?.avatarPath ? (
                  <Image source={{ uri: actor.avatarPath }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials}</Text>
                )}
              </View>
              <View style={styles.textCol}>
                <Text style={styles.message} numberOfLines={2}>
                  {active.message}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {activeCanOpen ? 'Tap to view' : 'Just now'}
                </Text>
              </View>
              <ThemedIcon name="bell" size={18} color={colors.accent} />
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </InAppNotificationContext.Provider>
  );
}

export function useInAppNotification(): InAppNotificationContextValue {
  const ctx = useContext(InAppNotificationContext);
  if (!ctx) throw new Error('useInAppNotification must be used inside InAppNotificationProvider');
  return ctx;
}

function hasFriendRequestNotification(notifications: Notification[], requestId: string, action: 'requested' | 'accepted') {
  return notifications.some((notification) => {
    if (notification.type !== 'friend_request') return false;
    const notificationRequestId = typeof notification.metadata.friendRequestId === 'string'
      ? notification.metadata.friendRequestId
      : notification.referenceId;
    return notificationRequestId === requestId && notification.metadata.action === action;
  });
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    hostContainer: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      zIndex: 9999,
      elevation: 9999,
    },
    toastShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
      borderRadius: radius.md,
    },
    toastCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    avatarCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarInitials: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
    textCol: { flex: 1, gap: 2 },
    message: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, lineHeight: 19 },
    subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted },
  });
