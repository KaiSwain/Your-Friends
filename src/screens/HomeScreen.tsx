import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, NativeScrollEvent, NativeSyntheticEvent, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppScreen } from '../../src/components/AppScreen';
import { BirthdayMomentCard } from '../../src/components/BirthdayMomentCard';
import { FadeInView } from '../../src/components/FadeInView';
import { setLivePolaroidScopeEnabled, stopAllLivePolaroids } from '../../src/components/LivePolaroidLayer';
import { PolaroidCarousel } from '../../src/components/PolaroidCarousel';
import { ThemedIcon } from '../../src/components/ThemedIcon';

import { FriendsListSkeleton } from '../../src/components/Skeleton';
import { WallPostCard } from '../../src/components/WallPostCard';
import { useAuth } from '../../src/features/auth/AuthContext';
import { usePremium } from '../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../src/features/social/SocialGraphContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import { useCalendar } from '../../src/features/calendar/CalendarContext';
import { getBirthdayMomentsForDate } from '../../src/features/birthday/birthdayMoments';
import type { ColorTokens } from '../../src/features/theme/themes';
import { createFriendInviteLink } from '../../src/lib/friendCode';
import { showGalleryPaywall } from '../../src/lib/premiumGates';
import { showPhotoSourceSheet } from '../../src/lib/photoSourceSheet';
import { memoryImagePickerOptions } from '../../src/lib/imagePickerPresets';
import { getCureProgress } from '../../src/lib/polaroidCure';
import {
  getCachedPolaroidShakeBoost,
  loadPolaroidShakeBoost,
  subscribePolaroidShakeBoost,
} from '../../src/lib/polaroidShakeBoost';
import { pushOnce } from '../../src/lib/navigationGuard';
import { createNotifications } from '../../src/lib/notifications';
import { stopAllSongPreviews } from '../../src/lib/songPreviewPlayback';
import { getWallPostMemoryDate } from '../../src/lib/memoryDate';
import { useSyntheticNotificationReads } from '../../src/hooks/useSyntheticNotificationReads';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';
import type { PeopleListItem } from '../../src/types/domain';

const HOME_LIVE_POLAROID_SCOPE = 'home';

