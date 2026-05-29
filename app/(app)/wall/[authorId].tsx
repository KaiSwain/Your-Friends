import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { notifyMemoryAuthorRecipientDeveloped } from '../../../src/lib/memoryRecipientDevelopNotifications';
import { backOnce, pushOnce } from '../../../src/lib/navigationGuard';
import { showPromptPaywall } from '../../../src/lib/premiumGates';
import { isPromptExpired } from '../../../src/lib/promptExpiration';
import { getProfileScreenGradientColors, useEffectiveProfileTheme } from '../../../src/hooks/useEffectiveProfileTheme';
import { useIncomingMemoryDevelopStarts } from '../../../src/hooks/useIncomingMemoryDevelopStarts';
import { compareWallPostsByMemoryDateDesc, groupPostsByMemoryDateDay } from '../../../src/lib/memoryDate';
import {
  getNotificationIdsForMemoryPrompt,
  getNotificationIdsForMoviePrompt,
  getNotificationIdsForWallPost,
  getUnreadMemoryPromptIds,
  getUnreadMoviePromptIds,
  getUnreadWallPostIds,
  markProfileNotificationIdsRead,
} from '../../../src/lib/profileNotificationIndicators';
import { usePrioritizedWallImageLoading } from '../../../src/hooks/usePrioritizedWallImageLoading';
import { useSyntheticNotificationReads } from '../../../src/hooks/useSyntheticNotificationReads';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import type { FontSet } from '../../../src/theme/typography';
import { colors as baseColors, radius, spacing } from '../../../src/theme/tokens';
import type { WallPost } from '../../../src/types/domain';

