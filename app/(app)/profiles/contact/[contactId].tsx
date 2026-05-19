import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ReactNode, useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { Alert, Animated, Image, Linking, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import {
  type DayGroup,
} from '../../../../src/components/MonthScrollableMemoryWall';
import { MemoryWallViewToggle, MemoryWallViews, type MemoryWallViewMode } from '../../../../src/components/MemoryWallViews';
import { MemoryPromptRequestList } from '../../../../src/components/MemoryPromptRequestList';
import { MemoryReplyThreadPreview } from '../../../../src/components/MemoryReplyThreadPreview';
import { LockedGiftNoteCard } from '../../../../src/components/LockedGiftNoteCard';
import { MemoryProfileCard, ProfileBackgroundBackdrop, WallModeToggle } from '../../../../src/components/profile';
import { SectionCard } from '../../../../src/components/SectionCard';
import { ProfileSkeleton } from '../../../../src/components/Skeleton';
import { WallPostCard } from '../../../../src/components/WallPostCard';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useCalendar } from '../../../../src/features/calendar/CalendarContext';
import { usePremium } from '../../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { buildContactProfileViewModel } from '../../../../src/features/social/selectors';
import type { ColorTokens } from '../../../../src/features/theme/themes';
import { protectTextFromFontClipping } from '../../../../src/theme/fontProtection';
import type { FontSet } from '../../../../src/theme/typography';
import { accentPalette, radius, spacing } from '../../../../src/theme/tokens';
import { contrastText } from '../../../../src/lib/contrastText';
import { backOnce, pushOnce, replaceOnce } from '../../../../src/lib/navigationGuard';
import { createPrivateNoteImageUrl, removePrivateNoteImage, uploadPrivateNoteImage } from '../../../../src/lib/privateNoteMedia';
import { showGalleryPaywall } from '../../../../src/lib/premiumGates';
import { showPhotoSourceSheet } from '../../../../src/lib/photoSourceSheet';
import { avatarImagePickerOptions, privateNoteImagePickerOptions } from '../../../../src/lib/imagePickerPresets';
import { getProfileScreenGradientColors, useEffectiveProfileTheme } from '../../../../src/hooks/useEffectiveProfileTheme';
import { compareWallPostsByMemoryDateDesc, groupPostsByMemoryDateDay } from '../../../../src/lib/memoryDate';
import { usePrioritizedWallImageLoading } from '../../../../src/hooks/usePrioritizedWallImageLoading';
import { useSyntheticNotificationReads } from '../../../../src/hooks/useSyntheticNotificationReads';
import type { ContactPrivateNoteBlock, WallPost } from '../../../../src/types/domain';

