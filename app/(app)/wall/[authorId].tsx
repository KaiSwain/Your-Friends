import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { AppScreen } from '../../../src/components/AppScreen';
import {
  type DayGroup,
} from '../../../src/components/MonthScrollableMemoryWall';
import { MemoryWallViewToggle, MemoryWallViews, type MemoryWallViewMode } from '../../../src/components/MemoryWallViews';
import { LockedGiftNoteCard } from '../../../src/components/LockedGiftNoteCard';
import { MemoryPromptRequestList } from '../../../src/components/MemoryPromptRequestList';
import { MemoryReplyThreadPreview } from '../../../src/components/MemoryReplyThreadPreview';
import { MemoryProfileCard, ProfileBackgroundBackdrop, WallModeToggle } from '../../../src/components/profile';
import { SectionCard } from '../../../src/components/SectionCard';
import { ProfileSkeleton } from '../../../src/components/Skeleton';
import { WallPostCard } from '../../../src/components/WallPostCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { usePremium } from '../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { buildViewedWallProfileViewModel } from '../../../src/features/social/selectors';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { contrastText } from '../../../src/lib/contrastText';
import { backOnce, pushOnce } from '../../../src/lib/navigationGuard';
import { getProfileScreenGradientColors, useEffectiveProfileTheme } from '../../../src/hooks/useEffectiveProfileTheme';
import { compareWallPostsByMemoryDateDesc, groupPostsByMemoryDateDay } from '../../../src/lib/memoryDate';
import { usePrioritizedWallImageLoading } from '../../../src/hooks/usePrioritizedWallImageLoading';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import type { FontSet } from '../../../src/theme/typography';
import { radius, spacing } from '../../../src/theme/tokens';
import type { WallPost } from '../../../src/types/domain';

