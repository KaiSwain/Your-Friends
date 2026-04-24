import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ReactNode, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import {
  MonthMemoryWallContent,
  MonthMemoryWallPicker,
  MonthMemoryWallStickyHeader,
  useMonthScrollableMemoryWall,
} from '../../../../src/components/MonthScrollableMemoryWall';
import { ProfileHeroCard } from '../../../../src/components/ProfileHeroCard';
import { SectionCard } from '../../../../src/components/SectionCard';
import { WallPostCard } from '../../../../src/components/WallPostCard';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../../src/features/theme/themes';
import type { FontSet } from '../../../../src/theme/typography';
import { accentPalette, radius, spacing } from '../../../../src/theme/tokens';
import type { WallPost } from '../../../../src/types/domain';

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string | string[] }>();
  const { currentUser } = useAuth();
  const { getUserById, isConnected, getWallPostsForSubject, getFriendFactsFor, addFriendFact, deleteFriendFact, deleteWallPost, updateWallPost } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [newFact, setNewFact] = useState('');
  const [factBusy, setFactBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostBody, setEditingPostBody] = useState('');
  const [editingPostImage, setEditingPostImage] = useState<string | null>(null);
  const [editingPostColor, setEditingPostColor] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [savingPost, setSavingPost] = useState(false);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  // Self-profile redirects to Your Profile
  if (userId === currentUser.id) {
    return <Redirect href="/(app)/profiles/me" />;
  }

  const profileUser = userId ? getUserById(userId) : undefined;

  if (!profileUser) {
    return (
      <AppScreen>
        <SectionCard title="We could not find that person.">
          <ActionButton label="Back to friends" onPress={() => router.replace('/(app)/friends')} />
        </SectionCard>
      </AppScreen>
    );
  }

  const connected = isConnected(currentUser.id, profileUser.id);
  const wallPosts = getWallPostsForSubject(profileUser.id, 'user');
  const monthWall = useMonthScrollableMemoryWall(wallPosts);
  // Viewer-centric: show facts YOU wrote about this friend
  const myFacts = getFriendFactsFor(currentUser.id, profileUser.id);

  async function handleAddFact() {
    if (!newFact.trim()) return;
    setFactBusy(true);
    try {
      await addFriendFact(currentUser!.id, { subjectUserId: profileUser!.id, body: newFact.trim() });
      setNewFact('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setFactBusy(false);
  }

  function handleDeleteFact(factId: string) {
    Alert.alert('Delete fact?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteFriendFact(factId) },
    ]);
  }

  function handleDeleteWallPost(postId: string) {
    Alert.alert('Delete memory?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteWallPost(postId) },
    ]);
  }

  function startEditingPost(post: WallPost) {
    setEditingPostId(post.id);
    setEditingPostBody(post.body);
    setEditingPostImage(post.imageUri);
    setEditingPostColor(post.cardColor ?? null);
    setImageChanged(false);
  }

  function cancelEditingPost() {
    setEditingPostId(null);
    setEditingPostBody('');
    setEditingPostImage(null);
    setEditingPostColor(null);
    setImageChanged(false);
  }

  async function pickEditImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setEditingPostImage(result.assets[0].uri);
      setImageChanged(true);
    }
  }

  async function saveEditingPost() {
    if (!editingPostId) return;
    setSavingPost(true);
    try {
      await updateWallPost(editingPostId, editingPostBody.trim(), imageChanged ? editingPostImage : undefined, editingPostColor);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSavingPost(false);
    cancelEditingPost();
  }

  function handleSaveBackText(postId: string, text: string) {
    const post = wallPosts.find((p) => p.id === postId);
    if (post) updateWallPost(postId, post.body, undefined, undefined, text);
  }

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
      </Pressable>
      <Pressable onPress={() => setEditing((prev) => !prev)} style={[styles.editButton, editing && styles.editButtonActive]}>
        <Text style={[styles.editButtonLabel, editing && styles.editButtonLabelActive]}>{editing ? 'Done' : 'Edit'}</Text>
      </Pressable>
    </View>
  );

  const screenContent: ReactNode[] = [];
  let stickyHeaderIndex: number | undefined;

  screenContent.push(
    <ProfileHeroCard
      key="hero"
      accentColor={profileUser.avatarColor}
      name={profileUser.displayName}
      subtitle={connected ? 'Connected friend' : `Friend code ${profileUser.friendCode}`}
      imageUri={profileUser.avatarPath}
    />,
  );

  if (connected) {
    screenContent.push(
      <ActionButton
        key="view-wall"
        label="View Your Wall"
        onPress={() => router.push(`/(app)/wall/${profileUser.id}`)}
        variant="primary"
      />,
    );
  }

  screenContent.push(
    <View key="facts" style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Notes</Text>
      </View>
      {myFacts.length > 0 ? (
        <View style={styles.factList}>
          {myFacts.map((fact) => (
            <View key={fact.id} style={styles.factChip}>
              <Text style={styles.factChipText}>{fact.body}</Text>
              {editing && (
                <Pressable onPress={() => handleDeleteFact(fact.id)}>
                  <Ionicons name="close" size={14} color={colors.error} />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyHint}>No notes yet. Add something you want to remember about {profileUser.displayName}.</Text>
      )}
      {editing && (
        <View style={styles.addFactRow}>
          <TextInput
            style={styles.addFactInput}
            value={newFact}
            onChangeText={setNewFact}
            placeholder="Add a note…"
            placeholderTextColor={colors.inkMuted}
          />
          <Pressable onPress={handleAddFact} disabled={factBusy} style={styles.addFactButton}>
            <Text style={styles.addFactButtonLabel}>{factBusy ? '…' : '+'}</Text>
          </Pressable>
        </View>
      )}
    </View>,
  );

  screenContent.push(
    <View key="memory-wall-controls" style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Memory Wall</Text>
        <Pressable onPress={() => router.push(`/(app)/memories/add?subjectId=${profileUser.id}&subjectType=user&backTo=${encodeURIComponent(`/(app)/profiles/user/${profileUser.id}`)}`)}>
          <Text style={styles.addLink}>Add</Text>
        </Pressable>
      </View>
      <MonthMemoryWallPicker
        monthGroups={monthWall.monthGroups}
        activeMonthKey={monthWall.activeMonth?.key ?? ''}
        onSelectMonth={monthWall.setSelectedMonthKey}
      />
    </View>,
  );

  if (!monthWall.activeMonth) {
    screenContent.push(
      <Text key="memory-wall-empty" style={styles.emptyHint}>No memories yet. Be the first to write one.</Text>,
    );
  } else {
    stickyHeaderIndex = screenContent.length;
    screenContent.push(
      <MonthMemoryWallStickyHeader key="memory-wall-month" label={monthWall.activeMonth.label} />,
    );
    screenContent.push(
      <View key="memory-wall-posts" style={styles.monthWallPostsBlock}>
        <MonthMemoryWallContent
          dayGroups={monthWall.activeMonth.dayGroups}
          renderPost={(post) => {
            const author = getUserById(post.authorUserId);
            const canEdit = post.authorUserId === currentUser.id;
            return (
              <View key={post.id}>
                <WallPostCard
                  authorName={author?.displayName ?? 'Unknown'}
                  post={post}
                  cardColor={post.cardColor}
                  editing={editing}
                  shareable={!editing}
                  onPress={editing && canEdit ? () => router.push({ pathname: '/(app)/memories/edit', params: { postId: post.id } }) : undefined}
                  onSaveBackText={canEdit ? handleSaveBackText : undefined}
                />
              </View>
            );
          }}
        />
      </View>,
    );
  }

  return (
    <AppScreen header={topBar} floatingHeaderOnScroll stickyHeaderIndices={stickyHeaderIndex !== undefined ? [stickyHeaderIndex] : undefined}>
      {screenContent}
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    backButton: { paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    editButton: {
      paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
      borderRadius: radius.pill, borderWidth: 1, borderColor: colors.accent,
    },
    editButtonActive: { backgroundColor: colors.accent },
    editButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent },
    editButtonLabelActive: { color: colors.white },
    section: { gap: spacing.sm },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
    addLink: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent },
    factList: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
    factChip: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.accent + '18',
      borderWidth: 1,
      borderColor: colors.accent + '40',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    factChipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
    deleteLink: { fontFamily: fonts.heading, fontSize: 20, color: colors.error, paddingLeft: spacing.sm },
    emptyHint: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
    addFactRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    addFactInput: {
      flex: 1, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1,
      borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      fontFamily: fonts.body, fontSize: 14, color: colors.ink,
    },
    addFactButton: {
      width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.accent,
      alignItems: 'center', justifyContent: 'center',
    },
    addFactButtonLabel: { fontFamily: fonts.heading, fontSize: 22, color: colors.white },
    monthWallPostsBlock: { marginTop: -spacing.md },
    editPanel: {
      gap: spacing.sm,
    },
    editControls: {
      backgroundColor: colors.paper, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
      padding: spacing.md, gap: spacing.sm,
    },
    editPhotoRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
    editPhotoButton: {
      paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
      borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line,
    },
    editPhotoButtonLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
    editPostInput: {
      borderRadius: radius.md, backgroundColor: colors.canvas,
      borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      fontFamily: fonts.body, fontSize: 14, color: colors.ink, minHeight: 60, textAlignVertical: 'top',
    },
    editActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    colorRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    colorSwatch: {
      width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    },
    colorCheck: { fontSize: 12, fontFamily: fonts.bodyBold, color: colors.ink },
    editSaveButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.accent },
    editSaveLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
    editCancelButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    editCancelLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
    editDeleteButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    editDeleteLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
  });
