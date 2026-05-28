import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppScreen } from '../../src/components/AppScreen';
import { BirthdayMomentCard } from '../../src/components/BirthdayMomentCard';
import { CachedRemoteImage, prefetchCachedImages } from '../../src/components/CachedRemoteImage';
import { FadeInView } from '../../src/components/FadeInView';
import { setLivePolaroidScopeEnabled, stopAllLivePolaroids } from '../../src/components/LivePolaroidLayer';
import { PolaroidIcon } from '../../src/components/PolaroidIcon';
import { PolaroidCarousel } from '../../src/components/PolaroidCarousel';
import { ThemedIcon } from '../../src/components/ThemedIcon';

import { FriendsListSkeleton } from '../../src/components/Skeleton';
import { WallPostCard } from '../../src/components/WallPostCard';
import { useAuth } from '../../src/features/auth/AuthContext';
import { useScrollChrome } from '../../src/features/navigation/ScrollChromeContext';
import { usePremium } from '../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../src/features/social/SocialGraphContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import { useCalendar } from '../../src/features/calendar/CalendarContext';
import { getBirthdayMomentsForDate } from '../../src/features/birthday/birthdayMoments';
import type { ColorTokens } from '../../src/features/theme/themes';
import { createFriendInviteLink } from '../../src/lib/friendCode';
import { showGalleryPaywall, showGiftNotePaywall, showMediaMemoryPaywall, showPromptPaywall } from '../../src/lib/premiumGates';
import { showPhotoSourceSheet } from '../../src/lib/photoSourceSheet';
import { memoryImagePickerOptions, memoryMediaPickerOptions } from '../../src/lib/imagePickerPresets';
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
import { getCachedMemoryDeveloped, loadMemoryDeveloped } from '../../src/lib/memoryDevelopNotifications';
import { notifyMemoryAuthorRecipientDeveloped } from '../../src/lib/memoryRecipientDevelopNotifications';
import { getPromptExpirationLabel, isPromptExpired } from '../../src/lib/promptExpiration';
import { useIncomingMemoryDevelopStarts } from '../../src/hooks/useIncomingMemoryDevelopStarts';
import { useSyntheticNotificationReads } from '../../src/hooks/useSyntheticNotificationReads';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';
import type { CalendarEvent, MemoryPromptRequest, MovieReviewRequest, Notification, PeopleListItem, WallPost } from '../../src/types/domain';

const HOME_LIVE_POLAROID_SCOPE = 'home';
const REGULAR_VIDEO_MAX_DURATION_MS = 5000;
const FREE_PREMIUM_REMINDER_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

const freePremiumReminderLastShownKey = (userId: string) => `yourfriends:premiumReminder:lastShown:${userId}`;

type HomeReceivedPrompt =
  | { kind: 'memory'; request: MemoryPromptRequest; createdAt: string }
  | { kind: 'movie'; request: MovieReviewRequest; createdAt: string };