export default function ViewYourWallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ authorId: string | string[] }>();
  const { currentUser } = useAuth();
  const { loading, getUserById, isConnected, getVisiblePostsByAuthor, getContactAboutMe, notifications, markNotificationRead, isPostOnProfileWall, addPostToProfileWall, cancelGiftNote, getGiftNotesForPair, getMovieReviewRequestsForPair, cancelMovieReviewRequest, getMemoryPromptRequestsForPair, cancelMemoryPromptRequest, getRepliesForWallPost, getWallPostById, refresh } = useSocialGraph();
  const { isPremium, isUserPremium } = usePremium();
  const { markSyntheticRead } = useSyntheticNotificationReads(currentUser?.id ?? null);
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
    resolvedMode,
    themedColors,
  } = useEffectiveProfileTheme(theirContactEarly?.profileBg);

  const styles = useMemo(
    () => makeStyles(effectiveColors, effectiveFonts, Boolean(theirContactEarly?.profileBgImagePath), resolvedMode),
    [effectiveColors, effectiveFonts, resolvedMode, theirContactEarly?.profileBgImagePath],
  );

  // The contact card the author created about the current user.
  const theirContact = author && currentUser ? getContactAboutMe(author.id, currentUser.id) : undefined;

  // ── Memory wall mode: shared wall (default) or their wall only.
  // both connected users' visible posts chronologically. ──
  const [wallMode, setWallMode] = useState<'theirs' | 'shared'>('shared');
  const [memoryWallViewMode, setMemoryWallViewMode] = useState<MemoryWallViewMode>('timeline');
  const [memoryFilter, setMemoryFilter] = useState<MemoryFilter>('all');
  const [viewedGlowPostIds, setViewedGlowPostIds] = useState<Set<string>>(() => new Set());
  const [viewedGlowMemoryPromptIds, setViewedGlowMemoryPromptIds] = useState<Set<string>>(() => new Set());
  const [viewedGlowMoviePromptIds, setViewedGlowMoviePromptIds] = useState<Set<string>>(() => new Set());
  const scrollViewRef = useRef<ScrollView | null>(null);
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
  const getIncomingDevelopStartAt = useIncomingMemoryDevelopStarts(wallPosts, currentUser?.id, wallMode === 'shared');
  const personalityTraits = theirContact?.personalityTraits ?? [];
  const facts = theirContact?.facts ?? [];
  const wallImageLoading = usePrioritizedWallImageLoading(wallPosts, true);
  const lockedGiftNotes = currentUser?.id && author?.id
    ? getGiftNotesForPair(currentUser.id, author.id).filter((note) => note.status === 'locked')
    : [];
  const moviePromptRequests = currentUser?.id && author?.id && wallMode === 'shared'
    ? getMovieReviewRequestsForPair(currentUser.id, author.id).filter((request) => request.status === 'pending' && !isPromptExpired(request))
    : [];
  const memoryPromptRequests = currentUser?.id && author?.id && wallMode === 'shared'
    ? getMemoryPromptRequestsForPair(currentUser.id, author.id).filter((request) => request.status === 'pending' && !isPromptExpired(request))
    : [];
  const unreadMemoryPromptIds = useMemo(() => getUnreadMemoryPromptIds(notifications), [notifications]);
  const unreadMoviePromptIds = useMemo(() => getUnreadMoviePromptIds(notifications), [notifications]);
  const unreadWallPostIds = useMemo(() => getUnreadWallPostIds(notifications), [notifications]);
  const highlightedMemoryPromptIds = useMemo(() => mergeStringSets(unreadMemoryPromptIds, viewedGlowMemoryPromptIds), [unreadMemoryPromptIds, viewedGlowMemoryPromptIds]);
  const highlightedMoviePromptIds = useMemo(() => mergeStringSets(unreadMoviePromptIds, viewedGlowMoviePromptIds), [unreadMoviePromptIds, viewedGlowMoviePromptIds]);
  const unreadIncomingPromptCount = currentUser?.id && wallMode === 'shared'
    ? memoryPromptRequests.filter((request) => request.recipientUserId === currentUser.id && unreadMemoryPromptIds.has(request.id)).length
      + moviePromptRequests.filter((request) => request.recipientUserId === currentUser.id && unreadMoviePromptIds.has(request.id)).length
    : 0;
  const newMemoryPromptIds = memoryPromptRequests
    .filter((request) => request.recipientUserId === currentUser?.id && highlightedMemoryPromptIds.has(request.id))
    .map((request) => request.id);
  const newMoviePromptIds = moviePromptRequests
    .filter((request) => request.recipientUserId === currentUser?.id && highlightedMoviePromptIds.has(request.id))
    .map((request) => request.id);

  function openMemoryComposer(kind: 'note' | 'song') {
    if (!author) return;
    pushOnce(router, {
      pathname: '/(app)/memories/add',
      params: {
        subjectId: author.id,
        subjectType: 'user',
        targetKeys: `user:${author.id}`,
        kind,
        backTo: `/(app)/wall/${author.id}`,
      },
    });
  }

  function openMemoryPrompt() {
    if (!author) return;
    Alert.alert(`Add to ${author.displayName}'s wall`, 'What kind of memory?', [
      { text: 'Note', onPress: () => openMemoryComposer('note') },
      { text: 'Song', onPress: () => openMemoryComposer('song') },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
    markProfileNotificationIdsRead(
      getNotificationIdsForMoviePrompt(notifications, requestId),
      markNotificationRead,
      markSyntheticRead,
    );
    pushOnce(router, `/(app)/movies/review/${requestId}`);
  }

  function openMemoryPromptRequest() {
    if (!author) return;
    if (!isPremium) {
      showPromptPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
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
    markProfileNotificationIdsRead(
      getNotificationIdsForMemoryPrompt(notifications, requestId),
      markNotificationRead,
      markSyntheticRead,
    );
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
      if (n.message.includes('added a personality trait about you: ')) {
        const trait = n.message.split('added a personality trait about you: ')[1];
        if (trait) set.add(trait);
      }
    }
    return set;
  }, [authorNotifications]);
  const glowPostIds = useMemo(() => mergeStringSets(unreadWallPostIds, viewedGlowPostIds), [unreadWallPostIds, viewedGlowPostIds]);
  const newSharedMemoryCount = wallMode === 'shared'
    ? unfilteredWallPosts.filter((post) => glowPostIds.has(post.id)).length
    : 0;
  const wallViewIndicators = {
    timeline: newSharedMemoryCount,
    grid: newSharedMemoryCount,
    prompts: unreadIncomingPromptCount,
  };
  const glowHero = useMemo(() =>
    authorNotifications.some(
      (n) => n.type === 'contact_update'
        && (n.message.includes('updated your profile') || n.message.includes('profile background')),
    ),
    [authorNotifications],
  );

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

  useEffect(() => {
    if (!currentUser?.id || !author?.id) return undefined;

    const visibleUnreadPostIds = wallPosts
      .filter((post) => unreadWallPostIds.has(post.id))
      .map((post) => post.id);
    const shouldClearPromptNotifications = memoryWallViewMode === 'prompts';
    const visibleUnreadMemoryPromptIds = shouldClearPromptNotifications
      ? memoryPromptRequests
        .filter((request) => request.recipientUserId === currentUser.id && unreadMemoryPromptIds.has(request.id))
        .map((request) => request.id)
      : [];
    const visibleUnreadMoviePromptIds = shouldClearPromptNotifications
      ? moviePromptRequests
        .filter((request) => request.recipientUserId === currentUser.id && unreadMoviePromptIds.has(request.id))
        .map((request) => request.id)
      : [];
    const profileUpdateNotificationIds = notifications
      .filter((notification) => !notification.read && notification.actorUserId === author.id && notification.type === 'contact_update')
      .map((notification) => notification.id);
    const notificationIds = uniqueStrings([
      ...profileUpdateNotificationIds,
      ...visibleUnreadPostIds.flatMap((postId) => getNotificationIdsForWallPost(notifications, postId)),
      ...visibleUnreadMemoryPromptIds.flatMap((requestId) => getNotificationIdsForMemoryPrompt(notifications, requestId)),
      ...visibleUnreadMoviePromptIds.flatMap((requestId) => getNotificationIdsForMoviePrompt(notifications, requestId)),
    ]);

    if (notificationIds.length === 0) return undefined;
    if (visibleUnreadPostIds.length > 0) setViewedGlowPostIds((current) => addStringsToSet(current, visibleUnreadPostIds));
    if (visibleUnreadMemoryPromptIds.length > 0) setViewedGlowMemoryPromptIds((current) => addStringsToSet(current, visibleUnreadMemoryPromptIds));
    if (visibleUnreadMoviePromptIds.length > 0) setViewedGlowMoviePromptIds((current) => addStringsToSet(current, visibleUnreadMoviePromptIds));

    const timeout = setTimeout(() => {
      markProfileNotificationIdsRead(notificationIds, markNotificationRead, markSyntheticRead);
    }, 900);
    return () => clearTimeout(timeout);
  }, [author?.id, currentUser?.id, markNotificationRead, markSyntheticRead, memoryPromptRequests, memoryWallViewMode, moviePromptRequests, notifications, unreadMemoryPromptIds, unreadMoviePromptIds, unreadWallPostIds, wallPosts]);

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

  if (personalityTraits.length > 0) {
    screenContent.push(
      <View key="personality-traits" style={styles.section}>
        <Text style={styles.sectionTitle}>Personality Traits</Text>
        <View style={styles.factList}>
          {personalityTraits.map((trait) => (
            <View key={trait} style={[styles.factChip, glowFactTexts.has(trait) && styles.glowRow]}>
              <Text style={styles.factChipText}>{trait}</Text>
            </View>
          ))}
        </View>
      </View>,
    );
  }

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
            <Ionicons name="sparkles-outline" size={14} color={effectiveColors.accentTertiary ?? effectiveColors.accent} />
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
            newMemoryPromptIds={newMemoryPromptIds}
            newMoviePromptIds={newMoviePromptIds}
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
        getGridExtraHeight={(post) => getReplyGridExtraHeight(getRepliesForWallPost(post.id))}
        themeColors={effectiveColors}
        viewMode={memoryWallViewMode}
        renderPost={(post, context) => {
          const isMine = currentUser ? post.authorUserId === currentUser.id : false;
          const postAuthorName = isMine ? (currentUser?.displayName ?? 'You') : author.displayName;
          const promptAuthorName = post.memoryPromptRequestId || post.promptVoice || post.promptText
            ? (post.subjectUserId ? getUserById(post.subjectUserId)?.displayName : null) ?? 'Someone'
            : undefined;
          const referencedPost = post.referencedWallPostId ? getWallPostById(post.referencedWallPostId) ?? null : null;
          const replies = getRepliesForWallPost(post.id);
          const replyItems = replies.map((reply) => ({
            id: reply.id,
            body: reply.body,
            voice: reply.voice,
            authorName: getUserById(reply.authorUserId)?.displayName ?? 'Someone',
          }));
          return (
            <View
              key={post.id}
              style={[styles.wallPostWithProfileAction, glowPostIds.has(post.id) && styles.glowRow]}
            >
              <WallPostCard
                authorName={postAuthorName}
                post={post}
                cardColor={post.cardColor}
                developStartAt={getIncomingDevelopStartAt(post)}
                themeColors={effectiveColors}
                imageLoadEnabled={wallImageLoading.isImageLoadEnabled(post)}
                displayMode={context?.viewMode}
                referencedPost={referencedPost}
                referencedPostAuthorName={referencedPost ? getUserById(referencedPost.authorUserId)?.displayName ?? 'Someone' : undefined}
                promptAuthorName={promptAuthorName}
                shareable
                onLongPress={() => handleMemoryLongPress(post)}
                onDeveloped={getIncomingDevelopStartAt(post) ? () => {
                  notifyMemoryAuthorRecipientDeveloped({
                    post,
                    recipientName: currentUser.displayName,
                    recipientUserId: currentUser.id,
                  }).catch((error) => console.warn('[notification] recipient developed memory insert failed:', error));
                } : undefined}
                onImageReady={wallImageLoading.markImageReady}
              />
              {glowPostIds.has(post.id) ? (
                <View style={styles.newMemoryPill}>
                  <Text style={styles.newMemoryPillText}>New</Text>
                </View>
              ) : null}
              <MemoryReplyThreadPreview
                replies={replyItems}
                onOpenThread={() => {
                  markProfileNotificationIdsRead(
                    getNotificationIdsForWallPost(notifications, post.id),
                    markNotificationRead,
                    markSyntheticRead,
                  );
                  pushOnce(router, `/(app)/memories/replies/${post.id}`);
                }}
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
      <ProfileBackgroundBackdrop colors={effectiveColors} imageUri={profileBgImagePath} tintColors={themedColors} />
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
  if (filter === 'photos') return posts.filter((post) => post.postType === 'polaroid' || post.postType === 'media');
  if (filter === 'notes') return posts.filter((post) => post.postType === 'note');
  if (filter === 'songs') return posts.filter((post) => post.postType === 'song' || Boolean(post.song));
  if (filter === 'movies') return posts.filter((post) => post.postType === 'movie');
  return posts.filter((post) => Boolean(post.memoryPromptRequestId || post.promptText || post.promptType));
}

function getReplyGridExtraHeight(replies: { voice?: unknown }[]) {
  const visibleReplies = replies.slice(-3);
  return 34 + visibleReplies.reduce((height, reply) => height + (reply.voice ? 42 : 28), 0) + (replies.length > visibleReplies.length ? 24 : 0);
}

function mergeStringSets(left: ReadonlySet<string>, right: ReadonlySet<string> | readonly string[]) {
  return new Set([...left, ...right]);
}

function addStringsToSet(current: Set<string>, values: readonly string[]) {
  if (values.every((value) => current.has(value))) return current;
  return new Set([...current, ...values]);
}

function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values));
}

