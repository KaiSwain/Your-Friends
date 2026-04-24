import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ReactNode, useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import { CardFlourish } from '../../../../src/components/CardFlourish';
import {
  MonthMemoryWallContent,
  MonthMemoryWallPicker,
  MonthMemoryWallStickyHeader,
  useMonthScrollableMemoryWall,
} from '../../../../src/components/MonthScrollableMemoryWall';
import { SectionCard } from '../../../../src/components/SectionCard';
import { ProfileSkeleton } from '../../../../src/components/Skeleton';
import { WallPostCard } from '../../../../src/components/WallPostCard';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import type { ColorTokens, ThemeName } from '../../../../src/features/theme/themes';
import { themes, themeNames } from '../../../../src/features/theme/themes';
import type { FontSet } from '../../../../src/theme/typography';
import { accentPalette, radius, spacing } from '../../../../src/theme/tokens';
import { fontSets } from '../../../../src/theme/typography';
import { contrastText, contrastTextSoft, contrastAccent } from '../../../../src/lib/contrastText';
import type { WallPost } from '../../../../src/types/domain';

export default function ContactProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ contactId: string | string[] }>();
  const { currentUser } = useAuth();
  const { loading, getContactById, getUserById, getDirectFriends, getPeopleListForUser, getWallPostsForSubject, addContactFact, deleteContactFact, deleteWallPost, updateWallPost, updateContact, migrateContactPostsToUser, linkContactByFriendCode, togglePin, removeFriend, deleteContact, notifications, refresh } = useSocialGraph();
  const { colors, fonts } = useTheme();

  const [newFact, setNewFact] = useState('');
  const [factBusy, setFactBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostBody, setEditingPostBody] = useState('');
  const [editingPostImage, setEditingPostImage] = useState<string | null>(null);
  const [editingPostColor, setEditingPostColor] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [linkingOpen, setLinkingOpen] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkScanning, setLinkScanning] = useState(false);
  const [linkCameraPermission, requestLinkCameraPermission] = useCameraPermissions();
  const linkScannedRef = useRef(false);

  const openLinkScanner = useCallback(async () => {
    if (!linkCameraPermission?.granted) {
      const res = await requestLinkCameraPermission();
      if (!res.granted) { setLinkError('Camera permission is required to scan QR codes.'); return; }
    }
    linkScannedRef.current = false;
    setLinkError('');
    setLinkScanning(true);
  }, [linkCameraPermission, requestLinkCameraPermission]);

  const handleLinkBarcodeScan = useCallback(({ data }: { data: string }) => {
    if (linkScannedRef.current) return;
    linkScannedRef.current = true;
    setLinkScanning(false);
    const code = data.replace(/^yourfriends:\/\//, '').trim().toUpperCase();
    if (code) {
      setLinkCode(code.slice(0, 8));
      setLinkError('');
    }
  }, []);

  const contactId = Array.isArray(params.contactId) ? params.contactId[0] : params.contactId;
  const contact = contactId ? getContactById(contactId) : undefined;

  const linkedUser = contact?.linkedUserId
    ? getUserById(contact.linkedUserId)
    : currentUser && contact
      ? getDirectFriends(currentUser.id).find(
          (f) => f.displayName.toLowerCase() === contact.displayName.toLowerCase(),
        ) ?? undefined
      : undefined;

  // Profile theme override — when a contact has a profileBg theme set, use that theme's palette on their profile.
  const { resolvedMode } = useTheme();
  const profileThemeName = contact?.profileBg && (themeNames as string[]).includes(contact.profileBg)
    ? (contact.profileBg as ThemeName)
    : null;
  const themedColors = profileThemeName ? themes[profileThemeName][resolvedMode] : null;
  const effectiveColors = themedColors ?? colors;
  const effectiveFonts = profileThemeName ? (fontSets[profileThemeName] ?? fonts) : fonts;
  const tint = themedColors?.accent ?? colors.accent;

  const styles = useMemo(() => makeStyles(effectiveColors, tint, effectiveFonts), [effectiveColors, tint, effectiveFonts]);

  // ── Hero card flip ──
  const [showBack, setShowBack] = useState(false);
  const [heroFrontHeight, setHeroFrontHeight] = useState(0);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const flipping = useRef(false);
  const flipTarget = useRef(0);

  // Single continuous rotation 0 → 180° driving both faces. The back face is
  // offset by 180° so backfaceVisibility cleanly hides whichever side is facing
  // away at any given frame — no mid-flip image "ghost" during the swap.
  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const handleHeroPress = useCallback(() => {
    if (editing) {
      router.push(`/(app)/profiles/contact/edit?contactId=${contact!.id}`);
      return;
    }
    if (flipping.current) return;
    flipping.current = true;
    const next = flipTarget.current === 0 ? 1 : 0;
    flipTarget.current = next;
    setShowBack(next === 1);
    Animated.timing(flipAnim, { toValue: next, duration: 360, useNativeDriver: true }).start(() => {
      flipping.current = false;
    });
  }, [editing, contact?.id, flipAnim, router]);

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

  // Compute wall posts + month buckets unconditionally so the hook count stays
  // stable across renders (including during sign-out when `currentUser` becomes null).
  const contactPostsAll = contact ? getWallPostsForSubject(contact.id, 'contact') : [];
  const linkedPostsAll = contact?.linkedUserId ? getWallPostsForSubject(contact.linkedUserId, 'user') : [];
  const wallPosts = [...contactPostsAll, ...linkedPostsAll]
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const monthWall = useMonthScrollableMemoryWall(wallPosts);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  if (loading) {
    return <AppScreen><ProfileSkeleton /></AppScreen>;
  }

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
  const heroCt = contact.cardColor ? contrastText(contact.cardColor) : FRAME_INK;
  const heroCtSoft = contact.cardColor ? contrastTextSoft(contact.cardColor) : FRAME_INK_SOFT;
  const heroCtAccent = contact.cardColor ? contrastAccent(contact.cardColor, tint) : tint;

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

  function handleUnfriend() {
    if (!currentUser || !contact.linkedUserId || !linkedUser) return;

    Alert.alert(
      `Unfriend ${linkedUser.displayName}?`,
      'They will stay in your private contact list, but the friendship link will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriend(currentUser.id, linkedUser.id);
              setEditing(false);
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to remove friend.');
            }
          },
        },
      ],
    );
  }

  function handleDeleteProfile() {
    if (!currentUser) return;

    if (contact.linkedUserId) {
      Alert.alert('Unfriend first', 'You can only delete this profile after you remove them as a friend.');
      return;
    }

    Alert.alert(
      `Delete ${contact.displayName}'s profile?`,
      'This will delete this profile card and remove its saved memories and facts from your app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete profile',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteContact(currentUser.id, contact.id);
              router.replace('/(app)/friends');
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to delete profile.');
            }
          },
        },
      ],
    );
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
      <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
      </Pressable>
      <View style={styles.topBarRight}>
        <Pressable onPress={() => togglePin(contact.id)} style={styles.pinButton} accessibilityRole="button" accessibilityLabel={contact.pinned ? 'Unpin contact' : 'Pin contact'}>
          <Text style={styles.pinLabel}>{contact.pinned ? <Ionicons name="pin" size={20} color="#E74C3C" /> : <Ionicons name="pin-outline" size={20} color={colors.inkMuted} />}</Text>
        </Pressable>
        <Pressable onPress={() => setEditing((prev) => !prev)} style={[styles.editButton, editing && styles.editButtonActive]} accessibilityRole="button" accessibilityLabel={editing ? 'Done editing' : 'Edit contact'}>
          <Text style={[styles.editButtonLabel, editing && styles.editButtonLabelActive]}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>
    </View>
  );

  const screenContent: ReactNode[] = [];
  let stickyHeaderIndex: number | undefined;

  screenContent.push(
    <Pressable key="hero" onPress={handleHeroPress} style={styles.heroSection}>
      <View style={styles.heroAmbientShadow} renderToHardwareTextureAndroid>
        <View onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h > 0) setHeroFrontHeight(h); }} style={styles.heroFaceHost}>
          <Animated.View pointerEvents={showBack ? 'none' : 'auto'} style={[styles.heroFace, { transform: [{ perspective: 1000 }, { rotateY: frontRotateY }] }]}>
            <View style={styles.heroTape} />
            <View style={[styles.heroCard, contact.cardColor ? { backgroundColor: contact.cardColor } : undefined]}>
              <View style={styles.heroPhotoFrame}>
                {contact.avatarPath ? (
                  <>
                    <Image source={{ uri: contact.avatarPath }} style={styles.heroPhoto} fadeDuration={0} />
                    <View style={styles.heroWarmBaseTint} />
                    <LinearGradient
                      colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.06)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.heroPhotoSheen}
                    />
                    <View style={styles.heroInsetShadowTop} />
                    <View style={styles.heroInsetShadowLeft} />
                  </>
                ) : (
                  <View style={[styles.heroPhotoSurface, { backgroundColor: accentColor }]}> 
                    <Text style={styles.heroInitials}>{getInitials(contact.displayName)}</Text>
                  </View>
                )}
              </View>
              <View style={styles.heroBottom}>
                <Text style={[styles.heroName, { color: heroCt }]} numberOfLines={1}>{contact.displayName}</Text>
                <View style={styles.heroNoteSlot}>
                  {contact.note ? (
                    <Text style={[styles.heroNote, { color: heroCtSoft }]} numberOfLines={HERO_NOTE_LINES}>{contact.note}</Text>
                  ) : null}
                </View>
              </View>
              <CardFlourish size={16} color={heroCtSoft} opacity={0.28} inset={12} />
            </View>
          </Animated.View>

          <Animated.View pointerEvents={showBack ? 'auto' : 'none'} style={[styles.heroFaceOverlay, styles.heroFace, { transform: [{ perspective: 1000 }, { rotateY: backRotateY }] }]}>
            <View style={styles.heroTape} />
            <View style={[styles.heroCard, styles.heroCardBack, contact.cardColor ? { backgroundColor: contact.cardColor } : undefined, heroFrontHeight > 0 && { height: heroFrontHeight }]}> 
              {contact.backText ? (
                <Text style={[styles.backText, { color: heroCt }]}>{contact.backText}</Text>
              ) : (
                <Text style={[styles.backPlaceholder, { color: heroCtSoft }]}>Nothing written on the back yet</Text>
              )}
              <Text style={[styles.backHint, { color: heroCtSoft }]}>tap to flip back</Text>
            </View>
          </Animated.View>
        </View>
      </View>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, linkedUser ? styles.statusDotOn : styles.statusDotOff]} />
        <Text style={styles.heroSubtitle}>
          {linkedUser ? 'Connected' : 'Not Connected'}
        </Text>
      </View>
    </Pressable>,
  );

  screenContent.push(
    linkedUser ? (
      <Pressable
        key="wall-button"
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
      <View key="connect-block" style={styles.connectBlock}>
        {linkingOpen ? (
          <View style={styles.connectForm}>
            <Text style={styles.connectFormTitle}>Link to {contact.displayName.split(' ')[0]}'s account</Text>
            {linkScanning ? (
              <View style={styles.scannerContainer}>
                <CameraView
                  style={styles.scanner}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleLinkBarcodeScan}
                />
                <View style={styles.scannerOverlay} pointerEvents="none">
                  <View style={styles.scannerFrame} />
                </View>
                <Pressable onPress={() => setLinkScanning(false)} style={styles.cancelScan}>
                  <Text style={styles.cancelScanLabel}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.connectHint}>Scan their QR code or type their friend code.</Text>
                <Pressable onPress={openLinkScanner} style={styles.scanButton}>
                  <Ionicons name="qr-code-outline" size={16} color={colors.accent} />
                  <Text style={styles.scanButtonLabel}>Scan QR Code</Text>
                </Pressable>
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or type it</Text>
                  <View style={styles.orLine} />
                </View>
                <TextInput
                  value={linkCode}
                  onChangeText={(v) => { setLinkCode(v.toUpperCase()); setLinkError(''); }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="AB3XK7PN"
                  placeholderTextColor={effectiveColors.inkMuted}
                  style={styles.connectInput}
                  maxLength={8}
                />
                {linkError ? <Text style={styles.connectError}>{linkError}</Text> : null}
                <View style={styles.connectActions}>
                  <Pressable
                    onPress={() => { setLinkingOpen(false); setLinkCode(''); setLinkError(''); }}
                    style={styles.connectCancel}
                  >
                    <Text style={styles.connectCancelLabel}>Cancel</Text>
                  </Pressable>
                  <ActionButton
                    label={linkBusy ? 'Linking…' : 'Link'}
                    disabled={linkBusy}
                    onPress={async () => {
                      if (!linkCode.trim()) { setLinkError('Enter a friend code.'); return; }
                      setLinkBusy(true);
                      setLinkError('');
                      const res = await linkContactByFriendCode(contact.id, currentUser.id, linkCode);
                      setLinkBusy(false);
                      if (!res.ok) { setLinkError(res.error); return; }
                      setLinkingOpen(false);
                      setLinkCode('');
                      Alert.alert('Linked!', `This card is now connected to ${res.friend.displayName}'s account. Memories you wrote will appear on their profile.`);
                    }}
                  />
                </View>
              </>
            )}
          </View>
        ) : (
          <Pressable onPress={() => setLinkingOpen(true)} style={styles.connectCta}>
            <Text style={styles.connectCtaLabel}>Did {contact.displayName.split(' ')[0]} join the app?</Text>
            <Text style={styles.connectCtaAction}>Link with friend code  →</Text>
          </Pressable>
        )}
      </View>
    ),
  );

  screenContent.push(
    <View key="facts" style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Facts</Text>
      </View>
      {contact.facts.length > 0 ? (
        <View style={styles.factList}>
          {contact.facts.map((fact) => (
            <View key={fact} style={styles.factChip}>
              <Text style={styles.factChipText}>{fact}</Text>
              {editing && (
                <Pressable onPress={() => handleDeleteFact(fact)}>
                  <Ionicons name="close" size={14} color={effectiveColors.error} />
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
            placeholderTextColor={effectiveColors.inkMuted}
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
        <Pressable onPress={() => router.push(`/(app)/memories/add?subjectId=${contact.id}&subjectType=contact&backTo=${encodeURIComponent(`/(app)/profiles/contact/${contact.id}`)}`)}>
          <Text style={styles.addLink}>Add</Text>
        </Pressable>
      </View>
      <MonthMemoryWallPicker
        monthGroups={monthWall.monthGroups}
        activeMonthKey={monthWall.activeMonth?.key ?? ''}
        onSelectMonth={monthWall.setSelectedMonthKey}
        themeColors={effectiveColors}
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
      <MonthMemoryWallStickyHeader key="memory-wall-month" label={monthWall.activeMonth.label} themeColors={effectiveColors} />,
    );
    screenContent.push(
      <View key="memory-wall-posts" style={styles.monthWallPostsBlock}>
        <MonthMemoryWallContent
          dayGroups={monthWall.activeMonth.dayGroups}
          themeColors={effectiveColors}
          renderPost={(post) => {
            const author = getUserById(post.authorUserId);
            return (
              <View key={post.id}>
                <WallPostCard
                  authorName={author?.displayName ?? 'Unknown'}
                  post={post}
                  cardColor={post.cardColor}
                  themeColors={effectiveColors}
                  editing={editing}
                  shareable={!editing}
                  onPress={editing ? () => router.push({ pathname: '/(app)/memories/edit', params: { postId: post.id } }) : undefined}
                  onSaveBackText={handleSaveBackText}
                />
              </View>
            );
          }}
        />
      </View>,
    );
  }

  if (editing) {
    screenContent.push(
      <View key="destructive-actions" style={styles.destructiveActions}>
        {contact.linkedUserId && linkedUser ? (
          <Pressable onPress={handleUnfriend} style={styles.unfriendButton} accessibilityRole="button" accessibilityLabel={`Unfriend ${linkedUser.displayName}`}>
            <Text style={styles.unfriendLabel}>Unfriend {linkedUser.displayName}</Text>
          </Pressable>
        ) : null}
        {!contact.linkedUserId ? (
          <Pressable onPress={handleDeleteProfile} style={styles.deleteProfileButton} accessibilityRole="button" accessibilityLabel={`Delete ${contact.displayName}'s profile`}>
            <Text style={styles.deleteProfileLabel}>Delete Profile</Text>
          </Pressable>
        ) : null}
      </View>,
    );
  }

  return (
    <AppScreen header={topBar} floatingHeaderOnScroll gradientColors={themedColors ? [themedColors.canvas, themedColors.canvasAlt, themedColors.canvas] : undefined} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} refreshing={refreshing} stickyHeaderIndices={stickyHeaderIndex !== undefined ? [stickyHeaderIndex] : undefined}>
      {screenContent}
    </AppScreen>
  );
}

function getInitials(value: string) {
  return value.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

const HERO_PHOTO = 200;
const HERO_PAD_SIDE = 10;
const HERO_PAD_TOP = 10;
const HERO_NOTE_LINES = 2;
const HERO_NOTE_LINE_HEIGHT = 20;
const HERO_NOTE_SLOT_HEIGHT = HERO_NOTE_LINES * HERO_NOTE_LINE_HEIGHT;
const HERO_BOTTOM_MIN_HEIGHT = 108;

// Warm ivory — real Polaroid frames are never pure white.
const POLAROID_FRAME = '#F5F2EA';
const FRAME_INK = '#2A2218';
const FRAME_INK_SOFT = '#6B6052';

const makeStyles = (colors: ColorTokens, tint: string, fonts: FontSet) =>
  StyleSheet.create({
    backButton: { paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    pinButton: { padding: spacing.xs },
    pinLabel: { fontSize: 20 },
    destructiveActions: { marginTop: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
    unfriendButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.error + '10',
    },
    unfriendLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
    deleteProfileButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.error,
    },
    deleteProfileLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
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
      width: 40, height: 40, borderRadius: radius.pill, backgroundColor: tint,
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
    editSaveButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: tint },
    editSaveLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
    editCancelButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    editCancelLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
    editDeleteButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    editDeleteLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },

    /* ── Hero polaroid card (matches carousel style) ── */
    heroSection: { alignItems: 'center', gap: spacing.sm },
    heroAmbientShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
    },
    heroTape: {
      width: 48,
      height: 14,
      backgroundColor: 'rgba(255,255,220,0.35)',
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: -7,
      zIndex: 1,
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
      borderRadius: 3,
      backgroundColor: POLAROID_FRAME,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(180,170,155,0.4)',
      paddingTop: HERO_PAD_TOP,
      paddingHorizontal: HERO_PAD_SIDE,
      paddingBottom: 0,
      alignItems: 'center',
      // Contact shadow (tight, dark)
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 5,
    },
    heroPhotoFrame: {
      width: HERO_PHOTO,
      height: HERO_PHOTO,
      borderRadius: 1,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.045)',
    },
    heroPhoto: { width: '100%', height: '100%', transform: [{ scale: 1.01 }] },
    heroPhotoSurface: {
      flex: 1, width: '100%', height: '100%',
      alignItems: 'center', justifyContent: 'center',
    },
    heroInitials: { fontFamily: fonts.heading, fontSize: 64, color: colors.white },
    heroWarmBaseTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(210,180,140,0.04)',
      zIndex: 4,
      pointerEvents: 'none' as const,
    },
    heroPhotoSheen: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 5,
      pointerEvents: 'none' as const,
    },
    heroInsetShadowTop: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: 6,
      backgroundColor: 'transparent',
      zIndex: 6,
      pointerEvents: 'none' as const,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    heroInsetShadowLeft: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      bottom: 0,
      width: 4,
      backgroundColor: 'transparent',
      zIndex: 6,
      pointerEvents: 'none' as const,
      shadowColor: '#000',
      shadowOffset: { width: 3, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    heroBottom: {
      width: '100%',
      paddingTop: 6,
      paddingBottom: 28,
      alignItems: 'center',
      gap: 4,
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
    },
    heroTagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
    heroTag: {
      backgroundColor: tint + '1A',
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    },
    heroTagText: { fontFamily: fonts.bodyBold, fontSize: 10, color: tint, textTransform: 'uppercase', letterSpacing: 0.5 },
    heroTagMore: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.inkMuted },
    heroNote: {
      fontFamily: fonts.handwritten,
      fontSize: 15,
      lineHeight: HERO_NOTE_LINE_HEIGHT,
      color: colors.inkSoft,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible' as const,
    },

    /* ── Back face ── */
    heroCardBack: {
      paddingTop: 24,
      paddingHorizontal: HERO_PAD_SIDE + 6,
      paddingBottom: 24,
      justifyContent: 'center',
      gap: 8,
    },
    backText: { fontFamily: fonts.handwritten, fontSize: 17, lineHeight: 24, textAlign: 'center', color: FRAME_INK, flex: 1 },
    backPlaceholder: { fontFamily: fonts.handwritten, fontSize: 17, textAlign: 'center', color: FRAME_INK_SOFT, flex: 1, opacity: 0.5 },
    backHint: { fontFamily: fonts.body, fontSize: 10, textAlign: 'center', color: FRAME_INK_SOFT, opacity: 0.5, paddingTop: 2 },

    heroSubtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSoft },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusDotOn: { backgroundColor: '#34C759' },
    statusDotOff: { backgroundColor: '#8E8E93' },
    wallButton: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
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
    connectBlock: { marginTop: spacing.md, alignItems: 'center' },
    connectCta: {
      alignSelf: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      gap: 2,
    },
    connectCtaLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
    connectCtaAction: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent, letterSpacing: 0.2 },
    connectForm: {
      alignSelf: 'stretch',
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      gap: spacing.sm,
    },
    connectFormTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink },
    connectHint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
    connectInput: {
      fontFamily: fonts.bodyBold,
      fontSize: 20,
      letterSpacing: 4,
      color: colors.ink,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.paperMuted,
      textAlign: 'center',
    },
    connectError: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error, textAlign: 'center' },
    connectActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    connectCancel: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    connectCancelLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSoft },
    scanButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.accent + '40',
      backgroundColor: colors.accent + '10',
    },
    scanButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent },
    orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    orLine: { flex: 1, height: 1, backgroundColor: colors.line },
    orText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, letterSpacing: 0.3 },
    scannerContainer: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: '#000',
      position: 'relative',
    },
    scanner: { ...StyleSheet.absoluteFillObject },
    scannerOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    scannerFrame: {
      width: '70%',
      aspectRatio: 1,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      borderRadius: radius.sm,
      backgroundColor: 'transparent',
    },
    cancelScan: {
      position: 'absolute',
      bottom: spacing.md,
      alignSelf: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs + 2,
      borderRadius: 999,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    cancelScanLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#FFFFFF' },
  });
