import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

import { useAuth } from '../auth/AuthContext';
import { usePremium } from '../premium/PremiumContext';
import { extractFriendCode } from '../../lib/friendCode';
import {
  uploadContactAvatar,
  uploadContactProfileBackground,
  uploadContactProfileVideo,
  uploadMemoryAudio,
  uploadMemoryImageVariants,
} from '../../lib/memoryMediaUpload';
import { createNotification, createNotifications, subscribeNotificationInserts } from '../../lib/notifications';
import { supabase } from '../../lib/supabase';
import { compareWallPostsByMemoryDateDesc } from '../../lib/memoryDate';
import { resyncFriendNotificationReminders } from '../../lib/friendNotificationReminders';
import { getPromptExpiresAt, isPromptExpired } from '../../lib/promptExpiration';
import { syncProfileBirthdayCalendarEvent } from '../calendar/queries';
import { canDeleteWallPost, canEditWallPostContent } from '../../lib/wallPostPermissions';
import { encodeWallPostTextStyle } from '../../lib/wallPostTextStyle';
import { useSyntheticNotificationReads } from '../../hooks/useSyntheticNotificationReads';
import {
  AppUser,
  CalendarEventReaction,
  CalendarEventReactionSummary,
  CalendarEventReactionValue,
  Contact,
  ContactPrivateNote,
  ContactPrivateNoteBlock,
  CompleteMemoryPromptRequestInput,
  CreateContactPrivateNoteBlockInput,
  CreateContactPrivateNoteInput,
  CreateContactInput,
  CreateFriendFactInput,
  CreateGiftNoteInput,
  CreateOfficialBroadcastInput,
  CreateMemoryPromptRequestInput,
  CreateSavedMemoryPromptInput,
  CompleteMovieReviewRequestInput,
  CreateMovieReviewRequestInput,
  UpdateContactPrivateNoteBlockInput,
  UpdateContactPrivateNoteInput,
  CreateWallPostInput,
  FriendFact,
  FriendRequest,
  Friendship,
  GiftNote,
  MemoryReply,
  MemoryPromptRequest,
  MovieReviewRequest,
  Notification,
  OfficialBroadcastResult,
  PeopleListItem,
  ProfileWallItem,
  SavedMemoryPrompt,
  SaveWallPostLayoutInput,
  SongAttachment,
  VoiceAttachment,
  WallPost,
  WallPostLayout,
  WallPostLayoutContext,
  WallPostVisibility,
} from '../../types/domain';
import { rowToContact, rowToFriendship, rowToUser, rowToWallPost, rowToFriendFact, rowToFriendRequest, rowToMemoryReply, rowToProfileWallItem } from './mappers';
import { enqueuePrivateNoteOp, newPrivateNoteId, replayPrivateNoteOps } from './privateNoteQueue';
import { buildPeopleListForUser } from './selectors';
import { cancelGiftNote, createGiftNote, fetchGiftNotes, giftQueryKeys, revealDueGiftNotes } from '../gifts/queries';
import {
  cancelMovieReviewRequest,
  completeMovieReviewRequest,
  createMovieReviewRequest,
  fetchMovieReviewRequests,
  movieQueryKeys,
} from '../movies/queries';
import {
  cancelMemoryPromptRequest,
  completeMemoryPromptRequest,
  createMemoryPromptRequest,
  createSavedMemoryPrompt,
  deleteSavedMemoryPrompt,
  fetchMemoryPromptRequests,
  fetchSavedMemoryPrompts,
  memoryPromptQueryKeys,
} from '../memoryPromptRequests/queries';
import {
  socialQueryKeys,
  fetchUsers,
  fetchContacts,
  fetchFriendships,
  fetchFriendRequests,
  fetchWallPosts,
  fetchMemoryReplies,
  fetchProfileWallItems,
  fetchWallPostLayouts,
  fetchPrivateNotes,
  fetchPrivateNoteBlocks,
  fetchFriendFacts,
  fetchCalendarEventReactions,
  fetchNotifications,
  upsertCalendarEventReaction,
  deleteCalendarEventReaction,
  upsertWallPostLayout,
  deleteWallPostLayout,
} from './queries';
import { createPendingMemoryEdit, type PendingMemoryEditUpdates } from '../memories/pendingMemoryEditQueue';
import { applyPendingMemoryEditsToCache, syncPendingMemoryEditToCache } from '../memories/pendingMemoryEditSync';

// Re-export so existing imports keep working.
export { socialQueryKeys } from './queries';

// Describe an unresolved friendship that is awaiting the user's choice between
// linking an existing manual contact or creating a new linked contact.
export interface PendingFriendLink {
  friend: AppUser;
  candidates: Contact[];
}

const LIVE_SOCIAL_REFRESH_MS = 5000;

