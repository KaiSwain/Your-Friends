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
import { usePremium } from '../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../src/features/social/SocialGraphContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import { cropAvatarImage } from '../../src/lib/avatarImage';
import { contrastText, contrastTextSoft } from '../../src/lib/contrastText';
import { groupPostsByMemoryDateDay } from '../../src/lib/memoryDate';
import { onCapturedUri } from '../../src/lib/cameraHandoff';
import { avatarImagePickerOptions } from '../../src/lib/imagePickerPresets';
import { getProfileScreenGradientColors } from '../../src/hooks/useEffectiveProfileTheme';
import { backOnce, pushOnce } from '../../src/lib/navigationGuard';
import { showGalleryPaywall } from '../../src/lib/premiumGates';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';
import type { WallPost } from '../../src/types/domain';

export default function MyProfileScreen() {
  const router = useRouter();
  const { currentUser, updateProfile } = useAuth();
  const { isPremium } = usePremium();
  const { getProfileWallItemsForUser, getRepliesForWallPost, getUserById, getWallPostById, removePostFromProfileWall } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [facts, setFacts] = useState<string[]>(currentUser?.profileFacts ?? []);
  const [newFact, setNewFact] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingProfilePostId, setRemovingProfilePostId] = useState<string | null>(null);
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
  const savedFacts = currentUser.profileFacts ?? [];
  const hasProfileChanges =
    displayName.trim() !== currentUser.displayName ||
    localImageUri !== null ||
    facts.length !== savedFacts.length ||
    facts.some((fact, index) => fact !== savedFacts[index]);
  const topBar = undefined;

  async function pickPhoto() {
    if (!isPremium) {
      showGalleryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
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

  function addFact() {
    const t = newFact.trim();
    if (!t || facts.includes(t)) return;
    setFacts((prev) => [...prev, t]);
    setNewFact('');
  }

  function removeFact(fact: string) {
    setFacts((prev) => prev.filter((f) => f !== fact));
  }

  async function handleSave() {
    if (!previewName) return;
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        avatarLocalUri: localImageUri,
        profileFacts: facts,
      });
      backOnce(router);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  }

  function handleRemoveProfileMemory(postId: string) {
    if (!currentUser) return;
    Alert.alert(
      'Remove from your profile?',
      'This only removes the memory from your profile wall. It will not delete the original memory.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingProfilePostId(postId);
            const result = await removePostFromProfileWall(currentUser.id, postId);
            setRemovingProfilePostId(null);
            if (!result.ok) Alert.alert('Could not remove memory', result.error);
          },
        },
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
          placeholderTextColor={colors.inkMuted}
        />
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
                <Pressable onPress={() => removeFact(f)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove fact: ${f}`}>
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
            placeholderTextColor={colors.inkMuted}
            onSubmitEditing={addFact}
            returnKeyType="done"
          />
          <Pressable onPress={addFact} style={styles.addFactButton} accessibilityRole="button" accessibilityLabel="Add fact">
            <Text style={styles.addFactButtonLabel}>+</Text>
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
            return profileWallItem?.repliesHidden ? 0 : getReplyGridExtraHeight(getRepliesForWallPost(post.id).length);
          }}
          themeColors={colors}
          viewMode={memoryWallViewMode}
          renderPost={(post, context) => {
            const authorName = post.authorUserId === currentUser.id
              ? currentUser.displayName
              : getUserById(post.authorUserId)?.displayName ?? 'Friend';
            const referencedPost = post.referencedWallPostId ? getWallPostById(post.referencedWallPostId) ?? null : null;
            const profileWallItem = profileWallItems.find((item) => item.wallPostId === post.id);
            const repliesHidden = profileWallItem?.repliesHidden ?? false;
            const replies = getRepliesForWallPost(post.id);
            const replyItems = replies.map((reply) => ({
              id: reply.id,
              body: reply.body,
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
                  shareable
                />
                {!repliesHidden ? (
                  <MemoryReplyThreadPreview
                    replies={replyItems}
                    onOpenThread={() => pushOnce(router, `/(app)/memories/replies/${post.id}`)}
                    themeColors={colors}
                  />
                ) : null}
                <Pressable
                  onPress={() => handleRemoveProfileMemory(post.id)}
                  disabled={removingProfilePostId === post.id}
                  style={styles.removeProfileMemoryButton}
                  accessibilityRole="button"
                  accessibilityLabel="Remove memory from profile"
                >
                  <Ionicons name="remove-circle-outline" size={15} color={colors.error} />
                  <Text style={styles.removeProfileMemoryLabel}>
                    {removingProfilePostId === post.id ? 'Removing...' : 'Remove from my profile'}
                  </Text>
                </Pressable>
              </View>
            );
          }}
          />
      </View>
      </AppScreen>
    </View>
  );
}

function getReplyGridExtraHeight(replyCount: number) {
  const visibleReplies = Math.min(replyCount, 3);
  return 34 + visibleReplies * 28 + (replyCount > visibleReplies ? 24 : 0);
}

const AVATAR_SIZE = 100;
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
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, marginTop: spacing.sm, ...protectTextFromFontClipping(fonts.heading, 28) },
    subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginBottom: spacing.lg },

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
    photoPillLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },

    fieldGroup: { marginBottom: spacing.lg },
    fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
    fieldHint: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginBottom: spacing.sm },
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
    factChipText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
    factChipRemove: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.inkMuted },

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
    removeProfileMemoryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.error + '35',
      backgroundColor: colors.error + '10',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    removeProfileMemoryLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.error },
  });