export default function ContactProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ contactId: string | string[] }>();
  const { currentUser } = useAuth();
  const { isPremium, isUserPremium } = usePremium();
  const { loading, contacts, getContactById, getUserById, getDirectFriends, getPeopleListForUser, getWallPostsForSubject, getVisiblePostsByAuthor, getPrivateNotesForContact, getPrivateNoteById, getPrivateNoteBlocks, cancelGiftNote, getGiftNotesForPair, getMovieReviewRequestsForPair, cancelMovieReviewRequest, getMemoryPromptRequestsForPair, cancelMemoryPromptRequest, getRepliesForWallPost, createPrivateNote, updatePrivateNote, deletePrivateNote, addPrivateNoteBlock, updatePrivateNoteBlock, deletePrivateNoteBlock, addContactFact, deleteContactFact, deleteWallPost, updateWallPost, updateContact, migrateContactPostsToUser, linkContactByFriendCode, togglePin, removeFriend, deleteContact, notifications, unreadCount, isPostOnProfileWall, addPostToProfileWall, refresh } = useSocialGraph();
  const { events } = useCalendar();
  const contactId = Array.isArray(params.contactId) ? params.contactId[0] : params.contactId;
  const contact = contactId ? getContactById(contactId) : undefined;
  const {
    baseColors: colors,
    effectiveColors,
    effectiveFonts,
    themedColors,
    tint,
  } = useEffectiveProfileTheme(contact?.profileBg);

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
  const [existingFriendLinkOpen, setExistingFriendLinkOpen] = useState(false);
  const [activePane, setActivePane] = useState<'profile' | 'notes'>('profile');
  const [memoryWallViewMode, setMemoryWallViewMode] = useState<MemoryWallViewMode>('timeline');
  const [memoryFilter, setMemoryFilter] = useState<MemoryFilter>('all');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [noteTitleDraft, setNoteTitleDraft] = useState('');
  const [noteTextDrafts, setNoteTextDrafts] = useState<Record<string, string>>({});
  const [activeNoteTextBlockId, setActiveNoteTextBlockId] = useState<string | null>(null);
  const [noteLinkDrafts, setNoteLinkDrafts] = useState<Record<string, string>>({});
  const [newNoteLinkDraft, setNewNoteLinkDraft] = useState('');
  const [noteImageUrls, setNoteImageUrls] = useState<Record<string, string>>({});
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesAutoSaving, setNotesAutoSaving] = useState(false);
  const [notesLastSavedAt, setNotesLastSavedAt] = useState<number | null>(null);
  const hydratedNoteIdRef = useRef<string | null>(null);
  const lastSavedTitleRef = useRef<string>('');
  const lastSavedTextDraftsRef = useRef<Record<string, string>>({});
  const lastSavedLinkDraftsRef = useRef<Record<string, string>>({});
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveInFlightRef = useRef(false);
  const autoSavePendingRef = useRef(false);
  const memoryDockBottom = Math.max(insets.bottom, spacing.sm) + spacing.sm;
  const [memoryMenuVisible, setMemoryMenuVisible] = useState(true);
  const memoryMenuVisibleRef = useRef(true);
  const memoryMenuScrollOffsetRef = useRef(0);
  const memoryMenuAnim = useRef(new Animated.Value(1)).current;

  const setMemoryMenuShown = useCallback((visible: boolean) => {
    if (memoryMenuVisibleRef.current === visible) return;
    memoryMenuVisibleRef.current = visible;
    setMemoryMenuVisible(visible);
    Animated.timing(memoryMenuAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 140,
      useNativeDriver: true,
    }).start();
  }, [memoryMenuAnim]);

  const handleMemoryMenuScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = offsetY - memoryMenuScrollOffsetRef.current;
    memoryMenuScrollOffsetRef.current = offsetY;

    if (offsetY <= 24) {
      setMemoryMenuShown(true);
      return;
    }

    if (Math.abs(delta) < 8) return;
    setMemoryMenuShown(delta < 0);
  }, [setMemoryMenuShown]);

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

  const { readIds: syntheticNotificationReadIds } = useSyntheticNotificationReads(currentUser?.id ?? null);
  const calendarFallbackUnreadCount = useMemo(() => {
    if (!currentUser?.id) return 0;
    const existingEventIds = new Set(
      notifications
        .filter((notification) => notification.type === 'calendar_event')
        .map((notification) => typeof notification.metadata.eventId === 'string' ? notification.metadata.eventId : notification.referenceId)
        .filter((eventId): eventId is string => Boolean(eventId)),
    );
    return events.filter((event) => {
      if (!event.shareId || event.sharedWithUserId !== currentUser.id || !event.sharedByUserId) return false;
      if (existingEventIds.has(event.id)) return false;
      return !syntheticNotificationReadIds.has(`calendar-share-fallback:${event.shareId}`);
    }).length;
  }, [currentUser?.id, events, notifications, syntheticNotificationReadIds]);
  const notificationBadgeCount = unreadCount + calendarFallbackUnreadCount;

  const linkedUser = contact?.linkedUserId ? getUserById(contact.linkedUserId) : undefined;

  const friendHasPremium = Boolean(linkedUser?.id && isUserPremium(linkedUser.id));

  const styles = useMemo(() => makeStyles(effectiveColors, tint, effectiveFonts), [effectiveColors, tint, effectiveFonts]);

  const handleHeroPress = useCallback(() => {
    if (editing) {
      pushOnce(router, `/(app)/profiles/contact/edit?contactId=${contact!.id}`);
    }
  }, [editing, contact?.id, router]);

  // Keep existing linked memories routed through subject_user_id. New links are
  // made only after the user explicitly chooses an account.
  useEffect(() => {
    if (contact?.linkedUserId) {
      migrateContactPostsToUser(contact.id, contact.linkedUserId);
    }
  }, [contact?.id, contact?.linkedUserId]);

  // Compute wall posts unconditionally so the hook count stays stable across
  // renders (including during sign-out when `currentUser` becomes null).
  const [wallMode, setWallMode] = useState<'mine' | 'shared'>('shared');
  const [focusedReferencePostId, setFocusedReferencePostId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const postLayoutYRef = useRef<Record<string, number>>({});
  const contactPostsAll = contact ? getWallPostsForSubject(contact.id, 'contact') : [];
  const linkedPostsAll = contact?.linkedUserId ? getWallPostsForSubject(contact.linkedUserId, 'user') : [];
  const myWallPosts = useMemo(() =>
    [...contactPostsAll, ...linkedPostsAll]
      .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
      .sort(compareWallPostsByMemoryDateDesc),
    [contactPostsAll, linkedPostsAll],
  );
  // The "shared wall" only contains polaroids each of you have explicitly
  // shared with the other (visibility === 'visible_to_subject'): your posts
  // about your friend, plus their posts about you. It only makes sense when
  // the contact is linked to a real user.
  const friendVisiblePosts = contact?.linkedUserId ? getVisiblePostsByAuthor(contact.linkedUserId) : [];
  const sharedWallPosts = useMemo(() => {
    if (!currentUser || !contact?.linkedUserId) return [];
    const linkedFriendId = contact.linkedUserId;
    // My posts about the linked friend (subject = friend, author = me).
    const myPostsAboutFriend = [...contactPostsAll, ...linkedPostsAll]
      .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
      .filter((p) => p.authorUserId === currentUser.id
        && p.subjectUserId === linkedFriendId
        && p.visibility === 'visible_to_subject');
    // Their posts about me (subject = me, author = friend) — these aren't in
    // the per-subject queries above, so pull them from getVisiblePostsByAuthor.
    const theirPostsAboutMe = friendVisiblePosts
      .filter((p) => p.subjectUserId === currentUser.id);
    const merged = [...myPostsAboutFriend, ...theirPostsAboutMe]
      .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
    return merged.sort(compareWallPostsByMemoryDateDesc);
  }, [contactPostsAll, linkedPostsAll, friendVisiblePosts, currentUser?.id, contact?.linkedUserId]);
  const isLinked = !!contact?.linkedUserId;
  const unfilteredWallPosts = wallMode === 'shared' && isLinked ? sharedWallPosts : myWallPosts;
  const wallPosts = useMemo(() => filterWallPosts(unfilteredWallPosts, memoryFilter), [unfilteredWallPosts, memoryFilter]);
  const wallDayGroups = useMemo<DayGroup[]>(() => groupPostsByMemoryDateDay(wallPosts), [wallPosts]);
  const wallImageLoading = usePrioritizedWallImageLoading(wallPosts, true);
  const lockedGiftNotes = currentUser?.id && contact?.linkedUserId
    ? getGiftNotesForPair(currentUser.id, contact.linkedUserId).filter((note) => note.status === 'locked')
    : [];
  const moviePromptRequests = currentUser?.id && contact?.linkedUserId && wallMode === 'shared'
    ? getMovieReviewRequestsForPair(currentUser.id, contact.linkedUserId).filter((request) => request.status === 'pending')
    : [];
  const memoryPromptRequests = currentUser?.id && contact?.linkedUserId && wallMode === 'shared'
    ? getMemoryPromptRequestsForPair(currentUser.id, contact.linkedUserId).filter((request) => request.status === 'pending')
    : [];
  const incomingPromptCount = currentUser?.id && wallMode === 'shared'
    ? memoryPromptRequests.filter((request) => request.recipientUserId === currentUser.id).length
      + moviePromptRequests.filter((request) => request.recipientUserId === currentUser.id).length
    : 0;
  const newSharedMemoryCount = wallMode === 'shared'
    ? sharedWallPosts.filter((post) => notifications.some((notification) => (
      !notification.read
      && notification.type === 'wall_post'
      && notification.referenceId === post.id
    ))).length
    : 0;
  const wallViewIndicators = {
    timeline: newSharedMemoryCount,
    grid: newSharedMemoryCount,
    prompts: incomingPromptCount,
  };
  const privateNotes = contact ? getPrivateNotesForContact(contact.id) : [];
  const selectedPrivateNote = selectedNoteId ? getPrivateNoteById(selectedNoteId) : undefined;
  const selectedNoteBlocks = selectedPrivateNote ? getPrivateNoteBlocks(selectedPrivateNote.id) : [];
  const selectedTextBlocks = selectedNoteBlocks.filter((block) => block.type === 'text');
  const selectedLinkBlocks = selectedNoteBlocks.filter((block) => block.type === 'link');
  const selectedImageBlocks = selectedNoteBlocks.filter((block) => block.type === 'image');
  const selectedTextBlockSignature = selectedTextBlocks.map((block) => `${block.id}:${block.content ?? ''}`).join('|');
  const selectedLinkBlockSignature = selectedLinkBlocks.map((block) => `${block.id}:${block.url ?? block.content ?? ''}`).join('|');
  const selectedImageBlockSignature = selectedImageBlocks.map((block) => `${block.id}:${block.imagePath ?? ''}`).join('|');

  useEffect(() => {
    if (activePane !== 'notes') return;
    if (selectedNoteId && privateNotes.some((note) => note.id === selectedNoteId)) return;
    setSelectedNoteId(privateNotes[0]?.id ?? null);
  }, [activePane, privateNotes, selectedNoteId]);

  useEffect(() => {
    if (activePane !== 'notes' && noteEditorOpen) setNoteEditorOpen(false);
  }, [activePane, noteEditorOpen]);

  useEffect(() => {
    if (noteEditorOpen && !selectedPrivateNote) setNoteEditorOpen(false);
  }, [noteEditorOpen, selectedPrivateNote?.id]);

  useEffect(() => {
    if (!selectedPrivateNote) {
      hydratedNoteIdRef.current = null;
      setNoteTitleDraft('');
      setNoteTextDrafts({});
      setActiveNoteTextBlockId(null);
      setNoteLinkDrafts({});
      setNewNoteLinkDraft('');
      setNoteImageUrls({});
      lastSavedTitleRef.current = '';
      lastSavedTextDraftsRef.current = {};
      lastSavedLinkDraftsRef.current = {};
      return;
    }
    // Only fully reset drafts when the user opens a different note. For the
    // same note, just seed drafts for any newly-arrived blocks (e.g. an image
    // we just added) without clobbering what the user is currently typing —
    // and never re-write the title from server state mid-edit, which used to
    // cause "Untitled" to slip back over a title the user had typed.
    const noteChanged = hydratedNoteIdRef.current !== selectedPrivateNote.id;
    hydratedNoteIdRef.current = selectedPrivateNote.id;
    if (noteChanged) {
      setNoteTitleDraft(selectedPrivateNote.title);
      lastSavedTitleRef.current = selectedPrivateNote.title;
    }
    setNoteTextDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const block of selectedTextBlocks) {
        next[block.id] = noteChanged
          ? block.content ?? ''
          : prev[block.id] ?? block.content ?? '';
      }
      return next;
    });
    setNoteLinkDrafts((prev) => {
      const next: Record<string, string> = {};
      for (const block of selectedLinkBlocks) {
        const fallback = block.url ?? block.content ?? '';
        next[block.id] = noteChanged ? fallback : prev[block.id] ?? fallback;
      }
      return next;
    });
    if (noteChanged) setNewNoteLinkDraft('');
    // Keep the saved-snapshot refs aligned with the canonical server state for
    // any blocks we haven't started editing locally; preserve the snapshot for
    // blocks the user is currently typing in so auto-save still computes a diff.
    const nextSavedText: Record<string, string> = {};
    for (const block of selectedTextBlocks) {
      nextSavedText[block.id] = noteChanged
        ? block.content ?? ''
        : lastSavedTextDraftsRef.current[block.id] ?? block.content ?? '';
    }
    lastSavedTextDraftsRef.current = nextSavedText;
    const nextSavedLink: Record<string, string> = {};
    for (const block of selectedLinkBlocks) {
      const fallback = block.url ?? block.content ?? '';
      nextSavedLink[block.id] = noteChanged
        ? fallback
        : lastSavedLinkDraftsRef.current[block.id] ?? fallback;
    }
    lastSavedLinkDraftsRef.current = nextSavedLink;
  }, [selectedPrivateNote?.id, selectedTextBlockSignature, selectedLinkBlockSignature]);

  useEffect(() => {
    let cancelled = false;
    const selectedIds = new Set(selectedImageBlocks.map((block) => block.id));
    setNoteImageUrls((prev) => Object.fromEntries(Object.entries(prev).filter(([blockId]) => selectedIds.has(blockId))));
    selectedImageBlocks.forEach((block) => {
      if (!block.imagePath) return;
      createPrivateNoteImageUrl(block.imagePath)
        .then((url) => {
          if (!cancelled) setNoteImageUrls((prev) => ({ ...prev, [block.id]: url }));
        })
        .catch(() => undefined);
    });
    return () => { cancelled = true; };
  }, [selectedPrivateNote?.id, selectedImageBlockSignature]);

  // Persist any drafts that differ from what we last saved. This is the core
  // of the Apple Notes-style auto-save: it never adds blocks (photo handlers
  // do that explicitly) and it never blocks the UI. We read the latest state
  // from refs so the in-flight save and the cleanup-flush always see the most
  // recent keystrokes — never a stale closure.
  const autoSaveStateRef = useRef({
    noteId: null as string | null,
    title: '',
    textDrafts: {} as Record<string, string>,
    linkDrafts: {} as Record<string, string>,
    textBlocks: [] as ContactPrivateNoteBlock[],
    linkBlocks: [] as ContactPrivateNoteBlock[],
  });
  autoSaveStateRef.current = {
    noteId: selectedPrivateNote?.id ?? null,
    title: noteTitleDraft,
    textDrafts: noteTextDrafts,
    linkDrafts: noteLinkDrafts,
    textBlocks: selectedTextBlocks,
    linkBlocks: selectedLinkBlocks,
  };
  const autoSavePrivateNote = useCallback(async () => {
    const snapshot = autoSaveStateRef.current;
    const noteId = snapshot.noteId;
    if (!noteId) return;
    if (autoSaveInFlightRef.current) {
      autoSavePendingRef.current = true;
      return;
    }
    autoSaveInFlightRef.current = true;
    autoSavePendingRef.current = false;
    let didWork = false;
    setNotesAutoSaving(true);
    try {
      if (snapshot.title !== lastSavedTitleRef.current) {
        await updatePrivateNote(noteId, { title: snapshot.title });
        lastSavedTitleRef.current = snapshot.title;
        didWork = true;
      }
      for (const block of snapshot.textBlocks) {
        const draft = snapshot.textDrafts[block.id] ?? block.content ?? '';
        if (draft !== (lastSavedTextDraftsRef.current[block.id] ?? '')) {
          await updatePrivateNoteBlock(block.id, { content: draft });
          lastSavedTextDraftsRef.current[block.id] = draft;
          didWork = true;
        }
      }
      for (const block of snapshot.linkBlocks) {
        const rawDraft = snapshot.linkDrafts[block.id] ?? block.url ?? block.content ?? '';
        const normalized = normalizePrivateNoteLink(rawDraft);
        const previous = lastSavedLinkDraftsRef.current[block.id] ?? '';
        if (normalized === previous) continue;
        if (!normalized) {
          await deletePrivateNoteBlock(block.id);
          delete lastSavedLinkDraftsRef.current[block.id];
        } else {
          await updatePrivateNoteBlock(block.id, { content: normalized, url: normalized });
          lastSavedLinkDraftsRef.current[block.id] = normalized;
        }
        didWork = true;
      }
      if (didWork) setNotesLastSavedAt(Date.now());
    } catch {
      // Swallow auto-save failures silently — the next edit will retry.
    } finally {
      autoSaveInFlightRef.current = false;
      setNotesAutoSaving(false);
      if (autoSavePendingRef.current) {
        autoSavePendingRef.current = false;
        autoSavePrivateNote();
      }
    }
  }, [updatePrivateNote, updatePrivateNoteBlock, deletePrivateNoteBlock]);

  // Schedule a debounced auto-save ~700ms after the last edit. The debounce
  // effect itself only manages the timer; flushing on note switch/unmount is
  // handled by a separate effect so we don't accidentally flush on every
  // keystroke (which used to cause race conditions and laggy saves).
  useEffect(() => {
    if (!selectedPrivateNote) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      autoSavePrivateNote();
    }, 700);
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [autoSavePrivateNote, selectedPrivateNote?.id, noteTitleDraft, noteTextDrafts, noteLinkDrafts]);

  // Flush any pending edits when the user switches notes or leaves the editor.
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      autoSavePrivateNote();
    };
  }, [selectedPrivateNote?.id, autoSavePrivateNote]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  if (loading) {
    return <AppScreen><ProfileSkeleton /></AppScreen>;
  }

  if (!contact || contact.ownerUserId !== currentUser.id) {
    return (
      <AppScreen>
        <SectionCard title="That contact is not in your private list.">
          <ActionButton label="Back to friends" onPress={() => replaceOnce(router, '/friends')} />
        </SectionCard>
      </AppScreen>
    );
  }

  const accentColor = getPeopleListForUser(currentUser.id).find((item) => item.id === contact.id)?.avatarColor ?? colors.apricot;
  const profileCard = buildContactProfileViewModel({ accentColor, contact, friendHasPremium, linkedUser });
  const linkedFriendIds = new Set(
    contacts
      .filter((candidate) => candidate.ownerUserId === currentUser.id && candidate.id !== contact.id && candidate.linkedUserId)
      .map((candidate) => candidate.linkedUserId!),
  );
  const existingFriendLinkTargets = getDirectFriends(currentUser.id)
    .filter((friend) => !linkedFriendIds.has(friend.id))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const suggestedExistingFriend = existingFriendLinkTargets.find(
    (friend) => friend.displayName.trim().toLowerCase().replace(/\s+/g, ' ') === contact.displayName.trim().toLowerCase().replace(/\s+/g, ' '),
  );
  const profileBackTo = `/(app)/profiles/contact/${contact.id}`;

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

  function openRealProfileLinkManager(userIdToOpen: string) {
    pushOnce(router, { pathname: '/(app)/profiles/user/[userId]', params: { userId: userIdToOpen, actual: '1' } });
  }

  function handleLinkExistingFriend(friendUserId: string) {
    const friend = existingFriendLinkTargets.find((candidate) => candidate.id === friendUserId);
    if (!friend) return;
    openRealProfileLinkManager(friend.id);
  }

  function handleDeleteWallPost(postId: string) {
    Alert.alert('Delete memory?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteWallPost(postId) },
    ]);
  }

  function handleUnfriend() {
    if (!currentUser || !contact || !contact.linkedUserId || !linkedUser) return;

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
    if (!currentUser || !contact) return;

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
              replaceOnce(router, '/friends');
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
    if (!isPremium) {
      showGalleryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(avatarImagePickerOptions);
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

  async function handleAddToMyProfile(postId: string, repliesHidden = false) {
    if (!currentUser) return;
    const result = await addPostToProfileWall(currentUser.id, postId, { repliesHidden });
    if (!result.ok) Alert.alert('Could not add to profile', result.error);
  }

  function handleMemoryLongPress(post: WallPost) {
    if (!currentUser || !contact || editing) return;
    const actions: Parameters<typeof Alert.alert>[2] = [];
    const onMyProfile = isPostOnProfileWall(currentUser.id, post.id);

    if (!onMyProfile) {
      actions.push({ text: 'Add with replies', onPress: () => handleAddToMyProfile(post.id, false) });
      actions.push({ text: 'Add and hide replies', onPress: () => handleAddToMyProfile(post.id, true) });
    }

    if (actions.length === 0) return;
    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Memory options', 'Choose what to do with this memory card.', actions);
  }

  async function handleCreatePrivateNote() {
    if (!currentUser || !contact) return;
    setNotesBusy(true);
    try {
      const note = await createPrivateNote(currentUser.id, contact.id, { title: 'New note' });
      const textBlock = await addPrivateNoteBlock(note.id, { type: 'text', content: '', sortOrder: 0 });
      setActivePane('notes');
      setSelectedNoteId(note.id);
      setNoteEditorOpen(true);
      setNoteTitleDraft(note.title);
      setNoteTextDrafts({ [textBlock.id]: '' });
      setActiveNoteTextBlockId(textBlock.id);
      setNoteLinkDrafts({});
      setNewNoteLinkDraft('');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to create note.');
    } finally {
      setNotesBusy(false);
    }
  }

  function openMemoryNoteShortcut() {
    if (!contact) return;
    pushOnce(router, {
      pathname: '/(app)/memories/add',
      params: { subjectId: contact.id, subjectType: 'contact', backTo: profileBackTo },
    });
  }

  function openGiftNoteShortcut() {
    if (!contact?.linkedUserId) return;
    pushOnce(router, {
      pathname: '/(app)/gifts/add',
      params: { subjectId: contact.id, subjectType: 'contact', backTo: profileBackTo },
    });
  }

  function openMovieRequestShortcut() {
    if (!contact?.linkedUserId) return;
    pushOnce(router, {
      pathname: '/(app)/movies/request',
      params: { subjectId: contact.id, subjectType: 'contact', backTo: profileBackTo },
    });
  }

  function openMovieReviewResponse(requestId: string) {
    pushOnce(router, `/(app)/movies/review/${requestId}`);
  }

  function openMemoryPromptRequestShortcut() {
    if (!contact?.linkedUserId) return;
    pushOnce(router, {
      pathname: '/(app)/prompts/request',
      params: { subjectId: contact.id, subjectType: 'contact', backTo: profileBackTo },
    });
  }

  function openMemoryPromptResponse(requestId: string) {
    pushOnce(router, `/(app)/prompts/respond/${requestId}`);
  }

  function openMemoryCameraShortcut() {
    if (!contact) return;
    pushOnce(router, {
      pathname: '/(app)/camera',
      params: {
        subjectId: contact.id,
        subjectType: 'contact',
        returnTo: '/(app)/memories/add',
        backTo: profileBackTo,
      },
    });
  }

  async function openMemoryGalleryShortcut() {
    if (!contact) return;
    if (!isPremium) {
      showGalleryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync(avatarImagePickerOptions);
    if (!result.canceled && result.assets[0]?.uri) {
      pushOnce(router, {
        pathname: '/(app)/memories/add',
        params: {
          subjectId: contact.id,
          subjectType: 'contact',
          capturedUri: result.assets[0].uri,
          backTo: profileBackTo,
        },
      });
    }
  }

  function openMemoryPhotoShortcut() {
    if (!contact) return;
    showPhotoSourceSheet({
      galleryLocked: !isPremium,
      onCamera: openMemoryCameraShortcut,
      onGallery: openMemoryGalleryShortcut,
    });
  }

  async function handleSavePrivateNote() {
    if (!selectedPrivateNote) return;
    setNotesBusy(true);
    try {
      await updatePrivateNote(selectedPrivateNote.id, { title: noteTitleDraft });
      if (selectedTextBlocks.length > 0) {
        for (const block of selectedTextBlocks) {
          await updatePrivateNoteBlock(block.id, { content: noteTextDrafts[block.id] ?? block.content ?? '' });
        }
      } else {
        const block = await addPrivateNoteBlock(selectedPrivateNote.id, { type: 'text', content: '', sortOrder: 0 });
        setNoteTextDrafts((prev) => ({ ...prev, [block.id]: '' }));
      }
      const nextLinkDrafts: Record<string, string> = {};
      for (const block of selectedLinkBlocks) {
        const normalizedLink = normalizePrivateNoteLink(noteLinkDrafts[block.id] ?? block.url ?? block.content ?? '');
        if (normalizedLink) {
          await updatePrivateNoteBlock(block.id, { content: normalizedLink, url: normalizedLink });
          nextLinkDrafts[block.id] = normalizedLink;
        } else {
          await deletePrivateNoteBlock(block.id);
        }
      }
      const newNormalizedLink = normalizePrivateNoteLink(newNoteLinkDraft);
      if (newNormalizedLink) {
        const sortOrder = getNextNoteSortOrder(selectedNoteBlocks);
        const block = await addPrivateNoteBlock(selectedPrivateNote.id, {
          type: 'link',
          content: newNormalizedLink,
          url: newNormalizedLink,
          sortOrder,
        });
        const textBlock = await addPrivateNoteBlock(selectedPrivateNote.id, { type: 'text', content: '', sortOrder: sortOrder + 1 });
        nextLinkDrafts[block.id] = newNormalizedLink;
        setNoteTextDrafts((prev) => ({ ...prev, [textBlock.id]: '' }));
      }
      setNoteLinkDrafts(nextLinkDrafts);
      setNewNoteLinkDraft('');
      setActiveNoteTextBlockId(null);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to save note.');
    } finally {
      setNotesBusy(false);
    }
  }

  async function handleAddPrivateNoteLink() {
    if (!selectedPrivateNote) return;
    const normalizedLink = normalizePrivateNoteLink(newNoteLinkDraft);
    if (!normalizedLink) return;
    setNotesBusy(true);
    try {
      const sortOrder = getNextNoteSortOrder(selectedNoteBlocks);
      const block = await addPrivateNoteBlock(selectedPrivateNote.id, {
        type: 'link',
        content: normalizedLink,
        url: normalizedLink,
        sortOrder,
      });
      const textBlock = await addPrivateNoteBlock(selectedPrivateNote.id, { type: 'text', content: '', sortOrder: sortOrder + 1 });
      setNoteLinkDrafts((prev) => ({ ...prev, [block.id]: normalizedLink }));
      setNoteTextDrafts((prev) => ({ ...prev, [textBlock.id]: '' }));
      setActiveNoteTextBlockId(textBlock.id);
      setNewNoteLinkDraft('');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to add link.');
    } finally {
      setNotesBusy(false);
    }
  }

  async function handleAddPrivateNotePhoto() {
    if (!selectedPrivateNote || !currentUser) return;

    const result = await ImagePicker.launchImageLibraryAsync(privateNoteImagePickerOptions);
    if (result.canceled || !result.assets[0]?.uri) return;

    setNotesBusy(true);
    try {
      const imagePath = await uploadPrivateNoteImage(currentUser.id, selectedPrivateNote.id, result.assets[0].uri);
      const sortOrder = getNextNoteSortOrder(selectedNoteBlocks);
      const block = await addPrivateNoteBlock(selectedPrivateNote.id, {
        type: 'image',
        content: result.assets[0].fileName ?? 'Photo',
        imagePath,
        sortOrder,
      });
      const textBlock = await addPrivateNoteBlock(selectedPrivateNote.id, { type: 'text', content: '', sortOrder: sortOrder + 1 });
      const signedUrl = await createPrivateNoteImageUrl(imagePath);
      setNoteImageUrls((prev) => ({ ...prev, [block.id]: signedUrl }));
      setNoteTextDrafts((prev) => ({ ...prev, [textBlock.id]: '' }));
      setActiveNoteTextBlockId(textBlock.id);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to add photo.');
    } finally {
      setNotesBusy(false);
    }
  }

  function handleDeletePrivateNotePhoto(block: ContactPrivateNoteBlock) {
    Alert.alert('Remove photo?', 'This photo will be removed from this private note.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setNotesBusy(true);
          try {
            if (block.imagePath) await removePrivateNoteImage(block.imagePath);
            await deletePrivateNoteBlock(block.id);
            setNoteImageUrls((prev) => {
              const next = { ...prev };
              delete next[block.id];
              return next;
            });
          } catch (err: any) {
            Alert.alert('Error', err.message ?? 'Failed to remove photo.');
          } finally {
            setNotesBusy(false);
          }
        },
      },
    ]);
  }

  function handleOpenPrivateNoteLink(rawUrl?: string | null) {
    if (!rawUrl) return;
    const url = normalizePrivateNoteLink(rawUrl);
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert('Could not open link', url));
  }

  function handleDeletePrivateNoteLink(block: ContactPrivateNoteBlock) {
    Alert.alert('Remove link?', 'This link will be removed from this private note.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setNotesBusy(true);
          try {
            await deletePrivateNoteBlock(block.id);
            setNoteLinkDrafts((prev) => {
              const next = { ...prev };
              delete next[block.id];
              return next;
            });
          } catch (err: any) {
            Alert.alert('Error', err.message ?? 'Failed to remove link.');
          } finally {
            setNotesBusy(false);
          }
        },
      },
    ]);
  }

  function handleDeletePrivateNote() {
    if (!selectedPrivateNote) return;
    Alert.alert('Delete note?', 'This private note and its blocks will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setNotesBusy(true);
          try {
            const imagePaths = selectedImageBlocks
              .map((block) => block.imagePath)
              .filter((path): path is string => !!path);
            await Promise.all(imagePaths.map((path) => removePrivateNoteImage(path).catch(() => undefined)));
            await deletePrivateNote(selectedPrivateNote.id);
            setSelectedNoteId(null);
            setNoteEditorOpen(false);
            setNoteImageUrls({});
          } catch (err: any) {
            Alert.alert('Error', err.message ?? 'Failed to delete note.');
          } finally {
            setNotesBusy(false);
          }
        },
      },
    ]);
  }

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => backOnce(router)} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
      </Pressable>
      <View style={styles.topBarRight}>
        {linkedUser ? (
          <Pressable
            onPress={() => pushOnce(router, { pathname: '/(app)/profiles/user/[userId]', params: { userId: linkedUser.id, actual: '1' } })}
            style={styles.topBarFriendButton}
            accessibilityRole="button"
            accessibilityLabel={`Open ${linkedUser.displayName}'s profile`}
          >
            <View style={[styles.topBarFriendAvatar, { backgroundColor: linkedUser.avatarColor }]}>
              {linkedUser.avatarPath ? (
                <Image source={{ uri: linkedUser.avatarPath }} style={styles.topBarFriendAvatarImage} />
              ) : (
                <Text style={styles.topBarFriendAvatarText}>{linkedUser.displayName.trim().slice(0, 1).toUpperCase() || '?'}</Text>
              )}
            </View>
            <Text style={styles.topBarFriendName} numberOfLines={1}>{linkedUser.displayName}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => pushOnce(router, '/(app)/notifications')}
          style={styles.notificationButton}
          accessibilityRole="button"
          accessibilityLabel={notificationBadgeCount > 0 ? `Notifications, ${notificationBadgeCount} unread` : 'Notifications'}
        >
          <Ionicons name={notificationBadgeCount > 0 ? 'notifications' : 'notifications-outline'} size={20} color={colors.inkMuted} />
          {notificationBadgeCount > 0 ? (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>{notificationBadgeCount > 9 ? '9+' : notificationBadgeCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable onPress={() => togglePin(contact.id)} style={styles.pinButton} accessibilityRole="button" accessibilityLabel={contact.pinned ? 'Unpin contact' : 'Pin contact'}>
          <Text style={styles.pinLabel}>{contact.pinned ? <Ionicons name="pin" size={20} color="#E74C3C" /> : <Ionicons name="pin-outline" size={20} color={colors.inkMuted} />}</Text>
        </Pressable>
        <Pressable onPress={() => setEditing((prev) => !prev)} style={[styles.editButton, editing && styles.editButtonActive]} accessibilityRole="button" accessibilityLabel={editing ? 'Done editing' : 'Edit contact'}>
          <Text style={[styles.editButtonLabel, editing && styles.editButtonLabelActive]}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>
    </View>
  );

  const showingFullScreenNote = activePane === 'notes' && noteEditorOpen && !!selectedPrivateNote;

  const noteTopBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => setNoteEditorOpen(false)} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to private notes">
        <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Notes</Text>
      </Pressable>
      <Text style={styles.noteAutoSaveStatus} accessibilityLiveRegion="polite">
        {notesAutoSaving ? 'Saving…' : notesLastSavedAt ? 'Saved' : ''}
      </Text>
    </View>
  );

  const screenContent: ReactNode[] = [];

  if (showingFullScreenNote) {
    screenContent.push(
      <View key="private-note-editor-fullscreen" style={[styles.noteEditor, styles.noteEditorFullscreen]}>
        <TextInput
          value={noteTitleDraft}
          onChangeText={setNoteTitleDraft}
          placeholder="Title"
          placeholderTextColor={effectiveColors.inkMuted}
          style={styles.noteTitleInput}
        />
        <View style={styles.noteBodyCanvas}>
          <View style={styles.noteBodyBlockList}>
            {selectedNoteBlocks.map((block, index) => {
              if (block.type === 'text') {
                const textDraft = noteTextDrafts[block.id] ?? block.content ?? '';
                const isEditingText = activeNoteTextBlockId === block.id || !textDraft.trim();
                if (isEditingText) {
                  return (
                    <TextInput
                      key={block.id}
                      value={textDraft}
                      onChangeText={(text) => setNoteTextDrafts((prev) => ({ ...prev, [block.id]: text }))}
                      onFocus={() => setActiveNoteTextBlockId(block.id)}
                      onBlur={() => setActiveNoteTextBlockId((current) => (current === block.id ? null : current))}
                      placeholder={index === 0 ? 'Start typing…' : 'Type under this…'}
                      placeholderTextColor={effectiveColors.inkMuted}
                      style={[styles.noteBodyTextBlockInput, index === 0 && styles.noteBodyTextBlockInputFirst]}
                      multiline
                      scrollEnabled={false}
                      textAlignVertical="top"
                      autoFocus={activeNoteTextBlockId === block.id}
                    />
                  );
                }

                return (
                  <Text
                    key={block.id}
                    style={[styles.noteBodyTextBlockDisplay, index === 0 && styles.noteBodyTextBlockDisplayFirst]}
                    onPress={() => setActiveNoteTextBlockId(block.id)}
                  >
                    {splitPrivateNoteInlineLinks(textDraft).map((part, partIndex) => (
                      part.type === 'link' ? (
                        <Text
                          key={`${block.id}-link-${partIndex}`}
                          onPress={(event) => {
                            event.stopPropagation();
                            handleOpenPrivateNoteLink(part.text);
                          }}
                          style={styles.noteBodyInlineLink}
                        >
                          {part.text}
                        </Text>
                      ) : (
                        <Text key={`${block.id}-text-${partIndex}`}>
                          {part.text}
                        </Text>
                      )
                    ))}
                  </Text>
                );
              }

                if (block.type === 'link') {
                  const linkDraft = noteLinkDrafts[block.id] ?? block.url ?? block.content ?? '';
                  return (
                    <View key={block.id} style={styles.noteBodyLinkBlock}>
                      <Pressable onPress={() => handleOpenPrivateNoteLink(linkDraft)} style={styles.noteBodyLinkPressable} accessibilityRole="link">
                        <Ionicons name="link-outline" size={16} color={tint} />
                        <Text style={styles.noteBodyLinkText} numberOfLines={2}>{linkDraft}</Text>
                      </Pressable>
                      <Pressable onPress={() => handleDeletePrivateNoteLink(block)} disabled={notesBusy} style={styles.noteIconButton} accessibilityRole="button" accessibilityLabel="Remove private note link">
                        <Ionicons name="close" size={15} color={colors.error} />
                      </Pressable>
                    </View>
                  );
                }

                const imageUrl = noteImageUrls[block.id];
                return (
                  <View key={block.id} style={styles.noteBodyPhotoBlock}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.noteBodyPhotoImage} />
                    ) : (
                      <View style={styles.noteBodyPhotoLoading}>
                        <Ionicons name="image-outline" size={28} color={colors.inkSoft} />
                      </View>
                    )}
                    <Pressable
                      onPress={() => handleDeletePrivateNotePhoto(block)}
                      disabled={notesBusy}
                      style={styles.noteBodyPhotoRemoveButton}
                      accessibilityRole="button"
                      accessibilityLabel="Remove private note photo"
                    >
                      <Ionicons name="close" size={15} color={colors.white} />
                    </Pressable>
                  </View>
                );
              })}
          </View>
          <View style={styles.noteInsertToolbar}>
            <Pressable onPress={handleAddPrivateNotePhoto} disabled={notesBusy} style={styles.noteInlinePhotoButton} accessibilityRole="button">
              <Ionicons name="images-outline" size={18} color={tint} />
              <Text style={styles.noteInlinePhotoLabel}>{notesBusy ? 'Working…' : 'Photo'}</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.noteActions}>
          <Pressable onPress={handleDeletePrivateNote} disabled={notesBusy} style={styles.noteDeleteButton} accessibilityRole="button">
            <Text style={styles.noteDeleteLabel}>Delete</Text>
          </Pressable>
        </View>
      </View>,
    );
  } else {

  screenContent.push(
    <View key="hero" style={[styles.heroSection, editing && styles.heroSectionEditing]}>
      <MemoryProfileCard
        accentColor={profileCard.accentColor}
        backPlaceholder="Nothing written on the back yet"
        backText={contact.backText}
        cardColor={profileCard.cardColor}
        colors={effectiveColors}
        glow={profileCard.friendHasPremium}
        imageUri={profileCard.avatarUri}
        name={profileCard.displayName}
        note={profileCard.note}
        onPress={editing ? handleHeroPress : undefined}
        videoMuted={profileCard.videoMuted}
        videoUri={profileCard.videoUri}
      />
      {!linkedUser ? (
        <View style={styles.connectionCard}>
          <View style={styles.connectionHeader}>
            <View style={[styles.statusDot, styles.statusDotOff]} />
            <Text style={styles.connectionTitle}>Not connected to an account</Text>
          </View>
          <Text style={styles.connectionSubtitle}>
            {suggestedExistingFriend
              ? `Possible match found: ${suggestedExistingFriend.email}. Connect it only if this is the right account.`
              : 'Invite them or link them when they join.'}
          </Text>
        </View>
      ) : null}
      {friendHasPremium ? (
        <View style={styles.heroPremiumBadge}>
          <Ionicons name="star" size={11} color="#7A5A1A" />
          <Text style={styles.heroPremiumBadgeText}>PREMIUM</Text>
        </View>
      ) : null}
      {editing ? (
        <View style={styles.editHeroHint}>
          <Ionicons name="create-outline" size={14} color={tint} />
          <Text style={styles.editHeroHintText}>Tap the card to edit their profile</Text>
        </View>
      ) : null}
    </View>,
  );

  if (contact.tags.length > 0) {
    screenContent.push(
      <View key="relationship-tags" style={styles.relationshipTagRow}>
        {contact.tags.map((tag) => (
          <View key={tag} style={styles.relationshipTagChip}>
            <Text style={styles.relationshipTagText}>{tag}</Text>
          </View>
        ))}
      </View>,
    );
  }

  screenContent.push(
    <View key="profile-notes-tabs" style={styles.segmentedControl}>
      <Pressable
        onPress={() => { setNoteEditorOpen(false); setActivePane('profile'); }}
        style={[styles.segmentedButton, activePane === 'profile' && styles.segmentedButtonActive]}
        accessibilityRole="button"
        accessibilityState={{ selected: activePane === 'profile' }}
      >
        <Ionicons name="person-outline" size={15} color={activePane === 'profile' ? colors.white : tint} />
        <Text style={[styles.segmentedLabel, activePane === 'profile' && styles.segmentedLabelActive]}>Profile</Text>
      </Pressable>
      <Pressable
        onPress={() => setActivePane('notes')}
        style={[styles.segmentedButton, activePane === 'notes' && styles.segmentedButtonActive]}
        accessibilityRole="button"
        accessibilityState={{ selected: activePane === 'notes' }}
      >
        <Ionicons name="document-text-outline" size={15} color={activePane === 'notes' ? colors.white : tint} />
        <Text style={[styles.segmentedLabel, activePane === 'notes' && styles.segmentedLabelActive]}>Notes</Text>
      </Pressable>
    </View>,
  );

  if (activePane === 'profile') {

  screenContent.push(
    linkedUser ? (
      <Pressable
        key="wall-button"
        onPress={() => pushOnce(router, `/(app)/wall/${linkedUser.id}`)}
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
                {existingFriendLinkTargets.length > 0 ? (
                  <View style={styles.existingFriendPanel}>
                    <Pressable
                      onPress={() => setExistingFriendLinkOpen((open) => !open)}
                      style={styles.existingFriendToggle}
                      accessibilityRole="button"
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.existingFriendTitle}>Already in your friends?</Text>
                        <Text style={styles.existingFriendSubtitle}>Open their real profile to choose exactly which saved profile they belong to.</Text>
                      </View>
                      <Ionicons name={existingFriendLinkOpen ? 'chevron-up' : 'chevron-down'} size={18} color={tint} />
                    </Pressable>
                    {existingFriendLinkOpen ? (
                      <View style={styles.existingFriendList}>
                        {existingFriendLinkTargets.map((friend) => (
                          <Pressable
                            key={friend.id}
                            onPress={() => handleLinkExistingFriend(friend.id)}
                            style={styles.existingFriendRow}
                            accessibilityRole="button"
                          >
                            <View style={[styles.existingFriendAvatar, { backgroundColor: friend.avatarColor }]}>
                              <Text style={styles.existingFriendAvatarText}>{friend.displayName.trim().slice(0, 1).toUpperCase() || '?'}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.existingFriendName}>{friend.displayName}</Text>
                              <Text style={styles.existingFriendEmail}>{friend.email}</Text>
                            </View>
                            <Ionicons name="open-outline" size={17} color={tint} />
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <Text style={styles.connectHint}>Or scan their QR code or type their friend code.</Text>
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
                      if (res.requested) {
                        Alert.alert('Request sent', `${res.friend.displayName} needs to accept before this card can link to their account.`);
                        return;
                      }
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
            <Text style={styles.connectCtaAction}>Connect existing friend or friend code  →</Text>
          </Pressable>
        )}
      </View>
    ),
  );

  screenContent.push(
    <View key="facts" style={[styles.section, editing && styles.editableFactsSection]}>
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
        <View style={styles.factEditorBox}>
          <View style={styles.editFactHintRow}>
            <Ionicons name="sparkles-outline" size={14} color={tint} />
            <Text style={styles.editFactHintText}>Add facts here. Tap the x on a chip to remove one.</Text>
          </View>
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
        </View>
      )}
    </View>,
  );

  screenContent.push(
    <View key="memory-wall-heading" style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.memoryWallTitle}>Memory Wall</Text>
      </View>
      {isLinked ? (
        <>
          <WallModeToggle
            colors={effectiveColors}
            fonts={effectiveFonts}
            onChange={setWallMode}
            options={[
              { key: 'shared', label: 'Shared wall' },
              { key: 'mine', label: 'Your wall' },
            ]}
            tint={tint}
            value={wallMode}
          />
          <MemoryWallViewToggle
            colors={effectiveColors}
            fonts={effectiveFonts}
            indicators={wallViewIndicators}
            onChange={setMemoryWallViewMode}
            tint={tint}
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
        </>
      ) : (
        <>
          <MemoryWallViewToggle
            colors={effectiveColors}
            fonts={effectiveFonts}
            indicators={wallViewIndicators}
            onChange={setMemoryWallViewMode}
            tint={tint}
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
        </>
      )}
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
              tint={tint}
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
        dayGroups={wallDayGroups}
        emptyAction={
          <Pressable
            onPress={openMemoryNoteShortcut}
            style={styles.memoryPromptButton}
            accessibilityRole="button"
            accessibilityLabel={`Start a memory prompt for ${contact.displayName}`}
          >
            <Ionicons name="sparkles-outline" size={14} color={effectiveColors.white} />
            <Text style={styles.memoryPromptButtonText}>Start with a prompt</Text>
          </Pressable>
        }
        emptyHint={wallMode === 'shared' && isLinked
          ? `No shared memories between you and ${contact.displayName} yet.`
          : 'No memories yet. Be the first to write one.'}
        promptContent={wallMode === 'shared' && isLinked ? (
          <MemoryPromptRequestList
            currentUserId={currentUser.id}
            friendName={contact.displayName}
            memoryPrompts={memoryPromptRequests}
            moviePrompts={moviePromptRequests}
            onAnswerMemoryPrompt={openMemoryPromptResponse}
            onCancelMemoryPrompt={(requestId) => cancelMemoryPromptRequest(requestId, currentUser.id)}
            onCreateMemoryPrompt={openMemoryPromptRequestShortcut}
            onAnswerMoviePrompt={openMovieReviewResponse}
            onCancelMoviePrompt={(requestId) => cancelMovieReviewRequest(requestId, currentUser.id)}
            onCreateMoviePrompt={openMovieRequestShortcut}
            themeColors={effectiveColors}
            tint={tint}
          />
        ) : undefined}
        getGridExtraHeight={(post) => getReplyGridExtraHeight(getRepliesForWallPost(post.id).length)}
        themeColors={effectiveColors}
        viewMode={memoryWallViewMode}
        renderPost={(post, context) => {
          const author = getUserById(post.authorUserId);
          const canEditPost = post.authorUserId === currentUser.id;
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
              style={[styles.wallPostWithProfileAction, focusedReferencePostId === post.id && styles.glowRow]}
            >
              <WallPostCard
                authorName={author?.displayName ?? 'Unknown'}
                post={post}
                cardColor={post.cardColor}
                themeColors={effectiveColors}
                imageLoadEnabled={wallImageLoading.isImageLoadEnabled(post)}
                displayMode={context?.viewMode}
                referencedPost={referencedPost}
                referencedPostAuthorName={referencedPost ? getUserById(referencedPost.authorUserId)?.displayName ?? 'Someone' : undefined}
                editing={editing}
                shareable={!editing}
                onPress={editing && canEditPost ? () => pushOnce(router, { pathname: '/(app)/memories/edit', params: { postId: post.id } }) : undefined}
                onLongPress={!editing ? () => handleMemoryLongPress(post) : undefined}
                onReferencedPostPress={post.referencedWallPostId ? focusReferencedPost : undefined}
                onImageReady={wallImageLoading.markImageReady}
                onSaveBackText={canEditPost ? handleSaveBackText : undefined}
              />
              {!editing ? (
                <MemoryReplyThreadPreview
                  replies={replyItems}
                  onOpenThread={() => pushOnce(router, `/(app)/memories/replies/${post.id}`)}
                  themeColors={effectiveColors}
                />
              ) : null}
            </View>
          );
        }}
      />
    </View>,
  );

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

  } else {
    screenContent.push(
      <View key="private-notes" style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Private Notes</Text>
          <Pressable onPress={handleCreatePrivateNote} disabled={notesBusy} accessibilityRole="button">
            <Text style={styles.addLink}>{notesBusy ? 'Saving…' : 'Add'}</Text>
          </Pressable>
        </View>
        {privateNotes.length === 0 ? (
          <Text style={styles.emptyHint}>No private notes yet. Add links, photo reminders, or anything you want to keep just for you.</Text>
        ) : (
          <View style={styles.noteList}>
            {privateNotes.map((note) => {
              const blocks = getPrivateNoteBlocks(note.id);
              const preview = getNotePreview(blocks);
              const active = noteEditorOpen && selectedPrivateNote?.id === note.id;
              return (
                <Pressable
                  key={note.id}
                  onPress={() => { setSelectedNoteId(note.id); setNoteEditorOpen(true); }}
                  style={[styles.noteRow, active && styles.noteRowActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={styles.noteRowIcon}>
                    <Ionicons name="document-text-outline" size={18} color={active ? tint : colors.inkSoft} />
                  </View>
                  <View style={styles.noteRowBody}>
                    <Text style={styles.noteRowTitle} numberOfLines={1}>{note.title || 'Untitled note'}</Text>
                    <Text style={styles.noteRowMeta} numberOfLines={1}>{preview || formatNoteDate(note.updatedAt)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>,
    );
  }
  }

  const showFloatingMemoryControls = activePane === 'profile' && !showingFullScreenNote;
  const memoryControlsScreenStyle = showFloatingMemoryControls ? styles.profileScreenWithMemoryMenu : undefined;
  const memoryMenuAnimatedStyle = {
    opacity: memoryMenuAnim,
    transform: [
      { translateY: memoryMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
      { scale: memoryMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
    ],
  };

  return (
    <View style={styles.screenShell}>
      <ProfileBackgroundBackdrop colors={effectiveColors} imageUri={contact.profileBgImagePath} />
      <AppScreen
        header={showingFullScreenNote ? noteTopBar : topBar}
        floatingHeaderOnScroll={!showingFullScreenNote}
        contentContainerStyle={showingFullScreenNote ? styles.noteScreenContent : memoryControlsScreenStyle}
        gradientColors={getProfileScreenGradientColors(contact.profileBgImagePath, themedColors)}
        onScroll={activePane === 'profile' && !showingFullScreenNote ? handleMemoryMenuScroll : undefined}
        onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }}
        refreshing={refreshing}
        scrollViewRef={scrollViewRef}
      >
        {screenContent}
      </AppScreen>

      {showFloatingMemoryControls ? (
        <View pointerEvents="box-none" style={styles.memoryFloatingLayer}>
          <Animated.View
            pointerEvents={memoryMenuVisible ? 'auto' : 'none'}
            style={[styles.memoryFloatingRow, { bottom: memoryDockBottom }, memoryMenuAnimatedStyle]}
          > 
            <View style={styles.memoryFloatingActionRow}>
              <Pressable
                onPress={openMemoryNoteShortcut}
                style={[styles.memoryFloatingButton, styles.memoryFloatingSecondaryButton]}
                accessibilityRole="button"
                accessibilityLabel={`Add note about ${contact.displayName}`}
              >
                <Ionicons name="create-outline" size={24} color={effectiveColors.inkSoft} />
              </Pressable>
              {contact.linkedUserId ? (
                <Pressable
                  onPress={openGiftNoteShortcut}
                  style={[styles.memoryFloatingButton, styles.memoryFloatingSecondaryButton]}
                  accessibilityRole="button"
                  accessibilityLabel={`Add gift note for ${contact.displayName}`}
                >
                  <Ionicons name="gift-outline" size={24} color={effectiveColors.inkSoft} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={openMemoryPhotoShortcut}
                style={[styles.memoryFloatingButton, styles.memoryFloatingPrimaryButton]}
                accessibilityRole="button"
                accessibilityLabel={`Add photo about ${contact.displayName}`}
              >
                <Ionicons name="camera-outline" size={25} color={effectiveColors.white} />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

function getNotePreview(blocks: ContactPrivateNoteBlock[]) {
  const text = blocks.find((block) => block.type === 'text' && block.content?.trim())?.content?.trim();
  if (text) return text;
  const linkBlocks = blocks.filter((block) => block.type === 'link' && (block.url?.trim() || block.content?.trim()));
  if (linkBlocks.length === 1) return linkBlocks[0].url?.trim() || linkBlocks[0].content?.trim() || '1 link';
  if (linkBlocks.length > 1) return `${linkBlocks.length} links`;
  const photoCount = blocks.filter((block) => block.type === 'image').length;
  if (photoCount > 0) return photoCount === 1 ? '1 photo' : `${photoCount} photos`;
  return '';
}

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

function normalizePrivateNoteLink(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

type PrivateNoteInlinePart = { type: 'text' | 'link'; text: string };

const PRIVATE_NOTE_INLINE_LINK_REGEX = /((?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()]*)?)/gi;
const PRIVATE_NOTE_TRAILING_LINK_PUNCTUATION = /[.,!?;:)\]]$/;

function splitPrivateNoteInlineLinks(value: string): PrivateNoteInlinePart[] {
  const parts: PrivateNoteInlinePart[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(PRIVATE_NOTE_INLINE_LINK_REGEX)) {
    const rawMatch = match[0];
    const matchIndex = match.index ?? 0;
    let linkText = rawMatch;
    let trailingText = '';

    while (linkText && PRIVATE_NOTE_TRAILING_LINK_PUNCTUATION.test(linkText)) {
      trailingText = linkText.slice(-1) + trailingText;
      linkText = linkText.slice(0, -1);
    }

    if (!linkText) continue;
    if (matchIndex > lastIndex) parts.push({ type: 'text', text: value.slice(lastIndex, matchIndex) });
    parts.push({ type: 'link', text: linkText });
    if (trailingText) parts.push({ type: 'text', text: trailingText });
    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < value.length) parts.push({ type: 'text', text: value.slice(lastIndex) });
  return parts.length > 0 ? parts : [{ type: 'text', text: value }];
}

function getNextNoteSortOrder(blocks: ContactPrivateNoteBlock[]) {
  return blocks.reduce((max, block) => Math.max(max, block.sortOrder), -1) + 1;
}

function formatNoteDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Updated just now';
  return `Updated ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
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
    backButton: { paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    topBarFriendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      maxWidth: 148,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: tint + '35',
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
    notificationButton: {
      position: 'relative',
      padding: spacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      backgroundColor: colors.error,
    },
    notificationBadgeText: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.white },
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
    noteTopSaveButton: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: tint,
    },
    noteTopSaveLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
    noteAutoSaveStatus: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.inkSoft,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      minWidth: 60,
      textAlign: 'right',
    },
    noteScreenContent: { paddingBottom: 260 },
    profileScreenWithMemoryMenu: { paddingBottom: 150 },
    section: { gap: spacing.sm },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
    addLink: { fontFamily: fonts.bodyBold, fontSize: 14, color: tint },
    memoryShortcutRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.lg,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
    },
    memoryShortcutButton: {
      width: 78,
      height: 78,
      borderRadius: 39,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    memoryShortcutButtonPrimary: {
      backgroundColor: tint,
      borderColor: tint,
    },
    memoryFloatingLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 30,
      elevation: 30,
    },
    memoryFloatingRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    memoryFloatingActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      alignSelf: 'center',
    },
    memoryFloatingButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 10,
    },
    memoryFloatingSecondaryButton: {
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    memoryFloatingPrimaryButton: {
      borderColor: tint,
      backgroundColor: tint,
    },
    segmentedControl: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: spacing.xs,
      padding: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    segmentedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
    },
    segmentedButtonActive: { backgroundColor: tint },
    segmentedLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: tint },
    segmentedLabelActive: { color: colors.white },
    noteList: { gap: spacing.sm },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    noteRowActive: { borderColor: tint, backgroundColor: tint + '12' },
    noteRowIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperMuted,
    },
    noteRowBody: { flex: 1, gap: 2 },
    noteRowTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    noteRowMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
    noteEditor: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    noteEditorFullscreen: {
      minHeight: 620,
      paddingHorizontal: 0,
      paddingTop: spacing.sm,
      borderWidth: 0,
      borderRadius: 0,
      backgroundColor: 'transparent',
    },
    noteTitleInput: {
      fontFamily: fonts.heading,
      fontSize: 24,
      color: colors.ink,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      ...protectTextFromFontClipping(fonts.heading, 24),
    },
    noteBodyInput: {
      minHeight: 180,
      fontFamily: fonts.body,
      fontSize: 16,
      lineHeight: 23,
      color: colors.ink,
      paddingVertical: spacing.sm,
    },
    noteBodyInputFullscreen: { minHeight: 220 },
    noteBodyTextBlockInput: {
      minHeight: 46,
      fontFamily: fonts.body,
      fontSize: 16,
      lineHeight: 23,
      color: colors.ink,
      paddingVertical: spacing.xs,
      paddingHorizontal: 0,
    },
    noteBodyTextBlockInputFirst: { minHeight: 150 },
    noteBodyTextBlockDisplay: {
      minHeight: 46,
      fontFamily: fonts.body,
      fontSize: 16,
      lineHeight: 23,
      color: colors.ink,
      paddingVertical: spacing.xs,
      paddingHorizontal: 0,
    },
    noteBodyTextBlockDisplayFirst: { minHeight: 150 },
    noteBodyInlineLink: {
      fontFamily: fonts.bodyMedium,
      color: tint,
      textDecorationLine: 'underline',
    },
    noteBodyCanvas: {
      gap: spacing.md,
      paddingTop: spacing.xs,
    },
    noteInsertToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    noteInlinePhotoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      minWidth: 92,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: tint + '50',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: tint + '12',
    },
    noteInlinePhotoLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: tint },
    noteInlineLinkComposer: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      paddingLeft: spacing.md,
      paddingRight: spacing.xs,
      paddingVertical: 3,
    },
    noteBodyBlockList: { gap: spacing.md },
    noteBodyLinkBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    noteBodyLinkPressable: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    noteBodyLinkText: {
      flex: 1,
      minWidth: 0,
      fontFamily: fonts.bodyMedium,
      fontSize: 16,
      lineHeight: 22,
      color: tint,
      textDecorationLine: 'underline',
    },
    noteBodyPhotoBlock: {
      width: '100%',
      aspectRatio: 4 / 3,
      borderRadius: radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
    },
    noteBodyPhotoImage: { width: '100%', height: '100%' },
    noteBodyPhotoLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    noteBodyPhotoRemoveButton: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.58)',
    },
    noteLinksSection: { gap: spacing.sm },
    noteLinkList: { gap: spacing.xs },
    noteLinkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    noteLinkRowInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: spacing.xs },
    noteIconButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperMuted,
    },
    noteLinkBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    noteLinkInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingVertical: spacing.xs },
    noteAddLinkButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tint,
    },
    noteAddLinkButtonDisabled: { opacity: 0.35 },
    noteOpenLinkButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paper,
    },
    notePhotoSection: { gap: spacing.sm },
    notePhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    notePhotoTile: {
      width: 96,
      height: 96,
      borderRadius: radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
    },
    notePhotoImage: { width: '100%', height: '100%' },
    notePhotoLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    notePhotoRemoveButton: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    noteAddPhotoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.line,
      padding: spacing.md,
    },
    noteAddPhotoLabel: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: tint },
    noteActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    noteSaveButton: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: tint },
    noteSaveLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
    noteDeleteButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    noteDeleteLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
    editableFactsSection: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: tint + '66',
      backgroundColor: tint + '0F',
      padding: spacing.md,
    },
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
    deleteLink: { fontFamily: fonts.heading, fontSize: 20, color: colors.error, paddingLeft: spacing.sm, ...protectTextFromFontClipping(fonts.heading, 20) },
    emptyHint: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
    memoryFilterRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
    memoryFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    memoryFilterChipActive: { backgroundColor: tint, borderColor: tint },
    memoryFilterText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
    memoryFilterTextActive: { color: colors.white },
    memoryPromptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: tint,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    memoryPromptButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
    lockedGiftBlock: { gap: spacing.sm },
    factEditorBox: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: tint + '66',
      backgroundColor: colors.paper,
      padding: spacing.sm,
      gap: spacing.sm,
    },
    editFactHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    editFactHintText: {
      flex: 1,
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkSoft,
      lineHeight: 17,
    },
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
    addFactButtonLabel: { fontFamily: fonts.heading, fontSize: 22, color: colors.white, ...protectTextFromFontClipping(fonts.heading, 22) },
    monthWallPostsBlock: { marginTop: -spacing.md },
    wallPostWithProfileAction: { alignItems: 'center', gap: spacing.xs },
    glowRow: {
      borderRadius: radius.lg,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.55,
      shadowRadius: 18,
      elevation: 8,
    },
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
    wallModeChipActive: { backgroundColor: tint },
    wallModeLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
    wallModeLabelActive: { color: contrastText(tint) },
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
    heroSectionEditing: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: tint + '88',
      backgroundColor: tint + '10',
      padding: spacing.md,
    },
    editHeroHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: tint + '55',
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    editHeroHintText: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: tint,
    },
    heroAmbientShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
    },
    heroPremiumGlow: {
      shadowColor: '#F5C242',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.95,
      shadowRadius: 22,
      elevation: 12,
    },
    heroPremiumBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
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
      letterSpacing: 1.2,
      color: '#7A5A1A',
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
    heroCardGhost: {
      borderColor: 'rgba(180,170,155,0.22)',
      shadowOpacity: 0.12,
      shadowRadius: 8,
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
    heroPhotoSurface: {
      flex: 1, width: '100%', height: '100%',
      alignItems: 'center', justifyContent: 'center',
    },
    heroInitials: { fontFamily: fonts.bodyBold, fontSize: 52, lineHeight: 58, color: colors.white, textAlign: 'center' },
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
      ...protectTextFromFontClipping(fonts.handwrittenBold, 26),
    },
    heroNote: {
      fontFamily: fonts.handwritten,
      fontSize: 15,
      lineHeight: HERO_NOTE_LINE_HEIGHT,
      color: colors.inkSoft,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible' as const,
      ...protectTextFromFontClipping(fonts.handwritten, 15),
    },

    /* ── Back face ── */
    heroCardBack: {
      paddingTop: 24,
      paddingHorizontal: HERO_PAD_SIDE + 6,
      paddingBottom: 24,
      justifyContent: 'center',
      gap: 8,
    },
    backText: { fontFamily: fonts.handwritten, fontSize: 17, lineHeight: 24, textAlign: 'center', color: FRAME_INK, flex: 1, ...protectTextFromFontClipping(fonts.handwritten, 17) },
    backPlaceholder: { fontFamily: fonts.handwritten, fontSize: 17, textAlign: 'center', color: FRAME_INK_SOFT, flex: 1, opacity: 0.5, ...protectTextFromFontClipping(fonts.handwritten, 17) },
    backHint: { fontFamily: fonts.body, fontSize: 10, textAlign: 'center', color: FRAME_INK_SOFT, opacity: 0.5, paddingTop: 2 },

    heroSubtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSoft },
    connectionCard: {
      width: '100%',
      maxWidth: 340,
      gap: spacing.xs,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper + 'D9',
      padding: spacing.md,
    },
    connectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    connectionTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
    connectionSubtitle: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
    manageConnectionButton: {
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      backgroundColor: tint + '16',
      borderWidth: 1,
      borderColor: tint + '45',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginTop: spacing.xs,
    },
    manageConnectionLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: tint },
    moveConnectionPanel: {
      gap: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: spacing.sm,
      marginTop: spacing.xs,
    },
    moveConnectionTitle: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
    moveConnectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.paperMuted,
      padding: spacing.sm,
    },
    moveConnectionAvatar: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tint,
    },
    moveConnectionAvatarText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
    moveConnectionName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
    moveConnectionMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusDotOn: { backgroundColor: '#34C759' },
    statusDotOff: { backgroundColor: '#8E8E93' },
    relationshipTagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.xs,
      marginTop: -spacing.xs,
    },
    relationshipTagChip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: tint + '45',
      backgroundColor: tint + '14',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    relationshipTagText: { fontFamily: fonts.bodyBold, fontSize: 12, color: tint },
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
    connectFormTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 18) },
    connectHint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
    existingFriendPanel: {
      gap: spacing.xs,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: tint + '35',
      backgroundColor: tint + '0F',
      padding: spacing.sm,
    },
    existingFriendToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    existingFriendTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
    existingFriendSubtitle: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.inkSoft },
    existingFriendList: { gap: spacing.xs, paddingTop: spacing.xs },
    existingFriendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.paper,
      padding: spacing.sm,
    },
    disabledRow: { opacity: 0.45 },
    existingFriendAvatar: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    existingFriendAvatarText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
    existingFriendName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
    existingFriendEmail: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft },
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