const makeStyles = (colors: ColorTokens, fonts: FontSet, hasBackgroundImage = false, mode: 'light' | 'dark' = 'light') => {
  const altTint = colors.accentAlt ?? colors.accent;
  const tertiaryTint = colors.accentTertiary ?? colors.accentSoft ?? colors.accent;
  const yellowTextShadow = mode === 'light' ? readableYellowTextShadow : {};
  const backgroundTextColor = hasBackgroundImage ? colors.white : colors.ink;
  const backgroundMutedTextColor = hasBackgroundImage ? colors.white : colors.inkSoft;
  const backgroundTextShadow = hasBackgroundImage
    ? {
      textShadowColor: 'rgba(0,0,0,0.78)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    }
    : {};

  return StyleSheet.create({
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
    topBar: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
    backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    topBarFriendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      maxWidth: 168,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: tertiaryTint + '35',
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
    heroSubtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: backgroundMutedTextColor, ...backgroundTextShadow },
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
      color: backgroundTextColor,
      overflow: 'visible' as const,
      ...backgroundTextShadow,
      ...protectTextFromFontClipping(fonts.heading, 22),
    },
    memoryWallTitle: {
      fontFamily: fonts.handwrittenBold,
      fontSize: 40,
      color: backgroundTextColor,
      textAlign: 'left',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible' as const,
      ...backgroundTextShadow,
      ...protectTextFromFontClipping(fonts.handwrittenBold, 40),
    },
    factList: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
    factChip: {
      borderRadius: radius.pill,
      backgroundColor: tertiaryTint + '18',
      borderWidth: 1,
      borderColor: tertiaryTint + '40',
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
    emptyHint: { fontFamily: fonts.body, fontSize: 14, color: backgroundMutedTextColor, ...backgroundTextShadow },
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
    memoryFilterChipActive: { backgroundColor: altTint + '1A', borderColor: altTint + '55' },
    memoryFilterText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
    memoryFilterTextActive: { color: altTint, ...yellowTextShadow },
    lockedGiftBlock: { gap: spacing.sm },
    memoryPromptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: tertiaryTint + '55',
      backgroundColor: tertiaryTint + '18',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    memoryPromptButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: tertiaryTint, ...yellowTextShadow },
    monthWallPostsBlock: { marginTop: -spacing.md },
    wallPostWithProfileAction: { alignItems: 'center', gap: spacing.xs },
    newMemoryPill: {
      alignSelf: 'center',
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      marginTop: -spacing.xs,
    },
    newMemoryPillText: { fontFamily: fonts.bodyBold, fontSize: 11, color: baseColors.success, textTransform: 'uppercase' },
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
      backgroundColor: altTint + '1A',
      borderWidth: 1,
      borderColor: altTint + '55',
    },
    wallModeLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.ink,
    },
    wallModeLabelActive: {
      color: altTint,
    },
  });
};

const readableYellowTextShadow = {
  textShadowColor: 'rgba(74, 52, 12, 0.34)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 1.5,
};
