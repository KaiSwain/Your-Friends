import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../src/components/AppScreen';
import { ListRowSkeleton } from '../../src/components/Skeleton';
import { ThemedIcon } from '../../src/components/ThemedIcon';
import { useSocialGraph } from '../../src/features/social/SocialGraphContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { loading, notifications, contacts, getUserById, markNotificationRead, markAllNotificationsRead, refresh } = useSocialGraph();
  const [refreshing, setRefreshing] = useState(false);

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} style={[styles.backButton, { flexDirection: 'row', alignItems: 'center', gap: 2 }]} accessibilityRole="button" accessibilityLabel="Go back">
        <ThemedIcon name="back" size={16} color={colors.inkSoft} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
      {notifications.some((n) => !n.read) && (
        <Pressable onPress={markAllNotificationsRead} accessibilityRole="button" accessibilityLabel="Mark all notifications as read">
          <Text style={styles.markAllLabel}>Mark all read</Text>
        </Pressable>
      )}
    </View>
  );

  function handlePress(n: (typeof notifications)[0]) {
    if (!n.read) markNotificationRead(n.id);
    if (n.type === 'wall_post' && n.actorUserId) {
      router.push(`/(app)/wall/${n.actorUserId}`);
    } else if (n.type === 'friend_request' && n.actorUserId) {
      const linkedContactId = contacts.find((contact) => contact.linkedUserId === n.actorUserId)?.id;
      router.push(linkedContactId ? `/(app)/profiles/contact/${linkedContactId}` : `/(app)/profiles/user/${n.actorUserId}`);
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
      ) : notifications.length > 0 ? (
        <View style={styles.list}>
          {notifications.map((n) => {
            const actor = getUserById(n.actorUserId);
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
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink },
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
    unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
    emptyState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
    emptySubtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft, textAlign: 'center' },
  });