interface SocialGraphContextValue {
  loading: boolean;
  contacts: Contact[];
  friendRequests: FriendRequest[];
  wallPosts: WallPost[];
  memoryReplies: MemoryReply[];
  profileWallItems: ProfileWallItem[];
  wallPostLayouts: WallPostLayout[];
  privateNotes: ContactPrivateNote[];
  privateNoteBlocks: ContactPrivateNoteBlock[];
  giftNotes: GiftNote[];
  movieReviewRequests: MovieReviewRequest[];
  memoryPromptRequests: MemoryPromptRequest[];
  savedMemoryPrompts: SavedMemoryPrompt[];
  addFriendByCode: (currentUserId: string, friendCode: string) => Promise<
    | { ok: true; friend: AppUser; contactId: string | null; candidateContactIds: string[]; requested?: boolean; requestId?: string; alreadyFriends?: boolean }
    | { ok: false; error: string }
  >;
  getIncomingFriendRequests: (currentUserId: string) => FriendRequest[];
  getOutgoingFriendRequests: (currentUserId: string) => FriendRequest[];
  acceptFriendRequest: (requestId: string, currentUserId: string) => Promise<
    | { ok: true; friend: AppUser; contactId: string | null; candidateContactIds: string[] }
    | { ok: false; error: string }
  >;
  declineFriendRequest: (requestId: string, currentUserId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  linkContactToFriend: (contactId: string, currentUserId: string, friendUserId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  createLinkedContactForFriend: (currentUserId: string, friendUserId: string) => Promise<{ ok: true; contactId: string } | { ok: false; error: string }>;
  getManualContactCandidatesForFriend: (currentUserId: string, friendUserId: string) => Contact[];
  getPendingFriendLinks: (currentUserId: string) => PendingFriendLink[];
  repairObviousFriendLinks: (currentUserId: string) => Promise<{ repaired: number; skipped: number }>;
  unlinkContactFromFriend: (contactId: string, currentUserId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  moveContactLink: (sourceContactId: string, targetContactId: string, currentUserId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeFriend: (currentUserId: string, friendUserId: string) => Promise<void>;
  deleteContact: (currentUserId: string, contactId: string) => Promise<void>;
  addManualContact: (ownerUserId: string, input: CreateContactInput) => Promise<Contact>;
  addWallPost: (authorUserId: string, input: CreateWallPostInput) => Promise<WallPost>;
  createOfficialBroadcast: (input: CreateOfficialBroadcastInput) => Promise<OfficialBroadcastResult>;
  createGiftNote: (authorUserId: string, input: CreateGiftNoteInput) => Promise<GiftNote>;
  cancelGiftNote: (noteId: string, authorUserId: string) => Promise<void>;
  getGiftNotesForPair: (leftUserId: string, rightUserId: string) => GiftNote[];
  createMovieReviewRequest: (requesterUserId: string, input: CreateMovieReviewRequestInput) => Promise<MovieReviewRequest>;
  cancelMovieReviewRequest: (requestId: string, requesterUserId: string) => Promise<void>;
  completeMovieReviewRequest: (reviewerUserId: string, input: CompleteMovieReviewRequestInput) => Promise<void>;
  getMovieReviewRequestsForPair: (leftUserId: string, rightUserId: string) => MovieReviewRequest[];
  getMovieReviewRequestById: (requestId: string) => MovieReviewRequest | undefined;
  createMemoryPromptRequest: (requesterUserId: string, input: CreateMemoryPromptRequestInput) => Promise<MemoryPromptRequest>;
  cancelMemoryPromptRequest: (requestId: string, requesterUserId: string) => Promise<void>;
  completeMemoryPromptRequest: (reviewerUserId: string, input: CompleteMemoryPromptRequestInput) => Promise<void>;
  getMemoryPromptRequestsForPair: (leftUserId: string, rightUserId: string) => MemoryPromptRequest[];
  getMemoryPromptRequestById: (requestId: string) => MemoryPromptRequest | undefined;
  createSavedMemoryPrompt: (ownerUserId: string, input: CreateSavedMemoryPromptInput) => Promise<SavedMemoryPrompt>;
  deleteSavedMemoryPrompt: (promptId: string, ownerUserId: string) => Promise<void>;
  getPrivateNotesForContact: (contactId: string) => ContactPrivateNote[];
  getPrivateNoteById: (noteId: string) => ContactPrivateNote | undefined;
  getPrivateNoteBlocks: (noteId: string) => ContactPrivateNoteBlock[];
  createPrivateNote: (ownerUserId: string, contactId: string, input?: CreateContactPrivateNoteInput) => Promise<ContactPrivateNote>;
  updatePrivateNote: (noteId: string, updates: UpdateContactPrivateNoteInput) => Promise<void>;
  deletePrivateNote: (noteId: string) => Promise<void>;
  addPrivateNoteBlock: (noteId: string, input: CreateContactPrivateNoteBlockInput) => Promise<ContactPrivateNoteBlock>;
  updatePrivateNoteBlock: (blockId: string, updates: UpdateContactPrivateNoteBlockInput) => Promise<void>;
  deletePrivateNoteBlock: (blockId: string) => Promise<void>;
  getContactById: (contactId: string) => Contact | undefined;
  getDirectFriends: (userId: string) => AppUser[];
  getPeopleListForUser: (userId: string) => PeopleListItem[];
  getUserById: (userId: string) => AppUser | undefined;
  getWallPostsForSubject: (subjectId: string, subjectType: 'user' | 'contact') => WallPost[];
  getWallPostById: (postId: string) => WallPost | undefined;
  getRepliesForWallPost: (postId: string) => MemoryReply[];
  getReplyCountForWallPost: (postId: string) => number;
  addMemoryReply: (wallPostId: string, authorUserId: string, body: string, voice?: VoiceAttachment | null) => Promise<MemoryReply>;
  deleteMemoryReply: (replyId: string, authorUserId: string) => Promise<void>;
  getProfileWallItemsForUser: (userId: string) => ProfileWallItem[];
  getWallPostLayoutsForContext: (ownerUserId: string, wallContext: WallPostLayoutContext, wallContextId: string) => WallPostLayout[];
  saveWallPostLayout: (input: SaveWallPostLayoutInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  resetWallPostLayout: (ownerUserId: string, wallContext: WallPostLayoutContext, wallContextId: string, wallPostId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  isPostOnProfileWall: (ownerUserId: string, wallPostId: string) => boolean;
  addPostToProfileWall: (ownerUserId: string, wallPostId: string, options?: { repliesHidden?: boolean }) => Promise<{ ok: true } | { ok: false; error: string }>;
  removePostFromProfileWall: (ownerUserId: string, wallPostId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  setProfileWallRepliesHidden: (ownerUserId: string, wallPostId: string, repliesHidden: boolean) => Promise<{ ok: true } | { ok: false; error: string }>;
  getVisiblePostsByAuthor: (authorId: string) => WallPost[];
  getContactAboutMe: (ownerUserId: string, myUserId: string) => Contact | undefined;
  isConnected: (leftUserId: string, rightUserId: string) => boolean;
  addFriendFact: (authorUserId: string, input: CreateFriendFactInput) => Promise<FriendFact>;
  deleteFriendFact: (factId: string) => Promise<void>;
  getFriendFactsFor: (authorUserId: string, subjectUserId: string) => FriendFact[];
  deleteWallPost: (postId: string) => Promise<void>;
  updateWallPost: (postId: string, body: string, newLocalImageUri?: string | null, cardColor?: string | null, backText?: string | null, filter?: string | null, visibility?: WallPostVisibility, song?: SongAttachment | null, videoMuted?: boolean, locationName?: string | null, voice?: VoiceAttachment | null, memoryDate?: string | null) => Promise<void>;
  updateContact: (contactId: string, updates: {
    displayName?: string;
    avatarLocalUri?: string | null;
    // Point the card photo at an already-stored image URL (e.g. the linked
    // friend's account avatar) without re-uploading.
    avatarRemoteUrl?: string | null;
    avatarVideoLocalUri?: string | null;
    avatarVideoMuted?: boolean;
    tags?: string[];
    note?: string | null;
    cardColor?: string | null;
    backText?: string | null;
    profileBg?: string | null;
    profileBgImageLocalUri?: string | null;
    linkedUserId?: string | null;
    pinned?: boolean;
    pinnedAt?: string | null;
  }) => Promise<void>;
  addContactFact: (contactId: string, fact: string) => Promise<void>;
  deleteContactFact: (contactId: string, fact: string) => Promise<void>;
  addContactPersonalityTrait: (contactId: string, trait: string) => Promise<void>;
  deleteContactPersonalityTrait: (contactId: string, trait: string) => Promise<void>;
  migrateContactPostsToUser: (contactId: string, userId: string) => Promise<void>;
  linkContactByFriendCode: (contactId: string, currentUserId: string, friendCode: string) => Promise<{ ok: true; friend: AppUser; requested?: boolean } | { ok: false; error: string }>;
  togglePin: (contactId: string) => Promise<void>;
  notifications: Notification[];
  unreadCount: number;
  calendarEventReactions: CalendarEventReaction[];
  getCalendarEventReactionSummary: (eventId: string) => CalendarEventReactionSummary;
  getCalendarEventReactionParticipantNames: (eventId: string) => { up: string[]; down: string[] };
  setCalendarEventReactionByEvent: (
    eventId: string,
    value: CalendarEventReactionValue | null,
    options?: {
      notificationId?: string | null;
      eventOwnerUserId?: string | null;
      eventDate?: string | null;
      eventTitle?: string | null;
    },
  ) => Promise<void>;
  setCalendarEventReaction: (
    notification: Notification,
    value: CalendarEventReactionValue | null,
  ) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SocialGraphContext = createContext<SocialGraphContextValue | null>(null);

export function SocialGraphProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const { isPremium } = usePremium();
  const socialEnabled = Boolean(currentUser?.id);
  const birthdaySyncSignatureRef = useRef<string | null>(null);
  const giftRevealSignatureRef = useRef<string | null>(null);
  const didAutoRepairFriendLinksRef = useRef(false);

  // ── Queries ──────────────────────────────────────────────────────────
  const usersQuery = useQuery({ queryKey: socialQueryKeys.users, queryFn: fetchUsers, enabled: socialEnabled });
  const contactsQuery = useQuery({ queryKey: socialQueryKeys.contacts, queryFn: fetchContacts, enabled: socialEnabled });
  const friendshipsQuery = useQuery({
    queryKey: socialQueryKeys.friendships,
    queryFn: fetchFriendships,
    enabled: socialEnabled,
    refetchInterval: socialEnabled ? LIVE_SOCIAL_REFRESH_MS : false,
  });
  const friendRequestsQuery = useQuery({
    queryKey: socialQueryKeys.friendRequests,
    queryFn: fetchFriendRequests,
    enabled: socialEnabled,
    refetchInterval: socialEnabled ? LIVE_SOCIAL_REFRESH_MS : false,
  });
  const wallPostsQuery = useQuery({ queryKey: socialQueryKeys.wallPosts, queryFn: fetchWallPosts, enabled: socialEnabled });
  const memoryRepliesQuery = useQuery({ queryKey: socialQueryKeys.memoryReplies, queryFn: fetchMemoryReplies, enabled: socialEnabled });
  const profileWallItemsQuery = useQuery({ queryKey: socialQueryKeys.profileWallItems, queryFn: fetchProfileWallItems, enabled: socialEnabled });
  const wallPostLayoutsQuery = useQuery({ queryKey: socialQueryKeys.wallPostLayouts, queryFn: fetchWallPostLayouts, enabled: socialEnabled });
  const privateNotesQuery = useQuery({ queryKey: socialQueryKeys.privateNotes, queryFn: fetchPrivateNotes, enabled: socialEnabled });
  const privateNoteBlocksQuery = useQuery({ queryKey: socialQueryKeys.privateNoteBlocks, queryFn: fetchPrivateNoteBlocks, enabled: socialEnabled });
  const giftNotesQuery = useQuery({
    queryKey: giftQueryKeys.notes(currentUser?.id ?? 'anonymous'),
    queryFn: () => fetchGiftNotes(currentUser!.id),
    enabled: Boolean(currentUser?.id),
    refetchInterval: socialEnabled ? LIVE_SOCIAL_REFRESH_MS : false,
  });
  const movieReviewRequestsQuery = useQuery({
    queryKey: movieQueryKeys.requests,
    queryFn: fetchMovieReviewRequests,
    enabled: socialEnabled,
    refetchInterval: socialEnabled ? LIVE_SOCIAL_REFRESH_MS : false,
  });
  const memoryPromptRequestsQuery = useQuery({
    queryKey: memoryPromptQueryKeys.requests,
    queryFn: fetchMemoryPromptRequests,
    enabled: socialEnabled,
    refetchInterval: socialEnabled ? LIVE_SOCIAL_REFRESH_MS : false,
  });
  const savedMemoryPromptsQuery = useQuery({
    queryKey: memoryPromptQueryKeys.savedPrompts(currentUser?.id ?? 'anonymous'),
    queryFn: () => fetchSavedMemoryPrompts(currentUser!.id),
    enabled: Boolean(currentUser?.id),
  });
  const friendFactsQuery = useQuery({ queryKey: socialQueryKeys.friendFacts, queryFn: fetchFriendFacts, enabled: socialEnabled });
  const notificationsQuery = useQuery({
    queryKey: socialQueryKeys.notifications,
    queryFn: fetchNotifications,
    enabled: socialEnabled,
    refetchInterval: socialEnabled ? LIVE_SOCIAL_REFRESH_MS : false,
  });
  const calendarEventReactionsQuery = useQuery({
    queryKey: socialQueryKeys.calendarEventReactions,
    queryFn: fetchCalendarEventReactions,
    enabled: socialEnabled,
  });

  const users = usersQuery.data ?? [];
  const contacts = contactsQuery.data ?? [];
  const friendships = friendshipsQuery.data ?? [];
  const friendRequests = friendRequestsQuery.data ?? [];
  const wallPosts = wallPostsQuery.data ?? [];
  const memoryReplies = memoryRepliesQuery.data ?? [];
  const profileWallItems = profileWallItemsQuery.data ?? [];
  const wallPostLayouts = wallPostLayoutsQuery.data ?? [];
  const privateNotes = privateNotesQuery.data ?? [];
  const privateNoteBlocks = privateNoteBlocksQuery.data ?? [];
  const giftNotes = giftNotesQuery.data ?? [];
  const movieReviewRequests = movieReviewRequestsQuery.data ?? [];
  const memoryPromptRequests = memoryPromptRequestsQuery.data ?? [];
  const savedMemoryPrompts = savedMemoryPromptsQuery.data ?? [];
  const friendFacts = friendFactsQuery.data ?? [];
  const persistedNotifications = notificationsQuery.data ?? [];
  const { readIds: syntheticNotificationReadIds } = useSyntheticNotificationReads(currentUser?.id ?? null);
  const notifications = useMemo(
    () => mergeSyntheticNotifications(persistedNotifications, friendRequests, wallPosts, movieReviewRequests, memoryPromptRequests, users, currentUser?.id ?? null, syntheticNotificationReadIds),
    [persistedNotifications, friendRequests, wallPosts, movieReviewRequests, memoryPromptRequests, users, currentUser?.id, syntheticNotificationReadIds],
  );
  const calendarEventReactions = calendarEventReactionsQuery.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const loading = usersQuery.isPending || contactsQuery.isPending || friendshipsQuery.isPending || friendRequestsQuery.isPending;
  const hasSettledInitialData = socialEnabled
    && usersQuery.isFetched
    && contactsQuery.isFetched
    && friendshipsQuery.isFetched
    && friendRequestsQuery.isFetched
    && wallPostsQuery.isFetched
    && memoryRepliesQuery.isFetched
    && profileWallItemsQuery.isFetched
    && wallPostLayoutsQuery.isFetched
    && privateNotesQuery.isFetched
    && privateNoteBlocksQuery.isFetched
    && giftNotesQuery.isFetched
    && movieReviewRequestsQuery.isFetched
    && memoryPromptRequestsQuery.isFetched
    && savedMemoryPromptsQuery.isFetched
    && friendFactsQuery.isFetched
    && notificationsQuery.isFetched
    && calendarEventReactionsQuery.isFetched;
  const friendReminderSignature = useMemo(() => {
    if (!currentUser?.id) return '';
    const incomingPolaroids = wallPosts
      .filter((post) => post.postType === 'polaroid' && post.imageUri && post.authorUserId !== currentUser.id && post.subjectUserId === currentUser.id)
      .map((post) => `${post.id}:${post.createdAt}`)
      .sort();
    const pendingMemoryPrompts = memoryPromptRequests
      .filter((request) => request.recipientUserId === currentUser.id && request.status === 'pending')
      .map((request) => `${request.id}:${request.createdAt}`)
      .sort();
    const pendingMoviePrompts = movieReviewRequests
      .filter((request) => request.recipientUserId === currentUser.id && request.status === 'pending')
      .map((request) => `${request.id}:${request.createdAt}`)
      .sort();
    const lockedGiftNotes = giftNotes
      .filter((note) => note.recipientUserId === currentUser.id && note.status === 'locked')
      .map((note) => `${note.id}:${note.unlockDate}:${note.unlockTime}`)
      .sort();
    return [
      currentUser.id,
      incomingPolaroids.join('|'),
      pendingMemoryPrompts.join('|'),
      pendingMoviePrompts.join('|'),
      lockedGiftNotes.join('|'),
    ].join('::');
  }, [currentUser?.id, giftNotes, memoryPromptRequests, movieReviewRequests, wallPosts]);

  // ── Effects ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socialEnabled) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: movieQueryKeys.requests });
      queryClient.invalidateQueries({ queryKey: memoryPromptQueryKeys.requests });
    });
    return () => subscription.unsubscribe();
  }, [queryClient, socialEnabled]);

  useEffect(() => {
    if (!currentUser?.id || !hasSettledInitialData || !friendReminderSignature) return;
    resyncFriendNotificationReminders({
      userId: currentUser.id,
      users,
      giftNotes,
      memoryPromptRequests,
      movieReviewRequests,
      wallPosts,
    }).catch((error) => console.warn('[notifications] reminder sync failed:', error));
  }, [currentUser?.id, friendReminderSignature, giftNotes, hasSettledInitialData, memoryPromptRequests, movieReviewRequests, users, wallPosts]);

  useEffect(() => {
    if (!socialEnabled) return;
    return subscribeNotificationInserts((insertedNotifications) => {
      queryClient.setQueryData<Notification[]>(socialQueryKeys.notifications, (old) => {
        const existing = old ?? [];
        const existingIds = new Set(existing.map((notification) => notification.id));
        const fresh = insertedNotifications.filter((notification) => !existingIds.has(notification.id));
        return [...fresh, ...existing].sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        );
      });
    });
  }, [queryClient, socialEnabled]);

  useEffect(() => {
    if (!socialEnabled) return;

    const channel = supabase
      .channel('social-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wall_posts' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.wallPosts });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memory_replies' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.memoryReplies });
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.notifications });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_wall_items' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.profileWallItems });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wall_post_layouts' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.wallPostLayouts });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_private_notes' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.privateNotes });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_private_note_blocks' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.privateNoteBlocks });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gift_notes' }, () => {
        queryClient.invalidateQueries({ queryKey: giftQueryKeys.all });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movie_review_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: movieQueryKeys.requests });
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.notifications });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memory_prompt_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: memoryPromptQueryKeys.requests });
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.notifications });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_memory_prompts' }, () => {
        if (currentUser?.id) queryClient.invalidateQueries({ queryKey: memoryPromptQueryKeys.savedPrompts(currentUser.id) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.contacts });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.notifications });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_event_reactions' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.calendarEventReactions });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.friendships });
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.users });
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.contacts });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.friendRequests });
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.notifications });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id, queryClient, socialEnabled]);

  useEffect(() => {
    if (!socialEnabled) return;
    if (!usersQuery.isSuccess || !contactsQuery.isSuccess || !friendshipsQuery.isSuccess) return;

    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const myId = authUser.id;

      const myContacts = contacts.filter((c) => c.ownerUserId === myId);
      const linkedIds = new Set(myContacts.filter((c) => c.linkedUserId).map((c) => c.linkedUserId!));
      const myFriendIds = friendships
        .map((f) => f.userLowId === myId ? f.userHighId : f.userHighId === myId ? f.userLowId : null)
        .filter((id): id is string => id !== null);
      const myFriendIdSet = new Set(myFriendIds);
      // Only auto-create a linked contact when the user has no ambiguous manual
      // candidates for that friend. Otherwise leave it pending so we can prompt
      // the user to choose between merging or creating a new linked profile.
      const orphanIds = myFriendIds.filter((id) => {
        if (linkedIds.has(id)) return false;
        const friend = users.find((u) => u.id === id);
        if (!friend) return false;
        const candidates = findManualContactCandidates(myContacts, friend.displayName);
        return candidates.length === 0;
      });

      if (orphanIds.length) {
        const inserts = orphanIds.map((friendId) => {
          const friend = users.find((u) => u.id === friendId);
          return {
            owner_user_id: myId,
            linked_user_id: friendId,
            display_name: friend?.displayName ?? 'Friend',
            avatar_path: friend?.avatarPath ?? null,
            facts: friend?.profileFacts?.length ? friend.profileFacts : [],
            personality_traits: friend?.profilePersonalityTraits?.length ? friend.profilePersonalityTraits : [],
          };
        });
        const { data: rows, error: upsertErr } = await supabase
          .from('contacts')
          .upsert(inserts, { onConflict: 'owner_user_id,linked_user_id', ignoreDuplicates: true })
          .select();
        if (upsertErr) {
          console.warn('Failed to sync missing linked contacts:', upsertErr.message);
        } else if (rows?.length) {
          const newContacts = rows.map(rowToContact);
          queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) => {
            const existing = old ?? [];
            const next = [...existing];
            for (const contact of newContacts) {
              const index = next.findIndex((item) => item.id === contact.id);
              if (index >= 0) next[index] = contact;
              else next.unshift(contact);
            }
            return next;
          });
        }
      }

      // Do not bulk-clear linked_user_id here. A transient empty friendships
      // fetch can make every linked contact look "stale" and wipe all links.

      if (!didAutoRepairFriendLinksRef.current && myFriendIds.length > 0) {
        didAutoRepairFriendLinksRef.current = true;
        const repaired = await repairObviousFriendLinks(myId);
        if (repaired.repaired > 0) {
          console.info(`[contacts] Restored ${repaired.repaired} obvious friend link(s).`);
        }
      }
    })();
  }, [socialEnabled, usersQuery.isSuccess, contactsQuery.isSuccess, friendshipsQuery.isSuccess, users, contacts, friendships, queryClient]);

  useEffect(() => {
    if (!currentUser?.id || !currentUser.birthday) return;
    if (!usersQuery.isSuccess || !friendshipsQuery.isSuccess) return;
    const friendIds = friendships
      .map((friendship) => {
        if (friendship.userLowId === currentUser.id) return friendship.userHighId;
        if (friendship.userHighId === currentUser.id) return friendship.userLowId;
        return null;
      })
      .filter((id): id is string => Boolean(id))
      .sort();
    const signature = `${currentUser.id}:${currentUser.birthday}:${currentUser.displayName}:${friendIds.join(',')}`;
    if (birthdaySyncSignatureRef.current === signature) return;
    birthdaySyncSignatureRef.current = signature;

    syncProfileBirthdayCalendarEvent({
      birthday: currentUser.birthday,
      displayName: currentUser.displayName,
      friendUserIds: friendIds,
      ownerUserId: currentUser.id,
    })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['calendar'] });
      })
      .catch((error) => {
        console.warn('[birthday-calendar] sync failed:', error instanceof Error ? error.message : error);
        birthdaySyncSignatureRef.current = null;
      });
  }, [currentUser?.birthday, currentUser?.displayName, currentUser?.id, friendships, friendshipsQuery.isSuccess, queryClient, usersQuery.isSuccess]);

  useEffect(() => {
    if (!currentUser?.id || !giftNotesQuery.isFetched) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    const signature = `${currentUser.id}:${todayKey}`;
    if (giftRevealSignatureRef.current === signature) return;
    giftRevealSignatureRef.current = signature;

    revealDueGiftNotes()
      .then((revealed) => {
        if (revealed.length === 0) return;
        const myReveals = revealed.filter((entry) => entry.recipientUserId === currentUser.id && entry.authorUserId !== currentUser.id);
        for (const reveal of myReveals) {
          createNotification({
            recipientUserId: reveal.authorUserId,
            actorUserId: currentUser.id,
            type: 'wall_post',
            referenceId: reveal.wallPostId,
            metadata: {
              wallPostId: reveal.wallPostId,
              giftNoteId: reveal.giftNoteId,
              source: 'gift_note_revealed',
            },
            message: `${currentUser.displayName} opened your gift note`,
          }).catch((error) => console.warn('[notification] gift_note_revealed insert failed:', error));
        }
        queryClient.invalidateQueries({ queryKey: giftQueryKeys.all });
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.wallPosts });
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.notifications });
      })
      .catch((error) => {
        console.warn('[gift-notes] reveal failed:', error instanceof Error ? error.message : error);
        giftRevealSignatureRef.current = null;
      });
  }, [currentUser?.id, giftNotesQuery.isFetched, queryClient]);

  // ── Lookups ──────────────────────────────────────────────────────────
  function getUserById(userId: string) {
    return users.find((user) => user.id === userId);
  }

  function getContactById(contactId: string) {
    return contacts.find((contact) => contact.id === contactId);
  }

  function getDirectFriends(userId: string) {
    return friendships
      .filter((f) => f.userLowId === userId || f.userHighId === userId)
      .map((f) => {
        const friendId = f.userLowId === userId ? f.userHighId : f.userLowId;
        return getUserById(friendId);
      })
      .filter((u): u is AppUser => Boolean(u));
  }

  function isConnected(leftUserId: string, rightUserId: string) {
    const low = leftUserId < rightUserId ? leftUserId : rightUserId;
    const high = leftUserId < rightUserId ? rightUserId : leftUserId;
    return friendships.some((f) => f.userLowId === low && f.userHighId === high);
  }

  function getGiftNotesForPair(leftUserId: string, rightUserId: string) {
    return giftNotes.filter((note) =>
      (note.authorUserId === leftUserId && note.recipientUserId === rightUserId)
      || (note.authorUserId === rightUserId && note.recipientUserId === leftUserId),
    );
  }

  function getMovieReviewRequestsForPair(leftUserId: string, rightUserId: string) {
    return movieReviewRequests.filter((request) =>
      (request.requesterUserId === leftUserId && request.recipientUserId === rightUserId)
      || (request.requesterUserId === rightUserId && request.recipientUserId === leftUserId),
    );
  }

  function getMovieReviewRequestById(requestId: string) {
    return movieReviewRequests.find((request) => request.id === requestId);
  }

  function getMemoryPromptRequestsForPair(leftUserId: string, rightUserId: string) {
    return memoryPromptRequests.filter((request) =>
      (request.requesterUserId === leftUserId && request.recipientUserId === rightUserId)
      || (request.requesterUserId === rightUserId && request.recipientUserId === leftUserId),
    );
  }

  function getMemoryPromptRequestById(requestId: string) {
    return memoryPromptRequests.find((request) => request.id === requestId);
  }

  function getIncomingFriendRequests(currentUserId: string) {
    return friendRequests.filter((request) => request.recipientUserId === currentUserId && request.status === 'pending');
  }

  function getOutgoingFriendRequests(currentUserId: string) {
    return friendRequests.filter((request) => request.requesterUserId === currentUserId && request.status === 'pending');
  }

  async function resolveAcceptedFriendContact(currentUserId: string, friendUserId: string) {
    const friend = users.find((u) => u.id === friendUserId);
    if (!friend) return { ok: false as const, error: 'Friend profile not found.' };

    const existingLinkedContact = contacts.find(
      (contact) => contact.ownerUserId === currentUserId && contact.linkedUserId === friendUserId,
    );
    if (existingLinkedContact) {
      return { ok: true as const, friend, contactId: existingLinkedContact.id, candidateContactIds: [] };
    }

    const candidates = getLinkReviewCandidates(currentUserId, friendUserId);
    if (candidates.length > 0) {
      return { ok: true as const, friend, contactId: null, candidateContactIds: candidates.map((contact) => contact.id) };
    }

    const created = await createLinkedContactForFriend(currentUserId, friendUserId);
    if (!created.ok) return created;
    return { ok: true as const, friend, contactId: created.contactId, candidateContactIds: [] };
  }

  function getPeopleListForUser(userId: string) {
    return buildPeopleListForUser({ contacts, friendships, userId, users });
  }

  // ── Wall post reads ──────────────────────────────────────────────────
  function getWallPostsForSubject(subjectId: string, subjectType: 'user' | 'contact') {
    return wallPosts
      .filter((post) => {
        if (subjectType === 'user') return post.subjectUserId === subjectId;
        return post.subjectContactId === subjectId;
      })
      .sort(compareWallPostsByMemoryDateDesc);
  }

  function getVisiblePostsByAuthor(authorId: string) {
    return wallPosts
      .filter((p) => p.authorUserId === authorId && p.visibility === 'visible_to_subject')
      .sort(compareWallPostsByMemoryDateDesc);
  }

  function getWallPostById(postId: string) {
    return wallPosts.find((p) => p.id === postId);
  }

  function getRepliesForWallPost(postId: string) {
    return memoryReplies.filter((reply) => reply.wallPostId === postId);
  }

  function getReplyCountForWallPost(postId: string) {
    return memoryReplies.filter((reply) => reply.wallPostId === postId).length;
  }

  function getProfileWallItemsForUser(userId: string) {
    return profileWallItems
      .filter((item) => item.ownerUserId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  function getWallPostLayoutsForContext(ownerUserId: string, wallContext: WallPostLayoutContext, wallContextId: string) {
    return wallPostLayouts.filter(
      (layout) =>
        layout.ownerUserId === ownerUserId &&
        layout.wallContext === wallContext &&
        layout.wallContextId === wallContextId,
    );
  }

  function isPostOnProfileWall(ownerUserId: string, wallPostId: string) {
    return profileWallItems.some((item) => item.ownerUserId === ownerUserId && item.wallPostId === wallPostId);
  }

  function getPrivateNotesForContact(contactId: string) {
    return privateNotes
      .filter((note) => note.contactId === contactId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function getPrivateNoteById(noteId: string) {
    return privateNotes.find((note) => note.id === noteId);
  }

  function getPrivateNoteBlocks(noteId: string) {
    return privateNoteBlocks
      .filter((block) => block.noteId === noteId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }

  // Private notes are offline-first: every mutation is applied optimistically
  // to the cache and queued in the private-note outbox, which replays against
  // Supabase when connectivity returns. Client-generated UUIDs are reused as
  // server primary keys so an op references the same id before and after sync.
  async function touchPrivateNote(noteId: string, updatedAt = new Date().toISOString()) {
    queryClient.setQueryData<ContactPrivateNote[]>(socialQueryKeys.privateNotes, (old) =>
      (old ?? []).map((note) => (note.id === noteId ? { ...note, updatedAt } : note)),
    );
    await enqueuePrivateNoteOp({ kind: 'note.update', id: noteId, updatedAt });
  }

  async function createPrivateNote(ownerUserId: string, contactId: string, input: CreateContactPrivateNoteInput = {}) {
    const title = input.title?.trim() || 'Untitled note';
    const now = new Date().toISOString();
    const note: ContactPrivateNote = {
      id: newPrivateNoteId(),
      ownerUserId,
      contactId,
      title,
      createdAt: now,
      updatedAt: now,
    };
    queryClient.setQueryData<ContactPrivateNote[]>(socialQueryKeys.privateNotes, (old) => [note, ...(old ?? [])]);
    await enqueuePrivateNoteOp({
      kind: 'note.insert',
      id: note.id,
      ownerUserId,
      contactId,
      title,
      createdAt: now,
      updatedAt: now,
    });
    void replayPrivateNoteOps();
    return note;
  }

  async function updatePrivateNote(noteId: string, updates: UpdateContactPrivateNoteInput) {
    if (updates.title === undefined) return;
    const title = updates.title.trim() || 'Untitled note';
    const updatedAt = new Date().toISOString();

    queryClient.setQueryData<ContactPrivateNote[]>(socialQueryKeys.privateNotes, (old) =>
      (old ?? []).map((note) => (note.id === noteId ? { ...note, title, updatedAt } : note)),
    );
    await enqueuePrivateNoteOp({ kind: 'note.update', id: noteId, title, updatedAt });
    void replayPrivateNoteOps();
  }

  async function deletePrivateNote(noteId: string) {
    queryClient.setQueryData<ContactPrivateNote[]>(socialQueryKeys.privateNotes, (old) =>
      (old ?? []).filter((note) => note.id !== noteId),
    );
    queryClient.setQueryData<ContactPrivateNoteBlock[]>(socialQueryKeys.privateNoteBlocks, (old) =>
      (old ?? []).filter((block) => block.noteId !== noteId),
    );
    await enqueuePrivateNoteOp({ kind: 'note.delete', id: noteId });
    void replayPrivateNoteOps();
  }

  async function addPrivateNoteBlock(noteId: string, input: CreateContactPrivateNoteBlockInput) {
    const note = privateNotes.find((entry) => entry.id === noteId);
    const ownerUserId = note?.ownerUserId ?? currentUser?.id;
    if (!ownerUserId) throw new Error('Note not found.');
    const now = new Date().toISOString();
    const sortOrder = input.sortOrder ?? getPrivateNoteBlocks(noteId).length;
    const block: ContactPrivateNoteBlock = {
      id: newPrivateNoteId(),
      noteId,
      ownerUserId,
      type: input.type,
      content: input.content ?? null,
      url: input.url ?? null,
      imagePath: input.imagePath ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    queryClient.setQueryData<ContactPrivateNoteBlock[]>(socialQueryKeys.privateNoteBlocks, (old) => [...(old ?? []), block]);
    await enqueuePrivateNoteOp({
      kind: 'block.insert',
      id: block.id,
      noteId,
      ownerUserId,
      type: block.type,
      content: block.content,
      url: block.url,
      imagePath: block.imagePath,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    });
    await touchPrivateNote(noteId, now);
    void replayPrivateNoteOps();
    return block;
  }

  async function updatePrivateNoteBlock(blockId: string, updates: UpdateContactPrivateNoteBlockInput) {
    const block = privateNoteBlocks.find((entry) => entry.id === blockId);
    if (!block) throw new Error('Note block not found.');
    const hasChange =
      updates.content !== undefined ||
      updates.url !== undefined ||
      updates.imagePath !== undefined ||
      updates.sortOrder !== undefined;
    if (!hasChange) return;

    const updatedAt = new Date().toISOString();
    queryClient.setQueryData<ContactPrivateNoteBlock[]>(socialQueryKeys.privateNoteBlocks, (old) =>
      (old ?? []).map((entry) => {
        if (entry.id !== blockId) return entry;
        return {
          ...entry,
          content: updates.content !== undefined ? updates.content : entry.content,
          url: updates.url !== undefined ? updates.url : entry.url,
          imagePath: updates.imagePath !== undefined ? updates.imagePath : entry.imagePath,
          sortOrder: updates.sortOrder !== undefined ? updates.sortOrder : entry.sortOrder,
          updatedAt,
        };
      }),
    );
    await enqueuePrivateNoteOp({
      kind: 'block.update',
      id: blockId,
      updatedAt,
      ...(updates.content !== undefined ? { content: updates.content } : {}),
      ...(updates.url !== undefined ? { url: updates.url } : {}),
      ...(updates.imagePath !== undefined ? { imagePath: updates.imagePath } : {}),
      ...(updates.sortOrder !== undefined ? { sortOrder: updates.sortOrder } : {}),
    });
    await touchPrivateNote(block.noteId, updatedAt);
    void replayPrivateNoteOps();
  }

  async function deletePrivateNoteBlock(blockId: string) {
    const block = privateNoteBlocks.find((entry) => entry.id === blockId);
    queryClient.setQueryData<ContactPrivateNoteBlock[]>(socialQueryKeys.privateNoteBlocks, (old) =>
      (old ?? []).filter((entry) => entry.id !== blockId),
    );
    await enqueuePrivateNoteOp({ kind: 'block.delete', id: blockId });
    if (block) await touchPrivateNote(block.noteId);
    void replayPrivateNoteOps();
  }

  function getContactAboutMe(ownerUserId: string, myUserId: string) {
    return contacts.find((c) => c.ownerUserId === ownerUserId && c.linkedUserId === myUserId);
  }

  function getFriendFactsFor(authorUserId: string, subjectUserId: string) {
    return friendFacts
      .filter((f) => f.authorUserId === authorUserId && f.subjectUserId === subjectUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ── Mutations: Friendships ───────────────────────────────────────────
  async function addFriendByCode(currentUserId: string, friendCode: string) {
    const code = extractFriendCode(friendCode);
    if (!code) return { ok: false as const, error: 'Enter a friend code.' };

    const { data: profile, error: lookupErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('friend_code', code)
      .single();

    if (lookupErr || !profile) {
      return { ok: false as const, error: 'No one found with that friend code.' };
    }

    if (profile.id === currentUserId) {
      return { ok: false as const, error: "That's your own friend code!" };
    }

    const alreadyFriends = isConnected(currentUserId, profile.id);

    if (!alreadyFriends) {
      const incoming = friendRequests.find(
        (request) =>
          request.requesterUserId === profile.id &&
          request.recipientUserId === currentUserId &&
          request.status === 'pending',
      );
      if (incoming) return acceptFriendRequest(incoming.id, currentUserId);

      const outgoing = friendRequests.find(
        (request) =>
          request.requesterUserId === currentUserId &&
          request.recipientUserId === profile.id &&
          request.status === 'pending',
      );
      if (outgoing) {
        return { ok: true as const, friend: rowToUser(profile), contactId: null, candidateContactIds: [], requested: true, requestId: outgoing.id };
      }

      const { data: requestRow, error: requestErr } = await supabase
        .from('friend_requests')
        .upsert(
          {
            requester_user_id: currentUserId,
            recipient_user_id: profile.id,
            status: 'pending',
            responded_at: null,
          },
          { onConflict: 'requester_user_id,recipient_user_id' },
        )
        .select()
        .single();

      if (requestErr || !requestRow) {
        return { ok: false as const, error: requestErr?.message ?? 'Could not send friend request.' };
      }

      const request = rowToFriendRequest(requestRow);
      queryClient.setQueryData<FriendRequest[]>(socialQueryKeys.friendRequests, (old) => {
        const existing = old ?? [];
        return [request, ...existing.filter((entry) => entry.id !== request.id)];
      });

      const currentUserProfile = users.find((u) => u.id === currentUserId);
      const currentName = currentUserProfile?.displayName ?? 'Someone';
      createNotification({
        recipientUserId: profile.id,
        actorUserId: currentUserId,
        type: 'friend_request',
        referenceId: request.id,
        metadata: { action: 'requested', friendRequestId: request.id, source: 'friend_invite' },
        message: `${currentName} used your invite and sent you a friend request`,
      }).catch((error) => console.warn('[notification] friend_request insert failed:', error));

      return { ok: true as const, friend: rowToUser(profile), contactId: null, candidateContactIds: [], requested: true, requestId: request.id };
    }

    const friendUser = rowToUser(profile);
    const hydrateOwnedLinkedContact = async () => {
      const { data: ownedLinkedContactRow, error: ownedLinkedContactErr } = await supabase
        .from('contacts')
        .select('*')
        .eq('owner_user_id', currentUserId)
        .eq('linked_user_id', friendUser.id)
        .maybeSingle();
      if (ownedLinkedContactErr || !ownedLinkedContactRow) return null;

      const ownedLinkedContact = rowToContact(ownedLinkedContactRow);
      queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) => {
        const existing = old ?? [];
        const found = existing.some((c) => c.id === ownedLinkedContact.id);
        if (found) {
          return existing.map((c) => c.id === ownedLinkedContact.id ? ownedLinkedContact : c);
        }
        return [ownedLinkedContact, ...existing];
      });
      return ownedLinkedContact;
    };

    const existingLinkedContact = contacts.find(
      (c) => c.ownerUserId === currentUserId && c.linkedUserId === friendUser.id,
    );
    if (existingLinkedContact) {
      return { ok: true as const, friend: friendUser, contactId: existingLinkedContact.id, candidateContactIds: [], alreadyFriends: true };
    }

    // If the user already has unlinked manual contacts that look like this
    // person (same first-name token), do NOT auto-merge. Defer to the chooser
    // UI so the user can decide which Steven (if any) this is.
    const candidates = getLinkReviewCandidates(currentUserId, friendUser.id);
    if (candidates.length > 0) {
      return { ok: true as const, friend: friendUser, contactId: null, candidateContactIds: candidates.map((c) => c.id), alreadyFriends: true };
    }

    const { data: newContactRow, error: newContactErr } = await supabase
      .from('contacts')
      .insert({
        owner_user_id: currentUserId,
        linked_user_id: friendUser.id,
        display_name: friendUser.displayName,
        avatar_path: friendUser.avatarPath ?? null,
        facts: friendUser.profileFacts.length > 0 ? friendUser.profileFacts : [],
        personality_traits: friendUser.profilePersonalityTraits.length > 0 ? friendUser.profilePersonalityTraits : [],
      })
      .select()
      .single();
    if (newContactErr) {
      const fetchedLinkedContact = await hydrateOwnedLinkedContact();
      if (fetchedLinkedContact) {
        return { ok: true as const, friend: friendUser, contactId: fetchedLinkedContact.id, candidateContactIds: [], alreadyFriends: true };
      }
      return { ok: false as const, error: newContactErr.message };
    }
    if (newContactRow) {
      const newContact = rowToContact(newContactRow);
      queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) => [newContact, ...(old ?? [])]);
      return { ok: true as const, friend: friendUser, contactId: newContact.id, candidateContactIds: [], alreadyFriends: true };
    }

    const fetchedLinkedContact = await hydrateOwnedLinkedContact();
    if (fetchedLinkedContact) {
      return { ok: true as const, friend: friendUser, contactId: fetchedLinkedContact.id, candidateContactIds: [], alreadyFriends: true };
    }

    return { ok: false as const, error: 'We added the friendship, but could not create your editable contact card.' };
  }

  async function acceptFriendRequest(requestId: string, currentUserId: string) {
    const request = friendRequests.find((entry) => entry.id === requestId);
    if (!request) return { ok: false as const, error: 'Friend request not found.' };
    if (request.recipientUserId !== currentUserId) return { ok: false as const, error: "You can't accept this request." };
    if (request.status !== 'pending') return { ok: false as const, error: 'This request has already been handled.' };

    const low = currentUserId < request.requesterUserId ? currentUserId : request.requesterUserId;
    const high = currentUserId < request.requesterUserId ? request.requesterUserId : currentUserId;

    if (!isConnected(currentUserId, request.requesterUserId)) {
      const { data: friendshipRow, error: friendshipErr } = await supabase.from('friendships').insert({
        user_low_id: low,
        user_high_id: high,
        created_by_user_id: currentUserId,
      }).select().single();
      if (friendshipErr) return { ok: false as const, error: friendshipErr.message };
      if (friendshipRow) {
        const friendship = rowToFriendship(friendshipRow);
        queryClient.setQueryData<Friendship[]>(socialQueryKeys.friendships, (old) => [friendship, ...(old ?? [])]);
      }
    }

    const respondedAt = new Date().toISOString();
    const { data: requestRow, error: requestErr } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted', responded_at: respondedAt })
      .eq('id', requestId)
      .eq('recipient_user_id', currentUserId)
      .select()
      .single();
    if (requestErr || !requestRow) return { ok: false as const, error: requestErr?.message ?? 'Could not accept request.' };

    queryClient.setQueryData<FriendRequest[]>(socialQueryKeys.friendRequests, (old) =>
      (old ?? []).map((entry) => (entry.id === requestId ? rowToFriendRequest(requestRow) : entry)),
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.friendships }),
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.users }),
    ]);

    const currentName = users.find((u) => u.id === currentUserId)?.displayName ?? 'Someone';
    createNotification({
      recipientUserId: request.requesterUserId,
      actorUserId: currentUserId,
      type: 'friend_request',
      referenceId: request.id,
      metadata: { action: 'accepted', friendRequestId: request.id, source: 'friend_requests' },
      message: `${currentName} accepted your friend request`,
    }).catch((error) => console.warn('[notification] friend_request insert failed:', error));

    return resolveAcceptedFriendContact(currentUserId, request.requesterUserId);
  }

  async function declineFriendRequest(requestId: string, currentUserId: string) {
    const request = friendRequests.find((entry) => entry.id === requestId);
    if (!request) return { ok: false as const, error: 'Friend request not found.' };
    if (request.recipientUserId !== currentUserId) return { ok: false as const, error: "You can't decline this request." };
    if (request.status !== 'pending') return { ok: false as const, error: 'This request has already been handled.' };

    const { data: requestRow, error } = await supabase
      .from('friend_requests')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('recipient_user_id', currentUserId)
      .select()
      .single();
    if (error || !requestRow) return { ok: false as const, error: error?.message ?? 'Could not decline request.' };

    queryClient.setQueryData<FriendRequest[]>(socialQueryKeys.friendRequests, (old) =>
      (old ?? []).map((entry) => (entry.id === requestId ? rowToFriendRequest(requestRow) : entry)),
    );
    return { ok: true as const };
  }

  // Link an existing manual contact to a friend who is already in our friends
  // list (used by the duplicate-resolution chooser screen).
  async function linkContactToFriend(contactId: string, currentUserId: string, friendUserId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return { ok: false as const, error: 'Contact not found.' };
    if (contact.ownerUserId !== currentUserId) return { ok: false as const, error: "You don't own this contact." };
    if (contact.linkedUserId === friendUserId) return { ok: true as const };
    if (contact.linkedUserId) return { ok: false as const, error: 'This contact is already linked to someone else.' };

    const existingLink = contacts.find(
      (c) => c.ownerUserId === currentUserId && c.linkedUserId === friendUserId,
    );
    if (existingLink) return { ok: false as const, error: 'You already have another contact linked to this person.' };

    const { error: updErr } = await supabase
      .from('contacts')
      .update({ linked_user_id: friendUserId })
      .eq('id', contactId)
      .eq('owner_user_id', currentUserId);
    if (updErr) return { ok: false as const, error: updErr.message };

    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).map((c) => (c.id === contactId ? { ...c, linkedUserId: friendUserId } : c)),
    );
    await migrateContactPostsToUser(contactId, friendUserId);
    return { ok: true as const };
  }

  // Create a brand-new linked contact card for an existing friendship (used by
  // the chooser when none of the manual candidates is the right person).
  async function createLinkedContactForFriend(currentUserId: string, friendUserId: string) {
    const existing = contacts.find(
      (c) => c.ownerUserId === currentUserId && c.linkedUserId === friendUserId,
    );
    if (existing) return { ok: true as const, contactId: existing.id };

    const friend = users.find((u) => u.id === friendUserId);
    const { data: newContactRow, error: newContactErr } = await supabase
      .from('contacts')
      .insert({
        owner_user_id: currentUserId,
        linked_user_id: friendUserId,
        display_name: friend?.displayName ?? 'Friend',
        avatar_path: friend?.avatarPath ?? null,
        facts: friend?.profileFacts?.length ? friend.profileFacts : [],
        personality_traits: friend?.profilePersonalityTraits?.length ? friend.profilePersonalityTraits : [],
      })
      .select()
      .single();
    if (newContactErr || !newContactRow) {
      const { data: existingRow } = await supabase
        .from('contacts')
        .select('*')
        .eq('owner_user_id', currentUserId)
        .eq('linked_user_id', friendUserId)
        .maybeSingle();
      if (existingRow) {
        const contact = rowToContact(existingRow);
        queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) => {
          const existingContacts = old ?? [];
          return existingContacts.some((entry) => entry.id === contact.id)
            ? existingContacts.map((entry) => (entry.id === contact.id ? contact : entry))
            : [contact, ...existingContacts];
        });
        return { ok: true as const, contactId: contact.id };
      }
      return { ok: false as const, error: newContactErr?.message ?? 'Could not create contact.' };
    }
    const newContact = rowToContact(newContactRow);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) => [newContact, ...(old ?? [])]);
    return { ok: true as const, contactId: newContact.id };
  }

  async function unlinkContactFromFriend(contactId: string, currentUserId: string) {
    const contact = contacts.find((entry) => entry.id === contactId);
    if (!contact) return { ok: false as const, error: 'Contact not found.' };
    if (contact.ownerUserId !== currentUserId) return { ok: false as const, error: "You don't own this contact." };
    if (!contact.linkedUserId) return { ok: true as const };

    const { error } = await supabase
      .from('contacts')
      .update({ linked_user_id: null })
      .eq('id', contactId)
      .eq('owner_user_id', currentUserId);
    if (error) return { ok: false as const, error: error.message };

    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).map((entry) => (entry.id === contactId ? { ...entry, linkedUserId: null } : entry)),
    );
    return { ok: true as const };
  }

  async function moveContactLink(sourceContactId: string, targetContactId: string, currentUserId: string) {
    if (sourceContactId === targetContactId) return { ok: true as const };

    const source = contacts.find((entry) => entry.id === sourceContactId);
    const target = contacts.find((entry) => entry.id === targetContactId);
    if (!source || !target) return { ok: false as const, error: 'Contact not found.' };
    if (source.ownerUserId !== currentUserId || target.ownerUserId !== currentUserId) {
      return { ok: false as const, error: "You don't own one of these contacts." };
    }
    if (!source.linkedUserId) return { ok: false as const, error: 'This profile is not connected to an account.' };
    if (target.linkedUserId) return { ok: false as const, error: 'The target profile is already connected to an account.' };

    const linkedUserId = source.linkedUserId;
    const { error: unlinkErr } = await supabase
      .from('contacts')
      .update({ linked_user_id: null })
      .eq('id', sourceContactId)
      .eq('owner_user_id', currentUserId);
    if (unlinkErr) return { ok: false as const, error: unlinkErr.message };

    const { error: linkErr } = await supabase
      .from('contacts')
      .update({ linked_user_id: linkedUserId })
      .eq('id', targetContactId)
      .eq('owner_user_id', currentUserId);
    if (linkErr) return { ok: false as const, error: linkErr.message };

    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).map((entry) => {
        if (entry.id === sourceContactId) return { ...entry, linkedUserId: null };
        if (entry.id === targetContactId) return { ...entry, linkedUserId };
        return entry;
      }),
    );
    await migrateContactPostsToUser(targetContactId, linkedUserId);
    return { ok: true as const };
  }

  function getManualContactCandidatesForFriend(currentUserId: string, friendUserId: string) {
    const friend = users.find((u) => u.id === friendUserId);
    if (!friend) return [];
    const myContacts = contacts.filter((c) => c.ownerUserId === currentUserId);
    return findManualContactCandidates(myContacts, friend.displayName);
  }

  function getUnlinkedManualContacts(currentUserId: string) {
    return contacts.filter((contact) => contact.ownerUserId === currentUserId && !contact.linkedUserId);
  }

  function getLinkReviewCandidates(currentUserId: string, friendUserId: string) {
    const suggested = getManualContactCandidatesForFriend(currentUserId, friendUserId);
    return suggested.length > 0 ? suggested : getUnlinkedManualContacts(currentUserId);
  }

  function getPendingFriendLinks(currentUserId: string): PendingFriendLink[] {
    const myContacts = contacts.filter((c) => c.ownerUserId === currentUserId);
    const linkedIds = new Set(myContacts.filter((c) => c.linkedUserId).map((c) => c.linkedUserId!));
    const friendIds = friendships
      .map((f) => (f.userLowId === currentUserId ? f.userHighId : f.userHighId === currentUserId ? f.userLowId : null))
      .filter((id): id is string => id !== null);
    const result: PendingFriendLink[] = [];
    for (const friendId of friendIds) {
      if (linkedIds.has(friendId)) continue;
      const friend = users.find((u) => u.id === friendId);
      if (!friend) continue;
      const candidates = getLinkReviewCandidates(currentUserId, friendId);
      if (candidates.length === 0) continue;
      result.push({ friend, candidates });
    }
    return result;
  }

  async function repairObviousFriendLinks(currentUserId: string) {
    const pending = getPendingFriendLinks(currentUserId);
    let repaired = 0;
    let skipped = 0;

    for (const { friend, candidates } of pending) {
      if (candidates.length !== 1) {
        skipped += 1;
        continue;
      }

      const result = await linkContactToFriend(candidates[0].id, currentUserId, friend.id);
      if (result.ok) repaired += 1;
      else skipped += 1;
    }

    return { repaired, skipped };
  }

  async function notifyLinkedContactUpdate({
    avatarLocalUri,
    contactId,
    linkedUserId,
    ownerUserId,
    profileBgImageLocalUri,
  }: {
    avatarLocalUri?: string | null;
    contactId: string;
    linkedUserId: string | null | undefined;
    ownerUserId?: string | null;
    profileBgImageLocalUri?: string | null;
  }) {
    if (!linkedUserId || !ownerUserId || linkedUserId === ownerUserId) return;

    const ownerName = users.find((user) => user.id === ownerUserId)?.displayName ?? 'Someone';
    const updateKind = avatarLocalUri !== undefined
      ? 'profile_photo'
      : profileBgImageLocalUri !== undefined
        ? 'profile_background'
        : 'profile';
    const message = avatarLocalUri !== undefined
      ? avatarLocalUri
        ? `${ownerName} updated your profile photo`
        : `${ownerName} removed your profile photo`
      : profileBgImageLocalUri === undefined
        ? `${ownerName} updated your profile`
        : profileBgImageLocalUri
          ? `${ownerName} updated your profile background`
          : `${ownerName} removed your profile background`;

    createNotification({
      recipientUserId: linkedUserId,
      actorUserId: ownerUserId,
      type: 'contact_update',
      referenceId: contactId,
      metadata: { contactId, source: 'contact_profile', updateKind },
      message,
    }).catch((error) => console.warn('[notification] contact_update insert failed:', error));
  }

  async function removeFriend(currentUserId: string, friendUserId: string) {
    const ownedLinkedContact = contacts.find(
      (contact) => contact.ownerUserId === currentUserId && contact.linkedUserId === friendUserId,
    );

    if (ownedLinkedContact) {
      const { error: migrateBackErr } = await supabase
        .from('wall_posts')
        .update({
          subject_user_id: null,
          subject_contact_id: ownedLinkedContact.id,
          visibility: 'private',
        })
        .eq('author_user_id', currentUserId)
        .eq('subject_user_id', friendUserId);
      if (migrateBackErr) throw new Error(migrateBackErr.message);
    }

    const low = currentUserId < friendUserId ? currentUserId : friendUserId;
    const high = currentUserId < friendUserId ? friendUserId : currentUserId;
    const { error: deleteErr } = await supabase
      .from('friendships')
      .delete()
      .eq('user_low_id', low)
      .eq('user_high_id', high);
    if (deleteErr) throw new Error(deleteErr.message);

    if (ownedLinkedContact) {
      const { error: unlinkErr } = await supabase
        .from('contacts')
        .update({ linked_user_id: null })
        .eq('id', ownedLinkedContact.id)
        .eq('owner_user_id', currentUserId);
      if (unlinkErr) throw new Error(unlinkErr.message);
    }

    queryClient.setQueryData<Friendship[]>(socialQueryKeys.friendships, (old) =>
      (old ?? []).filter((friendship) => !(friendship.userLowId === low && friendship.userHighId === high)),
    );
    if (ownedLinkedContact) {
      queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
        (old ?? []).map((contact) =>
          contact.id === ownedLinkedContact.id ? { ...contact, linkedUserId: null } : contact,
        ),
      );
      queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
        (old ?? []).map((post) =>
          post.authorUserId === currentUserId && post.subjectUserId === friendUserId
            ? {
                ...post,
                subjectUserId: null,
                subjectContactId: ownedLinkedContact.id,
                visibility: 'private',
              }
            : post,
        ),
      );
    }
  }

  async function deleteContact(currentUserId: string, contactId: string) {
    const contact = contacts.find((entry) => entry.id === contactId);
    if (!contact) throw new Error('Contact not found.');
    if (contact.ownerUserId !== currentUserId) throw new Error("You don't own this contact.");
    if (contact.linkedUserId) throw new Error('Unfriend this person before deleting their profile card.');

    const { error } = await supabase.from('contacts').delete().eq('id', contactId);
    if (error) throw new Error(error.message);

    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).filter((entry) => entry.id !== contactId),
    );
    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
      (old ?? []).filter((post) => post.subjectContactId !== contactId),
    );
  }

  // ── Mutations: Contacts ──────────────────────────────────────────────
  async function addManualContact(ownerUserId: string, input: CreateContactInput) {
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        owner_user_id: ownerUserId,
        display_name: input.displayName.trim(),
        nickname: input.nickname?.trim() || null,
        facts: ['Freshly added to your circle.'],
        personality_traits: [],
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? 'Failed to create contact');

    const contact = rowToContact(data);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) => [contact, ...(old ?? [])]);
    return contact;
  }

  async function updateContact(contactId: string, updates: {
    displayName?: string;
    avatarLocalUri?: string | null;
    avatarRemoteUrl?: string | null;
    avatarVideoLocalUri?: string | null;
    avatarVideoMuted?: boolean;
    tags?: string[];
    note?: string | null;
    cardColor?: string | null;
    backText?: string | null;
    profileBg?: string | null;
    profileBgImageLocalUri?: string | null;
    linkedUserId?: string | null;
    pinned?: boolean;
    pinnedAt?: string | null;
  }) {
    const dbUpdate: Record<string, unknown> = {};
    if (updates.displayName !== undefined) dbUpdate.display_name = updates.displayName;
    if (updates.tags !== undefined) dbUpdate.tags = updates.tags;
    if (updates.note !== undefined) dbUpdate.note = updates.note;
    if (updates.cardColor !== undefined) dbUpdate.card_color = updates.cardColor;
    if (updates.backText !== undefined) dbUpdate.back_text = updates.backText;
    if (updates.profileBg !== undefined) dbUpdate.profile_bg = updates.profileBg;
    if (updates.linkedUserId !== undefined) dbUpdate.linked_user_id = updates.linkedUserId;
    if (updates.avatarVideoMuted !== undefined) dbUpdate.avatar_video_muted = updates.avatarVideoMuted;
    if (updates.pinned !== undefined) dbUpdate.pinned = updates.pinned;
    if (updates.pinnedAt !== undefined) dbUpdate.pinned_at = updates.pinnedAt;

    if (updates.avatarLocalUri !== undefined) {
      if (updates.avatarLocalUri) {
        dbUpdate.avatar_path = await uploadContactAvatar(updates.avatarLocalUri);
      } else {
        dbUpdate.avatar_path = null;
      }
    } else if (updates.avatarRemoteUrl !== undefined) {
      // Reference an existing stored image (the friend's account photo) directly.
      dbUpdate.avatar_path = updates.avatarRemoteUrl;
    }

    if (updates.avatarVideoLocalUri !== undefined) {
      if (updates.avatarVideoLocalUri) {
        dbUpdate.avatar_video_path = await uploadContactProfileVideo(updates.avatarVideoLocalUri);
      } else {
        dbUpdate.avatar_video_path = null;
        dbUpdate.avatar_video_muted = false;
      }
    }

    if (updates.profileBgImageLocalUri !== undefined) {
      if (updates.profileBgImageLocalUri) {
        dbUpdate.profile_bg_image_path = await uploadContactProfileBackground(updates.profileBgImageLocalUri);
      } else {
        dbUpdate.profile_bg_image_path = null;
      }
    }

    if (Object.keys(dbUpdate).length === 0) return;

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) throw new Error('Contact not found.');
    const { error } = await supabase
      .from('contacts')
      .update(dbUpdate)
      .eq('id', contactId)
      .eq('owner_user_id', contact.ownerUserId);
    if (error) throw new Error(error.message);

    const linkedId = contact?.linkedUserId ?? (updates.linkedUserId ?? null);
    await notifyLinkedContactUpdate({
      avatarLocalUri: updates.avatarLocalUri,
      contactId,
      linkedUserId: linkedId,
      ownerUserId: contact?.ownerUserId,
      profileBgImageLocalUri: updates.profileBgImageLocalUri,
    });

    const newAvatarPath = typeof dbUpdate.avatar_path === 'string' ? dbUpdate.avatar_path : (dbUpdate.avatar_path === null ? null : undefined);
    const newAvatarVideoPath = typeof dbUpdate.avatar_video_path === 'string'
      ? dbUpdate.avatar_video_path
      : (dbUpdate.avatar_video_path === null ? null : undefined);
    const newProfileBgImagePath = typeof dbUpdate.profile_bg_image_path === 'string'
      ? dbUpdate.profile_bg_image_path
      : (dbUpdate.profile_bg_image_path === null ? null : undefined);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).map((c) => {
        if (c.id !== contactId) return c;
        const updated = { ...c };
        if (updates.displayName !== undefined) updated.displayName = updates.displayName;
        if (newAvatarPath !== undefined) updated.avatarPath = newAvatarPath;
        if (newAvatarVideoPath !== undefined) updated.avatarVideoPath = newAvatarVideoPath;
        if (updates.avatarVideoMuted !== undefined) updated.avatarVideoMuted = updates.avatarVideoMuted;
        if (newAvatarVideoPath === null) updated.avatarVideoMuted = false;
        if (updates.tags !== undefined) updated.tags = updates.tags;
        if (updates.note !== undefined) updated.note = updates.note;
        if (updates.cardColor !== undefined) updated.cardColor = updates.cardColor;
        if (updates.backText !== undefined) updated.backText = updates.backText;
        if (updates.profileBg !== undefined) updated.profileBg = updates.profileBg;
        if (newProfileBgImagePath !== undefined) updated.profileBgImagePath = newProfileBgImagePath;
        if (updates.linkedUserId !== undefined) updated.linkedUserId = updates.linkedUserId;
        if (updates.pinned !== undefined) updated.pinned = updates.pinned;
        if (updates.pinnedAt !== undefined) updated.pinnedAt = updates.pinnedAt;
        return updated;
      }),
    );
  }

  async function addContactFact(contactId: string, fact: string) {
    const contact = contacts.find((c) => c.id === contactId);
    const updatedFacts = [...(contact?.facts ?? []), fact];
    const { error } = await supabase.from('contacts').update({ facts: updatedFacts }).eq('id', contactId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).map((c) => (c.id === contactId ? { ...c, facts: updatedFacts } : c)),
    );

    const linkedId = contact?.linkedUserId;
    if (linkedId) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser && linkedId !== authUser.id) {
        const ownerName = users.find((u) => u.id === authUser.id)?.displayName ?? 'Someone';
        createNotification({
          recipientUserId: linkedId,
          actorUserId: authUser.id,
          type: 'contact_update',
          referenceId: contactId,
          metadata: { contactId, source: 'contact_fact' },
          message: `${ownerName} added a fact about you: ${fact}`,
        }).catch((error) => console.warn('[notification] contact_update insert failed:', error));
      }
    }
  }

  async function deleteContactFact(contactId: string, fact: string) {
    const contact = contacts.find((c) => c.id === contactId);
    const updatedFacts = (contact?.facts ?? []).filter((f) => f !== fact);
    const { error } = await supabase.from('contacts').update({ facts: updatedFacts }).eq('id', contactId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).map((c) => (c.id === contactId ? { ...c, facts: updatedFacts } : c)),
    );
  }

  async function addContactPersonalityTrait(contactId: string, trait: string) {
    const contact = contacts.find((c) => c.id === contactId);
    const normalizedTrait = trait.trim();
    const existingTraits = contact?.personalityTraits ?? [];
    const updatedTraits = existingTraits.some((entry) => entry.toLowerCase() === normalizedTrait.toLowerCase())
      ? existingTraits
      : [...existingTraits, normalizedTrait];
    const { error } = await supabase.from('contacts').update({ personality_traits: updatedTraits }).eq('id', contactId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).map((c) => (c.id === contactId ? { ...c, personalityTraits: updatedTraits } : c)),
    );

    const linkedId = contact?.linkedUserId;
    if (linkedId) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser && linkedId !== authUser.id) {
        const ownerName = users.find((u) => u.id === authUser.id)?.displayName ?? 'Someone';
        createNotification({
          recipientUserId: linkedId,
          actorUserId: authUser.id,
          type: 'contact_update',
          referenceId: contactId,
          metadata: { contactId, source: 'contact_personality_trait' },
          message: `${ownerName} added a personality trait about you: ${normalizedTrait}`,
        }).catch((error) => console.warn('[notification] contact_update insert failed:', error));
      }
    }
  }

  async function deleteContactPersonalityTrait(contactId: string, trait: string) {
    const contact = contacts.find((c) => c.id === contactId);
    const updatedTraits = (contact?.personalityTraits ?? []).filter((entry) => entry !== trait);
    const { error } = await supabase.from('contacts').update({ personality_traits: updatedTraits }).eq('id', contactId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).map((c) => (c.id === contactId ? { ...c, personalityTraits: updatedTraits } : c)),
    );
  }

  async function togglePin(contactId: string) {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    const newPinned = !contact.pinned;
    const pinnedAt = newPinned ? new Date().toISOString() : null;
    const { error } = await supabase.from('contacts').update({ pinned: newPinned, pinned_at: pinnedAt }).eq('id', contactId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).map((c) => (c.id === contactId ? { ...c, pinned: newPinned, pinnedAt } : c)),
    );
  }

  // ── Mutations: Wall Posts ────────────────────────────────────────────
  async function migrateContactPostsToUser(contactId: string, userId: string) {
    const { error } = await supabase
      .from('wall_posts')
      .update({ subject_user_id: userId, subject_contact_id: null, visibility: 'visible_to_subject' })
      .eq('subject_contact_id', contactId);
    if (error) console.warn('Failed to migrate contact posts:', error.message);
    await queryClient.invalidateQueries({ queryKey: socialQueryKeys.wallPosts });
  }

  // Link an existing manual contact card to a real user account via friend code.
  async function linkContactByFriendCode(contactId: string, currentUserId: string, friendCode: string) {
    const code = extractFriendCode(friendCode);
    if (!code) return { ok: false as const, error: 'Enter a friend code.' };

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return { ok: false as const, error: 'Contact not found.' };
    if (contact.ownerUserId !== currentUserId) return { ok: false as const, error: "You don't own this contact." };
    if (contact.linkedUserId) return { ok: false as const, error: 'This contact is already linked.' };

    const { data: profile, error: lookupErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('friend_code', code)
      .single();

    if (lookupErr || !profile) return { ok: false as const, error: 'No one found with that friend code.' };
    if (profile.id === currentUserId) return { ok: false as const, error: "That's your own friend code!" };

    // Make sure no other contact of this owner already links to that user.
    const existingLink = contacts.find((c) => c.ownerUserId === currentUserId && c.linkedUserId === profile.id);
    if (existingLink) return { ok: false as const, error: 'You already have another contact linked to this person.' };

    if (!isConnected(currentUserId, profile.id)) {
      const incoming = friendRequests.find(
        (request) =>
          request.requesterUserId === profile.id &&
          request.recipientUserId === currentUserId &&
          request.status === 'pending',
      );
      if (incoming) {
        const accepted = await acceptFriendRequest(incoming.id, currentUserId);
        if (!accepted.ok) return accepted;
      } else {
        const outgoing = friendRequests.find(
          (request) =>
            request.requesterUserId === currentUserId &&
            request.recipientUserId === profile.id &&
            request.status === 'pending',
        );
        if (outgoing) return { ok: true as const, friend: rowToUser(profile), requested: true };

        const { data: requestRow, error: requestErr } = await supabase
          .from('friend_requests')
          .upsert(
            {
              requester_user_id: currentUserId,
              recipient_user_id: profile.id,
              status: 'pending',
              responded_at: null,
            },
            { onConflict: 'requester_user_id,recipient_user_id' },
          )
          .select()
          .single();
        if (requestErr || !requestRow) return { ok: false as const, error: requestErr?.message ?? 'Could not send friend request.' };

        const request = rowToFriendRequest(requestRow);
        queryClient.setQueryData<FriendRequest[]>(socialQueryKeys.friendRequests, (old) => {
          const existing = old ?? [];
          return [request, ...existing.filter((entry) => entry.id !== request.id)];
        });

        const currentName = users.find((u) => u.id === currentUserId)?.displayName ?? 'Someone';
        createNotification({
          recipientUserId: profile.id,
          actorUserId: currentUserId,
          type: 'friend_request',
          referenceId: request.id,
          metadata: { action: 'requested', friendRequestId: request.id, source: 'friend_requests' },
          message: `${currentName} sent you a friend request`,
        }).catch((error) => console.warn('[notification] friend_request insert failed:', error));

        return { ok: true as const, friend: rowToUser(profile), requested: true };
      }
    }

    // Link the contact to the real user.
    const { error: updErr } = await supabase
      .from('contacts')
      .update({ linked_user_id: profile.id })
      .eq('id', contactId);
    if (updErr) return { ok: false as const, error: updErr.message };

    const friendUser = rowToUser(profile);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).map((c) => (c.id === contactId ? { ...c, linkedUserId: friendUser.id } : c)),
    );
    await migrateContactPostsToUser(contactId, friendUser.id);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.friendships }),
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.users }),
    ]);
    return { ok: true as const, friend: friendUser };
  }

  async function addWallPost(authorUserId: string, input: CreateWallPostInput) {
    const postType = input.postType ?? (input.movie ? 'movie' : input.song ? 'song' : input.voice ? 'voice' : input.imageUri ? 'polaroid' : 'note');
    const { data, error } = await supabase
      .from('wall_posts')
      .insert({
        author_user_id: authorUserId,
        subject_user_id: input.subjectUserId,
        subject_contact_id: input.subjectContactId,
        visibility: input.visibility,
        post_type: postType,
        body: input.body,
        image_path: input.imageUri,
        image_thumb_path: input.imageThumbUri ?? input.imageUri,
        video_path: input.videoUri ?? null,
        video_muted: input.videoMuted ?? false,
        card_color: input.cardColor ?? null,
        back_text: input.backText ?? null,
        filter: postType === 'note'
          ? encodeWallPostTextStyle(input.textFont, input.textSize, input.textEffect, input.textColor)
          : (input.filter ?? null),
        date_stamp: input.dateStamp ?? false,
        memory_date: input.memoryDate ?? null,
        location_name: input.locationName ?? null,
        song_provider: input.song?.provider ?? null,
        song_provider_id: input.song?.providerTrackId ?? null,
        song_title: input.song?.title ?? null,
        song_artist: input.song?.artist ?? null,
        song_artwork_url: input.song?.artworkUrl ?? null,
        song_preview_url: input.song?.previewUrl ?? null,
        song_external_url: input.song?.externalUrl ?? null,
        audio_path: input.voice?.uri ?? null,
        audio_duration_ms: input.voice?.durationMs ?? null,
        movie_tmdb_id: input.movie?.tmdbId ?? null,
        movie_title: input.movie?.title ?? null,
        movie_year: input.movie?.year ?? null,
        movie_poster_url: input.movie?.posterUrl ?? null,
        movie_overview: input.movie?.overview ?? null,
        movie_release_date: input.movie?.releaseDate ?? null,
        movie_vote_average: input.movie?.voteAverage ?? null,
        movie_review_rating: input.movie?.reviewRating ?? null,
        movie_review_request_id: input.movie?.reviewRequestId ?? null,
        memory_prompt_request_id: input.memoryPromptRequestId ?? null,
        referenced_wall_post_id: input.referencedWallPostId ?? null,
        prompt_text: input.promptText ?? null,
        prompt_type: input.promptType ?? null,
        prompt_audio_path: input.promptVoice?.uri ?? null,
        prompt_audio_duration_ms: input.promptVoice?.durationMs ?? null,
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? 'Failed to create memory');

    const post = rowToWallPost(data);
    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) => [post, ...(old ?? [])].sort(compareWallPostsByMemoryDateDesc));

    {
      let recipientId: string | null = input.subjectUserId;
      if (!recipientId && input.subjectContactId) {
        const c = contacts.find((ct) => ct.id === input.subjectContactId);
        recipientId = c?.linkedUserId ?? null;
      }
      const authorName = users.find((u) => u.id === authorUserId)?.displayName ?? 'Someone';
      if (recipientId && recipientId !== authorUserId) {
        createNotification({
          recipientUserId: recipientId,
          actorUserId: authorUserId,
          type: 'wall_post',
          referenceId: post.id,
          metadata: { wallPostId: post.id, postType: post.postType, source: 'wall_post' },
          message: `${authorName} added a ${post.postType === 'song' ? 'song memory' : post.postType === 'voice' ? 'voice memory' : post.postType === 'movie' ? 'movie review' : 'memory'} about you`,
        }).catch((error) => console.warn('[notification] wall_post insert failed:', error));
      }
    }

    return post;
  }

  async function createOfficialBroadcast(input: CreateOfficialBroadcastInput): Promise<OfficialBroadcastResult> {
    if (!currentUser?.isOfficial || !currentUser.isTeamAdmin) {
      throw new Error('Only the official Your Friends admin account can broadcast posts.');
    }

    const body = input.body.trim();
    if (!body && !input.imageUri) throw new Error('Write a message or choose a photo first.');

    const recipients = users
      .filter((user) => user.id !== currentUser.id && !user.isOfficial)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    if (recipients.length === 0) throw new Error('There are no users to send this broadcast to yet.');

    const broadcastId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const uploadedImage = input.imageUri
      ? await uploadMemoryImageVariants(input.imageUri, { prefix: 'official-broadcasts' })
      : null;
    const postType = uploadedImage ? 'polaroid' : 'note';
    const memoryDate = input.memoryDate ?? new Date().toISOString().slice(0, 10);

    const insertedPosts: WallPost[] = [];
    for (const recipientChunk of chunk(recipients, 200)) {
      const { data, error } = await supabase
        .from('wall_posts')
        .insert(
          recipientChunk.map((recipient) => ({
            author_user_id: currentUser.id,
            subject_user_id: recipient.id,
            subject_contact_id: null,
            visibility: 'visible_to_subject',
            post_type: postType,
            body,
            image_path: uploadedImage?.imageUri ?? null,
            image_thumb_path: uploadedImage?.imageThumbUri ?? null,
            video_path: null,
            video_muted: false,
            card_color: input.cardColor ?? null,
            back_text: input.backText ?? null,
            filter: input.filter ?? null,
            date_stamp: input.dateStamp ?? false,
            memory_date: memoryDate,
          })),
        )
        .select();

      if (error || !data) throw new Error(error?.message ?? 'Could not create official broadcast posts.');
      insertedPosts.push(...data.map(rowToWallPost));
    }

    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
      [...insertedPosts, ...(old ?? [])].sort(compareWallPostsByMemoryDateDesc),
    );

    let notificationCount = 0;
    for (const postChunk of chunk(insertedPosts, 200)) {
      const notifications = await createNotifications(
        postChunk
          .filter((post): post is WallPost & { subjectUserId: string } => Boolean(post.subjectUserId))
          .map((post) => ({
            recipientUserId: post.subjectUserId,
            actorUserId: currentUser.id,
            type: 'wall_post',
            referenceId: post.id,
            metadata: {
              wallPostId: post.id,
              postType: post.postType,
              source: 'official_broadcast',
              broadcastId,
            },
            message: 'Your Friends posted a new memory for you',
          })),
      );
      notificationCount += notifications.length;
    }

    return {
      broadcastId,
      recipientCount: recipients.length,
      postCount: insertedPosts.length,
      notificationCount,
    };
  }

  async function createGiftNoteForUser(authorUserId: string, input: CreateGiftNoteInput) {
    if (!isPremium) throw new Error('Gift notes are a Premium feature.');
    const note = await createGiftNote(authorUserId, input);
    queryClient.setQueryData<GiftNote[]>(giftQueryKeys.notes(authorUserId), (old) => [note, ...(old ?? [])]);
    return note;
  }

  async function cancelGiftNoteForUser(noteId: string, authorUserId: string) {
    const note = await cancelGiftNote(noteId, authorUserId);
    queryClient.setQueryData<GiftNote[]>(giftQueryKeys.notes(authorUserId), (old) =>
      (old ?? []).map((entry) => (entry.id === noteId ? note : entry)),
    );
  }

  async function createMovieReviewRequestForUser(requesterUserId: string, input: CreateMovieReviewRequestInput) {
    const request = await createMovieReviewRequest(requesterUserId, input);
    queryClient.setQueryData<MovieReviewRequest[]>(movieQueryKeys.requests, (old) => [request, ...(old ?? [])]);
    return request;
  }

  async function cancelMovieReviewRequestForUser(requestId: string, requesterUserId: string) {
    const request = await cancelMovieReviewRequest(requestId, requesterUserId);
    queryClient.setQueryData<MovieReviewRequest[]>(movieQueryKeys.requests, (old) =>
      (old ?? []).map((entry) => (entry.id === request.id ? request : entry)),
    );
  }

  async function completeMovieReviewRequestForUser(reviewerUserId: string, input: CompleteMovieReviewRequestInput) {
    const pendingRequest = movieReviewRequests.find((entry) => entry.id === input.requestId);
    if (!pendingRequest) throw new Error('Movie request is no longer available.');
    if (isPromptExpired(pendingRequest)) throw new Error('This movie prompt has expired.');
    const { request, wallPost } = await completeMovieReviewRequest(reviewerUserId, input);
    queryClient.setQueryData<MovieReviewRequest[]>(movieQueryKeys.requests, (old) =>
      (old ?? []).map((entry) => (entry.id === request.id ? request : entry)),
    );
    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) => [wallPost, ...(old ?? [])].sort(compareWallPostsByMemoryDateDesc));
  }

  async function createMemoryPromptRequestForUser(requesterUserId: string, input: CreateMemoryPromptRequestInput) {
    if (!isPremium) throw new Error('Sending prompts is a Premium feature.');
    const now = new Date().toISOString();
    const optimisticRequest: MemoryPromptRequest = {
      id: `pending-prompt:${requesterUserId}:${input.recipientUserId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      requesterUserId,
      recipientUserId: input.recipientUserId,
      promptType: input.promptType,
      promptText: input.promptText,
      promptVoice: input.promptVoice ?? null,
      status: 'pending',
      responseBody: null,
      responseSong: null,
      responseVoice: null,
      referencedWallPostId: null,
      completedWallPostId: null,
      createdAt: now,
      expiresAt: getPromptExpiresAt(now),
      updatedAt: now,
      completedAt: null,
    };

    queryClient.setQueryData<MemoryPromptRequest[]>(memoryPromptQueryKeys.requests, (old) => [optimisticRequest, ...(old ?? [])]);

    createPersistedMemoryPromptRequest(requesterUserId, input, optimisticRequest.id).catch((error) => {
      console.warn('[memory prompt] background send failed:', error);
      queryClient.setQueryData<MemoryPromptRequest[]>(memoryPromptQueryKeys.requests, (old) =>
        (old ?? []).filter((entry) => entry.id !== optimisticRequest.id),
      );
    });

    return optimisticRequest;
  }

  async function createPersistedMemoryPromptRequest(requesterUserId: string, input: CreateMemoryPromptRequestInput, optimisticId: string) {
    const uploadedPromptVoice = input.promptVoice
      ? {
        ...input.promptVoice,
        uri: await uploadMemoryAudio(input.promptVoice.uri, { prefix: `${requesterUserId}/voice-prompts` }),
      }
      : null;
    const request = await createMemoryPromptRequest(requesterUserId, { ...input, promptVoice: uploadedPromptVoice });
    queryClient.setQueryData<MemoryPromptRequest[]>(memoryPromptQueryKeys.requests, (old) =>
      (old ?? []).map((entry) => (entry.id === optimisticId ? request : entry)),
    );
    return request;
  }

  async function cancelMemoryPromptRequestForUser(requestId: string, requesterUserId: string) {
    const request = await cancelMemoryPromptRequest(requestId, requesterUserId);
    queryClient.setQueryData<MemoryPromptRequest[]>(memoryPromptQueryKeys.requests, (old) =>
      (old ?? []).map((entry) => (entry.id === request.id ? request : entry)),
    );
  }

  async function createSavedMemoryPromptForUser(ownerUserId: string, input: CreateSavedMemoryPromptInput) {
    const prompt = await createSavedMemoryPrompt(ownerUserId, input);
    queryClient.setQueryData<SavedMemoryPrompt[]>(memoryPromptQueryKeys.savedPrompts(ownerUserId), (old) => {
      const existing = old ?? [];
      return [prompt, ...existing.filter((entry) => entry.id !== prompt.id)];
    });
    return prompt;
  }

  async function deleteSavedMemoryPromptForUser(promptId: string, ownerUserId: string) {
    await deleteSavedMemoryPrompt(promptId, ownerUserId);
    queryClient.setQueryData<SavedMemoryPrompt[]>(memoryPromptQueryKeys.savedPrompts(ownerUserId), (old) =>
      (old ?? []).filter((entry) => entry.id !== promptId),
    );
  }

  async function completeMemoryPromptRequestForUser(reviewerUserId: string, input: CompleteMemoryPromptRequestInput) {
    const pendingRequest = memoryPromptRequests.find((entry) => entry.id === input.requestId);
    if (pendingRequest?.promptType === 'voice' && !isPremium) throw new Error('Voice prompt responses are a Premium feature.');
    if (input.responsePostType === 'media' && !isPremium) throw new Error('Media prompt responses are a Premium feature.');
    if (!pendingRequest) throw new Error('Memory prompt is no longer available.');
    if (isPromptExpired(pendingRequest)) throw new Error('This memory prompt has expired.');
    const now = new Date().toISOString();
    const optimisticWallPost: WallPost = {
      id: `pending-prompt-response:${input.requestId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      authorUserId: reviewerUserId,
      subjectUserId: pendingRequest.requesterUserId,
      subjectContactId: null,
      visibility: 'visible_to_subject',
      postType: pendingRequest.promptType === 'song'
        ? 'song'
        : pendingRequest.promptType === 'voice'
          ? 'voice'
          : pendingRequest.promptType === 'photo'
            ? input.responsePostType ?? 'media'
            : 'note',
      body: input.body?.trim() ?? '',
      imageUri: input.imageUri ?? null,
      imageThumbUri: input.imageUri ?? null,
      videoUri: input.videoUri ?? null,
      videoMuted: input.videoMuted ?? false,
      cardColor: null,
      backText: null,
      filter: null,
      dateStamp: false,
      song: pendingRequest.promptType === 'song' ? input.song ?? null : null,
      voice: input.voice ?? null,
      movie: null,
      memoryPromptRequestId: pendingRequest.id,
      referencedWallPostId: pendingRequest.promptType === 'photo_reference' ? input.referencedWallPostId ?? null : null,
      promptText: pendingRequest.promptText,
      promptType: pendingRequest.promptType,
      promptVoice: pendingRequest.promptVoice ?? null,
      memoryDate: now.slice(0, 10),
      locationName: null,
      createdAt: now,
      syncStatus: 'saving',
      syncError: null,
      pendingMemoryId: null,
    };
    const optimisticRequest: MemoryPromptRequest = {
      ...pendingRequest,
      status: 'completed',
      responseBody: input.body?.trim() || null,
      responseSong: pendingRequest.promptType === 'song' ? input.song ?? null : null,
      responseVoice: input.voice ?? null,
      referencedWallPostId: pendingRequest.promptType === 'photo_reference' ? input.referencedWallPostId ?? null : null,
      completedWallPostId: optimisticWallPost.id,
      updatedAt: now,
      completedAt: now,
    };

    queryClient.setQueryData<MemoryPromptRequest[]>(memoryPromptQueryKeys.requests, (old) =>
      (old ?? []).map((entry) => (entry.id === optimisticRequest.id ? optimisticRequest : entry)),
    );
    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) => [optimisticWallPost, ...(old ?? [])].sort(compareWallPostsByMemoryDateDesc));

    completeMemoryPromptRequest(reviewerUserId, input).then(({ request, wallPost }) => {
      queryClient.setQueryData<MemoryPromptRequest[]>(memoryPromptQueryKeys.requests, (old) =>
        (old ?? []).map((entry) => (entry.id === optimisticRequest.id ? request : entry)),
      );
      queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
        [wallPost, ...(old ?? []).filter((entry) => entry.id !== optimisticWallPost.id)].sort(compareWallPostsByMemoryDateDesc),
      );
    }).catch((error) => {
      console.warn('[memory prompt] background response failed:', error);
      queryClient.setQueryData<MemoryPromptRequest[]>(memoryPromptQueryKeys.requests, (old) =>
        (old ?? []).map((entry) => (entry.id === optimisticRequest.id ? pendingRequest : entry)),
      );
      queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
        (old ?? []).map((entry) => (entry.id === optimisticWallPost.id ? { ...entry, syncStatus: 'failed', syncError: 'Could not save prompt response. Try again.' } : entry)),
      );
    });
  }

  async function deleteWallPost(postId: string) {
    const post = wallPosts.find((p) => p.id === postId);
    if (!currentUser || !post || !canDeleteWallPost(post, currentUser.id)) throw new Error('You can only delete memories you wrote or responses to prompts you sent.');

    const { error } = await supabase.from('wall_posts').delete().eq('id', postId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
      (old ?? []).filter((p) => p.id !== postId),
    );
    queryClient.setQueryData<ProfileWallItem[]>(socialQueryKeys.profileWallItems, (old) =>
      (old ?? []).filter((item) => item.wallPostId !== postId),
    );
  }

  async function addMemoryReply(wallPostId: string, authorUserId: string, body: string, voice?: VoiceAttachment | null) {
    const trimmed = body.trim();
    if (!trimmed && !voice) throw new Error('Write or record a reply first.');
    const post = wallPosts.find((entry) => entry.id === wallPostId);
    if (!post) throw new Error('Memory not found.');

    const { data, error } = await supabase
      .from('memory_replies')
      .insert({
        wall_post_id: wallPostId,
        author_user_id: authorUserId,
        body: trimmed.slice(0, 500),
        audio_path: voice?.uri ?? null,
        audio_duration_ms: voice?.durationMs ?? null,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Could not add reply.');

    const reply = rowToMemoryReply(data);
    queryClient.setQueryData<MemoryReply[]>(socialQueryKeys.memoryReplies, (old) =>
      [...(old ?? []), reply].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    );

    if (post.authorUserId !== authorUserId) {
      const authorName = users.find((user) => user.id === authorUserId)?.displayName ?? 'Someone';
      createNotification({
        recipientUserId: post.authorUserId,
        actorUserId: authorUserId,
        type: 'memory_reply',
        referenceId: wallPostId,
        message: `${authorName} replied to your memory`,
        metadata: {
          memoryReplyId: reply.id,
          wallPostId,
          source: 'memory_reply',
        },
      }).catch((error) => console.warn('[notification] memory reply insert failed:', error));
    }

    return reply;
  }

  async function deleteMemoryReply(replyId: string, authorUserId: string) {
    const { error } = await supabase
      .from('memory_replies')
      .delete()
      .eq('id', replyId)
      .eq('author_user_id', authorUserId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<MemoryReply[]>(socialQueryKeys.memoryReplies, (old) =>
      (old ?? []).filter((reply) => reply.id !== replyId),
    );
  }

  async function addPostToProfileWall(ownerUserId: string, wallPostId: string, options?: { repliesHidden?: boolean }) {
    const post = wallPosts.find((entry) => entry.id === wallPostId);
    if (!post) return { ok: false as const, error: 'Memory not found.' };
    if (isPostOnProfileWall(ownerUserId, wallPostId)) return { ok: true as const };

    const { data, error } = await supabase
      .from('profile_wall_items')
      .upsert(
        { owner_user_id: ownerUserId, wall_post_id: wallPostId, replies_hidden: options?.repliesHidden ?? false },
        { onConflict: 'owner_user_id,wall_post_id' },
      )
      .select()
      .single();
    if (error || !data) return { ok: false as const, error: error?.message ?? 'Could not add this memory to your profile.' };

    const item = rowToProfileWallItem(data);
    queryClient.setQueryData<ProfileWallItem[]>(socialQueryKeys.profileWallItems, (old) => {
      const existing = old ?? [];
      return [item, ...existing.filter((entry) => entry.id !== item.id && !(entry.ownerUserId === ownerUserId && entry.wallPostId === wallPostId))];
    });
    return { ok: true as const };
  }

  async function removePostFromProfileWall(ownerUserId: string, wallPostId: string) {
    const { error } = await supabase
      .from('profile_wall_items')
      .delete()
      .eq('owner_user_id', ownerUserId)
      .eq('wall_post_id', wallPostId);
    if (error) return { ok: false as const, error: error.message };

    queryClient.setQueryData<ProfileWallItem[]>(socialQueryKeys.profileWallItems, (old) =>
      (old ?? []).filter((item) => !(item.ownerUserId === ownerUserId && item.wallPostId === wallPostId)),
    );
    return { ok: true as const };
  }

  async function setProfileWallRepliesHidden(ownerUserId: string, wallPostId: string, repliesHidden: boolean) {
    const { error } = await supabase
      .from('profile_wall_items')
      .update({ replies_hidden: repliesHidden })
      .eq('owner_user_id', ownerUserId)
      .eq('wall_post_id', wallPostId);
    if (error) return { ok: false as const, error: error.message };

    queryClient.setQueryData<ProfileWallItem[]>(socialQueryKeys.profileWallItems, (old) =>
      (old ?? []).map((entry) =>
        entry.ownerUserId === ownerUserId && entry.wallPostId === wallPostId
          ? { ...entry, repliesHidden }
          : entry,
      ),
    );
    return { ok: true as const };
  }

  async function saveWallPostLayout(input: SaveWallPostLayoutInput) {
    try {
      const layout = await upsertWallPostLayout(input);
      queryClient.setQueryData<WallPostLayout[]>(socialQueryKeys.wallPostLayouts, (old) => {
        const existing = old ?? [];
        return [
          layout,
          ...existing.filter((entry) =>
            entry.id !== layout.id &&
            !(
              entry.ownerUserId === input.ownerUserId &&
              entry.wallContext === input.wallContext &&
              entry.wallContextId === input.wallContextId &&
              entry.wallPostId === input.wallPostId
            ),
          ),
        ];
      });
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : 'Could not save board layout.' };
    }
  }

  async function resetWallPostLayout(ownerUserId: string, wallContext: WallPostLayoutContext, wallContextId: string, wallPostId: string) {
    try {
      await deleteWallPostLayout({ ownerUserId, wallContext, wallContextId, wallPostId });
      queryClient.setQueryData<WallPostLayout[]>(socialQueryKeys.wallPostLayouts, (old) =>
        (old ?? []).filter((entry) =>
          !(
            entry.ownerUserId === ownerUserId &&
            entry.wallContext === wallContext &&
            entry.wallContextId === wallContextId &&
            entry.wallPostId === wallPostId
          ),
        ),
      );
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : 'Could not reset board layout.' };
    }
  }

  async function updateWallPost(postId: string, body: string, newLocalImageUri?: string | null, cardColor?: string | null, backText?: string | null, filter?: string | null, visibility?: WallPostVisibility, song?: SongAttachment | null, videoMuted?: boolean, locationName?: string | null, voice?: VoiceAttachment | null, memoryDate?: string | null) {
    const post = wallPosts.find((p) => p.id === postId);
    if (!currentUser || !post || !canEditWallPostContent(post, currentUser.id)) throw new Error('You can only edit your own memories.');

    const updates: PendingMemoryEditUpdates = {
      body,
      hasImageChange: newLocalImageUri !== undefined,
      imageUri: newLocalImageUri ?? null,
      hasVoiceChange: voice !== undefined,
      voice,
    };
    if (visibility !== undefined) updates.visibility = visibility;
    if (backText !== undefined) updates.backText = backText;
    if (cardColor !== undefined) updates.cardColor = cardColor;
    if (filter !== undefined) updates.filter = filter;
    if (song !== undefined) updates.song = song;
    if (videoMuted !== undefined) updates.videoMuted = videoMuted;
    if (locationName !== undefined) updates.locationName = locationName;
    if (memoryDate !== undefined) updates.memoryDate = memoryDate;

    const pendingEdit = await createPendingMemoryEdit({
      postId,
      authorUserId: currentUser.id,
      updates,
    });
    applyPendingMemoryEditsToCache(queryClient, [pendingEdit]);
    syncPendingMemoryEditToCache(queryClient, pendingEdit).catch((error) => console.warn('[pending memory edits] immediate sync failed:', error));
  }

  // ── Mutations: Friend Facts ──────────────────────────────────────────
  async function addFriendFact(authorUserId: string, input: CreateFriendFactInput) {
    const { data, error } = await supabase
      .from('friend_facts')
      .insert({ author_user_id: authorUserId, subject_user_id: input.subjectUserId, body: input.body })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Failed to create fact');
    const fact = rowToFriendFact(data);
    queryClient.setQueryData<FriendFact[]>(socialQueryKeys.friendFacts, (old) => [fact, ...(old ?? [])]);
    return fact;
  }

  async function deleteFriendFact(factId: string) {
    const { error } = await supabase.from('friend_facts').delete().eq('id', factId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<FriendFact[]>(socialQueryKeys.friendFacts, (old) =>
      (old ?? []).filter((f) => f.id !== factId),
    );
  }

  // ── Mutations: Notifications ─────────────────────────────────────────
  async function markNotificationRead(notificationId: string) {
    if (notificationId.includes(':')) return;
    queryClient.setQueryData<Notification[]>(socialQueryKeys.notifications, (old) =>
      (old ?? []).map((n) => n.id === notificationId ? { ...n, read: true } : n),
    );
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
    if (error) {
      console.warn('[notifications] mark read failed:', error);
    }
  }

  async function markAllNotificationsRead() {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    queryClient.setQueryData<Notification[]>(socialQueryKeys.notifications, (old) =>
      (old ?? []).map((n) => ({ ...n, read: true })),
    );
    const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false);
    if (error) {
      console.warn('[notifications] mark all read failed:', error);
    }
  }

  function getCalendarEventReactionSummary(eventId: string): CalendarEventReactionSummary {
    const eventReactions = calendarEventReactions.filter((reaction) => reaction.eventId === eventId);
    return {
      eventId,
      upCount: eventReactions.filter((reaction) => reaction.value === 'up').length,
      downCount: eventReactions.filter((reaction) => reaction.value === 'down').length,
      myReaction: eventReactions.find((reaction) => reaction.userId === currentUser?.id)?.value ?? null,
    };
  }

  function getCalendarEventReactionParticipantNames(eventId: string): { up: string[]; down: string[] } {
    const labelFor = (userId: string) => {
      const name = getUserById(userId)?.displayName?.trim();
      return name && name.length > 0 ? name : 'Someone';
    };
    const namesFor = (value: CalendarEventReactionValue) =>
      calendarEventReactions
        .filter((reaction) => reaction.eventId === eventId && reaction.value === value)
        .map((reaction) => labelFor(reaction.userId))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return { up: namesFor('up'), down: namesFor('down') };
  }

  async function setCalendarEventReactionByEvent(
    eventId: string,
    value: CalendarEventReactionValue | null,
    options: {
      notificationId?: string | null;
      eventOwnerUserId?: string | null;
      eventDate?: string | null;
      eventTitle?: string | null;
    } = {},
  ) {
    if (!currentUser) throw new Error('Sign in to react to calendar events.');
    if (value === null) {
      await deleteCalendarEventReaction(eventId, currentUser.id);
      queryClient.setQueryData<CalendarEventReaction[]>(socialQueryKeys.calendarEventReactions, (old) =>
        (old ?? []).filter((reaction) => !(reaction.eventId === eventId && reaction.userId === currentUser.id)),
      );
      return;
    }

    let reaction: CalendarEventReaction;
    try {
      reaction = await upsertCalendarEventReaction({
        eventId,
        userId: currentUser.id,
        notificationId: options.notificationId ?? null,
        value,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save reaction.';
      if (/row-level security|violates row-level security/i.test(message)) {
        throw new Error('Supabase blocked this calendar reaction. Apply the calendar_event_reactions RLS policy update.');
      }
      throw error;
    }
    queryClient.setQueryData<CalendarEventReaction[]>(socialQueryKeys.calendarEventReactions, (old) => {
      const existing = old ?? [];
      return [reaction, ...existing.filter((entry) => entry.id !== reaction.id)];
    });

    const eventOwnerUserId = options.eventOwnerUserId ?? null;
    if (eventOwnerUserId && eventOwnerUserId !== currentUser.id) {
      const reactorName = currentUser.displayName || 'Someone';
      const reactionWord = value === 'up' ? 'thumbs up' : 'thumbs down';
      const rawTitle = options.eventTitle?.trim();
      const message = rawTitle
        ? `${reactorName} gave a ${reactionWord} to "${rawTitle}"`
        : `${reactorName} gave a ${reactionWord} to your calendar event`;
      await createNotification({
        recipientUserId: eventOwnerUserId,
        actorUserId: currentUser.id,
        type: 'calendar_event_reaction',
        referenceId: eventId,
        message,
        metadata: {
          eventId,
          eventTitle: rawTitle || undefined,
          date: options.eventDate ?? undefined,
          notificationId: options.notificationId ?? undefined,
          reactionValue: value,
          source: 'calendar_event_reaction',
        },
      }).catch((error) => console.warn('[notification] calendar_event_reaction insert failed:', error));
    }
  }

  async function setCalendarEventReaction(notification: Notification, value: CalendarEventReactionValue | null) {
    if (notification.type !== 'calendar_event') throw new Error('You can only react to calendar event notifications.');
    const eventId = getNotificationEventId(notification);
    if (!eventId) throw new Error('This notification is missing its event.');
    const ownerFromMeta =
      typeof notification.metadata.ownerUserId === 'string' && notification.metadata.ownerUserId.length > 0
        ? notification.metadata.ownerUserId
        : null;
    const eventTitle =
      typeof notification.metadata.eventTitle === 'string' && notification.metadata.eventTitle.trim().length > 0
        ? notification.metadata.eventTitle.trim()
        : null;
    await setCalendarEventReactionByEvent(eventId, value, {
      notificationId: notification.id,
      eventOwnerUserId: ownerFromMeta ?? notification.actorUserId,
      eventDate: typeof notification.metadata.date === 'string' ? notification.metadata.date : null,
      eventTitle,
    });
  }

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: giftQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: movieQueryKeys.requests }),
      queryClient.invalidateQueries({ queryKey: memoryPromptQueryKeys.requests }),
      currentUser?.id ? queryClient.invalidateQueries({ queryKey: memoryPromptQueryKeys.savedPrompts(currentUser.id) }) : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.memoryReplies }),
    ]);
  }, [currentUser?.id, queryClient]);

  // ── Provider ─────────────────────────────────────────────────────────
  return (
    <SocialGraphContext.Provider
      value={{
        loading,
        contacts,
        friendRequests,
        wallPosts,
        memoryReplies,
        profileWallItems,
        wallPostLayouts,
        privateNotes,
        privateNoteBlocks,
        giftNotes,
        movieReviewRequests,
        memoryPromptRequests,
        savedMemoryPrompts,
        addFriendByCode,
        getIncomingFriendRequests,
        getOutgoingFriendRequests,
        acceptFriendRequest,
        declineFriendRequest,
        linkContactToFriend,
        createLinkedContactForFriend,
        getManualContactCandidatesForFriend,
        getPendingFriendLinks,
        repairObviousFriendLinks,
        unlinkContactFromFriend,
        moveContactLink,
        removeFriend,
        deleteContact,
        addManualContact,
        addWallPost,
        createOfficialBroadcast,
        createGiftNote: createGiftNoteForUser,
        cancelGiftNote: cancelGiftNoteForUser,
        getGiftNotesForPair,
        createMovieReviewRequest: createMovieReviewRequestForUser,
        cancelMovieReviewRequest: cancelMovieReviewRequestForUser,
        completeMovieReviewRequest: completeMovieReviewRequestForUser,
        getMovieReviewRequestsForPair,
        getMovieReviewRequestById,
        createMemoryPromptRequest: createMemoryPromptRequestForUser,
        cancelMemoryPromptRequest: cancelMemoryPromptRequestForUser,
        completeMemoryPromptRequest: completeMemoryPromptRequestForUser,
        getMemoryPromptRequestsForPair,
        getMemoryPromptRequestById,
        createSavedMemoryPrompt: createSavedMemoryPromptForUser,
        deleteSavedMemoryPrompt: deleteSavedMemoryPromptForUser,
        getPrivateNotesForContact,
        getPrivateNoteById,
        getPrivateNoteBlocks,
        createPrivateNote,
        updatePrivateNote,
        deletePrivateNote,
        addPrivateNoteBlock,
        updatePrivateNoteBlock,
        deletePrivateNoteBlock,
        getContactById,
        getDirectFriends,
        getPeopleListForUser,
        getUserById,
        getWallPostsForSubject,
        getWallPostById,
        getRepliesForWallPost,
        getReplyCountForWallPost,
        addMemoryReply,
        deleteMemoryReply,
        getProfileWallItemsForUser,
        getWallPostLayoutsForContext,
        saveWallPostLayout,
        resetWallPostLayout,
        isPostOnProfileWall,
        addPostToProfileWall,
        removePostFromProfileWall,
        setProfileWallRepliesHidden,
        getVisiblePostsByAuthor,
        getContactAboutMe,
        isConnected,
        addFriendFact,
        deleteFriendFact,
        getFriendFactsFor,
        deleteWallPost,
        updateWallPost,
        updateContact,
        addContactFact,
        deleteContactFact,
        addContactPersonalityTrait,
        deleteContactPersonalityTrait,
        migrateContactPostsToUser,
        linkContactByFriendCode,
        togglePin,
        notifications,
        unreadCount,
        calendarEventReactions,
        getCalendarEventReactionSummary,
        getCalendarEventReactionParticipantNames,
        setCalendarEventReactionByEvent,
        setCalendarEventReaction,
        markNotificationRead,
        markAllNotificationsRead,
        refresh,
      }}
    >
      {children}
    </SocialGraphContext.Provider>
  );
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function useSocialGraph() {
  const context = useContext(SocialGraphContext);
  if (!context) {
    throw new Error('useSocialGraph must be used inside SocialGraphProvider.');
  }
  return context;
}

