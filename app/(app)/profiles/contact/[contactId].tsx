import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ReactNode, useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { Alert, Animated, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import {
  type DayGroup,
} from '../../../../src/components/MonthScrollableMemoryWall';
import { MemoryWallViewToggle, MemoryWallViews, memoryWallViewOptionsNoPrompts, type MemoryWallViewMode } from '../../../../src/components/MemoryWallViews';
import { MemoryPromptRequestList } from '../../../../src/components/MemoryPromptRequestList';
import { MemoryReplyThreadPreview } from '../../../../src/components/MemoryReplyThreadPreview';
import { LockedGiftNoteCard } from '../../../../src/components/LockedGiftNoteCard';
import { MemoryProfileCard, ProfileBackgroundBackdrop } from '../../../../src/components/profile';
import { PolaroidIcon } from '../../../../src/components/PolaroidIcon';
import { SectionCard } from '../../../../src/components/SectionCard';
import { ProfileSkeleton } from '../../../../src/components/Skeleton';
import { WallPostCard } from '../../../../src/components/WallPostCard';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useCalendar } from '../../../../src/features/calendar/CalendarContext';
import { useScrollChrome } from '../../../../src/features/navigation/ScrollChromeContext';
import { usePremium } from '../../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { buildContactProfileViewModel } from '../../../../src/features/social/selectors';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../../src/features/theme/themes';
import { protectTextFromFontClipping } from '../../../../src/theme/fontProtection';
import type { FontSet } from '../../../../src/theme/typography';
import { accentPalette, colors as baseColors, radius, spacing } from '../../../../src/theme/tokens';
import { notifyMemoryAuthorRecipientDeveloped } from '../../../../src/lib/memoryRecipientDevelopNotifications';
import { backOnce, navigateOnce, pushOnce, replaceOnce } from '../../../../src/lib/navigationGuard';
import { createPrivateNoteImageUrl, removePrivateNoteImage, uploadPrivateNoteImage } from '../../../../src/lib/privateNoteMedia';
import { showGalleryPaywall, showGiftNotePaywall, showMediaMemoryPaywall, showPromptPaywall } from '../../../../src/lib/premiumGates';
import { showPhotoSourceSheet } from '../../../../src/lib/photoSourceSheet';
import { isPromptExpired } from '../../../../src/lib/promptExpiration';
import { canDeleteWallPost, canEditWallPostContent } from '../../../../src/lib/wallPostPermissions';
import { avatarImagePickerOptions, memoryImagePickerOptions, memoryMediaPickerOptions, privateNoteImagePickerOptions } from '../../../../src/lib/imagePickerPresets';
import { getProfileScreenGradientColors, useEffectiveProfileTheme } from '../../../../src/hooks/useEffectiveProfileTheme';
import { useIncomingMemoryDevelopStarts } from '../../../../src/hooks/useIncomingMemoryDevelopStarts';
import { compareWallPostsByMemoryDateDesc, groupPostsByMemoryDateDay } from '../../../../src/lib/memoryDate';
import {
  getNotificationIdsForMemoryPrompt,
  getNotificationIdsForMoviePrompt,
  getNotificationIdsForWallPost,
  getUnreadMemoryPromptIds,
  getUnreadMoviePromptIds,
  getUnreadWallPostIds,
  markProfileNotificationIdsRead,
} from '../../../../src/lib/profileNotificationIndicators';
import { usePrioritizedWallImageLoading } from '../../../../src/hooks/usePrioritizedWallImageLoading';
import { useSyntheticNotificationReads } from '../../../../src/hooks/useSyntheticNotificationReads';
import type { ContactPrivateNoteBlock, WallPost } from '../../../../src/types/domain';
import {
  MEMORY_FILTER_OPTIONS,
  type MemoryFilter,
  addStringsToSet,
  filterWallPosts,
  formatNoteDate,
  getNextNoteSortOrder,
  getNotePreview,
  getReplyGridExtraHeight,
  mergeStringSets,
  normalizePrivateNoteLink,
  splitPrivateNoteInlineLinks,
  uniqueStrings,
} from './contactProfileHelpers';

const REGULAR_VIDEO_MAX_DURATION_MS = 30000;