export default function ViewYourWallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ authorId: string | string[] }>();
  const { currentUser } = useAuth();
  const { loading, getUserById, isConnected, getVisiblePostsByAuthor, getContactAboutMe, notifications, markNotificationRead, isPostOnProfileWall, addPostToProfileWall, cancelGiftNote, getGiftNotesForPair, getMovieReviewRequestsForPair, cancelMovieReviewRequest, getMemoryPromptRequestsForPair, cancelMemoryPromptRequest, getRepliesForWallPost, refresh } = useSocialGraph();
  const { isUserPremium } = usePremium();
  const [refreshing, setRefreshing] = useState(false);

  const authorId = Array.isArray(params.authorId) ? params.authorId[0] : params.authorId;
  const author = authorId ? getUserById(authorId) : undefined;

  // Resolve bgPreset early so styles can adapt to the profile background.
  const theirContactEarly = (!loading && author && currentUser && isConnected(currentUser.id, author.id))
    ? getContactAboutMe(author.id, currentUser.id) : undefined;
  const {
    baseColors: colors,
    effectiveColors,
    effectiveFonts,
    themedColors,
  } = useEffectiveProfileTheme(theirContactEarly?.profileBg);

  const styles = useMemo(() => makeStyles(effectiveColors, effectiveFonts), [effectiveColors, effectiveFonts]);

  // The contact card the author created about the current user.
  const theirContact = author && currentUser ? getContactAboutMe(author.id, currentUser.id) : undefined;

  // ── Memory wall mode: shared wall (default) or their wall only.
  // both connected users' visible posts chronologically. ──
  const [wallMode, setWallMode] = useState<'theirs' | 'shared'>('shared');
  const [memoryWallViewMode, setMemoryWallViewMode] = useState<MemoryWallViewMode>('timeline');
  const [memoryFilter, setMemoryFilter] = useState<MemoryFilter>('all');
  const [focusedReferencePostId, setFocusedReferencePostId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const postLayoutYRef = useRef<Record<string, number>>({});
  const theirPosts = author && currentUser
    ? getVisiblePostsByAuthor(author.id).filter((post) => post.subjectUserId === currentUser.id)
    : [];
  const myPosts = currentUser && author && wallMode === 'shared'
    ? getVisiblePostsByAuthor(currentUser.id).filter((post) => post.subjectUserId === author.id)
    : [];
  const unfilteredWallPosts = useMemo(() => {
    if (wallMode === 'theirs') return theirPosts;
    return [...theirPosts, ...myPosts]
      .filter((post, index, posts) => posts.findIndex((candidate) => candidate.id === post.id) === index)
      .sort(compareWallPostsByMemoryDateDesc);
  }, [wallMode, theirPosts, myPosts]);
  const wallPosts = useMemo(() => filterWallPosts(unfilteredWallPosts, memoryFilter), [unfilteredWallPosts, memoryFilter]);
  const dayGroups = useMemo<DayGroup[]>(() => groupPostsByMemoryDateDay(wallPosts), [wallPosts]);
  const facts = theirContact?.facts ?? [];
  const wallImageLoading = usePrioritizedWallImageLoading(wallPosts, true);
  const lockedGiftNotes = currentUser?.id && author?.id
    ? getGiftNotesForPair(currentUser.id, author.id).filter((note) => note.status === 'locked')
    : [];
  const moviePromptRequests = currentUser?.id && author?.id && wallMode === 'shared'
    ? getMovieReviewRequestsForPair(currentUser.id, author.id).filter((request) => request.status === 'pending')
    : [];
  const memoryPromptRequests = currentUser?.id && author?.id && wallMode === 'shared'
    ? getMemoryPromptRequestsForPair(currentUser.id, author.id).filter((request) => request.status === 'pending')
    : [];
  const incomingPromptCount = currentUser?.id && wallMode === 'shared'
    ? memoryPromptRequests.filter((request) => request.recipientUserId === currentUser.id).length
      + moviePromptRequests.filter((request) => request.recipientUserId === currentUser.id).length
    : 0;

  function openMemoryPrompt() {
    if (!author) return;
    pushOnce(router, {
      pathname: '/(app)/memories/add',
      params: {
        subjectId: author.id,
        subjectType: 'user',
        targetKeys: `user:${author.id}`,
        backTo: `/(app)/wall/${author.id}`,
      },
    });
  }

  function openMovieRequest() {
    if (!author) return;
    pushOnce(router, {
      pathname: '/(app)/movies/request',
      params: {
        subjectId: author.id,
        subjectType: 'user',
        backTo: `/(app)/wall/${author.id}`,
      },
    });
  }

  function openMovieReviewResponse(requestId: string) {
    pushOnce(router, `/(app)/movies/review/${requestId}`);
  }

  function openMemoryPromptRequest() {
    if (!author) return;
    pushOnce(router, {
      pathname: '/(app)/prompts/request',
      params: {
        subjectId: author.id,
        subjectType: 'user',
        backTo: `/(app)/wall/${author.id}`,
      },
    });
  }

  function openMemoryPromptResponse(requestId: string) {
    pushOnce(router, `/(app)/prompts/respond/${requestId}`);
  }

  // Unread notifications from this author — used to highlight fresh items.
  const authorNotifications = useMemo(
    () => notifications.filter((n) => !n.read && n.actorUserId === authorId),
    [notifications, authorId],
  );
  const glowFactTexts = useMemo(() => {
    const set = new Set<string>();
    for (const n of authorNotifications) {
      if (n.message.includes('added a fact about you: ')) {
        const fact = n.message.split('added a fact about you: ')[1];
        if (fact) set.add(fact);
      }
    }
    return set;
  }, [authorNotifications]);
  const glowPostIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of authorNotifications) {
      if (n.type === 'wall_post' && n.referenceId) set.add(n.referenceId);
    }
    return set;
  }, [authorNotifications]);
  const newSharedMemoryCount = wallMode === 'shared'
    ? unfilteredWallPosts.filter((post) => glowPostIds.has(post.id)).length
    : 0;
  const wallViewIndicators = {
    timeline: newSharedMemoryCount,
    grid: newSharedMemoryCount,
    prompts: incomingPromptCount,
  };
  const glowHero = useMemo(() =>
    authorNotifications.some(
      (n) => n.type === 'contact_update'
        && (n.message.includes('updated your profile') || n.message.includes('profile background')),
    ),
    [authorNotifications],
  );

  // Mark notifications as read when leaving the screen (not immediately).
  const seenNotificationIds = useRef<string[]>([]);
  useEffect(() => {
    if (authorNotifications.length > 0) {
      seenNotificationIds.current = authorNotifications.map((n) => n.id);
    }
  }, [authorNotifications]);
  useEffect(() => {
    return () => {
      seenNotificationIds.current.forEach((id) => markNotificationRead(id));
    };
  }, []);

  async function handleAddToMyProfile(postId: string, repliesHidden = false) {
    if (!currentUser) return;
    const result = await addPostToProfileWall(currentUser.id, postId, { repliesHidden });
    if (!result.ok) Alert.alert('Could not add to profile', result.error);
  }

  function handleMemoryLongPress(post: WallPost) {
    if (!currentUser) return;
    if (isPostOnProfileWall(currentUser.id, post.id)) return;
    Alert.alert('Memory options', 'Choose what to do with this memory card.', [
      { text: 'Add with replies', onPress: () => handleAddToMyProfile(post.id, false) },
      { text: 'Add and hide replies', onPress: () => handleAddToMyProfile(post.id, true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handlePostLayout(postId: string, event: LayoutChangeEvent) {
    postLayoutYRef.current[postId] = event.nativeEvent.layout.y;
  }

  function focusReferencedPost(postId: string) {
    postLayoutYRef.current = {};
    setMemoryFilter('all');
    setMemoryWallViewMode('timeline');
    setFocusedReferencePostId(postId);
    [180, 420, 800].forEach((delay) => {
      setTimeout(() => {
        const y = postLayoutYRef.current[postId];
        if (typeof y === 'number') scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
      }, delay);
    });
    setTimeout(() => setFocusedReferencePostId((current) => current === postId ? null : current), 1800);
  }

  // All hooks are above this line. Now guard for auth / loading / missing author.
  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  if (loading) {
    return <AppScreen><ProfileSkeleton /></AppScreen>;
  }
  const profileBgImagePath = theirContact?.profileBgImagePath ?? null;

  if (!author || !isConnected(currentUser.id, author.id)) {
    return (
      <AppScreen
        header={(
          <Pressable onPress={() => backOnce(router)} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
          </Pressable>
        )}
        floatingHeaderOnScroll
      >
        <SectionCard title="This wall is not available.">
          <Text style={styles.emptyHint}>Use the back button to return to the previous screen.</Text>
        </SectionCard>
      </AppScreen>
    );
  }

  const friendHasPremium = isUserPremium(author.id);
  const profileCard = buildViewedWallProfileViewModel({
    accentColor: colors.accent,
    currentUser,
    friendHasPremium,
    glow: glowHero,
    theirContact,
  });

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => backOnce(router)} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
      </Pressable>
      <Pressable
        onPress={() => pushOnce(router, { pathname: '/(app)/profiles/user/[userId]', params: { userId: author.id, actual: '1' } })}
        style={styles.topBarFriendButton}
        accessibilityRole="button"
        accessibilityLabel={`Open ${author.displayName}'s profile`}
      >
        <View style={[styles.topBarFriendAvatar, { backgroundColor: author.avatarColor }]}>
          {author.avatarPath ? (
            <Image source={{ uri: author.avatarPath }} style={styles.topBarFriendAvatarImage} />
          ) : (
            <Text style={styles.topBarFriendAvatarText}>{author.displayName.trim().slice(0, 1).toUpperCase() || '?'}</Text>
          )}
        </View>
        <Text style={styles.topBarFriendName} numberOfLines={1}>{author.displayName}</Text>
      </Pressable>
    </View>
  );

  const screenContent: ReactNode[] = [];

  screenContent.push(
    <View key="hero" style={styles.heroSection}>
      <MemoryProfileCard
        accentColor={profileCard.accentColor}
        backText={profileCard.backText}
        cardColor={profileCard.cardColor}
        colors={effectiveColors}
        glow={profileCard.friendHasPremium || profileCard.glow}
        imageUri={profileCard.avatarUri}
        name={profileCard.displayName}
        note={profileCard.note}
        videoMuted={profileCard.videoMuted}
        videoUri={profileCard.videoUri}
      />
      {friendHasPremium ? (
        <View style={styles.heroPremiumBadge}>
          <Ionicons name="star" size={11} color="#7A5A1A" />
          <Text style={styles.heroPremiumBadgeText}>PREMIUM</Text>
        </View>
      ) : null}
      <Text style={styles.heroSubtitle}>{author.displayName}'s profile of you — tap to flip</Text>
    </View>,
  );

  if (facts.length > 0) {
    screenContent.push(
      <View key="facts" style={styles.section}>
        <Text style={styles.sectionTitle}>Facts</Text>
        <View style={styles.factList}>
          {facts.map((fact) => (
            <View key={fact} style={[styles.factChip, glowFactTexts.has(fact) && styles.glowRow]}>
              <Text style={styles.factChipText}>{fact}</Text>
            </View>
          ))}
        </View>
      </View>,
    );
  }

  screenContent.push(
    <View key="memory-wall-controls" style={styles.section}>
      <Text style={styles.memoryWallTitle}>Memory Wall</Text>
      <WallModeToggle
        colors={effectiveColors}
        fonts={effectiveFonts}
        onChange={setWallMode}
        options={[
          { key: 'shared', label: 'Shared wall' },
          { key: 'theirs', label: `${author.displayName}'s wall` },
        ]}
        tint={effectiveColors.accent}
        value={wallMode}
      />
      <MemoryWallViewToggle
        colors={effectiveColors}
        fonts={effectiveFonts}
        indicators={wallViewIndicators}
        onChange={setMemoryWallViewMode}
        tint={effectiveColors.accent}
        value={memoryWallViewMode}
      />
      <View style={styles.memoryFilterRow}>
        {MEMORY_FILTER_OPTIONS.map((option) => {
          const active = memoryFilter === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setMemoryFilter(option.key)}
              style={[styles.memoryFilterChip, active && styles.memoryFilterChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.memoryFilterText, active && styles.memoryFilterTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>,
  );

  screenContent.push(
    lockedGiftNotes.length > 0 ? (
      <View key="locked-gift-notes" style={styles.lockedGiftBlock}>
        {lockedGiftNotes.map((note) => {
          const otherUserId = note.authorUserId === currentUser.id ? note.recipientUserId : note.authorUserId;
          return (
            <LockedGiftNoteCard
              key={note.id}
              giftNote={note}
              themeColors={effectiveColors}
              tint={effectiveColors.accent}
              person={getUserById(otherUserId) ?? null}
              viewerUserId={currentUser.id}
              onCancel={note.authorUserId === currentUser.id ? () => cancelGiftNote(note.id, currentUser.id) : undefined}
            />
          );
        })}
      </View>
    ) : null,
  );

  screenContent.push(
    <View key="memory-wall-posts" style={styles.monthWallPostsBlock}>
      <MemoryWallViews
        dayGroups={dayGroups}
        emptyAction={wallMode === 'shared' ? (
          <Pressable
            onPress={openMemoryPrompt}
            style={styles.memoryPromptButton}
            accessibilityRole="button"
            accessibilityLabel={`Start a memory prompt for ${author.displayName}`}
          >
            <Ionicons name="sparkles-outline" size={14} color={effectiveColors.white} />
            <Text style={styles.memoryPromptButtonText}>Start with a prompt</Text>
          </Pressable>
        ) : undefined}
        emptyHint={wallMode === 'theirs'
          ? `${author.displayName} hasn't shared any memories yet.`
          : `No shared memories yet between you and ${author.displayName}.`}
        promptContent={wallMode === 'shared' ? (
          <MemoryPromptRequestList
            currentUserId={currentUser.id}
            friendName={author.displayName}
            memoryPrompts={memoryPromptRequests}
            moviePrompts={moviePromptRequests}
            onAnswerMemoryPrompt={openMemoryPromptResponse}
            onCancelMemoryPrompt={(requestId) => cancelMemoryPromptRequest(requestId, currentUser.id)}
            onCreateMemoryPrompt={openMemoryPromptRequest}
            onAnswerMoviePrompt={openMovieReviewResponse}
            onCancelMoviePrompt={(requestId) => cancelMovieReviewRequest(requestId, currentUser.id)}
            onCreateMoviePrompt={openMovieRequest}
            themeColors={effectiveColors}
            tint={effectiveColors.accent}
          />
        ) : undefined}
        getGridExtraHeight={(post) => getReplyGridExtraHeight(getRepliesForWallPost(post.id).length)}
        themeColors={effectiveColors}
        viewMode={memoryWallViewMode}
        renderPost={(post, context) => {
          const isMine = currentUser ? post.authorUserId === currentUser.id : false;
          const postAuthorName = isMine ? (currentUser?.displayName ?? 'You') : author.displayName;
          const referencedPost = post.referencedWallPostId
            ? unfilteredWallPosts.find((candidate) => candidate.id === post.referencedWallPostId) ?? null
            : null;
          const replies = getRepliesForWallPost(post.id);
          const replyItems = replies.map((reply) => ({
            id: reply.id,
            body: reply.body,
            authorName: getUserById(reply.authorUserId)?.displayName ?? 'Someone',
          }));
          return (
            <View
              key={post.id}
              onLayout={(event) => handlePostLayout(post.id, event)}
              style={[styles.wallPostWithProfileAction, (glowPostIds.has(post.id) || focusedReferencePostId === post.id) && styles.glowRow]}
            >
              <WallPostCard
                authorName={postAuthorName}
                post={post}
                cardColor={post.cardColor}
                themeColors={effectiveColors}
                imageLoadEnabled={wallImageLoading.isImageLoadEnabled(post)}
                displayMode={context?.viewMode}
                referencedPost={referencedPost}
                referencedPostAuthorName={referencedPost ? getUserById(referencedPost.authorUserId)?.displayName ?? 'Someone' : undefined}
                shareable
                onLongPress={() => handleMemoryLongPress(post)}
                onReferencedPostPress={post.referencedWallPostId ? focusReferencedPost : undefined}
                onImageReady={wallImageLoading.markImageReady}
              />
              <MemoryReplyThreadPreview
                replies={replyItems}
                onOpenThread={() => pushOnce(router, `/(app)/memories/replies/${post.id}`)}
                themeColors={effectiveColors}
              />
            </View>
          );
        }}
      />
    </View>,
  );

  return (
    <View style={styles.screenShell}>
      <ProfileBackgroundBackdrop colors={effectiveColors} imageUri={profileBgImagePath} />
      <AppScreen
        header={topBar}
        floatingHeaderOnScroll
        gradientColors={getProfileScreenGradientColors(profileBgImagePath, themedColors)}
        onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }}
        refreshing={refreshing}
        scrollViewRef={scrollViewRef}
      >
        {screenContent}
      </AppScreen>
    </View>
  );
}

const HERO_PHOTO = 200;
const HERO_PAD_SIDE = 10;
const HERO_PAD_TOP = 10;
const HERO_NOTE_LINES = 2;
const HERO_NOTE_LINE_HEIGHT = 18;
const HERO_NOTE_SLOT_HEIGHT = HERO_NOTE_LINES * HERO_NOTE_LINE_HEIGHT;
const HERO_BOTTOM_MIN_HEIGHT = 104;

const POLAROID_FRAME = '#F5F2EA';
const FRAME_INK = '#2A2218';
const FRAME_INK_SOFT = '#6B6052';

type MemoryFilter = 'all' | 'photos' | 'notes' | 'songs' | 'movies' | 'prompts';

const MEMORY_FILTER_OPTIONS: { key: MemoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'photos', label: 'Photos' },
  { key: 'notes', label: 'Notes' },
  { key: 'songs', label: 'Songs' },
  { key: 'movies', label: 'Movies' },
  { key: 'prompts', label: 'Prompts' },
];

function filterWallPosts(posts: WallPost[], filter: MemoryFilter) {
  if (filter === 'all') return posts;
  if (filter === 'photos') return posts.filter((post) => post.postType === 'polaroid');
  if (filter === 'notes') return posts.filter((post) => post.postType === 'note');
  if (filter === 'songs') return posts.filter((post) => post.postType === 'song' || Boolean(post.song));
  if (filter === 'movies') return posts.filter((post) => post.postType === 'movie');
  return posts.filter((post) => Boolean(post.memoryPromptRequestId || post.promptText || post.promptType));
}

function getReplyGridExtraHeight(replyCount: number) {
  const visibleReplies = Math.min(replyCount, 3);
  return 34 + visibleReplies * 28 + (replyCount > visibleReplies ? 24 : 0);
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    screenShell: { flex: 1 },
    profileBackgroundLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
      backgroundColor: colors.canvas,
    },
    profileBackgroundImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
      opacity: 0.68,
      transform: [{ scale: 1.04 }],
    },
    profileBackgroundScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.canvas + '99',
    },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    topBarFriendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      maxWidth: 168,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.accent + '35',
      backgroundColor: colors.paper + 'D9',
      paddingLeft: 3,
      paddingRight: spacing.sm,
      paddingVertical: 3,
    },
    topBarFriendAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    topBarFriendAvatarImage: { width: '100%', height: '100%' },
    topBarFriendAvatarText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.white },
    topBarFriendName: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },

    /* ── Hero polaroid card ── */
    heroSection: { alignItems: 'center', gap: spacing.sm },
    heroAmbientShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 8,
    },
    heroPremiumGlow: {
      shadowColor: '#F5C242',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.95,
      shadowRadius: 24,
      elevation: 14,
    },
    heroPremiumBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'center',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: '#F8DA7A',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: '#C99A2A',
      shadowColor: '#F5C242',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 6,
    },
    heroPremiumBadgeText: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 1.6,
      color: '#7A5A1A',
    },
    heroTape: {
      position: 'absolute',
      top: -7,
      alignSelf: 'center',
      width: 48,
      height: 14,
      backgroundColor: 'rgba(255,255,220,0.55)',
      borderRadius: 2,
      zIndex: 10,
    },
    heroTapeGhost: {
      backgroundColor: 'rgba(255,255,220,0.18)',
    },
    heroFaceHost: {
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    heroFaceOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    heroFace: {
      backfaceVisibility: 'hidden',
    },
    heroHiddenFace: {
      opacity: 0,
    },
    heroCard: {
      width: HERO_PHOTO + HERO_PAD_SIDE * 2,
      borderRadius: 2,
      backgroundColor: POLAROID_FRAME,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(0,0,0,0.10)',
      paddingTop: HERO_PAD_TOP,
      paddingHorizontal: HERO_PAD_SIDE,
      paddingBottom: 0,
      alignItems: 'center',
    },
    heroCardGhost: {
      borderColor: 'rgba(180,170,155,0.22)',
      opacity: 0.82,
    },
    heroPhotoFrame: {
      width: HERO_PHOTO,
      height: HERO_PHOTO,
      borderRadius: 1,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.045)',
    },
    heroPhotoFrameGhost: {
      borderColor: 'rgba(0,0,0,0.025)',
      backgroundColor: 'rgba(237,232,221,0.58)',
    },
    heroPhoto: { width: '100%', height: '100%', transform: [{ scale: 1.01 }] },
    heroPhotoLoading: { opacity: 0 },
    heroPhotoGhostSurface: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
      backgroundColor: '#DCD7CC',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroPhotoGhostBloom: {
      position: 'absolute' as const,
      width: '74%',
      height: '74%',
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.22)',
      transform: [{ rotate: '-8deg' }],
    },
    heroPhotoGhostBand: {
      position: 'absolute' as const,
      left: -26,
      right: -26,
      height: '38%',
      backgroundColor: 'rgba(255,255,255,0.12)',
      transform: [{ rotate: '-12deg' }],
    },
    heroWarmBaseTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(200,170,110,0.06)',
    },
    heroPhotoSheen: {
      ...StyleSheet.absoluteFillObject,
    },
    heroInsetShadowTop: {
      position: 'absolute', top: 0, left: 0, right: 0, height: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(0,0,0,0.12)',
    },
    heroInsetShadowLeft: {
      position: 'absolute', top: 0, left: 0, bottom: 0, width: 18,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: 'rgba(0,0,0,0.08)',
    },
    heroPhotoSurface: {
      flex: 1, width: '100%', height: '100%',
      alignItems: 'center', justifyContent: 'center',
    },
    heroInitials: { fontFamily: fonts.bodyBold, fontSize: 52, lineHeight: 58, color: colors.white, textAlign: 'center' },
    heroBottom: {
      width: '100%', paddingTop: 6, paddingBottom: 28,
      alignItems: 'center', gap: 4,
      overflow: 'visible' as const,
      minHeight: HERO_BOTTOM_MIN_HEIGHT,
      justifyContent: 'flex-start',
    },
    heroNoteSlot: { width: '100%', minHeight: HERO_NOTE_SLOT_HEIGHT, justifyContent: 'flex-start' },
    heroName: {
      fontFamily: fonts.handwrittenBold,
      fontSize: 26,
      color: FRAME_INK,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible' as const,
      ...protectTextFromFontClipping(fonts.handwrittenBold, 26),
    },
    heroNote: {
      fontFamily: fonts.handwritten,
      fontSize: 15,
      lineHeight: HERO_NOTE_LINE_HEIGHT,
      color: FRAME_INK_SOFT,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible' as const,
      ...protectTextFromFontClipping(fonts.handwritten, 15),
    },
    heroSubtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSoft },
    /* ── Hero back face ── */
    heroCardBack: {
      justifyContent: 'center',
      paddingTop: 20,
      paddingBottom: 20,
      paddingHorizontal: 16,
    },
    heroBackText: {
      fontFamily: fonts.handwritten,
      fontSize: 17,
      lineHeight: 24,
      color: FRAME_INK,
      textAlign: 'center',
      flex: 1,
      ...protectTextFromFontClipping(fonts.handwritten, 17),
    },
    heroBackPlaceholder: {
      fontFamily: fonts.handwritten,
      fontSize: 17,
      color: FRAME_INK_SOFT,
      textAlign: 'center',
      flex: 1,
      opacity: 0.5,
      ...protectTextFromFontClipping(fonts.handwritten, 17),
    },
    heroBackHint: { fontFamily: fonts.body, fontSize: 10, color: FRAME_INK_SOFT, textAlign: 'center', marginTop: 'auto' as any, opacity: 0.6 },

    /* ── Sections ── */
    section: { gap: spacing.sm },
    sectionTitle: {
      fontFamily: fonts.heading,
      fontSize: 22,
      color: colors.ink,
      overflow: 'visible' as const,
      ...protectTextFromFontClipping(fonts.heading, 22),
    },
    memoryWallTitle: {
      fontFamily: fonts.handwrittenBold,
      fontSize: 40,
      color: colors.ink,
      textAlign: 'left',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible' as const,
      ...protectTextFromFontClipping(fonts.handwrittenBold, 40),
    },
    factList: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
    factChip: {
      borderRadius: radius.pill,
      backgroundColor: colors.accent + '18',
      borderWidth: 1,
      borderColor: colors.accent + '40',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    factChipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
    glowRow: {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 6,
    },
    emptyHint: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
    memoryFilterRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
    memoryFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    memoryFilterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    memoryFilterText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
    memoryFilterTextActive: { color: colors.white },
    lockedGiftBlock: { gap: spacing.sm },
    memoryPromptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    memoryPromptButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
    monthWallPostsBlock: { marginTop: -spacing.md },
    wallPostWithProfileAction: { alignItems: 'center', gap: spacing.xs },
    wallModeToggle: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      backgroundColor: colors.canvasAlt,
      borderRadius: radius.pill,
      padding: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.inkMuted + '33',
    },
    wallModeChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
    },
    wallModeChipActive: {
      backgroundColor: colors.accent,
    },
    wallModeLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.inkSoft,
    },
    wallModeLabelActive: {
      color: contrastText(colors.accent),
    },
  });
