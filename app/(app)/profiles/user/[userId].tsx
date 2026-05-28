import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import type { DayGroup } from '../../../../src/components/MonthScrollableMemoryWall';
import { MemoryWallViewToggle, MemoryWallViews, type MemoryWallViewMode } from '../../../../src/components/MemoryWallViews';
import { MemoryReplyThreadPreview } from '../../../../src/components/MemoryReplyThreadPreview';
import { ProfileBackgroundBackdrop, SavedProfileLinkChooser } from '../../../../src/components/profile';
import { SectionCard } from '../../../../src/components/SectionCard';
import { WallPostCard } from '../../../../src/components/WallPostCard';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../../src/features/theme/themes';
import { getProfileScreenGradientColors } from '../../../../src/hooks/useEffectiveProfileTheme';
import { getReadableSurfaceColors, type ReadableSurfaceColors } from '../../../../src/lib/contrastText';
import { groupPostsByMemoryDateDay } from '../../../../src/lib/memoryDate';
import { backOnce, pushOnce, replaceOnce } from '../../../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../../../src/theme/fontProtection';
import { type FontSet } from '../../../../src/theme/typography';
import { radius, spacing } from '../../../../src/theme/tokens';
import type { Contact, WallPost } from '../../../../src/types/domain';

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string | string[]; actual?: string }>();
  const { currentUser } = useAuth();
  const {
    contacts,
    createLinkedContactForFriend,
    getManualContactCandidatesForFriend,
    getProfileWallItemsForUser,
    getRepliesForWallPost,
    getUserById,
    getWallPostById,
    isConnected,
    linkContactToFriend,
    moveContactLink,
    refresh,
    unlinkContactFromFriend,
  } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const readableSurfaces = useMemo(() => ({
    page: getReadableSurfaceColors(colors.canvas, colors),
    paper: getReadableSurfaceColors(colors.paper, colors),
    paperMuted: getReadableSurfaceColors(colors.paperMuted, colors),
  }), [colors]);
  const styles = useMemo(() => makeStyles(colors, fonts, readableSurfaces), [colors, fonts, readableSurfaces]);
  const [linkChooserOpen, setLinkChooserOpen] = useState(false);
  const [busyContactId, setBusyContactId] = useState<string | null>(null);
  const [creatingLinkedProfile, setCreatingLinkedProfile] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [memoryWallViewMode, setMemoryWallViewMode] = useState<MemoryWallViewMode>('timeline');

  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const showActualProfile = params.actual === '1';
  const profileUser = userId ? getUserById(userId) : undefined;
  const ownedLinkedContact = currentUser && userId
    ? contacts.find((contact) => contact.ownerUserId === currentUser.id && contact.linkedUserId === userId)
    : undefined;
  const connectedToProfileUser = Boolean(currentUser && profileUser && isConnected(currentUser.id, profileUser.id));
  const unlinkedContacts = useMemo(
    () => currentUser
      ? contacts.filter((contact) => contact.ownerUserId === currentUser.id && !contact.linkedUserId)
      : [],
    [contacts, currentUser?.id],
  );
  const suggestedContacts = useMemo(
    () => currentUser && profileUser ? getManualContactCandidatesForFriend(currentUser.id, profileUser.id) : [],
    [currentUser?.id, getManualContactCandidatesForFriend, profileUser?.id],
  );
  const profileWallItems = useMemo(
    () => profileUser ? getProfileWallItemsForUser(profileUser.id) : [],
    [getProfileWallItemsForUser, profileUser?.id],
  );
  const profileWallPosts = useMemo<WallPost[]>(
    () => profileWallItems
      .map((item) => getWallPostById(item.wallPostId))
      .filter((post): post is WallPost => Boolean(post)),
    [getWallPostById, profileWallItems],
  );
  const profileWallDayGroups = useMemo<DayGroup[]>(() => groupPostsByMemoryDateDay(profileWallPosts), [profileWallPosts]);
  const publicProfileBackgroundUri = profileUser?.profileBgImagePublic ? profileUser.profileBgImagePath ?? null : null;
  const publicProfileGradientColors = publicProfileBackgroundUri
    ? getProfileScreenGradientColors(publicProfileBackgroundUri, null)
    : ([colors.canvas, colors.canvasAlt, colors.canvas] as const);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  if (userId === currentUser.id) {
    return <Redirect href="/profiles/me" />;
  }

  if (ownedLinkedContact && !showActualProfile) {
    return <Redirect href={`/(app)/profiles/contact/${ownedLinkedContact.id}`} />;
  }

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => backOnce(router)} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
    </View>
  );

  if (!profileUser) {
    return (
      <AppScreen header={topBar} floatingHeaderOnScroll>
        <SectionCard title="We could not find that person.">
          <ActionButton label="Back to friends" onPress={() => replaceOnce(router, '/friends')} />
        </SectionCard>
      </AppScreen>
    );
  }

  if (isConnected(currentUser.id, profileUser.id) && !showActualProfile) {
    return (
      <View style={styles.screenShell}>
        <ProfileBackgroundBackdrop colors={colors} imageUri={publicProfileBackgroundUri} />
        <AppScreen
          header={topBar}
          floatingHeaderOnScroll
          gradientColors={publicProfileGradientColors}
        >
          <View style={styles.hero}>
            <Text style={styles.title}>Finishing friend setup...</Text>
            <Text style={styles.subtitle}>
              {profileUser.displayName} is now a connected friend. Their editable profile lives in your private contact card,
              and this screen will redirect there once sync finishes.
            </Text>
          </View>
          <ActionButton label="Refresh" onPress={() => void refresh()} />
          <ActionButton label="Back to friends" onPress={() => replaceOnce(router, '/friends')} variant="secondary" />
        </AppScreen>
      </View>
    );
  }

  async function linkSavedProfile(contact: Contact) {
    if (!currentUser || !profileUser) return;
    setBusyContactId(contact.id);
    setLinkError('');
    const result = ownedLinkedContact
      ? await moveContactLink(ownedLinkedContact.id, contact.id, currentUser.id)
      : await linkContactToFriend(contact.id, currentUser.id, profileUser.id);
    setBusyContactId(null);
    if (!result.ok) {
      setLinkError(result.error);
      Alert.alert('Could not update link', result.error);
      return;
    }
    setLinkChooserOpen(false);
    Alert.alert('Linked', `${profileUser.email} is now connected to your saved ${contact.displayName} profile.`);
  }

  function handlePickSavedProfile(contact: Contact) {
    if (!profileUser) return;
    Alert.alert(
      ownedLinkedContact ? 'Change linked profile?' : 'Connect this profile?',
      ownedLinkedContact
        ? `Move the ${profileUser.email} account from ${ownedLinkedContact.displayName} to your saved ${contact.displayName} profile?`
        : `Connect the ${profileUser.email} account to your saved ${contact.displayName} profile?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: ownedLinkedContact ? 'Change' : 'Connect', onPress: () => void linkSavedProfile(contact) },
      ],
    );
  }

  function handleUnlinkSavedProfile() {
    if (!currentUser || !profileUser || !ownedLinkedContact) return;
    Alert.alert(
      'Unlink saved profile?',
      `${ownedLinkedContact.displayName} will become a private saved profile again. The ${profileUser.email} account will stay your friend.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            setBusyContactId(ownedLinkedContact.id);
            setLinkError('');
            const result = await unlinkContactFromFriend(ownedLinkedContact.id, currentUser.id);
            setBusyContactId(null);
            if (!result.ok) {
              setLinkError(result.error);
              Alert.alert('Could not unlink', result.error);
              return;
            }
            setLinkChooserOpen(false);
          },
        },
      ],
    );
  }

  async function handleCreateLinkedProfile() {
    if (!currentUser || !profileUser) return;
    setCreatingLinkedProfile(true);
    setLinkError('');
    const result = await createLinkedContactForFriend(currentUser.id, profileUser.id);
    setCreatingLinkedProfile(false);
    if (!result.ok) {
      setLinkError(result.error);
      Alert.alert('Could not create profile', result.error);
      return;
    }
    replaceOnce(router, `/(app)/profiles/contact/${result.contactId}`);
  }

  return (
    <View style={styles.screenShell}>
      <ProfileBackgroundBackdrop colors={colors} imageUri={publicProfileBackgroundUri} />
      <AppScreen
        header={topBar}
        floatingHeaderOnScroll
        gradientColors={publicProfileGradientColors}
      >
      <View style={styles.hero}>
        <View style={[styles.avatarFrame, { backgroundColor: profileUser.avatarColor }]}>
          {profileUser.avatarPath ? (
            <Image source={{ uri: profileUser.avatarPath }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>{getInitials(profileUser.displayName)}</Text>
          )}
        </View>
        <Text style={styles.title}>{profileUser.displayName}</Text>
        <Text style={styles.subtitle}>{profileUser.email}</Text>
      </View>

      {connectedToProfileUser ? (
        <SectionCard eyebrow="Connection" title="Linked saved profile">
          {ownedLinkedContact ? (
            <>
              <View style={styles.linkedProfileCard}>
                <Text style={styles.linkedProfileTitle}>{ownedLinkedContact.displayName}</Text>
                <Text style={styles.linkedProfileSubtitle}>
                  This real account is connected to your saved memory profile for {ownedLinkedContact.displayName}.
                </Text>
              </View>
              <View style={styles.connectionActions}>
                <Pressable
                  onPress={() => replaceOnce(router, `/(app)/profiles/contact/${ownedLinkedContact.id}`)}
                  style={styles.connectionButton}
                  accessibilityRole="button"
                >
                  <Text style={styles.connectionButtonLabel}>View memory profile card</Text>
                </Pressable>
                <Pressable
                  onPress={() => setLinkChooserOpen((open) => !open)}
                  style={styles.connectionButton}
                  accessibilityRole="button"
                >
                  <Text style={styles.connectionButtonLabel}>{linkChooserOpen ? 'Hide profiles' : 'Change linked profile'}</Text>
                </Pressable>
                <Pressable
                  onPress={handleUnlinkSavedProfile}
                  disabled={busyContactId === ownedLinkedContact.id}
                  style={[styles.connectionButton, styles.dangerConnectionButton]}
                  accessibilityRole="button"
                >
                  <Text style={styles.dangerConnectionLabel}>
                    {busyContactId === ownedLinkedContact.id ? 'Unlinking...' : 'Unlink from saved profile'}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.connectionCopy}>
                Choose which saved memory profile belongs to {profileUser.email}, or create a new profile card for them.
              </Text>
              <View style={styles.connectionActions}>
                {unlinkedContacts.length > 0 ? (
                  <Pressable
                    onPress={() => setLinkChooserOpen((open) => !open)}
                    style={styles.connectionButton}
                    accessibilityRole="button"
                  >
                    <Text style={styles.connectionButtonLabel}>{linkChooserOpen ? 'Hide profiles' : 'Link to a saved profile'}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => void handleCreateLinkedProfile()}
                  disabled={creatingLinkedProfile || busyContactId !== null}
                  style={[styles.connectionButton, styles.primaryConnectionButton]}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryConnectionLabel}>
                    {creatingLinkedProfile ? 'Creating...' : 'Create new memory profile card'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
          {linkError ? <Text style={styles.connectionError}>{linkError}</Text> : null}
          {linkChooserOpen && unlinkedContacts.length > 0 ? (
            <View style={styles.profileChooserBlock}>
              <SavedProfileLinkChooser
                allContacts={unlinkedContacts}
                busyContactId={busyContactId}
                colors={colors}
                disabled={creatingLinkedProfile}
                fonts={fonts}
                onSelect={handlePickSavedProfile}
                suggestedContacts={suggestedContacts}
              />
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      {profileUser.profilePersonalityTraits.length > 0 ? (
        <SectionCard title="Personality traits">
          <View style={styles.factList}>
            {profileUser.profilePersonalityTraits.map((trait) => (
              <View key={trait} style={styles.factChip}>
                <Text style={styles.factChipText}>{trait}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      ) : null}

      {profileUser.profileFacts.length > 0 ? (
        <SectionCard title="Profile facts">
          <View style={styles.factList}>
            {profileUser.profileFacts.map((fact) => (
              <View key={fact} style={styles.factChip}>
                <Text style={styles.factChipText}>{fact}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      ) : null}

      <View style={styles.memoryWallSection}>
        <Text style={styles.memoryWallTitle}>Profile Memory Wall</Text>
        <MemoryWallViewToggle
          colors={colors}
          fonts={fonts}
          onChange={setMemoryWallViewMode}
          tint={colors.accent}
          value={memoryWallViewMode}
        />
        <MemoryWallViews
          dayGroups={profileWallDayGroups}
          emptyHint={`${profileUser.displayName} has not featured any memories yet.`}
          getGridExtraHeight={(post) => {
            const profileWallItem = profileWallItems.find((item) => item.wallPostId === post.id);
            return profileWallItem?.repliesHidden ? 0 : getReplyGridExtraHeight(getRepliesForWallPost(post.id));
          }}
          themeColors={colors}
          viewMode={memoryWallViewMode}
          renderPost={(post, context) => {
            const referencedPost = post.referencedWallPostId ? getWallPostById(post.referencedWallPostId) ?? null : null;
            const promptAuthorName = post.memoryPromptRequestId || post.promptVoice || post.promptText
              ? (post.subjectUserId ? getUserById(post.subjectUserId)?.displayName : null) ?? 'Someone'
              : undefined;
            const profileWallItem = profileWallItems.find((item) => item.wallPostId === post.id);
            const repliesHidden = profileWallItem?.repliesHidden ?? false;
            const replies = getRepliesForWallPost(post.id);
            const replyItems = replies.map((reply) => ({
              id: reply.id,
              body: reply.body,
              voice: reply.voice,
              authorName: getUserById(reply.authorUserId)?.displayName ?? 'Someone',
            }));
            return (
              <View key={post.id} style={styles.profileMemoryItem}>
                <WallPostCard
                  authorName={getUserById(post.authorUserId)?.displayName ?? 'Friend'}
                  post={post}
                  cardColor={post.cardColor}
                  themeColors={colors}
                  displayMode={context?.viewMode}
                  referencedPost={referencedPost}
                  referencedPostAuthorName={referencedPost ? getUserById(referencedPost.authorUserId)?.displayName ?? 'Someone' : undefined}
                  promptAuthorName={promptAuthorName}
                  shareable
                />
                {!repliesHidden ? (
                  <MemoryReplyThreadPreview
                    allowReply={false}
                    replies={replyItems}
                    themeColors={colors}
                  />
                ) : null}
              </View>
            );
          }}
          />
      </View>
      </AppScreen>
    </View>
  );
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

function getReplyGridExtraHeight(replies: { voice?: unknown }[]) {
  const visibleReplies = replies.slice(-3);
  return 34 + visibleReplies.reduce((height, reply) => height + (reply.voice ? 42 : 28), 0) + (replies.length > visibleReplies.length ? 24 : 0);
}

const makeStyles = (
  colors: ColorTokens,
  fonts: FontSet,
  readableSurfaces: {
    page: ReadableSurfaceColors;
    paper: ReadableSurfaceColors;
    paperMuted: ReadableSurfaceColors;
  },
) =>
  StyleSheet.create({
    screenShell: { flex: 1 },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    backButton: { minHeight: 38, borderRadius: 999, borderWidth: 0, backgroundColor: withAlpha(colors.paper, 0.18), paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
    backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    hero: { gap: spacing.sm, alignItems: 'center' },
    avatarFrame: {
      width: 112,
      height: 112,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: colors.paper,
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarInitials: { fontFamily: fonts.bodyBold, fontSize: 34, color: colors.white },
    title: { fontFamily: fonts.heading, fontSize: 28, color: readableSurfaces.page.text, textAlign: 'center', ...protectTextFromFontClipping(fonts.heading, 28) },
    subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: readableSurfaces.page.mutedText, textAlign: 'center' },
    linkedProfileCard: {
      gap: spacing.xs,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.38),
      backgroundColor: colors.paper,
    },
    linkedProfileTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: readableSurfaces.paper.text },
    linkedProfileSubtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: readableSurfaces.paper.mutedText },
    connectionCopy: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: readableSurfaces.paper.mutedText },
    connectionActions: { gap: spacing.sm, marginTop: spacing.md },
    connectionButton: {
      minHeight: 44,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.paper,
    },
    primaryConnectionButton: {
      backgroundColor: colors.accent,
      borderColor: withAlpha(colors.white, 0.18),
    },
    dangerConnectionButton: {
      borderColor: colors.error,
      backgroundColor: colors.paper,
    },
    connectionButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: readableSurfaces.paper.text, textAlign: 'center' },
    primaryConnectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white, textAlign: 'center' },
    dangerConnectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error, textAlign: 'center' },
    connectionError: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.error, marginTop: spacing.sm },
    profileChooserBlock: { marginTop: spacing.md },
    factList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    factChip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.38),
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    factChipText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: readableSurfaces.paper.text },
    memoryWallSection: { gap: spacing.sm },
    memoryWallTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 24) },
    emptyHint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.inkMuted },
    profileMemoryItem: { alignItems: 'center', gap: spacing.xs },
  });

function withAlpha(color: string, alpha: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}