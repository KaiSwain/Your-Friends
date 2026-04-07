import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import { SectionCard } from '../../../../src/components/SectionCard';
import { WallPostCard } from '../../../../src/components/WallPostCard';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../../src/features/theme/themes';
import { fonts } from '../../../../src/theme/typography';
import { accentPalette, profileBackgrounds, radius, spacing } from '../../../../src/theme/tokens';
import { contrastText, contrastTextSoft, contrastAccent } from '../../../../src/lib/contrastText';
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

export default function ContactProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ contactId: string | string[] }>();
  const { currentUser } = useAuth();
  const { getContactById, getUserById, getDirectFriends, getPeopleListForUser, getWallPostsForSubject, addContactFact, deleteContactFact, deleteWallPost, updateWallPost, updateContact, migrateContactPostsToUser, togglePin, notifications } = useSocialGraph();
  const { colors } = useTheme();

  const [newFact, setNewFact] = useState('');
  const [factBusy, setFactBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostBody, setEditingPostBody] = useState('');
  const [editingPostImage, setEditingPostImage] = useState<string | null>(null);
  const [editingPostColor, setEditingPostColor] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [savingPost, setSavingPost] = useState(false);

  const contactId = Array.isArray(params.contactId) ? params.contactId[0] : params.contactId;
  const contact = contactId ? getContactById(contactId) : undefined;

  const linkedUser = contact?.linkedUserId
    ? getUserById(contact.linkedUserId)
    : currentUser && contact
      ? getDirectFriends(currentUser.id).find(
          (f) => f.displayName.toLowerCase() === contact.displayName.toLowerCase(),
        ) ?? undefined
      : undefined;

  const bgPreset = contact?.profileBg ? profileBackgrounds.find((b) => b.key === contact.profileBg) : undefined;
  const tint = bgPreset?.accent ?? colors.accent;
  const styles = useMemo(() => makeStyles(colors, tint), [colors, tint]);

  // Persist the discovered link so future memories route through subject_user_id.
  // Also migrate any existing wall posts so the friend can see them via RLS.
  useEffect(() => {
    if (!contact) return;
    if (!contact.linkedUserId && linkedUser) {
      updateContact(contact.id, { linkedUserId: linkedUser.id });
      migrateContactPostsToUser(contact.id, linkedUser.id);
    } else if (contact.linkedUserId) {
      migrateContactPostsToUser(contact.id, contact.linkedUserId);
    }
  }, [contact?.id, contact?.linkedUserId, linkedUser?.id]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  if (!contact || contact.ownerUserId !== currentUser.id) {
    return (
      <AppScreen>
        <SectionCard title="That contact is not in your private list.">
          <ActionButton label="Back to friends" onPress={() => router.replace('/(app)/friends')} />
        </SectionCard>
      </AppScreen>
    );
  }

  const accentColor = getPeopleListForUser(currentUser.id).find((item) => item.id === contact.id)?.avatarColor ?? colors.apricot;
  // Show posts targeting the contact OR the linked user (after migration).
  const contactPosts = getWallPostsForSubject(contact.id, 'contact');
  const linkedPosts = contact.linkedUserId ? getWallPostsForSubject(contact.linkedUserId, 'user') : [];
  const wallPosts = [...contactPosts, ...linkedPosts]
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const heroCt = contrastText(contact.cardColor);
  const heroCtSoft = contrastTextSoft(contact.cardColor);
  const heroCtAccent = contrastAccent(contact.cardColor, tint);

  async function handleAddFact() {
    if (!newFact.trim()) return;
    setFactBusy(true);
    try {
      await addContactFact(contact!.id, newFact.trim());
      setNewFact('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setFactBusy(false);
  }

  function handleDeleteFact(fact: string) {
    Alert.alert('Delete fact?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteContactFact(contact!.id, fact) },
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
      <View style={styles.topBarRight}>
        <Pressable onPress={() => togglePin(contact.id)} style={styles.pinButton}>
          <Text style={styles.pinLabel}>{contact.pinned ? '📌' : '📍'}</Text>
        </Pressable>
        <Pressable onPress={() => setEditing((prev) => !prev)} style={[styles.editButton, editing && styles.editButtonActive]}>
          <Text style={[styles.editButtonLabel, editing && styles.editButtonLabelActive]}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <AppScreen header={topBar} gradientColors={bgPreset?.gradient}>

      <Pressable onPress={() => router.push(`/(app)/profiles/contact/edit?contactId=${contact.id}`)} style={styles.heroSection}>
        <View style={[styles.heroCard, contact.cardColor ? { backgroundColor: contact.cardColor } : undefined]}>
          <View style={styles.heroPhotoFrame}>
            {contact.avatarPath ? (
              <Image source={{ uri: contact.avatarPath }} style={styles.heroPhoto} />
            ) : (
              <View style={[styles.heroPhotoSurface, { backgroundColor: accentColor }]}>
                <Text style={styles.heroInitials}>{getInitials(contact.displayName)}</Text>
              </View>
            )}
          </View>
          <View style={styles.heroBottom}>
            <Text style={[styles.heroName, contact.cardColor && { color: heroCt }]} numberOfLines={1}>{contact.displayName}</Text>
            {contact.tags.length > 0 && (
              <View style={styles.heroTagRow}>
                {contact.tags.slice(0, 2).map((tag) => (
                  <View key={tag} style={[styles.heroTag, contact.cardColor && { backgroundColor: heroCtAccent + '1A' }]}>
                    <Text style={[styles.heroTagText, contact.cardColor && { color: heroCtAccent }]} numberOfLines={1}>{tag}</Text>
                  </View>
                ))}
                {contact.tags.length > 2 && (
                  <Text style={[styles.heroTagMore, contact.cardColor && { color: heroCtSoft }]}>+{contact.tags.length - 2}</Text>
                )}
              </View>
            )}
            {contact.note ? (
              <Text style={[styles.heroNote, contact.cardColor && { color: heroCtSoft }]} numberOfLines={2}>{contact.note}</Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.heroSubtitle}>{contact.nickname ? `Saved as ${contact.nickname}` : 'Contact'}</Text>
        {linkedUser ? (
          <Pressable
            onPress={() => router.push(`/(app)/wall/${linkedUser.id}`)}
            style={styles.wallButton}
          >
            <View style={styles.wallButtonRow}>
              <Text style={styles.wallButtonLabel}>See their profile of you →</Text>
              {(() => {
                const unseenCount = notifications.filter(
                  (n) => !n.read && n.actorUserId === linkedUser.id &&
                    (n.type === 'wall_post' || n.type === 'contact_update'),
                ).length;
                return unseenCount > 0 ? (
                  <View style={styles.wallBadge}>
                    <Text style={styles.wallBadgeText}>{unseenCount}</Text>
                  </View>
                ) : null;
              })()}
            </View>
          </Pressable>
        ) : (
          <View style={[styles.statusBadge, styles.statusBadgePrivate]}>
            <Text style={[styles.statusBadgeText, styles.statusBadgeTextPrivate]}>Not on Your Friends yet</Text>
          </View>
        )}
      </Pressable>



      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Facts</Text>
        </View>
        {contact.facts.length > 0 ? (
          <View style={styles.factList}>
            {contact.facts.map((fact) => (
              <View key={fact} style={styles.factRow}>
                <Text style={styles.factText}>{fact}</Text>
                {editing && (
                  <Pressable onPress={() => handleDeleteFact(fact)}>
                    <Text style={styles.deleteLink}>×</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyHint}>No facts added yet.</Text>
        )}
        {editing && (
          <View style={styles.addFactRow}>
            <TextInput
              style={styles.addFactInput}
              value={newFact}
              onChangeText={setNewFact}
              placeholder="Add a fact…"
              placeholderTextColor={colors.inkMuted}
            />
            <Pressable onPress={handleAddFact} disabled={factBusy} style={styles.addFactButton}>
              <Text style={styles.addFactButtonLabel}>{factBusy ? '…' : '+'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Memory Wall</Text>
          <Pressable onPress={() => router.push(`/(app)/memories/add?subjectId=${contact.id}&subjectType=contact`)}>
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
                          onPress={editing ? () => startEditingPost(post) : undefined}
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

function getInitials(value: string) {
  return value.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

const HERO_PHOTO = 200;
const HERO_PADDING = 14;

const makeStyles = (colors: ColorTokens, tint: string) =>
  StyleSheet.create({
    backButton: { paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    pinButton: { padding: spacing.xs },
    pinLabel: { fontSize: 20 },
    editButton: {
      paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
      borderRadius: radius.pill, borderWidth: 1, borderColor: tint,
    },
    editButtonActive: { backgroundColor: tint },
    editButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: tint },
    editButtonLabelActive: { color: colors.white },
    section: { gap: spacing.sm },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
    addLink: { fontFamily: fonts.bodyBold, fontSize: 14, color: tint },
    factList: { gap: spacing.xs },
    factRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
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
      width: 40, height: 40, borderRadius: radius.pill, backgroundColor: tint,
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
    editSaveButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: tint },
    editSaveLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
    editCancelButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    editCancelLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
    editDeleteButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    editDeleteLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },

    /* ── Hero polaroid card (matches carousel style) ── */
    heroSection: { alignItems: 'center', gap: spacing.sm },
    heroCard: {
      width: HERO_PHOTO + HERO_PADDING * 2,
      borderRadius: 2,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      padding: HERO_PADDING,
      paddingBottom: 0,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    heroPhotoFrame: {
      width: HERO_PHOTO,
      height: HERO_PHOTO,
      borderRadius: 1,
      overflow: 'hidden',
    },
    heroPhoto: { width: '100%', height: '100%' },
    heroPhotoSurface: {
      flex: 1, width: '100%', height: '100%',
      alignItems: 'center', justifyContent: 'center',
    },
    heroInitials: { fontFamily: fonts.heading, fontSize: 64, color: colors.white },
    heroBottom: {
      width: '100%', paddingVertical: spacing.md,
      alignItems: 'center', gap: 4,
    },
    heroName: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, textAlign: 'center' },
    heroTagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
    heroTag: {
      backgroundColor: tint + '1A',
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    },
    heroTagText: { fontFamily: fonts.bodyBold, fontSize: 10, color: tint, textTransform: 'uppercase', letterSpacing: 0.5 },
    heroTagMore: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.inkMuted },
    heroNote: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.inkSoft, textAlign: 'center' },
    heroSubtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSoft },
    wallButton: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: tint + '18',
      borderWidth: 1,
      borderColor: tint + '40',
    },
    wallButtonRow: { flexDirection: 'row', alignItems: 'center' },
    wallButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: tint },
    wallBadge: {
      minWidth: 20, height: 20, borderRadius: 10,
      backgroundColor: colors.error ?? '#EF4444',
      alignItems: 'center' as const, justifyContent: 'center' as const,
      paddingHorizontal: 5, marginLeft: 6,
    },
    wallBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: '#fff' },
    statusBadge: {
      paddingVertical: 3,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    statusBadgePrivate: { borderColor: colors.line, backgroundColor: colors.paper },
    statusBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.3 },
    statusBadgeTextPrivate: { color: colors.inkMuted },
  });