export default function FriendsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();
  const { loading, wallPosts, getPeopleListForUser, getUserById, unreadCount, togglePin, notifications, refresh, getPendingFriendLinks } = useSocialGraph();
  const { events } = useCalendar();
  const { isPremium, isUserPremium, referrerCode } = usePremium();
  const [refreshing, setRefreshing] = useState(false);
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFloatingTopControls, setShowFloatingTopControls] = useState(true);
  const [showFloatingAddFriend, setShowFloatingAddFriend] = useState(true);
  const floatingTopAnim = useRef(new Animated.Value(1)).current;
  const floatingBottomAnim = useRef(new Animated.Value(1)).current;
  const lastScrollOffsetRef = useRef(0);
  const floatingTopVisibleRef = useRef(true);
  const floatingBottomVisibleRef = useRef(true);

  useFocusEffect(useCallback(() => {
    setLivePolaroidScopeEnabled(HOME_LIVE_POLAROID_SCOPE, true);
    return () => {
      setLivePolaroidScopeEnabled(HOME_LIVE_POLAROID_SCOPE, false);
      stopAllSongPreviews();
    };
  }, []));

  // ── Developing photos (still curing) ────────────────────────────────
  const [now, setNow] = useState(Date.now());
  const [shakeBoostsByPostId, setShakeBoostsByPostId] = useState<Record<string, number>>({});
  const imagePostIdsKey = useMemo(
    () => (wallPosts ?? []).filter((p) => p.imageUri).map((p) => p.id).sort().join('|'),
    [wallPosts],
  );
  const showReferralBadge = Boolean(currentUser?.id && !referrerCode);
  const { readIds: syntheticNotificationReadIds } = useSyntheticNotificationReads(currentUser?.id ?? null);
  const calendarFallbackUnreadCount = useMemo(() => {
    if (!currentUser?.id) return 0;
    const existingEventIds = new Set(
      notifications
        .filter((notification) => notification.type === 'calendar_event')
        .map((notification) => typeof notification.metadata.eventId === 'string' ? notification.metadata.eventId : notification.referenceId)
        .filter((eventId): eventId is string => Boolean(eventId)),
    );
    return events.filter((event) => {
      if (!event.shareId || event.sharedWithUserId !== currentUser.id || !event.sharedByUserId) return false;
      if (existingEventIds.has(event.id)) return false;
      return !syntheticNotificationReadIds.has(`calendar-share-fallback:${event.shareId}`);
    }).length;
  }, [currentUser?.id, events, notifications, syntheticNotificationReadIds]);
  const notificationBadgeCount = unreadCount + calendarFallbackUnreadCount;

  useEffect(() => {
    const imagePostIds = imagePostIdsKey ? imagePostIdsKey.split('|') : [];
    if (imagePostIds.length === 0) {
      setShakeBoostsByPostId({});
      return;
    }

    setShakeBoostsByPostId((prev) => {
      const next: Record<string, number> = {};
      for (const id of imagePostIds) next[id] = prev[id] ?? getCachedPolaroidShakeBoost(id);
      return next;
    });

    let active = true;
    const unsubscribes = imagePostIds.map((id) =>
      subscribePolaroidShakeBoost(id, (boostMs) => {
        if (!active) return;
        setShakeBoostsByPostId((prev) => ({ ...prev, [id]: boostMs }));
        setNow(Date.now());
      }),
    );

    imagePostIds.forEach((id) => {
      loadPolaroidShakeBoost(id)
        .then((boostMs) => {
          if (!active) return;
          setShakeBoostsByPostId((prev) => ({ ...prev, [id]: boostMs }));
          setNow(Date.now());
        })
        .catch(() => undefined);
    });

    return () => {
      active = false;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [imagePostIdsKey]);

  const developingPosts = useMemo(
    () =>
      (wallPosts ?? []).filter((p) => {
        if (!p.imageUri) return false;
        const shakeBoostMs = shakeBoostsByPostId[p.id] ?? getCachedPolaroidShakeBoost(p.id);
        return getCureProgress(p.createdAt, now + shakeBoostMs) < 1;
      }),
    [wallPosts, now, shakeBoostsByPostId],
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

    const yesterdayPosts = posts.filter((p) => sameDay(getWallPostMemoryDate(p), yesterday));
    const weekPosts = posts.filter((p) => sameDay(getWallPostMemoryDate(p), oneWeekAgo));
    const monthPosts = posts.filter((p) => sameDay(getWallPostMemoryDate(p), oneMonthAgo));
    const yearPosts = posts.filter((p) => {
      const dt = getWallPostMemoryDate(p);
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

      const inserts: Parameters<typeof createNotifications>[0] = [];

      if (monthBucket) {
        inserts.push({
          recipientUserId: currentUser.id,
          actorUserId: currentUser.id,
          type: 'wall_post',
          referenceId: monthBucket.posts[0].id,
          metadata: {
            wallPostId: monthBucket.posts[0].id,
            throwbackBucket: 'month',
            source: 'throwback',
          },
          message: `You have ${monthBucket.posts.length} ${monthBucket.posts.length === 1 ? 'memory' : 'memories'} from 1 month ago`,
        });
      }
      if (yearBucket) {
        inserts.push({
          recipientUserId: currentUser.id,
          actorUserId: currentUser.id,
          type: 'wall_post',
          referenceId: yearBucket.posts[0].id,
          metadata: {
            wallPostId: yearBucket.posts[0].id,
            throwbackBucket: 'year',
            source: 'throwback',
          },
          message: `You have ${yearBucket.posts.length} ${yearBucket.posts.length === 1 ? 'memory' : 'memories'} from 1 year ago`,
        });
      }

      if (inserts.length > 0) {
        await createNotifications(inserts);
        await AsyncStorage.setItem(storageKey, '1');
        refresh();
      }
    })();
  }, [currentUser, throwbackBuckets, loading]);

  const currentUserId = currentUser?.id;
  const allPeople = useMemo(
    () => (currentUserId ? getPeopleListForUser(currentUserId) : []),
    [currentUserId, getPeopleListForUser],
  );

  const allPeopleWithPremium = useMemo(
    () =>
      allPeople.map((p) => ({
        ...p,
        isPremium:
          p.entityType === 'user'
            ? isUserPremium(p.id)
            : p.linkedUserId
              ? isUserPremium(p.linkedUserId)
              : false,
      })),
    [allPeople, isUserPremium],
  );

  const query = searchQuery.trim().toLowerCase();
  const people = useMemo(
    () => (query
      ? allPeopleWithPremium.filter((p) => p.title.toLowerCase().includes(query))
      : allPeopleWithPremium),
    [allPeopleWithPremium, query],
  );
  const birthdayMoments = useMemo(
    () => currentUser?.id
      ? getBirthdayMomentsForDate({
        currentUserId: currentUser.id,
        events,
        getUserById,
      })
      : [],
    [currentUser?.id, events, getUserById],
  );
  const activePerson = people[activeIndex] ?? people[0];

  const handleCarouselIndexChange = useCallback((index: number) => {
    setActiveIndex((previousIndex) => (previousIndex === index ? previousIndex : index));
  }, []);

  const handleCarouselPress = useCallback((item: PeopleListItem) => {
    setLivePolaroidScopeEnabled(HOME_LIVE_POLAROID_SCOPE, false);
    stopAllLivePolaroids();
    stopAllSongPreviews();
    pushOnce(
      router,
      item.entityType === 'user'
        ? `/(app)/profiles/user/${item.id}`
        : `/(app)/profiles/contact/${item.id}`,
    );
  }, [router]);

  const handleCarouselLongPress = useCallback((item: PeopleListItem) => {
    if (item.entityType !== 'contact') return;
    Alert.alert(
      item.pinned ? 'Unpin?' : 'Pin to carousel?',
      item.pinned ? `${item.title} will leave your pinned group.` : `${item.title} will be added after your other pinned people.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: item.pinned ? 'Unpin' : 'Pin', onPress: () => togglePin(item.id) },
      ],
    );
  }, [togglePin]);

  const getCarouselUnreadCount = useCallback((item: PeopleListItem) => {
    const userId = item.linkedUserId ?? (item.entityType === 'user' ? item.id : null);
    if (!userId) return 0;
    return notifications.filter((notification) => !notification.read && notification.actorUserId === userId).length;
  }, [notifications]);

  const openNoteShortcut = useCallback(() => {
    if (!activePerson) return;
    pushOnce(router, {
      pathname: '/(app)/memories/add',
      params: { subjectId: activePerson.id, subjectType: activePerson.entityType, backTo: '/friends' },
    });
  }, [activePerson, router]);

  const openCameraShortcut = useCallback(() => {
    if (!activePerson) return;
    pushOnce(router, {
      pathname: '/(app)/camera',
      params: {
        subjectId: activePerson.id,
        subjectType: activePerson.entityType,
        returnTo: '/(app)/memories/add',
        backTo: '/friends',
      },
    });
  }, [activePerson, router]);

  const openGalleryShortcut = useCallback(async () => {
    if (!activePerson) return;
    if (!isPremium) {
      showGalleryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync(memoryImagePickerOptions);
    if (!result.canceled && result.assets[0]?.uri) {
      pushOnce(router, {
        pathname: '/(app)/memories/add',
        params: {
          subjectId: activePerson.id,
          subjectType: activePerson.entityType,
          capturedUri: result.assets[0].uri,
          backTo: '/friends',
        },
      });
    }
  }, [activePerson, isPremium, router]);

  const openBirthdayMoment = useCallback((friendUserId: string) => {
    pushOnce(router, {
      pathname: '/(app)/memories/add',
      params: {
        subjectId: friendUserId,
        subjectType: 'user',
        targetKeys: `user:${friendUserId}`,
        backTo: '/friends',
      },
    });
  }, [router]);

  const openPhotoShortcut = useCallback(() => {
    if (!activePerson) return;
    showPhotoSourceSheet({
      galleryLocked: !isPremium,
      onCamera: openCameraShortcut,
      onGallery: openGalleryShortcut,
    });
  }, [activePerson, isPremium, openCameraShortcut, openGalleryShortcut]);

  const shareAddMeLink = useCallback(() => {
    if (!currentUser?.friendCode) return;
    const inviteLink = createFriendInviteLink(currentUser.friendCode);
    Share.share({
      message: `Add me on Your Friends!\n${inviteLink}\nFriend code: ${currentUser.friendCode}`,
    }).catch(() => undefined);
  }, [currentUser?.friendCode]);

  const openQrScanner = useCallback(() => {
    pushOnce(router, '/(app)/friends/add?scan=1');
  }, [router]);

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

  const pendingLinks = getPendingFriendLinks(currentUser.id);

  return (
    <>
    <AppScreen
      contentContainerStyle={styles.screenContent}
      safeAreaEdges={['left', 'right']}
      onScroll={handleScroll}
      onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }}
      refreshing={refreshing}
    >
      <View style={styles.headerSpacer} />

      <View style={styles.heroCopy}>
        <View style={styles.titleGuard}>
          <Text style={styles.title}>Your Friends</Text>
        </View>
        <Text style={styles.subtitle}>Swipe through the people you keep close.</Text>
      </View>

      {pendingLinks.length > 0 && (
        <View style={styles.pendingLinksBlock}>
          <Pressable
            onPress={() => pushOnce(router, '/(app)/friends/link')}
            style={[styles.pendingLinkBanner, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '40' }]}
            accessibilityRole="button"
            accessibilityLabel="Review friend matches"
          >
            <Ionicons name="git-merge-outline" size={18} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.pendingLinkTitle, { color: colors.ink }]}>Review friend matches</Text>
              <Text style={[styles.pendingLinkSub, { color: colors.inkSoft }]}>
                {pendingLinks.length} {pendingLinks.length === 1 ? 'friend may' : 'friends may'} match saved profiles.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.accent} />
          </Pressable>
        </View>
      )}

      {birthdayMoments.length > 0 ? (
        <View style={styles.birthdayMomentsBlock}>
          {birthdayMoments.map((moment) => (
            <BirthdayMomentCard
              key={moment.friend.id}
              friend={moment.friend}
              onAddMemory={() => openBirthdayMoment(moment.friend.id)}
            />
          ))}
        </View>
      ) : null}

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
            onIndexChange={handleCarouselIndexChange}
            onPressItem={handleCarouselPress}
            onLongPressItem={handleCarouselLongPress}
            getUnreadCount={getCarouselUnreadCount}
            livePolaroidScope={HOME_LIVE_POLAROID_SCOPE}
          />

          <View style={styles.activeMeta}>
            <Text style={styles.activeName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{activePerson?.title}</Text>
            {activePerson?.subtitle ? <Text style={styles.activeDescription}>{activePerson.subtitle}</Text> : null}
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
                    livePolaroidScope={HOME_LIVE_POLAROID_SCOPE}
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
                      livePolaroidScope={HOME_LIVE_POLAROID_SCOPE}
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
          <Text style={styles.emptySubtitle}>Share your add-me link or scan a friend's QR to get your first connection going.</Text>
          {currentUser.friendCode ? (
            <View style={styles.inviteCard}>
              <Text style={styles.inviteEyebrow}>Your friend code</Text>
              <Text style={styles.inviteCode}>{currentUser.friendCode}</Text>
              <Text style={styles.inviteLink} numberOfLines={1}>
                {createFriendInviteLink(currentUser.friendCode)}
              </Text>
            </View>
          ) : null}
          <View style={styles.emptyActions}>
            <Pressable
              onPress={shareAddMeLink}
              style={styles.emptyPrimaryAction}
              accessibilityRole="button"
              accessibilityLabel="Share your add me link"
            >
              <Ionicons name="share-outline" size={17} color={colors.white} />
              <Text style={styles.emptyPrimaryActionLabel}>Share add-me link</Text>
            </Pressable>
            <Pressable
              onPress={openQrScanner}
              style={styles.emptySecondaryAction}
              accessibilityRole="button"
              accessibilityLabel="Scan a friend's QR code"
            >
              <Ionicons name="qr-code-outline" size={17} color={colors.accent} />
              <Text style={styles.emptySecondaryActionLabel}>Scan QR code</Text>
            </Pressable>
          </View>
        </View>
      )}

    </AppScreen>

    <View pointerEvents="box-none" style={styles.floatingLayer}>
      <Animated.View
        pointerEvents={showFloatingTopControls ? 'auto' : 'none'}
        style={[styles.floatingTopRow, { top: insets.top + spacing.sm }, floatingTopStyle]}
      >
        <View style={styles.floatingTopLeft}>
          <Pressable
            onPress={() => pushOnce(router, '/(app)/settings')}
            style={styles.floatingIconButton}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <Ionicons name="settings-outline" size={22} color={colors.inkSoft} />
          </Pressable>
          <Pressable
            onPress={() => pushOnce(router, '/(app)/store')}
            style={styles.floatingIconButton}
            accessibilityRole="button"
            accessibilityLabel="Open store"
          >
            <Ionicons name="bag-handle-outline" size={21} color={colors.inkSoft} />
          </Pressable>
        </View>

        <View style={styles.floatingTopRight}>
          <Pressable
            onPress={() => pushOnce(router, '/(app)/friends/add')}
            style={[styles.floatingIconButton, styles.bellWrapper]}
            accessibilityRole="button"
            accessibilityLabel={showReferralBadge ? 'Add friend, referral code needed' : 'Add friend'}
          >
            <Ionicons name="person-add-outline" size={20} color={colors.inkSoft} />
            {showReferralBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>1</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable onPress={() => pushOnce(router, '/(app)/notifications')} style={[styles.floatingIconButton, styles.bellWrapper]} accessibilityRole="button" accessibilityLabel={notificationBadgeCount > 0 ? `Notifications, ${notificationBadgeCount} unread` : 'Notifications'}>
            <ThemedIcon name="bell" size={20} color={colors.inkSoft} />
            {notificationBadgeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notificationBadgeCount > 9 ? '9+' : notificationBadgeCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents={showFloatingAddFriend ? 'auto' : 'none'}
        style={[
          styles.floatingBottomRow,
          // The tab bar is an absolute overlay, so keep memory actions above it.
          { bottom: Math.max(insets.bottom, spacing.sm) + spacing.sm + 64 + spacing.sm },
          floatingBottomStyle,
        ]}
      >
        <View style={styles.floatingMemoryRow} pointerEvents="box-none">
          <Pressable
            onPress={openNoteShortcut}
            disabled={!activePerson}
            style={[styles.floatingMemoryButton, !activePerson && styles.floatingActionDisabled]}
            accessibilityRole="button"
            accessibilityLabel={activePerson ? `Add note about ${activePerson.title}` : 'Add note'}
          >
            <Ionicons name="create-outline" size={24} color={colors.inkSoft} />
          </Pressable>

          <Pressable
            onPress={openPhotoShortcut}
            disabled={!activePerson}
            style={[styles.floatingMemoryButton, styles.floatingMemoryButtonPrimary, !activePerson && styles.floatingActionDisabled]}
            accessibilityRole="button"
            accessibilityLabel={activePerson ? `Add memory card about ${activePerson.title}` : 'Add memory card'}
          >
            <Ionicons name="camera-outline" size={25} color={colors.white} />
          </Pressable>
        </View>
      </Animated.View>
    </View>

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
    heroCopy: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, alignSelf: 'stretch' },
    titleGuard: {
      alignSelf: 'stretch',
      overflow: 'visible',
      paddingHorizontal: spacing.md,
    },
    title: {
      fontFamily: fonts.heading,
      fontSize: 34,
      color: colors.ink,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 12,
      overflow: 'visible' as const,
      ...protectTextFromFontClipping(fonts.heading, 34),
    },
    subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft, textAlign: 'center' },
    pendingLinksBlock: { gap: spacing.sm, paddingHorizontal: spacing.md },
    pendingLinkBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    pendingLinkTitle: { fontFamily: fonts.bodyBold, fontSize: 14 },
    pendingLinkSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
    birthdayMomentsBlock: { gap: spacing.sm, paddingHorizontal: spacing.md },
    carouselBlock: { alignItems: 'center', gap: spacing.md },
    emptyState: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, textAlign: 'center', ...protectTextFromFontClipping(fonts.heading, 24) },
    emptySubtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft, textAlign: 'center' },
    inviteCard: {
      alignSelf: 'stretch',
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
    },
    inviteEyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      color: colors.inkMuted,
    },
    inviteCode: { fontFamily: fonts.heading, fontSize: 22, letterSpacing: 3, color: colors.accent, ...protectTextFromFontClipping(fonts.heading, 22) },
    inviteLink: { alignSelf: 'stretch', fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft, textAlign: 'center' },
    emptyActions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
    emptyPrimaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    emptyPrimaryActionLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
    emptySecondaryAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.accent + '66',
      backgroundColor: colors.accent + '12',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    emptySecondaryActionLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent },

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
    activeName: { fontFamily: fonts.heading, fontSize: 36, color: colors.ink, textAlign: 'center', width: '100%', ...protectTextFromFontClipping(fonts.heading, 36) },
    activeDescription: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft, textAlign: 'center' },
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
    floatingTopRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    floatingTopLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
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
    floatingMemoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    floatingMemoryButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 10,
    },
    floatingMemoryButtonPrimary: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    floatingActionDisabled: {
      opacity: 0.45,
    },
    feedSection: { gap: spacing.sm },
    feedHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs },
    feedTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 20) },
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
