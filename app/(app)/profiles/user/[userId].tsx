import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import { ProfileHeroCard } from '../../../../src/components/ProfileHeroCard';
import { SectionCard } from '../../../../src/components/SectionCard';
import { WallPostCard } from '../../../../src/components/WallPostCard';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../../src/features/theme/themes';
import { fonts } from '../../../../src/theme/typography';
import { accentPalette, radius, spacing } from '../../../../src/theme/tokens';
import type { WallPost } from '../../../../src/types/domain';

function groupPostsByDate(posts: WallPost[]) {
  const groups: { label: string; posts: WallPost[] }[] = [];
  let currentLabel = '';
  for (const post of posts) {
    const d = new Date(post.createdAt);
    const label = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, posts: [] });
    }
    groups[groups.length - 1].posts.push(post);
  }
  return groups;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string | string[] }>();
  const { currentUser } = useAuth();
  const { getUserById, isConnected, getWallPostsForSubject, getFriendFactsFor, addFriendFact, deleteFriendFact, deleteWallPost, updateWallPost } = useSocialGraph();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backLabel}>← Back</Text>
      </Pressable>
      <Pressable onPress={() => setEditing((prev) => !prev)} style={[styles.editButton, editing && styles.editButtonActive]}>
        <Text style={[styles.editButtonLabel, editing && styles.editButtonLabelActive]}>{editing ? 'Done' : 'Edit'}</Text>
      </Pressable>
    </View>
  );

  return (
    <AppScreen header={topBar}>

      <ProfileHeroCard
        accentColor={profileUser.avatarColor}
        name={profileUser.displayName}
        subtitle={connected ? 'Connected friend' : `Friend code ${profileUser.friendCode}`}
        imageUri={profileUser.avatarPath}
      />

      {connected && (
        <ActionButton
          label="View Your Wall"
          onPress={() => router.push(`/(app)/wall/${profileUser.id}`)}
          variant="primary"
        />
      )}

      {/* Facts YOU wrote about this friend */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Notes</Text>
        </View>
        {myFacts.length > 0 ? (
          <View style={styles.factList}>
            {myFacts.map((fact) => (
              <View key={fact.id} style={styles.factRow}>
                <Text style={styles.factText}>{fact.body}</Text>
                {editing && (
                  <Pressable onPress={() => handleDeleteFact(fact.id)}>
                    <Text style={styles.deleteLink}>×</Text>
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
      </View>

      {/* Memory wall */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Memory Wall</Text>
          <Pressable onPress={() => router.push(`/(app)/memories/add?subjectId=${profileUser.id}&subjectType=user`)}>
            <Text style={styles.addLink}>Add</Text>
          </Pressable>
        </View>
        {wallPosts.length > 0 ? (
          <View style={styles.wallList}>
            {groupPostsByDate(wallPosts).map((group) => (
              <View key={group.label}>
                <View style={styles.dateHeader}>
                  <View style={styles.dateLine} />
                  <Text style={styles.dateLabel}>{group.label}</Text>
                  <View style={styles.dateLine} />
                </View>
                {group.posts.map((post) => {
                  const author = getUserById(post.authorUserId);
                  const isEditingThis = editingPostId === post.id;
                  const canEdit = post.authorUserId === currentUser.id;
                  return (
                    <View key={post.id}>
                      {isEditingThis ? (
                        <View style={styles.editPanel}>
                          <WallPostCard
                            authorName={author?.displayName ?? 'Unknown'}
                            post={{ ...post, body: editingPostBody.trim(), imageUri: editingPostImage }}
                            cardColor={editingPostColor}
                          />
                          <View style={styles.editControls}>
                            <View style={styles.editPhotoRow}>
                              <Pressable onPress={pickEditImage} style={styles.editPhotoButton}>
                                <Text style={styles.editPhotoButtonLabel}>📷 Change Photo</Text>
                              </Pressable>
                              {editingPostImage && (
                                <Pressable onPress={() => { setEditingPostImage(null); setImageChanged(true); }} style={styles.editPhotoButton}>
                                  <Text style={[styles.editPhotoButtonLabel, { color: colors.error }]}>Remove Photo</Text>
                                </Pressable>
                              )}
                            </View>
                            <TextInput
                              style={styles.editPostInput}
                              value={editingPostBody}
                              onChangeText={setEditingPostBody}
                              placeholder="Write something…"
                              placeholderTextColor={colors.inkMuted}
                              multiline
                            />
                            <View style={styles.colorRow}>
                              <Pressable onPress={() => setEditingPostColor(null)} style={[styles.colorSwatch, { backgroundColor: colors.paper, borderColor: !editingPostColor ? colors.accent : colors.line }]}>
                                {!editingPostColor && <Text style={styles.colorCheck}>✓</Text>}
                              </Pressable>
                              {accentPalette.map((c) => (
                                <Pressable key={c} onPress={() => setEditingPostColor(c)} style={[styles.colorSwatch, { backgroundColor: c, borderColor: editingPostColor === c ? colors.ink : 'transparent' }]}>
                                  {editingPostColor === c && <Text style={styles.colorCheck}>✓</Text>}
                                </Pressable>
                              ))}
                            </View>
                            <View style={styles.editActions}>
                              <Pressable onPress={saveEditingPost} disabled={savingPost} style={styles.editSaveButton}>
                                <Text style={styles.editSaveLabel}>{savingPost ? 'Saving…' : 'Save'}</Text>
                              </Pressable>
                              <Pressable onPress={cancelEditingPost} style={styles.editCancelButton}>
                                <Text style={styles.editCancelLabel}>Cancel</Text>
                              </Pressable>
                              <View style={{ flex: 1 }} />
                              <Pressable onPress={() => { cancelEditingPost(); handleDeleteWallPost(post.id); }} style={styles.editDeleteButton}>
                                <Text style={styles.editDeleteLabel}>Delete</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      ) : (
                        <WallPostCard
                          authorName={author?.displayName ?? 'Unknown'}
                          post={post}
                          cardColor={post.cardColor}
                          onPress={editing && canEdit ? () => startEditingPost(post) : undefined}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyHint}>No memories yet. Be the first to write one.</Text>
        )}
      </View>
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens) =>
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
    factList: { gap: spacing.xs },
    factRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: colors.line,
    },
    factText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
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
    wallList: {
      gap: spacing.sm,
    },
    dateHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    dateLine: { flex: 1, height: 1, backgroundColor: colors.line },
    dateLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
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