function getNotificationEventId(notification: Notification) {
  if (typeof notification.metadata.eventId === 'string') return notification.metadata.eventId;
  return notification.referenceId;
}

function mergeSyntheticNotifications(
  persistedNotifications: Notification[],
  friendRequests: FriendRequest[],
  wallPosts: WallPost[],
  movieReviewRequests: MovieReviewRequest[],
  memoryPromptRequests: MemoryPromptRequest[],
  users: AppUser[],
  currentUserId: string | null,
  syntheticNotificationReadIds: Set<string>,
): Notification[] {
  if (!currentUserId) return persistedNotifications;

  const syntheticNotifications: Notification[] = [];
  for (const request of friendRequests) {
    if (request.recipientUserId === currentUserId && request.status === 'pending') {
      if (hasFriendRequestNotification(persistedNotifications, request.id, 'requested')) continue;
      const requester = users.find((user) => user.id === request.requesterUserId);
      const id = `friend-request-fallback:requested:${request.id}`;
      syntheticNotifications.push({
        id,
        recipientUserId: currentUserId,
        actorUserId: request.requesterUserId,
        type: 'friend_request',
        referenceId: request.id,
        metadata: { action: 'requested', friendRequestId: request.id, source: 'friend_requests' },
        message: `${requester?.displayName ?? 'Someone'} sent you a friend request`,
        read: syntheticNotificationReadIds.has(id),
        createdAt: request.createdAt,
      });
    }

    if (request.requesterUserId === currentUserId && request.status === 'accepted') {
      if (hasFriendRequestNotification(persistedNotifications, request.id, 'accepted')) continue;
      const recipient = users.find((user) => user.id === request.recipientUserId);
      const id = `friend-request-fallback:accepted:${request.id}`;
      syntheticNotifications.push({
        id,
        recipientUserId: currentUserId,
        actorUserId: request.recipientUserId,
        type: 'friend_request',
        referenceId: request.id,
        metadata: { action: 'accepted', friendRequestId: request.id, source: 'friend_requests' },
        message: `${recipient?.displayName ?? 'Someone'} accepted your friend request`,
        read: syntheticNotificationReadIds.has(id),
        createdAt: request.respondedAt ?? request.createdAt,
      });
    }
  }

  for (const post of wallPosts) {
    if (post.subjectUserId !== currentUserId || post.authorUserId === currentUserId) continue;
    if (hasWallPostNotification(persistedNotifications, post.id)) continue;
    const author = users.find((user) => user.id === post.authorUserId);
    const id = `wall-post-fallback:${post.id}`;
    syntheticNotifications.push({
      id,
      recipientUserId: currentUserId,
      actorUserId: post.authorUserId,
      type: 'wall_post',
      referenceId: post.id,
      metadata: { wallPostId: post.id, postType: post.postType, source: 'wall_post' },
      message: `${author?.displayName ?? 'Someone'} added a ${post.postType === 'song' ? 'song memory' : post.postType === 'voice' ? 'voice memory' : post.postType === 'movie' ? 'movie review' : 'memory'} about you`,
      read: syntheticNotificationReadIds.has(id),
      createdAt: post.createdAt,
    });
  }

  for (const request of movieReviewRequests) {
    if (request.recipientUserId !== currentUserId || request.status !== 'pending') continue;
    if (hasMovieReviewRequestNotification(persistedNotifications, request.id)) continue;
    const requester = users.find((user) => user.id === request.requesterUserId);
    const id = `movie-review-request-fallback:${request.id}`;
    syntheticNotifications.push({
      id,
      recipientUserId: currentUserId,
      actorUserId: request.requesterUserId,
      type: 'movie_review_request',
      referenceId: request.id,
      metadata: { movieReviewRequestId: request.id, source: 'movie_review_request' },
      message: `${requester?.displayName ?? 'Someone'} wants your take on ${request.movie.title}`,
      read: syntheticNotificationReadIds.has(id),
      createdAt: request.createdAt,
    });
  }

  for (const request of memoryPromptRequests) {
    if (request.recipientUserId !== currentUserId || request.status !== 'pending') continue;
    if (hasMemoryPromptRequestNotification(persistedNotifications, request.id)) continue;
    const requester = users.find((user) => user.id === request.requesterUserId);
    const id = `memory-prompt-request-fallback:${request.id}`;
    syntheticNotifications.push({
      id,
      recipientUserId: currentUserId,
      actorUserId: request.requesterUserId,
      type: 'memory_prompt_request',
      referenceId: request.id,
      metadata: { memoryPromptRequestId: request.id, promptType: request.promptType, source: 'memory_prompt_request' },
      message: `${requester?.displayName ?? 'Someone'} sent you a memory prompt`,
      read: syntheticNotificationReadIds.has(id),
      createdAt: request.createdAt,
    });
  }

  return [...persistedNotifications, ...syntheticNotifications].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function hasWallPostNotification(notifications: Notification[], postId: string) {
  return notifications.some((notification) => {
    if (notification.type !== 'wall_post') return false;
    const notificationPostId = typeof notification.metadata.wallPostId === 'string'
      ? notification.metadata.wallPostId
      : notification.referenceId;
    return notificationPostId === postId;
  });
}

function hasMovieReviewRequestNotification(notifications: Notification[], requestId: string) {
  return notifications.some((notification) => {
    if (notification.type !== 'movie_review_request') return false;
    const notificationRequestId = typeof notification.metadata.movieReviewRequestId === 'string'
      ? notification.metadata.movieReviewRequestId
      : notification.referenceId;
    return notificationRequestId === requestId;
  });
}

function hasMemoryPromptRequestNotification(notifications: Notification[], requestId: string) {
  return notifications.some((notification) => {
    if (notification.type !== 'memory_prompt_request') return false;
    const notificationRequestId = typeof notification.metadata.memoryPromptRequestId === 'string'
      ? notification.metadata.memoryPromptRequestId
      : notification.referenceId;
    return notificationRequestId === requestId;
  });
}

function hasFriendRequestNotification(notifications: Notification[], requestId: string, action: 'requested' | 'accepted') {
  return notifications.some((notification) => {
    if (notification.type !== 'friend_request') return false;
    const notificationRequestId = typeof notification.metadata.friendRequestId === 'string'
      ? notification.metadata.friendRequestId
      : notification.referenceId;
    return notificationRequestId === requestId && notification.metadata.action === action;
  });
}

// Return the leading first-name token from a display name, lowercased and
// stripped of trailing punctuation. Used to identify ambiguous duplicate
// candidates (e.g. "Steven", "Steven P.", "Steven from work" all share
// the token "steven").
function firstNameToken(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return '';
  const first = trimmed.split(/\s+/)[0] ?? '';
  return first.replace(/[^a-z0-9']/g, '');
}

// Return the unlinked manual contacts whose name shares the same first-name
// token as the friend's display name. We never auto-merge by name; this list
// is what the chooser UI shows the user when they connect with a real account.
function findManualContactCandidates(ownerContacts: Contact[], friendDisplayName: string): Contact[] {
  const target = firstNameToken(friendDisplayName);
  if (!target) return [];
  return ownerContacts.filter(
    (c) => !c.linkedUserId && firstNameToken(c.displayName) === target,
  );
}

