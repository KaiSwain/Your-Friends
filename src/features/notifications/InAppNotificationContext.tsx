import { usePathname, useRouter } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { useSocialGraph } from '../social/SocialGraphContext';
import { useTheme } from '../theme/ThemeContext';
import type { ColorTokens } from '../theme/themes';
import type { FontSet } from '../../theme/typography';
import { radius, spacing } from '../../theme/tokens';
import { ThemedIcon } from '../../components/ThemedIcon';
import type { Notification } from '../../types/domain';

interface InAppNotificationContextValue {
  show: (notification: Notification) => void;
}

const InAppNotificationContext = createContext<InAppNotificationContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;
const ENTER_MS = 180;
const EXIT_MS = 180;
const SWIPE_DISMISS_THRESHOLD = -40;

export function InAppNotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const { notifications, contacts, getUserById, markNotificationRead } = useSocialGraph();
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

  useEffect(() => {
    if (seededRef.current) return;
    // Wait until the first real notifications snapshot settles before seeding
    // so we don't miss brand-new notifications that arrive on the very first
    // render. An empty array still counts as a valid seed.
    seenIdsRef.current = new Set(notifications.map((n) => n.id));
    seededRef.current = true;
  }, [notifications]);

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
        router.push(`/(app)/wall/${n.actorUserId}`);
      } else if (n.type === 'friend_request' && n.actorUserId) {
        const linkedContactId = contacts.find((contact) => contact.linkedUserId === n.actorUserId)?.id;
        router.push(linkedContactId ? `/(app)/profiles/contact/${linkedContactId}` : `/(app)/profiles/user/${n.actorUserId}`);
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

  const value = useMemo<InAppNotificationContextValue>(() => ({ show }), [show]);

  const actor = active ? getUserById(active.actorUserId) : undefined;
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
            accessibilityLabel={`Notification: ${active.message}. Tap to view.`}
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
                  Tap to view
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
