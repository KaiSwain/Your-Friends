import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreen } from '../../../src/components/AppScreen';
import { DrawerMenu } from '../../../src/components/DrawerMenu';
import { FadeInView } from '../../../src/components/FadeInView';
import { PolaroidCarousel } from '../../../src/components/PolaroidCarousel';
import { ThemedIcon } from '../../../src/components/ThemedIcon';

import { FriendsListSkeleton } from '../../../src/components/Skeleton';
import { WallPostCard } from '../../../src/components/WallPostCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { getCureProgress, CURE_DURATION_MS } from '../../../src/lib/polaroidCure';
import { supabase } from '../../../src/lib/supabase';
import type { FontSet } from '../../../src/theme/typography';
import { radius, spacing } from '../../../src/theme/tokens';

export default function FriendsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();
  const { loading, wallPosts, getPeopleListForUser, getUserById, unreadCount, togglePin, notifications, refresh } = useSocialGraph();
  const [refreshing, setRefreshing] = useState(false);
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFloatingTopControls, setShowFloatingTopControls] = useState(true);
  const [showFloatingAddFriend, setShowFloatingAddFriend] = useState(true);
  const floatingTopAnim = useRef(new Animated.Value(1)).current;
  const floatingBottomAnim = useRef(new Animated.Value(1)).current;
  const lastScrollOffsetRef = useRef(0);
  const floatingTopVisibleRef = useRef(true);
  const floatingBottomVisibleRef = useRef(true);

  // ── Developing photos (still curing) ────────────────────────────────
  const [now, setNow] = useState(Date.now());
  const developingPosts = useMemo(
    () => (wallPosts ?? []).filter((p) => p.imageUri && getCureProgress(p.createdAt, now) < 1),
    [wallPosts, now],
  );
  useEffect(() => {
    if (developingPosts.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(id);
  }, [developingPosts.length]);

  // ── Throwback buckets ────────────────────────────────────────────────
  const throwbackBuckets = useMemo(() => {
    const posts = wallPosts ?? [];
    const today = new Date();

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    const yesterdayPosts = posts.filter((p) => sameDay(new Date(p.createdAt), yesterday));
    const weekPosts = posts.filter((p) => sameDay(new Date(p.createdAt), oneWeekAgo));
    const monthPosts = posts.filter((p) => sameDay(new Date(p.createdAt), oneMonthAgo));
    const yearPosts = posts.filter((p) => {
      const dt = new Date(p.createdAt);
      return dt.getMonth() === oneYearAgo.getMonth() && dt.getDate() === oneYearAgo.getDate() && dt.getFullYear() <= oneYearAgo.getFullYear();
    });

    return [
      { label: 'Yesterday', posts: yesterdayPosts },
      { label: '1 Week Ago', posts: weekPosts },
      { label: '1 Month Ago', posts: monthPosts },
      { label: '1 Year Ago', posts: yearPosts },
    ].filter((b) => b.posts.length > 0);
  }, [wallPosts]);

  // ── Throwback notifications (1 month & 1 year, once per day) ────────
  const sentThrowbackRef = useRef(false);
  useEffect(() => {
    if (!currentUser || sentThrowbackRef.current || loading) return;
    const monthBucket = throwbackBuckets.find((b) => b.label === '1 Month Ago');
    const yearBucket = throwbackBuckets.find((b) => b.label === '1 Year Ago');
    if (!monthBucket && !yearBucket) return;

    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `throwback_notified_${currentUser.id}_${todayKey}`;

    (async () => {
      const already = await AsyncStorage.getItem(storageKey);
      if (already) { sentThrowbackRef.current = true; return; }
      sentThrowbackRef.current = true;

      const inserts: { recipient_user_id: string; actor_user_id: string; type: string; reference_id: string | null; message: string }[] = [];

      if (monthBucket) {
        inserts.push({
          recipient_user_id: currentUser.id,
          actor_user_id: currentUser.id,
          type: 'wall_post',
          reference_id: monthBucket.posts[0].id,
          message: `You have ${monthBucket.posts.length} ${monthBucket.posts.length === 1 ? 'memory' : 'memories'} from 1 month ago`,
        });
      }
      if (yearBucket) {
        inserts.push({
          recipient_user_id: currentUser.id,
          actor_user_id: currentUser.id,
          type: 'wall_post',
          reference_id: yearBucket.posts[0].id,
          message: `You have ${yearBucket.posts.length} ${yearBucket.posts.length === 1 ? 'memory' : 'memories'} from 1 year ago`,
        });
      }

      if (inserts.length > 0) {
        await supabase.from('notifications').insert(inserts);
        await AsyncStorage.setItem(storageKey, '1');
        refresh();
      }
    })();
  }, [currentUser, throwbackBuckets, loading]);

  const allPeople = currentUser ? getPeopleListForUser(currentUser.id) : [];

  const query = searchQuery.trim().toLowerCase();
  const people = query
    ? allPeople.filter((p) => p.title.toLowerCase().includes(query))
    : allPeople;
  const activePerson = people[activeIndex] ?? people[0];

  const openNoteShortcut = useCallback(() => {
    if (!activePerson) return;
    router.push({
      pathname: '/(app)/memories/add',
      params: { subjectId: activePerson.id, subjectType: activePerson.entityType, backTo: '/(app)/friends' },
    });
  }, [activePerson, router]);

  const openPolaroidShortcut = useCallback(() => {
    if (!activePerson) return;
    router.push({
      pathname: '/(app)/camera',
      params: {
        subjectId: activePerson.id,
        subjectType: activePerson.entityType,
        returnTo: '/(app)/memories/add',
        backTo: '/(app)/friends',
      },
    });
  }, [activePerson, router]);

  const setFloatingTopVisible = useCallback((visible: boolean) => {
    if (floatingTopVisibleRef.current === visible) return;
    floatingTopVisibleRef.current = visible;
    setShowFloatingTopControls(visible);
    Animated.timing(floatingTopAnim, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [floatingTopAnim]);

  const setFloatingBottomVisible = useCallback((visible: boolean) => {
    if (floatingBottomVisibleRef.current === visible) return;
    floatingBottomVisibleRef.current = visible;
    setShowFloatingAddFriend(visible);
    Animated.timing(floatingBottomAnim, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [floatingBottomAnim]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = offsetY - lastScrollOffsetRef.current;
    lastScrollOffsetRef.current = offsetY;

    if (Math.abs(delta) < 8) return;

    if (offsetY <= 24) {
      setFloatingTopVisible(true);
      setFloatingBottomVisible(true);
      return;
    }

    if (delta > 0) {
      setFloatingTopVisible(false);
      setFloatingBottomVisible(false);
      return;
    }

    setFloatingTopVisible(true);
    setFloatingBottomVisible(true);
  }, [setFloatingBottomVisible, setFloatingTopVisible]);

  const floatingTopStyle = useMemo(
    () => ({
      opacity: floatingTopAnim,
      transform: [{ translateY: floatingTopAnim.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }],
    }),
    [floatingTopAnim],
  );

  const floatingBottomStyle = useMemo(
    () => ({
      opacity: floatingBottomAnim,
      transform: [{ translateY: floatingBottomAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
    }),
    [floatingBottomAnim],
  );

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  return (
    <>
    <AppScreen
      contentContainerStyle={styles.screenContent}
      onScroll={handleScroll}
      onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }}
      refreshing={refreshing}
    >
      <View style={styles.headerSpacer} />

      <View style={styles.heroCopy}>
        <Text style={styles.title}>Your Friends</Text>
        <Text style={styles.subtitle}>Swipe through the people you keep close.</Text>
      </View>

      <View style={styles.searchBar}>
        <ThemedIcon name="search" size={18} color={colors.inkMuted} />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Search for friends..."
          placeholderTextColor={colors.inkMuted}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setActiveIndex(0);
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <FriendsListSkeleton />
      ) : people.length > 0 ? (
        <>
        <View style={styles.carouselBlock}>
          <PolaroidCarousel
            key={query ? 'search' : 'loop'}
            activeIndex={activeIndex}
            items={people}
            loop={!query}
            onIndexChange={setActiveIndex}
            onPressItem={(item) =>
              router.push(
                item.entityType === 'user'
                  ? `/(app)/profiles/user/${item.id}`
                  : `/(app)/profiles/contact/${item.id}`,
              )
            }
            onLongPressItem={(item) => {
              if (item.entityType === 'contact') {
                Alert.alert(
                  item.pinned ? 'Unpin from #1?' : 'Pin to #1?',
                  item.pinned ? `${item.title} will no longer be first.` : `${item.title} will appear first in your carousel.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: item.pinned ? 'Unpin' : 'Pin', onPress: () => togglePin(item.id) },
                  ],
                );
              }
            }}
            getUnreadCount={(item) => {
              const userId = item.linkedUserId ?? (item.entityType === 'user' ? item.id : null);
              if (!userId) return 0;
              return notifications.filter((n) => !n.read && n.actorUserId === userId).length;
            }}
          />

          <View style={styles.activeMeta}>
            <Text style={styles.activeName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{activePerson?.title}</Text>
            <Text style={styles.activeDescription}>{activePerson?.subtitle}</Text>
          </View>

          <View style={styles.shortcutRow}>
            <Pressable
              onPress={openNoteShortcut}
              style={styles.shortcutButton}
              accessibilityRole="button"
              accessibilityLabel={activePerson ? `Add note about ${activePerson.title}` : 'Add note'}
            >
              <Ionicons name="create" size={34} color={colors.ink} />
            </Pressable>

            <Pressable
              onPress={openPolaroidShortcut}
              style={[styles.shortcutButton, styles.shortcutButtonPrimary]}
              accessibilityRole="button"
              accessibilityLabel={activePerson ? `Add polaroid about ${activePerson.title}` : 'Add polaroid'}
            >
              <Ionicons name="camera" size={36} color={colors.white} />
            </Pressable>
          </View>
        </View>

        {/* ── Developing (Darkroom) ── */}
        <FadeInView delay={100}>
          <View style={styles.feedSection}>
            <View style={styles.feedHeader}>
              <ThemedIcon name="hourglass" size={16} color={colors.accent} />
              <Text style={styles.feedTitle}>Developing…</Text>
            </View>
            {developingPosts.length > 0 ? (
              <>
                <Text style={styles.feedSubtitle}>Your photos are still coming to life</Text>
                {developingPosts.map((post) => (
                  <WallPostCard
                    key={post.id}
                    authorName={getUserById(post.authorUserId)?.displayName ?? 'You'}
                    post={post}
                    cardColor={post.cardColor}
                  />
                ))}
              </>
            ) : (
              <Text style={styles.feedSubtitle}>No photos in the darkroom right now</Text>
            )}
          </View>
        </FadeInView>

        {/* ── Throwbacks ── */}
        <FadeInView delay={200}>
          <View style={styles.feedSection}>
            <View style={styles.feedHeader}>
              <ThemedIcon name="clock" size={16} color={colors.accent} />
              <Text style={styles.feedTitle}>On This Day</Text>
            </View>
            {throwbackBuckets.length > 0 ? (
              throwbackBuckets.map((bucket) => (
                <View key={bucket.label} style={styles.throwbackBucket}>
                  <Text style={styles.throwbackLabel}>{bucket.label}</Text>
                  {bucket.posts.map((post) => (
                    <WallPostCard
                      key={post.id}
                      authorName={getUserById(post.authorUserId)?.displayName ?? 'You'}
                      post={post}
                      cardColor={post.cardColor}
                      shareable
                    />
                  ))}
                </View>
              ))
            ) : (
              <Text style={styles.feedSubtitle}>No throwbacks for today — keep making memories!</Text>
            )}
          </View>
        </FadeInView>

      </>
      ) : (
        <View style={styles.emptyState}>
          <ThemedIcon name="users" size={48} color={colors.inkMuted} />
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptySubtitle}>Add your first friend by their code, or save someone as a private contact.</Text>
        </View>
      )}

    </AppScreen>

    <View pointerEvents="box-none" style={styles.floatingLayer}>
      <Animated.View
        pointerEvents={showFloatingTopControls ? 'auto' : 'none'}
        style={[styles.floatingTopRow, { top: insets.top + spacing.sm }, floatingTopStyle]}
      >
        <Pressable onPress={() => setDrawerOpen(true)} style={styles.floatingIconButton} accessibilityRole="button" accessibilityLabel="Open menu">
          <ThemedIcon name="menu" size={22} color={colors.inkSoft} />
        </Pressable>

        <Pressable onPress={() => router.push('/(app)/notifications')} style={[styles.floatingIconButton, styles.bellWrapper]} accessibilityRole="button" accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}>
          <ThemedIcon name="bell" size={20} color={colors.inkSoft} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>

      <Animated.View
        pointerEvents={showFloatingAddFriend ? 'auto' : 'none'}
        style={[styles.floatingBottomRow, { bottom: Math.max(insets.bottom, spacing.sm) + spacing.sm }, floatingBottomStyle]}
      >
        <Pressable onPress={() => router.push('/(app)/friends/add')} style={[styles.addButton, styles.floatingAddButton]} accessibilityRole="button" accessibilityLabel="Add friend">
          <Text style={styles.addButtonLabel}>+ Add Friend</Text>
        </Pressable>
      </Animated.View>
    </View>

    <DrawerMenu visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    screenContent: { paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.lg },
    headerSpacer: { height: 44 },
    headerLink: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSoft },
    bellWrapper: { position: 'relative' as const },
    badge: {
      position: 'absolute' as const, top: -4, right: -6,
      minWidth: 16, height: 16, borderRadius: 8,
      backgroundColor: colors.error ?? '#EF4444',
      alignItems: 'center' as const, justifyContent: 'center' as const,
      paddingHorizontal: 4,
    },
    badgeText: { fontFamily: fonts.bodyBold, fontSize: 9, color: '#fff' },
    heroCopy: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
    title: { fontFamily: fonts.heading, fontSize: 34, color: colors.ink, textAlign: 'center' },
    subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft, textAlign: 'center' },
    carouselBlock: { alignItems: 'center', gap: spacing.md },
    emptyState: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, textAlign: 'center' },
    emptySubtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft, textAlign: 'center' },

    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.paperMuted,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginHorizontal: spacing.lg,
    },
    searchBarIcon: { fontSize: 14 },
    searchBarInput: { fontFamily: fonts.body, fontSize: 13, color: colors.ink, flex: 1, padding: 0 },
    activeMeta: { alignSelf: 'stretch', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
    activeName: { fontFamily: fonts.heading, fontSize: 36, color: colors.ink, textAlign: 'center', width: '100%' },
    activeDescription: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft, textAlign: 'center' },
    shortcutRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.lg,
      marginTop: spacing.sm,
    },
    shortcutButton: {
      width: 94,
      height: 94,
      borderRadius: 47,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      elevation: 8,
    },
    shortcutButtonPrimary: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },

    footerRow: { alignItems: 'center' },
    floatingLayer: {
      ...StyleSheet.absoluteFillObject,
    },
    floatingTopRow: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    floatingIconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    floatingBottomRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    floatingAddButton: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 10,
    },
    feedSection: { gap: spacing.sm },
    feedHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs },
    feedTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink },
    feedSubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
    throwbackBucket: { gap: spacing.sm },
    throwbackLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
    addButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
    },
    addButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  });
