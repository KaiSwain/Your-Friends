import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { AppScreen } from '../../src/components/AppScreen';
import type { DayGroup } from '../../src/components/MonthScrollableMemoryWall';
import { MemoryWallViewToggle, MemoryWallViews, type MemoryWallViewMode } from '../../src/components/MemoryWallViews';
import { MemoryReplyThreadPreview } from '../../src/components/MemoryReplyThreadPreview';
import { ProfileBackgroundBackdrop } from '../../src/components/profile';
import { WallPostCard } from '../../src/components/WallPostCard';
import { useAuth } from '../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../src/features/social/SocialGraphContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import { cropAvatarImage } from '../../src/lib/avatarImage';
import { getReadableSurfaceColors, type ReadableSurfaceColors } from '../../src/lib/contrastText';
import { groupPostsByMemoryDateDay } from '../../src/lib/memoryDate';
import { onCapturedUri } from '../../src/lib/cameraHandoff';
import { avatarImagePickerOptions } from '../../src/lib/imagePickerPresets';
import { getProfileScreenGradientColors } from '../../src/hooks/useEffectiveProfileTheme';
import { backOnce, pushOnce } from '../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';
import type { WallPost } from '../../src/types/domain';

export default function MyProfileScreen() {
  const router = useRouter();
  const { currentUser, updateProfile } = useAuth();
  const { getProfileWallItemsForUser, getRepliesForWallPost, getUserById, getWallPostById, removePostFromProfileWall, setProfileWallRepliesHidden } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const readableSurfaces = useMemo(() => ({
    page: getReadableSurfaceColors(colors.canvas, colors),
    paper: getReadableSurfaceColors(colors.paper, colors),
    paperMuted: getReadableSurfaceColors(colors.paperMuted, colors),
  }), [colors]);
  const styles = useMemo(() => makeStyles(colors, fonts, readableSurfaces), [colors, fonts, readableSurfaces]);

  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [personalityTraits, setPersonalityTraits] = useState<string[]>(currentUser?.profilePersonalityTraits ?? []);
  const [newPersonalityTrait, setNewPersonalityTrait] = useState('');
  const [facts, setFacts] = useState<string[]>(currentUser?.profileFacts ?? []);
  const [newFact, setNewFact] = useState('');
  const [profileChipSaving, setProfileChipSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileActionPostId, setProfileActionPostId] = useState<string | null>(null);
  const [memoryWallViewMode, setMemoryWallViewMode] = useState<MemoryWallViewMode>('timeline');

  const profileWallItems = useMemo(() => {
    if (!currentUser) return [];
    return getProfileWallItemsForUser(currentUser.id);
  }, [currentUser?.id, getProfileWallItemsForUser, getWallPostById]);
  const memoryWallPosts = useMemo<WallPost[]>(() => (
    profileWallItems
      .map((item) => getWallPostById(item.wallPostId))
      .filter((post): post is WallPost => Boolean(post))
  ), [getWallPostById, profileWallItems]);
  const memoryWallDayGroups = useMemo<DayGroup[]>(() => groupPostsByMemoryDateDay(memoryWallPosts), [memoryWallPosts]);

  // Subscribe once on mount so a captured photo flows back into local state
  // without disturbing other unsaved profile edits.
  useEffect(() => onCapturedUri((uri) => {
    cropAvatarImage(uri)
      .then(setLocalImageUri)
      .catch(() => setLocalImageUri(uri));
  }), []);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const displayImage = localImageUri ?? currentUser.avatarPath ?? null;
  const profileBackgroundUri = currentUser.profileBgImagePath ?? null;
  const previewName = displayName.trim() || currentUser.displayName;
  const savedPersonalityTraits = currentUser.profilePersonalityTraits ?? [];
  const savedFacts = currentUser.profileFacts ?? [];
  const hasProfileChanges =
    displayName.trim() !== currentUser.displayName ||
    localImageUri !== null ||
    personalityTraits.length !== savedPersonalityTraits.length ||
    personalityTraits.some((trait, index) => trait !== savedPersonalityTraits[index]) ||
    facts.length !== savedFacts.length ||
    facts.some((fact, index) => fact !== savedFacts[index]);
  const topBar = undefined;

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync(avatarImagePickerOptions);
    if (!result.canceled && result.assets[0]) {
      try {
        setLocalImageUri(await cropAvatarImage(result.assets[0].uri));
      } catch {
        setLocalImageUri(result.assets[0].uri);
      }
    }
  }

  async function takePhoto() {
    pushOnce(router, { pathname: '/(app)/camera', params: { handoff: '1', avatarHandoff: '1' } });
  }

  async function saveProfileChips(
    updates: { profileFacts?: string[]; profilePersonalityTraits?: string[] },
    rollback: () => void,
  ) {
    setProfileChipSaving(true);
    try {
      await updateProfile(updates);
      return true;
    } catch (err: any) {
      rollback();
      Alert.alert('Could not save profile details', err.message ?? 'Try again in a moment.');
      return false;
    } finally {
      setProfileChipSaving(false);
    }
  }

  async function addPersonalityTrait() {
    if (profileChipSaving) return;
    const trait = newPersonalityTrait.trim();
    if (!trait || personalityTraits.some((entry) => entry.toLowerCase() === trait.toLowerCase())) return;
    const previousTraits = personalityTraits;
    const nextTraits = [...personalityTraits, trait];
    setPersonalityTraits(nextTraits);
    setNewPersonalityTrait('');
    const saved = await saveProfileChips(
      { profilePersonalityTraits: nextTraits },
      () => setPersonalityTraits(previousTraits),
    );
    if (!saved) setNewPersonalityTrait(trait);
  }

  async function removePersonalityTrait(trait: string) {
    if (profileChipSaving) return;
    const previousTraits = personalityTraits;
    const nextTraits = personalityTraits.filter((entry) => entry !== trait);
    setPersonalityTraits(nextTraits);
    await saveProfileChips(
      { profilePersonalityTraits: nextTraits },
      () => setPersonalityTraits(previousTraits),
    );
  }

  async function addFact() {
    if (profileChipSaving) return;
    const t = newFact.trim();
    if (!t || facts.includes(t)) return;
    const previousFacts = facts;
    const nextFacts = [...facts, t];
    setFacts(nextFacts);
    setNewFact('');
    const saved = await saveProfileChips(
      { profileFacts: nextFacts },
      () => setFacts(previousFacts),
    );
    if (!saved) setNewFact(t);
  }

  async function removeFact(fact: string) {
    if (profileChipSaving) return;
    const previousFacts = facts;
    const nextFacts = facts.filter((f) => f !== fact);
    setFacts(nextFacts);
    await saveProfileChips(
      { profileFacts: nextFacts },
      () => setFacts(previousFacts),
    );
  }

  async function handleSave() {
    if (!previewName) return;
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        avatarLocalUri: localImageUri,
        profilePersonalityTraits: personalityTraits,
        profileFacts: facts,
      });
      backOnce(router);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  }

  async function removeProfileMemory(postId: string) {
    if (!currentUser) return;
    setProfileActionPostId(postId);
    const result = await removePostFromProfileWall(currentUser.id, postId);
    setProfileActionPostId(null);
    if (!result.ok) Alert.alert('Could not remove memory', result.error);
  }

  async function setProfileMemoryRepliesVisibility(postId: string, repliesHidden: boolean) {
    if (!currentUser) return;
    setProfileActionPostId(postId);
    const result = await setProfileWallRepliesHidden(currentUser.id, postId, repliesHidden);
    setProfileActionPostId(null);
    if (!result.ok) Alert.alert('Could not update memory', result.error);
  }

  function handleProfileMemoryLongPress(postId: string, repliesHidden: boolean) {
    if (!currentUser || profileActionPostId) return;
    Alert.alert(
      'Profile memory options',
      'Choose what to do with this memory on your profile.',
      [
        { text: repliesHidden ? 'Unhide replies' : 'Hide replies', onPress: () => void setProfileMemoryRepliesVisibility(postId, !repliesHidden) },
        {
          text: 'Remove from profile',
          style: 'destructive',
          onPress: () => void removeProfileMemory(postId),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  return (
    <View style={styles.screenShell}>
      <ProfileBackgroundBackdrop colors={colors} imageUri={profileBackgroundUri} />
      <AppScreen
        header={topBar}
        floatingHeaderOnScroll
        gradientColors={getProfileScreenGradientColors(profileBackgroundUri, null)}
        footerAvoidsFloatingTabBar
        footer={hasProfileChanges ? (
          <ActionButton label={saving ? 'Saving…' : 'Save Profile'} onPress={handleSave} disabled={saving} />
        ) : undefined}
      >
        <Text style={styles.title}>Your Profile</Text>
        <Text style={styles.subtitle}>This is how friends see you when they add you.</Text>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <Pressable onPress={pickPhoto} style={styles.avatarFrame} accessibilityRole="button" accessibilityLabel="Change profile photo">
          {displayImage ? (
            <Image source={{ uri: displayImage }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: currentUser.avatarColor }]}>
              <Text style={styles.avatarInitials}>
                {previewName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
              </Text>
            </View>
          )}
          <View style={styles.avatarOverlay}>
            <Text style={styles.avatarOverlayText}>Change</Text>
          </View>
        </Pressable>
        <View style={styles.photoActions}>
          <Pressable onPress={pickPhoto} style={styles.photoPill} accessibilityRole="button" accessibilityLabel="Choose from gallery">
            <Text style={styles.photoPillLabel}>Gallery</Text>
          </Pressable>
          <Pressable onPress={takePhoto} style={styles.photoPill} accessibilityRole="button" accessibilityLabel="Take a photo">
            <Text style={styles.photoPillLabel}>Camera</Text>
          </Pressable>
        </View>
      </View>

      {/* Display Name */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Display Name</Text>
        <TextInput
          style={styles.textInput}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={currentUser.displayName}
          placeholderTextColor={colors.ink}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Personality Traits</Text>
        <Text style={styles.fieldHint}>Short traits friends can see and AI captions can use.</Text>
        {personalityTraits.length > 0 && (
          <View style={styles.factList}>
            {personalityTraits.map((trait) => (
              <View key={trait} style={styles.factChip}>
                <Text style={styles.factChipText}>{trait}</Text>
                <Pressable disabled={profileChipSaving} onPress={() => void removePersonalityTrait(trait)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove trait: ${trait}`}>
                  <Ionicons name="close" size={14} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={styles.addFactRow}>
          <TextInput
            style={styles.addFactInput}
            value={newPersonalityTrait}
            onChangeText={setNewPersonalityTrait}
            placeholder="Add a trait..."
            placeholderTextColor={colors.ink}
            onSubmitEditing={() => void addPersonalityTrait()}
            returnKeyType="done"
          />
          <Pressable disabled={profileChipSaving} onPress={() => void addPersonalityTrait()} style={[styles.addFactButton, profileChipSaving && styles.addFactButtonDisabled]} accessibilityRole="button" accessibilityLabel="Add personality trait">
            <Text style={styles.addFactButtonLabel}>{profileChipSaving ? '...' : '+'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Profile Facts */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Profile Facts</Text>
        <Text style={styles.fieldHint}>Quick facts visible to friends who add you.</Text>
        {facts.length > 0 && (
          <View style={styles.factList}>
            {facts.map((f) => (
              <View key={f} style={styles.factChip}>
                <Text style={styles.factChipText}>{f}</Text>
                <Pressable disabled={profileChipSaving} onPress={() => void removeFact(f)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove fact: ${f}`}>
                  <Ionicons name="close" size={14} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={styles.addFactRow}>
          <TextInput
            style={styles.addFactInput}
            value={newFact}
            onChangeText={setNewFact}
            placeholder="Add a fact…"
            placeholderTextColor={colors.ink}
            onSubmitEditing={() => void addFact()}
            returnKeyType="done"
          />
          <Pressable disabled={profileChipSaving} onPress={() => void addFact()} style={[styles.addFactButton, profileChipSaving && styles.addFactButtonDisabled]} accessibilityRole="button" accessibilityLabel="Add fact">
            <Text style={styles.addFactButtonLabel}>{profileChipSaving ? '...' : '+'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.memoryWallSection}>
        <View style={styles.memoryWallTitleGuard}>
          <Text style={styles.memoryWallTitle}>Memory Wall</Text>
        </View>
        <MemoryWallViewToggle
          colors={colors}
          fonts={fonts}
          onChange={setMemoryWallViewMode}
          tint={colors.accent}
          value={memoryWallViewMode}
        />
        <MemoryWallViews
          dayGroups={memoryWallDayGroups}
          emptyHint="No memories featured yet. Add favorites from a shared memory wall."
          getGridExtraHeight={(post) => {
            const profileWallItem = profileWallItems.find((item) => item.wallPostId === post.id);
            return profileWallItem?.repliesHidden ? 0 : getReplyGridExtraHeight(getRepliesForWallPost(post.id));
          }}
          themeColors={colors}
          viewMode={memoryWallViewMode}
          renderPost={(post, context) => {
            const authorName = post.authorUserId === currentUser.id
              ? currentUser.displayName
              : getUserById(post.authorUserId)?.displayName ?? 'Friend';
            const promptAuthorName = post.memoryPromptRequestId || post.promptVoice || post.promptText
              ? (post.subjectUserId ? getUserById(post.subjectUserId)?.displayName : null) ?? 'Someone'
              : undefined;
            const referencedPost = post.referencedWallPostId ? getWallPostById(post.referencedWallPostId) ?? null : null;
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
                  authorName={authorName}
                  post={post}
                  cardColor={post.cardColor}
                  themeColors={colors}
                  displayMode={context?.viewMode}
                  referencedPost={referencedPost}
                  referencedPostAuthorName={referencedPost ? getUserById(referencedPost.authorUserId)?.displayName ?? 'Someone' : undefined}
                  promptAuthorName={promptAuthorName}
                  shareable
                  onLongPress={() => handleProfileMemoryLongPress(post.id, repliesHidden)}
                />
                {!repliesHidden ? (
                  <MemoryReplyThreadPreview
                    replies={replyItems}
                    onOpenThread={() => pushOnce(router, `/(app)/memories/replies/${post.id}`)}
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

function getReplyGridExtraHeight(replies: { voice?: unknown }[]) {
  const visibleReplies = replies.slice(-3);
  return 34 + visibleReplies.reduce((height, reply) => height + (reply.voice ? 42 : 28), 0) + (replies.length > visibleReplies.length ? 24 : 0);
}

const AVATAR_SIZE = 100;
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
    backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
    backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    title: { fontFamily: fonts.heading, fontSize: 28, color: readableSurfaces.page.text, marginTop: spacing.sm, ...protectTextFromFontClipping(fonts.heading, 28) },
    subtitle: { fontFamily: fonts.body, fontSize: 14, color: readableSurfaces.page.mutedText, marginBottom: spacing.lg },

    avatarSection: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
    avatarFrame: {
      width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
      overflow: 'hidden', position: 'relative',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarPlaceholder: {
      width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center',
    },
    avatarInitials: { fontFamily: fonts.bodyBold, fontSize: 32, lineHeight: 36, color: colors.white, textAlign: 'center' },
    avatarOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 4, alignItems: 'center',
    },
    avatarOverlayText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: '#fff' },
    photoActions: { flexDirection: 'row', gap: spacing.sm },
    photoPill: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.pill, backgroundColor: colors.paper,
    },
    photoPillLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: readableSurfaces.paper.text },

    fieldGroup: { marginBottom: spacing.lg },
    fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: readableSurfaces.page.text, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
    fieldHint: { fontFamily: fonts.body, fontSize: 13, color: readableSurfaces.page.mutedText, marginBottom: spacing.sm },
    textInput: {
      fontFamily: fonts.body, fontSize: 16, color: colors.ink,
      backgroundColor: colors.paper, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },

    factList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
    factChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.paper, borderRadius: radius.pill,
      paddingHorizontal: spacing.sm, paddingVertical: 4,
    },
    factChipText: { fontFamily: fonts.body, fontSize: 13, color: readableSurfaces.paper.text },
    factChipRemove: { fontFamily: fonts.bodyMedium, fontSize: 16, color: readableSurfaces.paper.mutedText },

    addFactRow: { flexDirection: 'row', gap: spacing.xs },
    addFactInput: {
      flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink,
      backgroundColor: colors.paper, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    addFactButton: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    },
    addFactButtonDisabled: { opacity: 0.55 },
    addFactButtonLabel: { fontFamily: fonts.heading, fontSize: 20, color: colors.white, ...protectTextFromFontClipping(fonts.heading, 20) },

    memoryWallSection: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xl },
    memoryWallTitleGuard: {
      alignSelf: 'stretch',
      overflow: 'visible',
      paddingTop: 4,
      paddingBottom: 4,
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
    emptyHint: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
    profileMemoryItem: { alignItems: 'center', gap: spacing.xs },
  });