export default function ContactProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ contactId: string | string[] }>();
  const { currentUser } = useAuth();
  const { resolvedMode } = useTheme();
  const { isScrollChromeHidden } = useScrollChrome();
  const { isPremium, isUserPremium } = usePremium();
  const { loading, contacts, getContactById, getUserById, getDirectFriends, getPeopleListForUser, getWallPostsForSubject, getVisiblePostsByAuthor, getPrivateNotesForContact, getPrivateNoteById, getPrivateNoteBlocks, cancelGiftNote, getGiftNotesForPair, getMovieReviewRequestsForPair, cancelMovieReviewRequest, getMemoryPromptRequestsForPair, cancelMemoryPromptRequest, getRepliesForWallPost, getWallPostById, createPrivateNote, updatePrivateNote, deletePrivateNote, addPrivateNoteBlock, updatePrivateNoteBlock, deletePrivateNoteBlock, addContactFact, deleteContactFact, addContactPersonalityTrait, deleteContactPersonalityTrait, deleteWallPost, updateWallPost, updateContact, migrateContactPostsToUser, linkContactByFriendCode, togglePin, removeFriend, deleteContact, notifications, unreadCount, markNotificationRead, isPostOnProfileWall, addPostToProfileWall, refresh } = useSocialGraph();
  const { events } = useCalendar();
  const contactId = Array.isArray(params.contactId) ? params.contactId[0] : params.contactId;
  const contact = contactId ? getContactById(contactId) : undefined;
  const {
    baseColors: colors,
    effectiveColors: rawEffectiveColors,
    effectiveFonts,
    themedColors,
  } = useEffectiveProfileTheme(contact?.profileBg);
  const hasProfileBackgroundImage = Boolean(contact?.profileBgImagePath);
  const effectiveColors = useMemo(
    () => hasProfileBackgroundImage
      ? {
        ...rawEffectiveColors,
        ink: colors.ink,
        inkSoft: colors.ink,
        inkMuted: colors.ink,
      }
      : rawEffectiveColors,
    [colors.ink, colors.inkSoft, hasProfileBackgroundImage, rawEffectiveColors],
  );
  const blurTint = resolvedMode === 'dark' ? 'dark' : 'light';
  const tint = effectiveColors.ink;

  const [newFact, setNewFact] = useState('');
  const [factBusy, setFactBusy] = useState(false);
  const [newPersonalityTrait, setNewPersonalityTrait] = useState('');
  const [personalityTraitBusy, setPersonalityTraitBusy] = useState(false);
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
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [promptsExpanded, setPromptsExpanded] = useState(false);
  const [memoryWallViewMode, setMemoryWallViewMode] = useState<MemoryWallViewMode>('timeline');
  const [memoryFilter, setMemoryFilter] = useState<MemoryFilter>('all');
  const [viewedGlowPostIds, setViewedGlowPostIds] = useState<Set<string>>(() => new Set());
  const [viewedGlowMemoryPromptIds, setViewedGlowMemoryPromptIds] = useState<Set<string>>(() => new Set());
  const [viewedGlowMoviePromptIds, setViewedGlowMoviePromptIds] = useState<Set<string>>(() => new Set());
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
  const memoryDockBottom = Math.max(insets.bottom * 0.5, spacing.xs);
  const [memoryMenuVisible, setMemoryMenuVisible] = useState(true);
  const memoryMenuVisibleRef = useRef(true);
  const memoryMenuAnim = useRef(new Animated.Value(1)).current;

  const setMemoryMenuShown = useCallback((visible: boolean) => {
    if (memoryMenuVisibleRef.current === visible) return;
    memoryMenuVisibleRef.current = visible;
    setMemoryMenuVisible(visible);
    Animated.timing(memoryMenuAnim, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [memoryMenuAnim]);

  useEffect(() => {
    setMemoryMenuShown(activePane === 'profile' ? !isScrollChromeHidden : true);
  }, [activePane, isScrollChromeHidden, setMemoryMenuShown]);

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

  const { readIds: syntheticNotificationReadIds, markSyntheticRead } = useSyntheticNotificationReads(currentUser?.id ?? null);
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

  const styles = useMemo(
    () => makeStyles(effectiveColors, tint, effectiveFonts, hasProfileBackgroundImage),
    [effectiveColors, tint, effectiveFonts, hasProfileBackgroundImage],
  );
  const profileGradientColors = useMemo(
    () => getProfileScreenGradientColors(contact?.profileBgImagePath, themedColors),
    [contact?.profileBgImagePath, themedColors],
  );

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
  const wallMode: 'mine' | 'shared' = 'shared';
  const scrollViewRef = useRef<ScrollView | null>(null);
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
  const getIncomingDevelopStartAt = useIncomingMemoryDevelopStarts(wallPosts, currentUser?.id, wallMode === 'shared' && isLinked);
  const wallImageLoading = usePrioritizedWallImageLoading(wallPosts, true);
  const lockedGiftNotes = currentUser?.id && contact?.linkedUserId
    ? getGiftNotesForPair(currentUser.id, contact.linkedUserId).filter((note) => note.status === 'locked')
    : [];
  const moviePromptRequests = currentUser?.id && contact?.linkedUserId
    ? getMovieReviewRequestsForPair(currentUser.id, contact.linkedUserId).filter((request) => request.status === 'pending' && !isPromptExpired(request))
    : [];
  const memoryPromptRequests = currentUser?.id && contact?.linkedUserId
    ? getMemoryPromptRequestsForPair(currentUser.id, contact.linkedUserId).filter((request) => request.status === 'pending' && !isPromptExpired(request))
    : [];
  const unreadMemoryPromptIds = useMemo(() => getUnreadMemoryPromptIds(notifications), [notifications]);
  const unreadMoviePromptIds = useMemo(() => getUnreadMoviePromptIds(notifications), [notifications]);
  const unreadWallPostIds = useMemo(() => getUnreadWallPostIds(notifications), [notifications]);
  const highlightedMemoryPromptIds = useMemo(() => mergeStringSets(unreadMemoryPromptIds, viewedGlowMemoryPromptIds), [unreadMemoryPromptIds, viewedGlowMemoryPromptIds]);
  const highlightedMoviePromptIds = useMemo(() => mergeStringSets(unreadMoviePromptIds, viewedGlowMoviePromptIds), [unreadMoviePromptIds, viewedGlowMoviePromptIds]);
  const highlightedWallPostIds = useMemo(() => mergeStringSets(unreadWallPostIds, viewedGlowPostIds), [unreadWallPostIds, viewedGlowPostIds]);
  const unreadIncomingPromptCount = currentUser?.id
    ? memoryPromptRequests.filter((request) => request.recipientUserId === currentUser.id && unreadMemoryPromptIds.has(request.id)).length
      + moviePromptRequests.filter((request) => request.recipientUserId === currentUser.id && unreadMoviePromptIds.has(request.id)).length
    : 0;
  const newMemoryPromptIds = memoryPromptRequests
    .filter((request) => request.recipientUserId === currentUser?.id && highlightedMemoryPromptIds.has(request.id))
    .map((request) => request.id);
  const newMoviePromptIds = moviePromptRequests
    .filter((request) => request.recipientUserId === currentUser?.id && highlightedMoviePromptIds.has(request.id))
    .map((request) => request.id);
  const promptsToAnswerCount = currentUser?.id
    ? memoryPromptRequests.filter((request) => request.recipientUserId === currentUser.id).length
      + moviePromptRequests.filter((request) => request.recipientUserId === currentUser.id).length
    : 0;
  const newSharedMemoryCount = wallMode === 'shared'
    ? sharedWallPosts.filter((post) => highlightedWallPostIds.has(post.id)).length
    : 0;
  const wallViewIndicators = {
    timeline: newSharedMemoryCount,
    grid: newSharedMemoryCount,
    prompts: unreadIncomingPromptCount,
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

  useEffect(() => {
    if (!currentUser?.id || !contact) return undefined;

    const visibleUnreadPostIds = wallPosts
      .filter((post) => unreadWallPostIds.has(post.id))
      .map((post) => post.id);
    const shouldClearPromptNotifications = activePane === 'profile' && isLinked;
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
    const profileActorId = contact.linkedUserId ?? null;
    const profileUpdateNotificationIds = notifications
      .filter((notification) =>
        !notification.read
        && notification.type === 'contact_update'
        && (notification.referenceId === contact.id || (profileActorId ? notification.actorUserId === profileActorId : false)),
      )
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
  }, [activePane, contact, currentUser?.id, isLinked, markNotificationRead, markSyntheticRead, memoryPromptRequests, moviePromptRequests, notifications, unreadMemoryPromptIds, unreadMoviePromptIds, unreadWallPostIds, wallPosts]);

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

  async function handleAddPersonalityTrait() {
    const trait = newPersonalityTrait.trim();
    if (!trait) return;
    setPersonalityTraitBusy(true);
    try {
      await addContactPersonalityTrait(contact!.id, trait);
      setNewPersonalityTrait('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setPersonalityTraitBusy(false);
  }

  function handleDeletePersonalityTrait(trait: string) {
    Alert.alert('Delete trait?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteContactPersonalityTrait(contact!.id, trait) },
    ]);
  }

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

  function markNotificationsForMemoryPrompt(requestId: string) {
    markProfileNotificationIdsRead(
      getNotificationIdsForMemoryPrompt(notifications, requestId),
      markNotificationRead,
      markSyntheticRead,
    );
  }

  function markNotificationsForMoviePrompt(requestId: string) {
    markProfileNotificationIdsRead(
      getNotificationIdsForMoviePrompt(notifications, requestId),
      markNotificationRead,
      markSyntheticRead,
    );
  }

  function markNotificationsForWallPost(postId: string) {
    markProfileNotificationIdsRead(
      getNotificationIdsForWallPost(notifications, postId),
      markNotificationRead,
      markSyntheticRead,
    );
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

  function openMemoryComposerShortcut(kind: 'note' | 'song') {
    if (!contact) return;
    pushOnce(router, {
      pathname: '/(app)/memories/add',
      params: { subjectId: contact.id, subjectType: 'contact', kind, backTo: profileBackTo },
    });
  }

  function openMemoryNoteShortcut() {
    if (!contact) return;
    Alert.alert(`Add to ${contact.displayName}'s wall`, 'What kind of memory?', [
      { text: 'Note', onPress: () => openMemoryComposerShortcut('note') },
      { text: 'Song', onPress: () => openMemoryComposerShortcut('song') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function openGiftNoteShortcut() {
    if (!contact?.linkedUserId) return;
    if (!isPremium) {
      showGiftNotePaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
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
    markNotificationsForMoviePrompt(requestId);
    pushOnce(router, `/(app)/movies/review/${requestId}`);
  }

  function openMemoryPromptRequestShortcut() {
    if (!contact?.linkedUserId) return;
    if (!isPremium) {
      showPromptPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    pushOnce(router, {
      pathname: '/(app)/prompts/request',
      params: { subjectId: contact.id, subjectType: 'contact', backTo: profileBackTo },
    });
  }

  function openPromptTypeSheet() {
    if (!contact?.linkedUserId) return;
    Alert.alert(`Ask ${contact.displayName}`, 'What do you want them to answer?', [
      { text: 'Memory Prompt', onPress: openMemoryPromptRequestShortcut },
      { text: 'Movie Rating', onPress: openMovieRequestShortcut },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function openMemoryPromptResponse(requestId: string) {
    markNotificationsForMemoryPrompt(requestId);
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

  async function openRegularMediaCameraShortcut() {
    if (!contact) return;
    if (!isPremium) {
      showMediaMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchCameraAsync(memoryMediaPickerOptions);
    } catch {
      Alert.alert('Camera unavailable', 'The camera is not available on this device. Try this on a real phone or choose from your gallery.');
      return;
    }
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) return;
    if (asset.type === 'video' && asset.duration && asset.duration > REGULAR_VIDEO_MAX_DURATION_MS + 250) {
      Alert.alert('Video too long', 'Regular video memories can be up to 30 seconds.');
      return;
    }
    pushOnce(router, {
      pathname: '/(app)/memories/add',
      params: {
        subjectId: contact.id,
        subjectType: 'contact',
        mediaUri: asset.uri,
        mediaType: asset.type === 'video' ? 'video' : 'image',
        backTo: profileBackTo,
      },
    });
  }

  async function openRegularMediaGalleryShortcut() {
    if (!contact) return;
    if (!isPremium) {
      showMediaMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync(memoryMediaPickerOptions);
    } catch {
      Alert.alert('Gallery unavailable', 'We could not open your gallery. Try again in a moment.');
      return;
    }
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.uri) return;
    if (asset.type === 'video' && asset.duration && asset.duration > REGULAR_VIDEO_MAX_DURATION_MS + 250) {
      Alert.alert('Video too long', 'Regular video memories can be up to 30 seconds.');
      return;
    }
    pushOnce(router, {
      pathname: '/(app)/memories/add',
      params: {
        subjectId: contact.id,
        subjectType: 'contact',
        mediaUri: asset.uri,
        mediaType: asset.type === 'video' ? 'video' : 'image',
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

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync(memoryImagePickerOptions);
    } catch {
      Alert.alert('Gallery unavailable', 'We could not open your gallery. Try again in a moment.');
      return;
    }
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

  function openPolaroidShortcut() {
    if (!contact) return;
    showPhotoSourceSheet({
      galleryLocked: !isPremium,
      onCamera: openMemoryCameraShortcut,
      onGallery: openMemoryGalleryShortcut,
      title: 'Add Memory Card',
    });
  }

  function openRegularMediaShortcut() {
    if (!contact) return;
    if (!isPremium) {
      showMediaMemoryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    showPhotoSourceSheet({
      cameraLabel: 'Take Photo or Video',
      galleryLabel: 'Choose Photo or Video',
      galleryLocked: false,
      onCamera: openRegularMediaCameraShortcut,
      onGallery: openRegularMediaGalleryShortcut,
      title: 'Add Media',
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
    if (!isPremium) {
      showGalleryPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }

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
          onPress={() => navigateOnce(router, '/(app)/notifications')}
          style={styles.notificationButton}
          accessibilityRole="button"
          accessibilityLabel={notificationBadgeCount > 0 ? `Notifications, ${notificationBadgeCount} unread` : 'Notifications'}
        >
          <Ionicons name={notificationBadgeCount > 0 ? 'notifications' : 'notifications-outline'} size={20} color={colors.ink} />
          {notificationBadgeCount > 0 ? (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>{notificationBadgeCount > 9 ? '9+' : notificationBadgeCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable onPress={() => togglePin(contact.id)} style={styles.pinButton} accessibilityRole="button" accessibilityLabel={contact.pinned ? 'Unpin contact' : 'Pin contact'}>
          <Text style={styles.pinLabel}>{contact.pinned ? <Ionicons name="pin" size={20} color="#E74C3C" /> : <Ionicons name="pin-outline" size={20} color={colors.ink} />}</Text>
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
          placeholderTextColor={effectiveColors.ink}
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
                      placeholderTextColor={effectiveColors.ink}
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
                        <Ionicons name="image-outline" size={28} color={colors.ink} />
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
        <Ionicons name="person-outline" size={15} color={tint} />
        <Text style={[styles.segmentedLabel, activePane === 'profile' && styles.segmentedLabelActive]}>Profile</Text>
      </Pressable>
      <Pressable
        onPress={() => setActivePane('notes')}
        style={[styles.segmentedButton, activePane === 'notes' && styles.segmentedButtonActive]}
        accessibilityRole="button"
        accessibilityState={{ selected: activePane === 'notes' }}
      >
        <Ionicons name="document-text-outline" size={15} color={tint} />
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
                  placeholderTextColor={effectiveColors.ink}
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

  const aboutOpen = aboutExpanded || editing;
  screenContent.push(
    <View key="about" style={[styles.section, editing && styles.editableFactsSection]}>
      <Pressable
        onPress={() => setAboutExpanded((prev) => !prev)}
        disabled={editing}
        style={styles.sectionHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded: aboutOpen }}
        accessibilityLabel={aboutOpen ? 'Hide About' : 'Show About'}
      >
        <Text style={styles.sectionTitle}>About</Text>
        {!editing ? (
          <Ionicons name={aboutOpen ? 'chevron-up' : 'chevron-down'} size={20} color={effectiveColors.ink} />
        ) : null}
      </Pressable>
      {aboutOpen ? (
        <>
          <View style={styles.aboutSubgroup}>
            <View style={styles.sectionHeader}>
              <Text style={styles.aboutSubtitle}>Personality Traits</Text>
            </View>
            {contact.personalityTraits.length > 0 ? (
              <View style={styles.factList}>
                {contact.personalityTraits.map((trait) => (
                  <View key={trait} style={styles.factChip}>
                    <Text style={styles.factChipText}>{trait}</Text>
                    {editing && (
                      <Pressable onPress={() => handleDeletePersonalityTrait(trait)}>
                        <Ionicons name="close" size={14} color={effectiveColors.error} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyHint}>No personality traits added yet.</Text>
            )}
            {editing && (
              <View style={styles.factEditorBox}>
                <View style={styles.addFactRow}>
                  <TextInput
                    style={styles.addFactInput}
                    value={newPersonalityTrait}
                    onChangeText={setNewPersonalityTrait}
                    placeholder="Add a trait..."
                    placeholderTextColor={effectiveColors.ink}
                  />
                  <Pressable onPress={handleAddPersonalityTrait} disabled={personalityTraitBusy} style={styles.addFactButton}>
                    <Text style={styles.addFactButtonLabel}>{personalityTraitBusy ? '...' : '+'}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          <View style={styles.aboutSubgroup}>
            <View style={styles.sectionHeader}>
              <Text style={styles.aboutSubtitle}>Facts</Text>
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
                <View style={styles.addFactRow}>
                  <TextInput
                    style={styles.addFactInput}
                    value={newFact}
                    onChangeText={setNewFact}
                    placeholder="Add a fact…"
                    placeholderTextColor={effectiveColors.ink}
                  />
                  <Pressable onPress={handleAddFact} disabled={factBusy} style={styles.addFactButton}>
                    <Text style={styles.addFactButtonLabel}>{factBusy ? '…' : '+'}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </>
      ) : null}
    </View>,
  );

  if (isLinked) {
    const promptsOpen = promptsExpanded || promptsToAnswerCount > 0;
    screenContent.push(
      <View key="prompts" style={styles.section}>
        <Pressable
          onPress={() => setPromptsExpanded((prev) => !prev)}
          style={styles.sectionHeader}
          accessibilityRole="button"
          accessibilityState={{ expanded: promptsOpen }}
          accessibilityLabel={promptsToAnswerCount > 0 ? `Prompts, ${promptsToAnswerCount} to answer` : promptsOpen ? 'Hide Prompts' : 'Show Prompts'}
        >
          <View style={styles.promptsHeaderLeft}>
            <Text style={styles.sectionTitle}>Prompts</Text>
            {promptsToAnswerCount > 0 ? (
              <View style={styles.promptsAnswerBadge}>
                <Text style={styles.promptsAnswerBadgeText}>{promptsToAnswerCount} to answer</Text>
              </View>
            ) : null}
          </View>
          <Ionicons name={promptsOpen ? 'chevron-up' : 'chevron-down'} size={20} color={effectiveColors.ink} />
        </Pressable>
        {promptsOpen ? (
          <MemoryPromptRequestList
            currentUserId={currentUser.id}
            friendName={contact.displayName}
            memoryPrompts={memoryPromptRequests}
            moviePrompts={moviePromptRequests}
            newMemoryPromptIds={newMemoryPromptIds}
            newMoviePromptIds={newMoviePromptIds}
            onAnswerMemoryPrompt={openMemoryPromptResponse}
            onCancelMemoryPrompt={(requestId) => cancelMemoryPromptRequest(requestId, currentUser.id)}
            onCreateMemoryPrompt={openMemoryPromptRequestShortcut}
            onAnswerMoviePrompt={openMovieReviewResponse}
            onCancelMoviePrompt={(requestId) => cancelMovieReviewRequest(requestId, currentUser.id)}
            onCreateMoviePrompt={openMovieRequestShortcut}
            themeColors={effectiveColors}
            tint={tint}
          />
        ) : null}
      </View>,
    );
  }

  screenContent.push(
    <View key="memory-wall-heading" style={[styles.section, styles.memoryWallControlCard]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.memoryWallTitle}>Shared Memory Wall</Text>
      </View>
      <MemoryWallViewToggle
        colors={effectiveColors}
        fonts={effectiveFonts}
        indicators={wallViewIndicators}
        onChange={setMemoryWallViewMode}
        options={memoryWallViewOptionsNoPrompts}
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
            onPress={isLinked ? openPromptTypeSheet : openMemoryNoteShortcut}
            style={styles.memoryPromptButton}
            accessibilityRole="button"
            accessibilityLabel={`Start a memory prompt for ${contact.displayName}`}
          >
            <Ionicons name="sparkles-outline" size={14} color={tint} />
            <Text style={styles.memoryPromptButtonText}>Start with a prompt</Text>
          </Pressable>
        }
        emptyHint={wallMode === 'shared' && isLinked
          ? `No shared memories between you and ${contact.displayName} yet.`
          : 'No memories yet. Be the first to write one.'}
        getGridExtraHeight={(post) => getReplyGridExtraHeight(getRepliesForWallPost(post.id))}
        themeColors={effectiveColors}
        viewMode={memoryWallViewMode}
        renderPost={(post, context) => {
          const author = getUserById(post.authorUserId);
          const canEditPost = canEditWallPostContent(post, currentUser.id);
          const canOpenPostEditor = canEditPost || canDeleteWallPost(post, currentUser.id);
          const promptAuthorName = post.memoryPromptRequestId || post.promptVoice || post.promptText
            ? (post.subjectUserId ? getUserById(post.subjectUserId)?.displayName : null) ?? contact.displayName
            : undefined;
          const referencedPost = post.referencedWallPostId ? getWallPostById(post.referencedWallPostId) ?? null : null;
          const replies = getRepliesForWallPost(post.id);
          const isNewWallPost = highlightedWallPostIds.has(post.id);
          const replyItems = replies.map((reply) => ({
            id: reply.id,
            body: reply.body,
            voice: reply.voice,
            authorName: getUserById(reply.authorUserId)?.displayName ?? 'Someone',
          }));
          return (
            <View
              key={post.id}
              style={[styles.wallPostWithProfileAction, isNewWallPost && styles.glowRow]}
            >
              <WallPostCard
                authorName={author?.displayName ?? 'Unknown'}
                post={post}
                cardColor={post.cardColor}
                developStartAt={getIncomingDevelopStartAt(post)}
                themeColors={effectiveColors}
                imageLoadEnabled={wallImageLoading.isImageLoadEnabled(post)}
                displayMode={context?.viewMode}
                referencedPost={referencedPost}
                referencedPostAuthorName={referencedPost ? getUserById(referencedPost.authorUserId)?.displayName ?? 'Someone' : undefined}
                promptAuthorName={promptAuthorName}
                editing={editing}
                shareable={!editing}
                onPress={editing && canOpenPostEditor ? () => pushOnce(router, { pathname: '/(app)/memories/edit', params: { postId: post.id } }) : undefined}
                onLongPress={!editing ? () => handleMemoryLongPress(post) : undefined}
                onDeveloped={getIncomingDevelopStartAt(post) ? () => {
                  notifyMemoryAuthorRecipientDeveloped({
                    post,
                    recipientName: currentUser.displayName,
                    recipientUserId: currentUser.id,
                  }).catch((error) => console.warn('[notification] recipient developed memory insert failed:', error));
                } : undefined}
                onImageReady={wallImageLoading.markImageReady}
                onSaveBackText={canEditPost ? handleSaveBackText : undefined}
              />
              {isNewWallPost ? (
                <View style={styles.newMemoryPill}>
                  <Text style={styles.newMemoryPillText}>New</Text>
                </View>
              ) : null}
              {!editing ? (
                <MemoryReplyThreadPreview
                  replies={replyItems}
                  onOpenThread={() => {
                    markNotificationsForWallPost(post.id);
                    pushOnce(router, `/(app)/memories/replies/${post.id}`);
                  }}
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
                    <Ionicons name="document-text-outline" size={18} color={active ? tint : colors.ink} />
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
      { translateY: memoryMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
    ],
  };

  return (
    <View style={styles.screenShell}>
      <ProfileBackgroundBackdrop colors={effectiveColors} imageUri={contact.profileBgImagePath} tintColors={themedColors} />
      <AppScreen
        header={showingFullScreenNote ? noteTopBar : topBar}
        floatingHeaderOnScroll={!showingFullScreenNote}
        contentContainerStyle={showingFullScreenNote ? styles.noteScreenContent : memoryControlsScreenStyle}
        gradientColors={profileGradientColors}
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
              <BlurView intensity={58} tint={blurTint} style={[StyleSheet.absoluteFill, styles.memoryFloatingDockBlur]} pointerEvents="none" />
              <View pointerEvents="none" style={styles.memoryFloatingDockGlassTint} />
              <View pointerEvents="none" style={styles.memoryFloatingDockHighlight} />
              <View pointerEvents="none" style={styles.memoryFloatingDockGlow} />
              <Pressable
                onPress={openMemoryNoteShortcut}
                style={[styles.memoryFloatingButton, styles.memoryFloatingSecondaryButton]}
                accessibilityRole="button"
                accessibilityLabel={`Add note about ${contact.displayName}`}
              >
                <Ionicons name="create-outline" size={24} color={effectiveColors.ink} />
              </Pressable>
              {contact.linkedUserId ? (
                <Pressable
                  onPress={openPromptTypeSheet}
                  style={[styles.memoryFloatingButton, styles.memoryFloatingSecondaryButton]}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask ${contact.displayName} for a prompt or rating`}
                >
                  <Ionicons name="sparkles-outline" size={24} color={effectiveColors.ink} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={openPolaroidShortcut}
                style={[styles.memoryFloatingButton, styles.memoryFloatingPrimaryButton]}
                accessibilityRole="button"
                accessibilityLabel={`Add Memory Card about ${contact.displayName}`}
              >
                <PolaroidIcon size={23} color={effectiveColors.white} />
              </Pressable>
              {contact.linkedUserId ? (
                <Pressable
                  onPress={openGiftNoteShortcut}
                  style={[styles.memoryFloatingButton, styles.memoryFloatingSecondaryButton]}
                  accessibilityRole="button"
                  accessibilityLabel={`Add gift note for ${contact.displayName}`}
                >
                  <Ionicons name="gift-outline" size={22} color={effectiveColors.ink} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={openRegularMediaShortcut}
                style={[styles.memoryFloatingButton, styles.memoryFloatingSecondaryButton]}
                accessibilityRole="button"
                accessibilityLabel={`Add photo or video about ${contact.displayName}`}
              >
                <Ionicons name="camera-outline" size={25} color={effectiveColors.ink} />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

function withAlpha(color: string, alpha: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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

const makeStyles = (colors: ColorTokens, tint: string, fonts: FontSet, hasBackgroundImage = false) => {
  const altTint = colors.ink;
  const tertiaryTint = colors.inkSoft;
  const backgroundTextColor = colors.ink;
  const backgroundMutedTextColor = colors.inkSoft;
  const backgroundTextShadow = hasBackgroundImage
    ? {
      textShadowColor: 'rgba(255,255,255,0.7)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
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
    backButton: {
      alignSelf: 'flex-start',
      flexShrink: 0,
      minHeight: 40,
      borderRadius: 999,
      borderWidth: 0,
      backgroundColor: withAlpha(colors.paper, 0.18),
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      justifyContent: 'center',
    },
    backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    topBar: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    topBarRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 1,
      minWidth: 0,
      borderRadius: radius.pill,
      backgroundColor: withAlpha(colors.paper, 0.16),
      padding: 3,
    },
    topBarFriendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: 148,
      borderRadius: radius.pill,
      borderWidth: 0,
      backgroundColor: 'transparent',
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
      width: 36,
      height: 36,
      flexShrink: 0,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
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
    pinButton: {
      width: 36,
      height: 36,
      flexShrink: 0,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
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
      minHeight: 36,
      flexShrink: 0,
      justifyContent: 'center',
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    editButtonActive: { backgroundColor: colors.accent },
    editButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent },
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
    profileScreenWithMemoryMenu: { paddingBottom: 230 },
    section: {
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: hasBackgroundImage ? withAlpha(colors.line, 0.42) : 'transparent',
      backgroundColor: hasBackgroundImage ? withAlpha(colors.paper, 0.7) : 'transparent',
      padding: hasBackgroundImage ? spacing.md : 0,
    },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: {
      fontFamily: fonts.heading,
      fontSize: 22,
      lineHeight: 30,
      color: backgroundTextColor,
      paddingRight: 10,
      overflow: 'visible' as const,
      ...backgroundTextShadow,
      ...protectTextFromFontClipping(fonts.heading, 22),
    },
    promptsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1, minWidth: 0 },
    promptsAnswerBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      backgroundColor: colors.accent,
    },
    promptsAnswerBadgeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.white },
    aboutSubgroup: { gap: spacing.sm },
    aboutSubtitle: {
      fontFamily: fonts.heading,
      fontSize: 22,
      lineHeight: 30,
      color: backgroundTextColor,
      paddingRight: 10,
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
    memoryWallControlCard: {
      gap: spacing.md,
      borderColor: withAlpha(colors.line, 0.58),
      backgroundColor: withAlpha(colors.paper, hasBackgroundImage ? 0.78 : 0.56),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: hasBackgroundImage ? 0.16 : 0.08,
      shadowRadius: 18,
      elevation: 4,
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
      borderColor: withAlpha(colors.white, 0.18),
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
      gap: spacing.sm,
      alignSelf: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: withAlpha(colors.white, 0.28),
      backgroundColor: withAlpha(colors.paper, 0.34),
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.2,
      shadowRadius: 28,
      elevation: 12,
    },
    memoryFloatingDockBlur: {
      borderRadius: radius.pill,
    },
    memoryFloatingDockGlassTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: withAlpha(colors.paper, 0.16),
    },
    memoryFloatingDockHighlight: {
      position: 'absolute',
      top: 1,
      left: 18,
      right: 18,
      height: StyleSheet.hairlineWidth,
      backgroundColor: withAlpha(colors.white, 0.72),
    },
    memoryFloatingDockGlow: {
      position: 'absolute',
      top: -28,
      left: '34%',
      width: 108,
      height: 108,
      borderRadius: 54,
      backgroundColor: withAlpha(colors.accentAlt ?? colors.accent, 0.2),
    },
    memoryFloatingButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: withAlpha(colors.white, 0.3),
      backgroundColor: withAlpha(colors.paper, 0.5),
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 4,
    },
    memoryFloatingSecondaryButton: {},
    memoryFloatingPrimaryButton: {
      borderColor: colors.accent,
      backgroundColor: colors.accent,
      width: 58,
      height: 58,
      borderRadius: 29,
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 8,
    },
    segmentedControl: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: spacing.xs,
      padding: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.7),
      backgroundColor: withAlpha(colors.paper, 0.7),
    },
    segmentedButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
    },
    segmentedButtonActive: {
      backgroundColor: withAlpha(colors.paper, 0.78),
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.42),
    },
    segmentedLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: altTint },
    segmentedLabelActive: { color: altTint },
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
    noteRowActive: { borderColor: withAlpha(colors.line, 0.5), backgroundColor: colors.paper },
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
    noteRowMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.ink },
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
      color: altTint,
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
      borderColor: withAlpha(colors.line, 0.42),
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.paper,
    },
    noteInlinePhotoLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: altTint },
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
      color: altTint,
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
      backgroundColor: altTint,
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
    noteAddPhotoLabel: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: altTint },
    noteActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    noteSaveButton: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: tint },
    noteSaveLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
    noteDeleteButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    noteDeleteLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
    editableFactsSection: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.4),
      backgroundColor: withAlpha(colors.paper, 0.78),
      padding: spacing.md,
    },
    factList: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
    factChip: {
      flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: withAlpha(colors.paper, hasBackgroundImage ? 0.54 : 0.9),
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.42),
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    factChipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
    deleteLink: { fontFamily: fonts.heading, fontSize: 20, color: colors.error, paddingLeft: spacing.sm, ...protectTextFromFontClipping(fonts.heading, 20) },
    emptyHint: { fontFamily: fonts.body, fontSize: 14, color: backgroundMutedTextColor, ...backgroundTextShadow },
    memoryFilterRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', paddingBottom: spacing.xs },
    memoryFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: withAlpha(colors.paper, 0.68),
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.72),
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    memoryFilterChipActive: { backgroundColor: withAlpha(altTint, 0.14), borderColor: withAlpha(colors.line, 0.42) },
    memoryFilterText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
    memoryFilterTextActive: { color: altTint },
    memoryPromptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.42),
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    memoryPromptButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: tertiaryTint },
    lockedGiftBlock: { gap: spacing.sm },
    factEditorBox: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: withAlpha(colors.line, 0.42),
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
    monthWallPostsBlock: { marginTop: -spacing.xs },
    wallPostWithProfileAction: { alignItems: 'center', gap: spacing.xs },
    newMemoryPill: {
      alignSelf: 'center',
      borderRadius: radius.pill,
      backgroundColor: tint,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      marginTop: -spacing.xs,
    },
    newMemoryPillText: { fontFamily: fonts.bodyBold, fontSize: 11, color: baseColors.success, textTransform: 'uppercase' },
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
    wallModeChipActive: { backgroundColor: altTint + '1A' },
    wallModeLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
    wallModeLabelActive: { color: altTint },
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
      borderColor: withAlpha(colors.line, 0.46),
      backgroundColor: colors.paper,
      padding: spacing.md,
    },
    editHeroHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.42),
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    editHeroHintText: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: tertiaryTint,
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

    heroSubtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: backgroundMutedTextColor, ...backgroundTextShadow },
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
      backgroundColor: altTint + '16',
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.4),
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginTop: spacing.xs,
    },
    manageConnectionLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: altTint },
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
      borderColor: withAlpha(colors.line, 0.42),
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    relationshipTagText: { fontFamily: fonts.bodyBold, fontSize: 12, color: tertiaryTint },
    wallButton: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.pill,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.42),
    },
    wallButtonRow: { flexDirection: 'row', alignItems: 'center' },
    wallButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: altTint },
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
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.42),
      backgroundColor: colors.paper,
    },
    connectCtaLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
    connectCtaAction: { fontFamily: fonts.bodyBold, fontSize: 14, color: altTint, letterSpacing: 0.2 },
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
      borderColor: withAlpha(colors.line, 0.42),
      backgroundColor: colors.paper,
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
      borderColor: withAlpha(colors.line, 0.42),
      backgroundColor: colors.paper,
    },
    scanButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: altTint },
    orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    orLine: { flex: 1, height: 1, backgroundColor: colors.line },
    orText: { fontFamily: fonts.body, fontSize: 12, color: colors.ink, letterSpacing: 0.3 },
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
};
