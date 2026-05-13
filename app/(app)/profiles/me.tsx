import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { MonthMemoryWallContent, type DayGroup } from '../../../src/components/MonthScrollableMemoryWall';
import { WallPostCard } from '../../../src/components/WallPostCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { usePremium } from '../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { contrastText, contrastTextSoft } from '../../../src/lib/contrastText';
import { onCapturedUri } from '../../../src/lib/cameraHandoff';
import { showGalleryPaywall } from '../../../src/lib/premiumGates';
import type { FontSet } from '../../../src/theme/typography';
import { radius, spacing } from '../../../src/theme/tokens';
import type { WallPost } from '../../../src/types/domain';

export default function MyProfileScreen() {
  const router = useRouter();
  const { currentUser, updateProfile } = useAuth();
  const { isPremium } = usePremium();
  const { getDirectFriends, getPeopleListForUser, getVisiblePostsByAuthor, getWallPostsForSubject, getUserById } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [facts, setFacts] = useState<string[]>(currentUser?.profileFacts ?? []);
  const [newFact, setNewFact] = useState('');
  const [saving, setSaving] = useState(false);

  const directFriends = currentUser ? getDirectFriends(currentUser.id) : [];
  const people = currentUser ? getPeopleListForUser(currentUser.id) : [];
  const memoryWallPosts = useMemo<WallPost[]>(() => {
    if (!currentUser) return [];

    const subjectRefs = people.flatMap((person) => [
      { id: person.id, entityType: person.entityType },
      ...(person.linkedUserId ? [{ id: person.linkedUserId, entityType: 'user' as const }] : []),
    ]);
    const myPostsAboutPeople = subjectRefs
      .filter((subject, index, subjects) =>
        subjects.findIndex((candidate) => candidate.id === subject.id && candidate.entityType === subject.entityType) === index,
      )
      .flatMap((subject) =>
        getWallPostsForSubject(subject.id, subject.entityType)
          .filter((post) => post.authorUserId === currentUser.id),
      );
    const friendsPostsAboutMe = directFriends.flatMap((friend) =>
      getVisiblePostsByAuthor(friend.id)
        .filter((post) => post.subjectUserId === currentUser.id),
    );

    return [...myPostsAboutPeople, ...friendsPostsAboutMe]
      .filter((post, index, posts) => posts.findIndex((candidate) => candidate.id === post.id) === index)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [currentUser?.id, directFriends, people, getVisiblePostsByAuthor, getWallPostsForSubject]);
  const memoryWallDayGroups = useMemo<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    let currentLabel = '';
    for (const post of memoryWallPosts) {
      const date = new Date(post.createdAt);
      const label = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, posts: [] });
      }
      groups[groups.length - 1].posts.push(post);
    }
    return groups;
  }, [memoryWallPosts]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const displayImage = localImageUri ?? currentUser.avatarPath ?? null;
  const previewName = displayName.trim() || currentUser.displayName;
  const savedFacts = currentUser.profileFacts ?? [];
  const hasProfileChanges =
    displayName.trim() !== currentUser.displayName ||
    localImageUri !== null ||
    facts.length !== savedFacts.length ||
    facts.some((fact, index) => fact !== savedFacts[index]);
  const topBar = (
    <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  async function pickPhoto() {
    if (!isPremium) {
      showGalleryPaywall(() => router.push('/(app)/store'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setLocalImageUri(result.assets[0].uri);
  }

  async function takePhoto() {
    // Open the in-app polaroid camera (with the polaroid frame overlay) and
    // receive the captured URI via the handoff bus when it pops back.
    router.push({ pathname: '/(app)/camera', params: { handoff: '1' } });
  }

  // Subscribe once on mount so a captured photo flows back into local state
  // without disturbing other unsaved profile edits.
  useEffect(() => onCapturedUri((uri) => setLocalImageUri(uri)), []);

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
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  }

  return (
    <AppScreen
      header={topBar}
      floatingHeaderOnScroll
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
        <Text style={styles.memoryWallTitle}>Memory Wall</Text>
        {memoryWallDayGroups.length === 0 ? (
          <Text style={styles.emptyHint}>No memories yet.</Text>
        ) : (
          <MonthMemoryWallContent
            dayGroups={memoryWallDayGroups}
            themeColors={colors}
            renderPost={(post) => {
              const authorName = post.authorUserId === currentUser.id
                ? currentUser.displayName
                : getUserById(post.authorUserId)?.displayName ?? 'Friend';
              return (
                <WallPostCard
                  key={post.id}
                  authorName={authorName}
                  post={post}
                  cardColor={post.cardColor}
                  themeColors={colors}
                  shareable
                />
              );
            }}
          />
        )}
      </View>
    </AppScreen>
  );
}

const AVATAR_SIZE = 100;
const PREVIEW_WIDTH = 160;

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, marginTop: spacing.sm },
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
    avatarInitials: { fontFamily: fonts.heading, fontSize: 36, color: colors.white },
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
    addFactButtonLabel: { fontFamily: fonts.heading, fontSize: 20, color: colors.white },

    memoryWallSection: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xl },
    memoryWallTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
    emptyHint: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },

    previewCard: {
      width: PREVIEW_WIDTH, borderRadius: radius.lg, overflow: 'hidden',
      alignSelf: 'center', paddingBottom: spacing.sm,
    },
    previewImage: { width: PREVIEW_WIDTH, height: PREVIEW_WIDTH, resizeMode: 'cover' },
    previewImagePlaceholder: {
      width: PREVIEW_WIDTH, height: PREVIEW_WIDTH,
      alignItems: 'center', justifyContent: 'center',
    },
    previewInitials: { fontFamily: fonts.heading, fontSize: 44 },
    previewName: { fontFamily: fonts.heading, fontSize: 16, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xs },
    previewCaption: { fontFamily: fonts.body, fontSize: 11, textAlign: 'center', paddingHorizontal: spacing.xs },
  });