export default function FriendsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();
  const {
    loading,
    wallPosts,
    memoryPromptRequests,
    movieReviewRequests,
    getPeopleListForUser,
    getUserById,
    unreadCount,
    togglePin,
    notifications,
    refresh,
    getPendingFriendLinks,
  } = useSocialGraph();
  const { events } = useCalendar();
  const { isPremium, isUserPremium } = usePremium();
  const [refreshing, setRefreshing] = useState(false);
  const { colors, fonts, resolvedMode } = useTheme();
  const { isScrollChromeHidden } = useScrollChrome();
  const blurTint = resolvedMode === 'dark' ? 'dark' : 'light';
  const hasCustomBackground = Boolean(currentUser?.profileBgImagePath);
  const styles = useMemo(() => makeStyles(colors, fonts, hasCustomBackground), [colors, fonts, hasCustomBackground]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFloatingTopControls, setShowFloatingTopControls] = useState(true);
  const [showFloatingAddFriend, setShowFloatingAddFriend] = useState(true);
  const floatingTopAnim = useRef(new Animated.Value(1)).current;
  const floatingBottomAnim = useRef(new Animated.Value(1)).current;
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
  const [developedByPostId, setDevelopedByPostId] = useState<Record<string, boolean>>({});
  const imagePostIdsKey = useMemo(
    () => (wallPosts ?? []).filter((p) => p.postType === 'polaroid' && p.imageUri).map((p) => p.id).sort().join('|'),
    [wallPosts],
  );
  const { readIds: syntheticNotificationReadIds } = useSyntheticNotificationReads(currentUser?.id ?? null);
  const getIncomingDevelopStartAt = useIncomingMemoryDevelopStarts(wallPosts ?? [], currentUser?.id, true);
  const notifyAuthorIfIncomingDeveloped = useCallback((post: WallPost) => {
    if (!currentUser) return;
    if (!getIncomingDevelopStartAt(post)) return;
    notifyMemoryAuthorRecipientDeveloped({
      post,
      recipientName: currentUser.displayName,
      recipientUserId: currentUser.id,
    }).catch((error) => console.warn('[notification] recipient developed memory insert failed:', error));
  }, [currentUser, getIncomingDevelopStartAt]);
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
    if (!currentUser?.id || isPremium || loading) return;
    const userId = currentUser.id;
    let cancelled = false;

    async function maybeOpenPremiumReminder() {
      try {
        const storageKey = freePremiumReminderLastShownKey(userId);
        const nowMs = Date.now();
        const lastShownRaw = await AsyncStorage.getItem(storageKey);
        const lastShownMs = lastShownRaw ? Number(lastShownRaw) : 0;
        if (Number.isFinite(lastShownMs) && nowMs - lastShownMs < FREE_PREMIUM_REMINDER_INTERVAL_MS) return;

        await AsyncStorage.setItem(storageKey, String(nowMs));
        if (!cancelled) pushOnce(router, '/(app)/store');
      } catch {
        // Ignore reminder storage issues; Premium can still be opened manually.
      }
    }

    maybeOpenPremiumReminder();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, isPremium, loading, router]);

  useEffect(() => {
    const imagePostIds = imagePostIdsKey ? imagePostIdsKey.split('|') : [];
    if (imagePostIds.length === 0) {
      setShakeBoostsByPostId({});
      setDevelopedByPostId({});
      return;
    }

    setShakeBoostsByPostId((prev) => {
      const next: Record<string, number> = {};
      for (const id of imagePostIds) next[id] = prev[id] ?? getCachedPolaroidShakeBoost(id);
      return next;
    });
    setDevelopedByPostId((prev) => {
      const next: Record<string, boolean> = {};
      for (const id of imagePostIds) next[id] = prev[id] ?? getCachedMemoryDeveloped(id);
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
      loadMemoryDeveloped(id)
        .then((developed) => {
          if (!active) return;
          setDevelopedByPostId((prev) => ({ ...prev, [id]: developed }));
          if (developed) setNow(Date.now());
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
        if (p.postType !== 'polaroid' || !p.imageUri) return false;
        if (developedByPostId[p.id] || getCachedMemoryDeveloped(p.id)) return false;
        const shakeBoostMs = shakeBoostsByPostId[p.id] ?? getCachedPolaroidShakeBoost(p.id);
        return getCureProgress(getIncomingDevelopStartAt(p) ?? p.createdAt, now + shakeBoostMs) < 1;
      }),
    [developedByPostId, getIncomingDevelopStartAt, wallPosts, now, shakeBoostsByPostId],
  );
  useEffect(() => {
    if (developingPosts.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(id);
  }, [developingPosts.length]);

  useEffect(() => {
    for (const post of wallPosts ?? []) {
      const developStartAt = getIncomingDevelopStartAt(post);
      if (!developStartAt) continue;
      const shakeBoostMs = shakeBoostsByPostId[post.id] ?? getCachedPolaroidShakeBoost(post.id);
      if (getCureProgress(developStartAt, now + shakeBoostMs) >= 1) {
        notifyAuthorIfIncomingDeveloped(post);
      }
    }
  }, [getIncomingDevelopStartAt, notifyAuthorIfIncomingDeveloped, now, shakeBoostsByPostId, wallPosts]);

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

    const oldestFirst = (left: (typeof posts)[number], right: (typeof posts)[number]) => {
      const byMemoryDate = getWallPostMemoryDate(left).getTime() - getWallPostMemoryDate(right).getTime();
      if (byMemoryDate !== 0) return byMemoryDate;
      return left.createdAt.localeCompare(right.createdAt);
    };

    const yesterdayPosts = posts.filter((p) => sameDay(getWallPostMemoryDate(p), yesterday)).sort(oldestFirst);
    const weekPosts = posts.filter((p) => sameDay(getWallPostMemoryDate(p), oneWeekAgo)).sort(oldestFirst);
    const monthPosts = posts.filter((p) => sameDay(getWallPostMemoryDate(p), oneMonthAgo)).sort(oldestFirst);
    const yearPosts = posts.filter((p) => {
      const dt = getWallPostMemoryDate(p);
      return dt.getMonth() === oneYearAgo.getMonth() && dt.getDate() === oneYearAgo.getDate() && dt.getFullYear() <= oneYearAgo.getFullYear();
    }).sort(oldestFirst);

    return [
      { label: '1 Year Ago', posts: yearPosts },
      { label: '1 Month Ago', posts: monthPosts },
      { label: '1 Week Ago', posts: weekPosts },
      { label: 'Yesterday', posts: yesterdayPosts },
    ].filter((b) => b.posts.length > 0);
  }, [wallPosts]);

  const wallPostById = useMemo(() => {
    const map = new Map<string, (typeof wallPosts)[number]>();
    for (const post of wallPosts ?? []) map.set(post.id, post);
    return map;
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
  const activeFriendPosition = people.length > 0 ? Math.min(activeIndex + 1, people.length) : 0;
  const receivedPrompts = useMemo<HomeReceivedPrompt[]>(() => {
    if (!currentUser?.id) return [];
    return [
      ...memoryPromptRequests
        .filter((request) => request.recipientUserId === currentUser.id && request.status === 'pending' && !isPromptExpired(request, now))
        .map((request) => ({ kind: 'memory' as const, request, createdAt: request.createdAt })),
      ...movieReviewRequests
        .filter((request) => request.recipientUserId === currentUser.id && request.status === 'pending' && !isPromptExpired(request, now))
        .map((request) => ({ kind: 'movie' as const, request, createdAt: request.createdAt })),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [currentUser?.id, memoryPromptRequests, movieReviewRequests, now]);

  useEffect(() => {
    if (receivedPrompts.length === 0) return undefined;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [receivedPrompts.length]);

  useEffect(() => {
    if (!activePerson || !currentUser?.id) return;
    const activePosts = (wallPosts ?? [])
      .filter((post) => {
        if (!post.imageUri) return false;
        if (activePerson.entityType === 'contact') {
          return post.subjectContactId === activePerson.id
            || (activePerson.linkedUserId
              ? ((post.authorUserId === currentUser.id && post.subjectUserId === activePerson.linkedUserId)
                || (post.authorUserId === activePerson.linkedUserId && post.subjectUserId === currentUser.id))
              : false);
        }
        return (post.authorUserId === currentUser.id && post.subjectUserId === activePerson.id)
          || (post.authorUserId === activePerson.id && post.subjectUserId === currentUser.id);
      })
      .slice(0, 6);
    const thumbUris = activePosts.map((post) => post.imageThumbUri ?? post.imageUri);
    const fullUris = activePosts.slice(0, 2).map((post) => post.imageUri);
    prefetchCachedImages([...thumbUris, ...fullUris]).catch(() => undefined);
  }, [activePerson, currentUser?.id, wallPosts]);

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
    return getPersonUnreadCount({
      item,
      currentUserId: currentUser?.id ?? null,
      events,
      memoryPromptRequests,
      movieReviewRequests,
      notifications,
      syntheticNotificationReadIds,
      wallPosts: wallPosts ?? [],
    });
  }, [currentUser?.id, events, memoryPromptRequests, movieReviewRequests, notifications, syntheticNotificationReadIds, wallPosts]);

  const openReceivedPrompt = useCallback((prompt: HomeReceivedPrompt) => {
    pushOnce(
      router,
      prompt.kind === 'movie'
        ? `/(app)/movies/review/${prompt.request.id}`
        : `/(app)/prompts/respond/${prompt.request.id}`,
    );
  }, [router]);

  const openMemoryComposerShortcut = useCallback((kind: 'note' | 'song') => {
    if (!activePerson) return;
    pushOnce(router, {
      pathname: '/(app)/memories/add',
      params: { subjectId: activePerson.id, subjectType: activePerson.entityType, kind, backTo: '/friends' },
    });
  }, [activePerson, router]);

  const openNoteShortcut = useCallback(() => {
    if (!activePerson) return;
    Alert.alert(`Add to ${activePerson.title}'s wall`, 'What kind of memory?', [
      { text: 'Note', onPress: () => openMemoryComposerShortcut('note') },
      { text: 'Song', onPress: () => openMemoryComposerShortcut('song') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [activePerson, openMemoryComposerShortcut]);

  const openGiftNoteShortcut = useCallback(() => {
    if (!activePerson || (activePerson.entityType === 'contact' && !activePerson.linkedUserId)) return;
    if (!isPremium) {
      showGiftNotePaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    pushOnce(router, {
      pathname: '/(app)/gifts/add',
      params: { subjectId: activePerson.id, subjectType: activePerson.entityType, backTo: '/friends' },
    });
  }, [activePerson, isPremium, router]);

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

  const openMediaCameraShortcut = useCallback(async () => {
    if (!activePerson) return;
    if (!isPremium) {
      showMediaMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchCameraAsync(memoryMediaPickerOptions);
    } catch {
      Alert.alert('Camera unavailable', 'The camera is not available on this device. Try this on a real phone or choose from your gallery.');
      return;
    }
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) return;
    if (asset.type === 'video' && asset.duration && asset.duration > REGULAR_VIDEO_MAX_DURATION_MS + 250) {
      Alert.alert('Video too long', 'Regular video memories can be up to 5 seconds.');
      return;
    }
    pushOnce(router, {
      pathname: '/(app)/memories/add',
      params: {
        subjectId: activePerson.id,
        subjectType: activePerson.entityType,
        mediaUri: asset.uri,
        mediaType: asset.type === 'video' ? 'video' : 'image',
        backTo: '/friends',
      },
    });
  }, [activePerson, isPremium, router]);

  const openMediaGalleryShortcut = useCallback(async () => {
    if (!activePerson) return;
    if (!isPremium) {
      showMediaMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync(memoryMediaPickerOptions);
    } catch {
      Alert.alert('Gallery unavailable', 'We could not open your gallery. Try again in a moment.');
      return;
    }
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) return;
    if (asset.type === 'video' && asset.duration && asset.duration > REGULAR_VIDEO_MAX_DURATION_MS + 250) {
      Alert.alert('Video too long', 'Regular video memories can be up to 5 seconds.');
      return;
    }
    pushOnce(router, {
      pathname: '/(app)/memories/add',
      params: {
        subjectId: activePerson.id,
        subjectType: activePerson.entityType,
        mediaUri: asset.uri,
        mediaType: asset.type === 'video' ? 'video' : 'image',
        backTo: '/friends',
      },
    });
  }, [activePerson, isPremium, router]);

  const openGalleryShortcut = useCallback(async () => {
    if (!activePerson) return;
    if (!isPremium) {
      showGalleryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync(memoryImagePickerOptions);
    } catch {
      Alert.alert('Gallery unavailable', 'We could not open your gallery. Try again in a moment.');
      return;
    }
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

  const openPolaroidShortcut = useCallback(() => {
    if (!activePerson) return;
    showPhotoSourceSheet({
      galleryLocked: !isPremium,
      onCamera: openCameraShortcut,
      onGallery: openGalleryShortcut,
      title: 'Add Memory Card',
    });
  }, [activePerson, isPremium, openCameraShortcut, openGalleryShortcut]);

  const openMediaShortcut = useCallback(() => {
    if (!activePerson) return;
    if (!isPremium) {
      showMediaMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    showPhotoSourceSheet({
      cameraLabel: 'Take Photo or Video',
      galleryLabel: 'Choose Photo or Video',
      galleryLocked: false,
      onCamera: openMediaCameraShortcut,
      onGallery: openMediaGalleryShortcut,
      title: 'Add Media',
    });
  }, [activePerson, isPremium, openMediaCameraShortcut, openMediaGalleryShortcut]);

  const openMemoryPromptShortcut = useCallback(() => {
    if (!activePerson || (activePerson.entityType === 'contact' && !activePerson.linkedUserId)) return;
    if (!isPremium) {
      showPromptPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    pushOnce(router, {
      pathname: '/(app)/prompts/request',
      params: { subjectId: activePerson.id, subjectType: activePerson.entityType, backTo: '/friends' },
    });
  }, [activePerson, isPremium, router]);

  const openMovieRequestShortcut = useCallback(() => {
    if (!activePerson || (activePerson.entityType === 'contact' && !activePerson.linkedUserId)) return;
    pushOnce(router, {
      pathname: '/(app)/movies/request',
      params: { subjectId: activePerson.id, subjectType: activePerson.entityType, backTo: '/friends' },
    });
  }, [activePerson, router]);

  const openPromptTypeSheet = useCallback(() => {
    if (!activePerson || (activePerson.entityType === 'contact' && !activePerson.linkedUserId)) return;
    Alert.alert(`Ask ${activePerson.title}`, 'What do you want them to answer?', [
      { text: 'Memory Prompt', onPress: openMemoryPromptShortcut },
      { text: 'Movie Rating', onPress: openMovieRequestShortcut },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [activePerson, openMemoryPromptShortcut, openMovieRequestShortcut]);

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

  useEffect(() => {
    const visible = !isScrollChromeHidden;
    setFloatingTopVisible(visible);
    setFloatingBottomVisible(visible);
  }, [isScrollChromeHidden, setFloatingBottomVisible, setFloatingTopVisible]);

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
            style={[styles.pendingLinkBanner, { backgroundColor: colors.paper, borderColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Review friend matches"
          >
            <Ionicons name="git-merge-outline" size={18} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.pendingLinkTitle, { color: colors.ink }]}>Review friend matches</Text>
              <Text style={[styles.pendingLinkSub, { color: colors.ink }]}>
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
        <ThemedIcon name="search" size={18} color={colors.ink} />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Search for friends..."
          placeholderTextColor={colors.ink}
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
          <View style={styles.carouselStage}>
            <View pointerEvents="none" style={styles.carouselGlow} />
            <View pointerEvents="none" style={styles.carouselGlowAlt} />
            <View style={styles.carouselHeaderRow}>
              <Text style={styles.carouselEyebrow}>Current Wall</Text>
              <View style={styles.friendCounterPill}>
                <Text style={styles.friendCounterText}>
                  Friend {activeFriendPosition} of {people.length}
                </Text>
              </View>
            </View>
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
                {developingPosts.map((post) => {
                  const referencedPost = post.referencedWallPostId ? wallPostById.get(post.referencedWallPostId) ?? null : null;
                  const promptAuthorName = post.memoryPromptRequestId || post.promptVoice || post.promptText
                    ? (post.subjectUserId ? getUserById(post.subjectUserId)?.displayName : null) ?? 'Someone'
                    : undefined;
                  return (
                    <WallPostCard
                      key={post.id}
                      authorName={getUserById(post.authorUserId)?.displayName ?? 'You'}
                      post={post}
                      cardColor={post.cardColor}
                      developStartAt={getIncomingDevelopStartAt(post)}
                      referencedPost={referencedPost}
                      referencedPostAuthorName={referencedPost ? getUserById(referencedPost.authorUserId)?.displayName ?? 'Someone' : undefined}
                      promptAuthorName={promptAuthorName}
                      livePolaroidScope={HOME_LIVE_POLAROID_SCOPE}
                      onDeveloped={getIncomingDevelopStartAt(post) ? () => notifyAuthorIfIncomingDeveloped(post) : undefined}
                    />
                  );
                })}
              </>
            ) : (
              <Text style={styles.feedSubtitle}>No photos in the darkroom right now</Text>
            )}
          </View>
        </FadeInView>

        {/* ── Received Prompts ── */}
        <FadeInView delay={150}>
          <View style={styles.feedSection}>
            <View style={styles.feedHeader}>
              <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
              <Text style={styles.feedTitle}>Prompts</Text>
            </View>
            {receivedPrompts.length > 0 ? (
              <>
                <Text style={styles.feedSubtitle}>
                  {receivedPrompts.length} {receivedPrompts.length === 1 ? 'prompt is' : 'prompts are'} waiting for your answer
                </Text>
                {receivedPrompts.map((prompt) => {
                  const requester = getUserById(prompt.request.requesterUserId);
                  const title = prompt.kind === 'movie'
                    ? `${requester?.displayName ?? 'Someone'} asked you to rate`
                    : `${requester?.displayName ?? 'Someone'} asked`;
                  const body = prompt.kind === 'movie'
                    ? `${prompt.request.movie.title}${prompt.request.movie.year ? ` (${prompt.request.movie.year})` : ''}`
                    : prompt.request.promptText;
                  const metaType = prompt.kind === 'movie' ? 'Movie rating' : labelForHomePrompt(prompt.request.promptType);
                  const meta = `${metaType} - ${getPromptExpirationLabel(prompt.request.expiresAt, now)}`;
                  return (
                    <Pressable
                      key={`${prompt.kind}-${prompt.request.id}`}
                      onPress={() => openReceivedPrompt(prompt)}
                      style={styles.promptCard}
                      accessibilityRole="button"
                      accessibilityLabel={`Answer prompt from ${requester?.displayName ?? 'someone'}`}
                    >
                      <View style={styles.promptIcon}>
                        {requester?.avatarPath ? (
                          <CachedRemoteImage uri={requester.avatarPath} style={styles.promptAvatar} />
                        ) : (
                          <Ionicons name={iconForHomePrompt(prompt)} size={18} color={colors.accent} />
                        )}
                      </View>
                      <View style={styles.promptCardBody}>
                        <Text style={styles.promptCardTitle}>{title}</Text>
                        <Text style={styles.promptCardText} numberOfLines={2}>{body}</Text>
                        <Text style={styles.promptCardMeta}>{meta}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.accent} />
                    </Pressable>
                  );
                })}
              </>
            ) : (
              <Text style={styles.feedSubtitle}>No prompts waiting for you right now</Text>
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
                  {bucket.posts.map((post) => {
                    const referencedPost = post.referencedWallPostId ? wallPostById.get(post.referencedWallPostId) ?? null : null;
                    const promptAuthorName = post.memoryPromptRequestId || post.promptVoice || post.promptText
                      ? (post.subjectUserId ? getUserById(post.subjectUserId)?.displayName : null) ?? 'Someone'
                      : undefined;
                    return (
                      <WallPostCard
                        key={post.id}
                        authorName={getUserById(post.authorUserId)?.displayName ?? 'You'}
                        post={post}
                        cardColor={post.cardColor}
                        developStartAt={getIncomingDevelopStartAt(post)}
                        referencedPost={referencedPost}
                        referencedPostAuthorName={referencedPost ? getUserById(referencedPost.authorUserId)?.displayName ?? 'Someone' : undefined}
                        promptAuthorName={promptAuthorName}
                        shareable
                        livePolaroidScope={HOME_LIVE_POLAROID_SCOPE}
                        onDeveloped={getIncomingDevelopStartAt(post) ? () => notifyAuthorIfIncomingDeveloped(post) : undefined}
                      />
                    );
                  })}
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
          <ThemedIcon name="users" size={48} color={colors.ink} />
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
            <Ionicons name="settings-outline" size={22} color={colors.ink} />
          </Pressable>
          <Pressable
            onPress={() => pushOnce(router, '/(app)/store')}
            style={styles.floatingIconButton}
            accessibilityRole="button"
            accessibilityLabel="Open store"
          >
            <Ionicons name="bag-handle-outline" size={21} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.floatingTopRight}>
          <Pressable
            onPress={() => pushOnce(router, '/(app)/friends/add')}
            style={[styles.floatingIconButton, styles.bellWrapper]}
            accessibilityRole="button"
            accessibilityLabel="Add friend"
          >
            <Ionicons name="person-add-outline" size={20} color={colors.ink} />
          </Pressable>

          <Pressable onPress={() => pushOnce(router, '/(app)/notifications')} style={[styles.floatingIconButton, styles.bellWrapper]} accessibilityRole="button" accessibilityLabel={notificationBadgeCount > 0 ? `Notifications, ${notificationBadgeCount} unread` : 'Notifications'}>
            <ThemedIcon name="bell" size={20} color={colors.ink} />
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
          { bottom: Math.max(insets.bottom * 0.5, spacing.xs) + 64 + spacing.xs },
          floatingBottomStyle,
        ]}
      >
        <View style={styles.floatingMemoryDock} pointerEvents="box-none">
          <BlurView intensity={58} tint={blurTint} style={[StyleSheet.absoluteFill, styles.floatingMemoryDockBlur]} pointerEvents="none" />
          <View pointerEvents="none" style={styles.floatingMemoryDockGlassTint} />
          <View pointerEvents="none" style={styles.floatingMemoryDockHighlight} />
          <View pointerEvents="none" style={styles.floatingMemoryDockGlow} />
          <Pressable
            onPress={openNoteShortcut}
            disabled={!activePerson}
            style={[styles.floatingMemoryButton, !activePerson && styles.floatingActionDisabled]}
            accessibilityRole="button"
            accessibilityLabel={activePerson ? `Add note about ${activePerson.title}` : 'Add note'}
          >
            <Ionicons name="create-outline" size={24} color={colors.ink} />
          </Pressable>

          <Pressable
            onPress={openPromptTypeSheet}
            disabled={!activePerson || (activePerson.entityType === 'contact' && !activePerson.linkedUserId)}
            style={[styles.floatingMemoryButton, (!activePerson || (activePerson.entityType === 'contact' && !activePerson.linkedUserId)) && styles.floatingActionDisabled]}
            accessibilityRole="button"
            accessibilityLabel={activePerson ? `Ask ${activePerson.title} for a prompt or rating` : 'Ask for a prompt or rating'}
          >
            <Ionicons name="sparkles-outline" size={24} color={colors.ink} />
          </Pressable>

          <Pressable
            onPress={openPolaroidShortcut}
            disabled={!activePerson}
            style={[styles.floatingMemoryButton, styles.floatingMemoryButtonPrimary, !activePerson && styles.floatingActionDisabled]}
            accessibilityRole="button"
            accessibilityLabel={activePerson ? `Add Memory Card about ${activePerson.title}` : 'Add Memory Card'}
          >
            <PolaroidIcon size={23} color={colors.white} />
          </Pressable>

          <Pressable
            onPress={openGiftNoteShortcut}
            disabled={!activePerson || (activePerson.entityType === 'contact' && !activePerson.linkedUserId)}
            style={[styles.floatingMemoryButton, (!activePerson || (activePerson.entityType === 'contact' && !activePerson.linkedUserId)) && styles.floatingActionDisabled]}
            accessibilityRole="button"
            accessibilityLabel={activePerson ? `Add gift note for ${activePerson.title}` : 'Add gift note'}
          >
            <Ionicons name="gift-outline" size={22} color={colors.ink} />
          </Pressable>

          <Pressable
            onPress={openMediaShortcut}
            disabled={!activePerson}
            style={[styles.floatingMemoryButton, !activePerson && styles.floatingActionDisabled]}
            accessibilityRole="button"
            accessibilityLabel={activePerson ? `Add photo or video about ${activePerson.title}` : 'Add photo or video'}
          >
            <Ionicons name="camera-outline" size={25} color={colors.ink} />
          </Pressable>
        </View>
      </Animated.View>
    </View>

    </>
  );
}

function getPersonUnreadCount({
  currentUserId,
  events,
  item,
  memoryPromptRequests,
  movieReviewRequests,
  notifications,
  syntheticNotificationReadIds,
  wallPosts,
}: {
  currentUserId: string | null;
  events: CalendarEvent[];
  item: PeopleListItem;
  memoryPromptRequests: MemoryPromptRequest[];
  movieReviewRequests: MovieReviewRequest[];
  notifications: Notification[];
  syntheticNotificationReadIds: Set<string>;
  wallPosts: WallPost[];
}) {
  const userId = item.linkedUserId ?? (item.entityType === 'user' ? item.id : null);
  if (!userId) return 0;

  const unreadNotifications = notifications.filter((notification) => {
    if (notification.read) return false;
    if (notification.actorUserId === userId) return true;
    return notificationTouchesUser(notification, userId, wallPosts, memoryPromptRequests, movieReviewRequests);
  }).length;

  const existingCalendarEventIds = new Set(
    notifications
      .filter((notification) => notification.type === 'calendar_event')
      .map((notification) => typeof notification.metadata.eventId === 'string' ? notification.metadata.eventId : notification.referenceId)
      .filter((eventId): eventId is string => Boolean(eventId)),
  );
  const fallbackCalendarNotifications = events.filter((event) => {
    if (!currentUserId || !event.shareId || event.sharedWithUserId !== currentUserId || event.sharedByUserId !== userId) return false;
    if (existingCalendarEventIds.has(event.id)) return false;
    return !syntheticNotificationReadIds.has(`calendar-share-fallback:${event.shareId}`);
  }).length;

  return unreadNotifications + fallbackCalendarNotifications;
}

function notificationTouchesUser(
  notification: Notification,
  userId: string,
  wallPosts: WallPost[],
  memoryPromptRequests: MemoryPromptRequest[],
  movieReviewRequests: MovieReviewRequest[],
) {
  const wallPostId = typeof notification.metadata.wallPostId === 'string' ? notification.metadata.wallPostId : notification.referenceId;
  if (wallPostId && notification.type === 'wall_post') {
    const post = wallPosts.find((candidate) => candidate.id === wallPostId);
    if (post?.authorUserId === userId || post?.subjectUserId === userId) return true;
  }

  const memoryPromptRequestId = typeof notification.metadata.memoryPromptRequestId === 'string'
    ? notification.metadata.memoryPromptRequestId
    : notification.type === 'memory_prompt_request'
      ? notification.referenceId
      : null;
  if (memoryPromptRequestId) {
    const request = memoryPromptRequests.find((candidate) => candidate.id === memoryPromptRequestId);
    if (request?.requesterUserId === userId || request?.recipientUserId === userId) return true;
  }

  const movieReviewRequestId = typeof notification.metadata.movieReviewRequestId === 'string'
    ? notification.metadata.movieReviewRequestId
    : notification.type === 'movie_review_request'
      ? notification.referenceId
      : null;
  if (movieReviewRequestId) {
    const request = movieReviewRequests.find((candidate) => candidate.id === movieReviewRequestId);
    if (request?.requesterUserId === userId || request?.recipientUserId === userId) return true;
  }

  if (typeof notification.metadata.birthdayUserId === 'string' && notification.metadata.birthdayUserId === userId) return true;
  if (typeof notification.metadata.ownerUserId === 'string' && notification.metadata.ownerUserId === userId) return true;
  return false;
}

function iconForHomePrompt(prompt: HomeReceivedPrompt) {
  if (prompt.kind === 'movie') return 'film-outline' as const;
  if (prompt.request.promptType === 'photo' || prompt.request.promptType === 'photo_reference') return 'camera-outline' as const;
  if (prompt.request.promptType === 'voice') return 'mic-outline' as const;
  if (prompt.request.promptType === 'song') return 'musical-notes-outline' as const;
  return 'chatbubble-ellipses-outline' as const;
}

function labelForHomePrompt(promptType: MemoryPromptRequest['promptType']) {
  if (promptType === 'photo' || promptType === 'photo_reference') return 'Photo prompt';
  if (promptType === 'voice') return 'Voice answer requested';
  if (promptType === 'song') return 'Song prompt';
  return 'Memory prompt';
}

const makeStyles = (colors: ColorTokens, fonts: FontSet, hasCustomBackground = false) => {
  const backgroundTextShadow = hasCustomBackground
    ? {
      textShadowColor: 'rgba(255,255,255,0.82)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    }
    : {};

  return StyleSheet.create({
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
    subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: hasCustomBackground ? colors.ink : colors.inkSoft, textAlign: 'center', ...backgroundTextShadow },
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
    carouselStage: {
      width: '100%',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.66),
      backgroundColor: withAlpha(colors.paper, 0.48),
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 4,
    },
    carouselGlow: {
      position: 'absolute',
      top: -82,
      right: -44,
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: withAlpha(colors.accent, 0.14),
    },
    carouselGlowAlt: {
      position: 'absolute',
      bottom: -92,
      left: -54,
      width: 190,
      height: 190,
      borderRadius: 95,
      backgroundColor: withAlpha(colors.accentAlt ?? colors.accent, 0.1),
    },
    carouselHeaderRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    carouselEyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.accent,
    },
    friendCounterPill: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.42),
      backgroundColor: withAlpha(colors.accent, 0.12),
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    friendCounterText: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.ink,
    },
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
      backgroundColor: colors.paper,
    },
    inviteEyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      color: colors.ink,
    },
    inviteCode: { fontFamily: fonts.heading, fontSize: 22, letterSpacing: 3, color: colors.accent, ...protectTextFromFontClipping(fonts.heading, 22) },
    inviteLink: { alignSelf: 'stretch', fontFamily: fonts.body, fontSize: 11, color: colors.ink, textAlign: 'center' },
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
      borderColor: colors.accent,
      backgroundColor: colors.paper,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    emptySecondaryActionLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent },

    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: withAlpha(colors.paper, 0.72),
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.78),
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginHorizontal: spacing.lg,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
    searchBarIcon: { fontSize: 14 },
    searchBarInput: { fontFamily: fonts.body, fontSize: 13, color: colors.ink, flex: 1, padding: 0 },
    activeMeta: { alignSelf: 'stretch', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
    activeName: { fontFamily: fonts.heading, fontSize: 36, color: colors.ink, textAlign: 'center', width: '100%', ...protectTextFromFontClipping(fonts.heading, 36) },
    activeDescription: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: hasCustomBackground ? colors.ink : colors.inkSoft, textAlign: 'center', ...backgroundTextShadow },
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
      borderColor: withAlpha(colors.line, 0.72),
      backgroundColor: withAlpha(colors.paper, 0.78),
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
    floatingMemoryDock: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: withAlpha(colors.white, 0.28),
      backgroundColor: withAlpha(colors.paper, 0.34),
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.2,
      shadowRadius: 28,
      elevation: 12,
    },
    floatingMemoryDockBlur: {
      borderRadius: radius.pill,
    },
    floatingMemoryDockGlassTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(colors.paper, 0.16),
    },
    floatingMemoryDockHighlight: {
      position: 'absolute',
      top: 1,
      left: 18,
      right: 18,
      height: StyleSheet.hairlineWidth,
      backgroundColor: withAlpha(colors.white, 0.72),
    },
    floatingMemoryDockGlow: {
      position: 'absolute',
      top: -28,
      left: '34%',
      width: 108,
      height: 108,
      borderRadius: 54,
      backgroundColor: withAlpha(colors.accentAlt ?? colors.accent, 0.2),
    },
    floatingMemoryButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: withAlpha(colors.white, 0.3),
      backgroundColor: withAlpha(colors.paper, 0.5),
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
    },
    floatingMemoryButtonPrimary: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
      width: 58,
      height: 58,
      borderRadius: 29,
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 8,
    },
    floatingActionDisabled: {
      opacity: 0.45,
    },
    feedSection: { gap: spacing.sm },
    feedHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs },
    feedTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink, ...backgroundTextShadow, ...protectTextFromFontClipping(fonts.heading, 20) },
    feedSubtitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink, ...backgroundTextShadow },
    promptCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: withAlpha(colors.paper, hasCustomBackground ? 0.97 : 1),
      padding: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    promptIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentSoft,
      overflow: 'hidden',
    },
    promptAvatar: { width: '100%', height: '100%' },
    promptCardBody: { flex: 1, gap: 3 },
    promptCardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
    promptCardText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink },
    promptCardMeta: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.accent },
    throwbackBucket: { gap: spacing.sm },
    throwbackLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: hasCustomBackground ? colors.ink : colors.accent, textTransform: 'uppercase' as const, letterSpacing: 0.8, ...backgroundTextShadow },
    addButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
    },
    addButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  });
};

function withAlpha(color: string, alpha: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
