import { useQuery, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

import { useAuth } from '../auth/AuthContext';
import { compressImage } from '../../lib/compressImage';
import { extractFriendCode } from '../../lib/friendCode';
import { supabase } from '../../lib/supabase';
import { splitWallPostPresentation } from '../../lib/wallPostTextStyle';
import { accentPalette } from '../../theme/tokens';
import {
  AppUser,
  Contact,
  ContactPrivateNote,
  ContactPrivateNoteBlock,
  CreateContactPrivateNoteBlockInput,
  CreateContactPrivateNoteInput,
  CreateContactInput,
  CreateFriendFactInput,
  UpdateContactPrivateNoteBlockInput,
  UpdateContactPrivateNoteInput,
  CreateWallPostInput,
  FriendFact,
  Friendship,
  Notification,
  PeopleListItem,
  WallPost,
  WallPostVisibility,
} from '../../types/domain';
import { rowToContact, rowToContactPrivateNote, rowToContactPrivateNoteBlock, rowToFriendship, rowToUser, rowToWallPost, rowToFriendFact } from './mappers';
import {
  socialQueryKeys,
  fetchUsers,
  fetchContacts,
  fetchFriendships,
  fetchWallPosts,
  fetchPrivateNotes,
  fetchPrivateNoteBlocks,
  fetchFriendFacts,
  fetchNotifications,
} from './queries';

// Re-export so existing imports keep working.
export { socialQueryKeys } from './queries';

// Describe an unresolved friendship that is awaiting the user's choice between
// linking an existing manual contact or creating a new linked contact.
export interface PendingFriendLink {
  friend: AppUser;
  candidates: Contact[];
}

interface SocialGraphContextValue {
  loading: boolean;
  contacts: Contact[];
  wallPosts: WallPost[];
  privateNotes: ContactPrivateNote[];
  privateNoteBlocks: ContactPrivateNoteBlock[];
  addFriendByCode: (currentUserId: string, friendCode: string) => Promise<
    | { ok: true; friend: AppUser; contactId: string | null; candidateContactIds: string[] }
    | { ok: false; error: string }
  >;
  linkContactToFriend: (contactId: string, currentUserId: string, friendUserId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  createLinkedContactForFriend: (currentUserId: string, friendUserId: string) => Promise<{ ok: true; contactId: string } | { ok: false; error: string }>;
  getManualContactCandidatesForFriend: (currentUserId: string, friendUserId: string) => Contact[];
  getPendingFriendLinks: (currentUserId: string) => PendingFriendLink[];
  removeFriend: (currentUserId: string, friendUserId: string) => Promise<void>;
  deleteContact: (currentUserId: string, contactId: string) => Promise<void>;
  addManualContact: (ownerUserId: string, input: CreateContactInput) => Promise<Contact>;
  addWallPost: (authorUserId: string, input: CreateWallPostInput) => Promise<WallPost>;
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
  getVisiblePostsByAuthor: (authorId: string) => WallPost[];
  getContactAboutMe: (ownerUserId: string, myUserId: string) => Contact | undefined;
  isConnected: (leftUserId: string, rightUserId: string) => boolean;
  addFriendFact: (authorUserId: string, input: CreateFriendFactInput) => Promise<FriendFact>;
  deleteFriendFact: (factId: string) => Promise<void>;
  getFriendFactsFor: (authorUserId: string, subjectUserId: string) => FriendFact[];
  deleteWallPost: (postId: string) => Promise<void>;
  updateWallPost: (postId: string, body: string, newLocalImageUri?: string | null, cardColor?: string | null, backText?: string | null, filter?: string | null, visibility?: WallPostVisibility) => Promise<void>;
  updateContact: (contactId: string, updates: { displayName?: string; avatarLocalUri?: string | null; tags?: string[]; linkedUserId?: string | null }) => Promise<void>;
  addContactFact: (contactId: string, fact: string) => Promise<void>;
  deleteContactFact: (contactId: string, fact: string) => Promise<void>;
  migrateContactPostsToUser: (contactId: string, userId: string) => Promise<void>;
  linkContactByFriendCode: (contactId: string, currentUserId: string, friendCode: string) => Promise<{ ok: true; friend: AppUser } | { ok: false; error: string }>;
  togglePin: (contactId: string) => Promise<void>;
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SocialGraphContext = createContext<SocialGraphContextValue | null>(null);

export function SocialGraphProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const socialEnabled = Boolean(currentUser?.id);

  // ── Queries ──────────────────────────────────────────────────────────
  const usersQuery = useQuery({ queryKey: socialQueryKeys.users, queryFn: fetchUsers, enabled: socialEnabled });
  const contactsQuery = useQuery({ queryKey: socialQueryKeys.contacts, queryFn: fetchContacts, enabled: socialEnabled });
  const friendshipsQuery = useQuery({ queryKey: socialQueryKeys.friendships, queryFn: fetchFriendships, enabled: socialEnabled });
  const wallPostsQuery = useQuery({ queryKey: socialQueryKeys.wallPosts, queryFn: fetchWallPosts, enabled: socialEnabled });
  const privateNotesQuery = useQuery({ queryKey: socialQueryKeys.privateNotes, queryFn: fetchPrivateNotes, enabled: socialEnabled });
  const privateNoteBlocksQuery = useQuery({ queryKey: socialQueryKeys.privateNoteBlocks, queryFn: fetchPrivateNoteBlocks, enabled: socialEnabled });
  const friendFactsQuery = useQuery({ queryKey: socialQueryKeys.friendFacts, queryFn: fetchFriendFacts, enabled: socialEnabled });
  const notificationsQuery = useQuery({ queryKey: socialQueryKeys.notifications, queryFn: fetchNotifications, enabled: socialEnabled });

  const users = usersQuery.data ?? [];
  const contacts = contactsQuery.data ?? [];
  const friendships = friendshipsQuery.data ?? [];
  const wallPosts = wallPostsQuery.data ?? [];
  const privateNotes = privateNotesQuery.data ?? [];
  const privateNoteBlocks = privateNoteBlocksQuery.data ?? [];
  const friendFacts = friendFactsQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const loading = usersQuery.isPending || contactsQuery.isPending || friendshipsQuery.isPending;
  const hasSettledInitialData = socialEnabled
    && usersQuery.isFetched
    && contactsQuery.isFetched
    && friendshipsQuery.isFetched
    && wallPostsQuery.isFetched
    && privateNotesQuery.isFetched
    && privateNoteBlocksQuery.isFetched
    && friendFactsQuery.isFetched
    && notificationsQuery.isFetched;

  // ── Effects ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socialEnabled) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.all });
    });
    return () => subscription.unsubscribe();
  }, [queryClient, socialEnabled]);

  useEffect(() => {
    if (!hasSettledInitialData) return;

    const channel = supabase
      .channel('social-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wall_posts' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.wallPosts });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_private_notes' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.privateNotes });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_private_note_blocks' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.privateNoteBlocks });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.contacts });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.notifications });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.friendships });
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.users });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hasSettledInitialData, queryClient]);

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

      const staleLinkedContacts = myContacts.filter(
        (contact) => contact.linkedUserId && !myFriendIdSet.has(contact.linkedUserId),
      );
      if (staleLinkedContacts.length) {
        const staleIds = staleLinkedContacts.map((contact) => contact.id);
        const { error: unlinkErr } = await supabase
          .from('contacts')
          .update({ linked_user_id: null })
          .in('id', staleIds);
        if (unlinkErr) {
          console.warn('Failed to unlink stale contacts:', unlinkErr.message);
        } else {
          queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
            (old ?? []).map((contact) =>
              staleIds.includes(contact.id) ? { ...contact, linkedUserId: null } : contact,
            ),
          );
        }
      }
    })();
  }, [socialEnabled, usersQuery.isSuccess, contactsQuery.isSuccess, friendshipsQuery.isSuccess, users, contacts, friendships, queryClient]);

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

  function getPeopleListForUser(userId: string) {
    const friendItems: PeopleListItem[] = getDirectFriends(userId).map((friend) => ({
      id: friend.id,
      entityType: 'user',
      createdAt:
        friendships.find(
          (f) =>
            (f.userLowId === userId && f.userHighId === friend.id) ||
            (f.userHighId === userId && f.userLowId === friend.id),
        )?.createdAt ?? friend.createdAt,
      title: friend.displayName,
      subtitle: `Friend code ${friend.friendCode}`,
      caption: '',
      avatarColor: friend.avatarColor,
      imageUri: friend.avatarPath ?? null,
      tags: [],
    }));

    const contactItems: PeopleListItem[] = contacts
      .filter((contact) => contact.ownerUserId === userId)
      .map((contact) => {
        const linkedFriend = contact.linkedUserId ? users.find((u) => u.id === contact.linkedUserId) : undefined;
        return {
          id: contact.id,
          entityType: 'contact' as const,
          createdAt: contact.createdAt,
          title: contact.displayName,
          subtitle: contact.nickname ? `Saved as ${contact.nickname}` : '',
          caption: '',
          avatarColor: getContactAccent(contact.id),
          // Prefer the contact's own saved avatar; fall back to the linked
          // friend's real profile picture so connected contacts always show
          // a real photo even when the contact row was saved blank.
          imageUri: contact.avatarPath ?? linkedFriend?.avatarPath ?? null,
          tags: contact.tags ?? [],
          note: contact.note ?? null,
          cardColor: contact.cardColor ?? null,
          linkedUserId: contact.linkedUserId,
          pinned: contact.pinned,
          pinnedAt: contact.pinnedAt,
        };
      });

    const linkedUserIds = new Set(
      contacts.filter((c) => c.ownerUserId === userId && c.linkedUserId).map((c) => c.linkedUserId!),
    );

    return [...friendItems.filter((f) => !linkedUserIds.has(f.id)), ...contactItems].sort(
      (a, b) => {
        const pinA = a.pinned ? 1 : 0;
        const pinB = b.pinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
        if (pinA && pinB) {
          const pinnedAtA = a.pinnedAt ?? a.createdAt;
          const pinnedAtB = b.pinnedAt ?? b.createdAt;
          const pinOrder = pinnedAtA.localeCompare(pinnedAtB);
          if (pinOrder !== 0) return pinOrder;
        }
        return b.createdAt.localeCompare(a.createdAt);
      },
    );
  }

  // ── Wall post reads ──────────────────────────────────────────────────
  function getWallPostsForSubject(subjectId: string, subjectType: 'user' | 'contact') {
    return wallPosts
      .filter((post) => {
        if (subjectType === 'user') return post.subjectUserId === subjectId;
        return post.subjectContactId === subjectId;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function getVisiblePostsByAuthor(authorId: string) {
    return wallPosts
      .filter((p) => p.authorUserId === authorId && p.visibility === 'visible_to_subject')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function getWallPostById(postId: string) {
    return wallPosts.find((p) => p.id === postId);
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

  async function touchPrivateNote(noteId: string, updatedAt = new Date().toISOString()) {
    const { error } = await supabase
      .from('contact_private_notes')
      .update({ updated_at: updatedAt })
      .eq('id', noteId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<ContactPrivateNote[]>(socialQueryKeys.privateNotes, (old) =>
      (old ?? []).map((note) => (note.id === noteId ? { ...note, updatedAt } : note)),
    );
  }

  async function createPrivateNote(ownerUserId: string, contactId: string, input: CreateContactPrivateNoteInput = {}) {
    const title = input.title?.trim() || 'Untitled note';
    const { data, error } = await supabase
      .from('contact_private_notes')
      .insert({ owner_user_id: ownerUserId, contact_id: contactId, title })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Failed to create note');

    const note = rowToContactPrivateNote(data);
    queryClient.setQueryData<ContactPrivateNote[]>(socialQueryKeys.privateNotes, (old) => [note, ...(old ?? [])]);
    return note;
  }

  async function updatePrivateNote(noteId: string, updates: UpdateContactPrivateNoteInput) {
    const dbUpdate: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdate.title = updates.title.trim() || 'Untitled note';
    if (Object.keys(dbUpdate).length === 0) return;

    const updatedAt = new Date().toISOString();
    dbUpdate.updated_at = updatedAt;
    const { error } = await supabase.from('contact_private_notes').update(dbUpdate).eq('id', noteId);
    if (error) throw new Error(error.message);

    queryClient.setQueryData<ContactPrivateNote[]>(socialQueryKeys.privateNotes, (old) =>
      (old ?? []).map((note) => {
        if (note.id !== noteId) return note;
        return {
          ...note,
          title: typeof dbUpdate.title === 'string' ? dbUpdate.title : note.title,
          updatedAt,
        };
      }),
    );
  }

  async function deletePrivateNote(noteId: string) {
    const { error } = await supabase.from('contact_private_notes').delete().eq('id', noteId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<ContactPrivateNote[]>(socialQueryKeys.privateNotes, (old) =>
      (old ?? []).filter((note) => note.id !== noteId),
    );
    queryClient.setQueryData<ContactPrivateNoteBlock[]>(socialQueryKeys.privateNoteBlocks, (old) =>
      (old ?? []).filter((block) => block.noteId !== noteId),
    );
  }

  async function addPrivateNoteBlock(noteId: string, input: CreateContactPrivateNoteBlockInput) {
    const note = privateNotes.find((entry) => entry.id === noteId);
    const ownerUserId = note?.ownerUserId ?? currentUser?.id;
    if (!ownerUserId) throw new Error('Note not found.');
    const nextSortOrder = input.sortOrder ?? getPrivateNoteBlocks(noteId).length;
    const { data, error } = await supabase
      .from('contact_private_note_blocks')
      .insert({
        note_id: noteId,
        owner_user_id: ownerUserId,
        type: input.type,
        content: input.content ?? null,
        url: input.url ?? null,
        image_path: input.imagePath ?? null,
        sort_order: nextSortOrder,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Failed to add note block');

    const block = rowToContactPrivateNoteBlock(data);
    queryClient.setQueryData<ContactPrivateNoteBlock[]>(socialQueryKeys.privateNoteBlocks, (old) => [...(old ?? []), block]);
    await touchPrivateNote(noteId);
    return block;
  }

  async function updatePrivateNoteBlock(blockId: string, updates: UpdateContactPrivateNoteBlockInput) {
    const block = privateNoteBlocks.find((entry) => entry.id === blockId);
    if (!block) throw new Error('Note block not found.');
    const dbUpdate: Record<string, unknown> = {};
    if (updates.content !== undefined) dbUpdate.content = updates.content;
    if (updates.url !== undefined) dbUpdate.url = updates.url;
    if (updates.imagePath !== undefined) dbUpdate.image_path = updates.imagePath;
    if (updates.sortOrder !== undefined) dbUpdate.sort_order = updates.sortOrder;
    if (Object.keys(dbUpdate).length === 0) return;

    const updatedAt = new Date().toISOString();
    dbUpdate.updated_at = updatedAt;
    const { error } = await supabase.from('contact_private_note_blocks').update(dbUpdate).eq('id', blockId);
    if (error) throw new Error(error.message);

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
    await touchPrivateNote(block.noteId);
  }

  async function deletePrivateNoteBlock(blockId: string) {
    const block = privateNoteBlocks.find((entry) => entry.id === blockId);
    const { error } = await supabase.from('contact_private_note_blocks').delete().eq('id', blockId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<ContactPrivateNoteBlock[]>(socialQueryKeys.privateNoteBlocks, (old) =>
      (old ?? []).filter((entry) => entry.id !== blockId),
    );
    if (block) await touchPrivateNote(block.noteId);
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

    const low = currentUserId < profile.id ? currentUserId : profile.id;
    const high = currentUserId < profile.id ? profile.id : currentUserId;
    const alreadyFriends = isConnected(currentUserId, profile.id);

    if (!alreadyFriends) {
      const { error: insertErr } = await supabase.from('friendships').insert({
        user_low_id: low,
        user_high_id: high,
        created_by_user_id: currentUserId,
      });

      if (insertErr) {
        return { ok: false as const, error: insertErr.message };
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.friendships }),
        queryClient.invalidateQueries({ queryKey: socialQueryKeys.users }),
      ]);

      const currentUserProfile = users.find((u) => u.id === currentUserId);
      const currentName = currentUserProfile?.displayName ?? 'Someone';
      supabase.from('notifications').insert({
        recipient_user_id: profile.id,
        actor_user_id: currentUserId,
        type: 'friend_request',
        reference_id: null,
        message: `${currentName} added you as a friend`,
      }).then(({ error: nErr }) => { if (nErr) console.error('[notification] friend_request insert failed:', nErr); });
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
      return { ok: true as const, friend: friendUser, contactId: existingLinkedContact.id, candidateContactIds: [] };
    }

    // If the user already has unlinked manual contacts that look like this
    // person (same first-name token), do NOT auto-merge. Defer to the chooser
    // UI so the user can decide which Steven (if any) this is.
    const myContacts = contacts.filter((c) => c.ownerUserId === currentUserId);
    const candidates = findManualContactCandidates(myContacts, friendUser.displayName);
    if (candidates.length > 0) {
      return { ok: true as const, friend: friendUser, contactId: null, candidateContactIds: candidates.map((c) => c.id) };
    }

    const { data: newContactRow, error: newContactErr } = await supabase
      .from('contacts')
      .insert({
        owner_user_id: currentUserId,
        linked_user_id: friendUser.id,
        display_name: friendUser.displayName,
        avatar_path: friendUser.avatarPath ?? null,
        facts: friendUser.profileFacts.length > 0 ? friendUser.profileFacts : [],
      })
      .select()
      .single();
    if (newContactErr) {
      const fetchedLinkedContact = await hydrateOwnedLinkedContact();
      if (fetchedLinkedContact) {
        return { ok: true as const, friend: friendUser, contactId: fetchedLinkedContact.id, candidateContactIds: [] };
      }
      return { ok: false as const, error: newContactErr.message };
    }
    if (newContactRow) {
      const newContact = rowToContact(newContactRow);
      queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) => [newContact, ...(old ?? [])]);
      return { ok: true as const, friend: friendUser, contactId: newContact.id, candidateContactIds: [] };
    }

    const fetchedLinkedContact = await hydrateOwnedLinkedContact();
    if (fetchedLinkedContact) {
      return { ok: true as const, friend: friendUser, contactId: fetchedLinkedContact.id, candidateContactIds: [] };
    }

    return { ok: false as const, error: 'We added the friendship, but could not create your editable contact card.' };
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
      .eq('id', contactId);
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
      })
      .select()
      .single();
    if (newContactErr || !newContactRow) {
      return { ok: false as const, error: newContactErr?.message ?? 'Could not create contact.' };
    }
    const newContact = rowToContact(newContactRow);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) => [newContact, ...(old ?? [])]);
    return { ok: true as const, contactId: newContact.id };
  }

  function getManualContactCandidatesForFriend(currentUserId: string, friendUserId: string) {
    const friend = users.find((u) => u.id === friendUserId);
    if (!friend) return [];
    const myContacts = contacts.filter((c) => c.ownerUserId === currentUserId);
    return findManualContactCandidates(myContacts, friend.displayName);
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
      const candidates = findManualContactCandidates(myContacts, friend.displayName);
      if (candidates.length === 0) continue;
      result.push({ friend, candidates });
    }
    return result;
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
        .eq('id', ownedLinkedContact.id);
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
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? 'Failed to create contact');

    const contact = rowToContact(data);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) => [contact, ...(old ?? [])]);
    return contact;
  }

  async function updateContact(contactId: string, updates: { displayName?: string; avatarLocalUri?: string | null; tags?: string[]; note?: string | null; cardColor?: string | null; backText?: string | null; profileBg?: string | null; linkedUserId?: string | null; pinned?: boolean; pinnedAt?: string | null }) {
    const dbUpdate: Record<string, unknown> = {};
    if (updates.displayName !== undefined) dbUpdate.display_name = updates.displayName;
    if (updates.tags !== undefined) dbUpdate.tags = updates.tags;
    if (updates.note !== undefined) dbUpdate.note = updates.note;
    if (updates.cardColor !== undefined) dbUpdate.card_color = updates.cardColor;
    if (updates.backText !== undefined) dbUpdate.back_text = updates.backText;
    if (updates.profileBg !== undefined) dbUpdate.profile_bg = updates.profileBg;
    if (updates.linkedUserId !== undefined) dbUpdate.linked_user_id = updates.linkedUserId;
    if (updates.pinned !== undefined) dbUpdate.pinned = updates.pinned;
    if (updates.pinnedAt !== undefined) dbUpdate.pinned_at = updates.pinnedAt;

    if (updates.avatarLocalUri !== undefined) {
      if (updates.avatarLocalUri) {
        const compressed = await compressImage(updates.avatarLocalUri);
        const ext = 'jpg';
        const fileName = `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const base64 = await FileSystem.readAsStringAsync(compressed, { encoding: FileSystem.EncodingType.Base64 });
        const { error: uploadErr } = await supabase.storage
          .from('Memories')
          .upload(fileName, decode(base64), { contentType: `image/${ext}`, upsert: false });
        if (uploadErr) throw new Error(uploadErr.message);
        const { data: urlData } = supabase.storage.from('Memories').getPublicUrl(fileName);
        dbUpdate.avatar_path = urlData.publicUrl;
      } else {
        dbUpdate.avatar_path = null;
      }
    }

    if (Object.keys(dbUpdate).length === 0) return;

    const { error } = await supabase.from('contacts').update(dbUpdate).eq('id', contactId);
    if (error) throw new Error(error.message);

    const contact = contacts.find((c) => c.id === contactId);
    const linkedId = contact?.linkedUserId ?? (updates.linkedUserId ?? null);
    if (linkedId && contact) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser && linkedId !== authUser.id) {
        const ownerName = users.find((u) => u.id === authUser.id)?.displayName ?? 'Someone';
        supabase.from('notifications').insert({
          recipient_user_id: linkedId,
          actor_user_id: authUser.id,
          type: 'contact_update',
          reference_id: contactId,
          message: `${ownerName} updated your profile`,
        }).then(({ error: nErr }) => { if (nErr) console.error('[notification] contact_update insert failed:', nErr); });
      }
    }

    const newAvatarPath = typeof dbUpdate.avatar_path === 'string' ? dbUpdate.avatar_path : (dbUpdate.avatar_path === null ? null : undefined);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).map((c) => {
        if (c.id !== contactId) return c;
        const updated = { ...c };
        if (updates.displayName !== undefined) updated.displayName = updates.displayName;
        if (newAvatarPath !== undefined) updated.avatarPath = newAvatarPath;
        if (updates.tags !== undefined) updated.tags = updates.tags;
        if (updates.note !== undefined) updated.note = updates.note;
        if (updates.cardColor !== undefined) updated.cardColor = updates.cardColor;
        if (updates.backText !== undefined) updated.backText = updates.backText;
        if (updates.profileBg !== undefined) updated.profileBg = updates.profileBg;
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
        supabase.from('notifications').insert({
          recipient_user_id: linkedId,
          actor_user_id: authUser.id,
          type: 'contact_update',
          reference_id: contactId,
          message: `${ownerName} added a fact about you: ${fact}`,
        }).then(({ error: nErr }) => { if (nErr) console.error('[notification] contact_fact insert failed:', nErr); });
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

    // Create friendship if it doesn't exist yet (canonical ordering).
    if (!isConnected(currentUserId, profile.id)) {
      const low = currentUserId < profile.id ? currentUserId : profile.id;
      const high = currentUserId < profile.id ? profile.id : currentUserId;
      const { error: fErr } = await supabase.from('friendships').insert({
        user_low_id: low,
        user_high_id: high,
        created_by_user_id: currentUserId,
      });
      if (fErr) return { ok: false as const, error: fErr.message };

      const currentName = users.find((u) => u.id === currentUserId)?.displayName ?? 'Someone';
      supabase.from('notifications').insert({
        recipient_user_id: profile.id,
        actor_user_id: currentUserId,
        type: 'friend_request',
        reference_id: null,
        message: `${currentName} added you as a friend`,
      }).then(({ error: nErr }) => { if (nErr) console.error('[notification] friend_request insert failed:', nErr); });
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
    const { data, error } = await supabase
      .from('wall_posts')
      .insert({
        author_user_id: authorUserId,
        subject_user_id: input.subjectUserId,
        subject_contact_id: input.subjectContactId,
        visibility: input.visibility,
        body: input.body,
        image_path: input.imageUri,
        card_color: input.cardColor ?? null,
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? 'Failed to create memory');

    const post = rowToWallPost(data);
    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) => [post, ...(old ?? [])]);

    {
      let recipientId: string | null = input.subjectUserId;
      if (!recipientId && input.subjectContactId) {
        const c = contacts.find((ct) => ct.id === input.subjectContactId);
        recipientId = c?.linkedUserId ?? null;
      }
      const authorName = users.find((u) => u.id === authorUserId)?.displayName ?? 'Someone';
      if (recipientId && recipientId !== authorUserId) {
        supabase.from('notifications').insert({
          recipient_user_id: recipientId,
          actor_user_id: authorUserId,
          type: 'wall_post',
          reference_id: post.id,
          message: `${authorName} added a memory about you`,
        }).then(({ error: nErr }) => { if (nErr) console.error('[notification] wall_post insert failed:', nErr); });
      }
    }

    return post;
  }

  async function deleteWallPost(postId: string) {
    const post = wallPosts.find((p) => p.id === postId);
    if (!currentUser || post?.authorUserId !== currentUser.id) throw new Error('You can only delete your own memories.');

    const { error } = await supabase.from('wall_posts').delete().eq('id', postId).eq('author_user_id', currentUser.id);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
      (old ?? []).filter((p) => p.id !== postId),
    );
  }

  async function updateWallPost(postId: string, body: string, newLocalImageUri?: string | null, cardColor?: string | null, backText?: string | null, filter?: string | null, visibility?: WallPostVisibility) {
    const post = wallPosts.find((p) => p.id === postId);
    if (!currentUser || post?.authorUserId !== currentUser.id) throw new Error('You can only edit your own memories.');

    const updateData: Record<string, unknown> = { body };

    if (visibility !== undefined) {
      updateData.visibility = visibility;
    }

    if (backText !== undefined) {
      updateData.back_text = backText;
    }

    if (cardColor !== undefined) {
      updateData.card_color = cardColor;
    }

    if (filter !== undefined) {
      updateData.filter = filter;
    }

    if (newLocalImageUri !== undefined) {
      if (newLocalImageUri) {
        const compressed = await compressImage(newLocalImageUri);
        const ext = 'jpg';
        const fileName = `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const base64 = await FileSystem.readAsStringAsync(compressed, { encoding: FileSystem.EncodingType.Base64 });
        const { error: uploadErr } = await supabase.storage
          .from('Memories')
          .upload(fileName, decode(base64), { contentType: `image/${ext}`, upsert: false });
        if (uploadErr) throw new Error(uploadErr.message);
        const { data: urlData } = supabase.storage.from('Memories').getPublicUrl(fileName);
        updateData.image_path = urlData.publicUrl;
      } else {
        updateData.image_path = null;
      }
    }

    const { error } = await supabase.from('wall_posts').update(updateData).eq('id', postId).eq('author_user_id', currentUser.id);
    if (error) throw new Error(error.message);
    const newImageUri = typeof updateData.image_path === 'string' ? updateData.image_path : (updateData.image_path === null ? null : undefined);
    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
      (old ?? []).map((p) => {
        if (p.id !== postId) return p;
        const updated = { ...p, body };
        if (newImageUri !== undefined) updated.imageUri = newImageUri;
        if (cardColor !== undefined) updated.cardColor = cardColor;
        if (backText !== undefined) updated.backText = backText;
        if (filter !== undefined) {
          const presentation = splitWallPostPresentation(filter);
          updated.filter = presentation.filter;
          updated.textFont = presentation.textFont;
          updated.textSize = presentation.textSize;
          updated.textEffect = presentation.textEffect;
          updated.textColor = presentation.textColor;
        }
        if (visibility !== undefined) updated.visibility = visibility;
        return updated;
      }),
    );
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
    await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
    queryClient.setQueryData<Notification[]>(socialQueryKeys.notifications, (old) =>
      (old ?? []).map((n) => n.id === notificationId ? { ...n, read: true } : n),
    );
  }

  async function markAllNotificationsRead() {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    await supabase.from('notifications').update({ read: true }).eq('read', false);
    queryClient.setQueryData<Notification[]>(socialQueryKeys.notifications, (old) =>
      (old ?? []).map((n) => ({ ...n, read: true })),
    );
  }

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: socialQueryKeys.all });
  }, [queryClient]);

  // ── Provider ─────────────────────────────────────────────────────────
  return (
    <SocialGraphContext.Provider
      value={{
        loading,
        contacts,
        wallPosts,
        privateNotes,
        privateNoteBlocks,
        addFriendByCode,
        linkContactToFriend,
        createLinkedContactForFriend,
        getManualContactCandidatesForFriend,
        getPendingFriendLinks,
        removeFriend,
        deleteContact,
        addManualContact,
        addWallPost,
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
        migrateContactPostsToUser,
        linkContactByFriendCode,
        togglePin,
        notifications,
        unreadCount,
        markNotificationRead,
        markAllNotificationsRead,
        refresh,
      }}
    >
      {children}
    </SocialGraphContext.Provider>
  );
}

export function useSocialGraph() {
  const context = useContext(SocialGraphContext);
  if (!context) {
    throw new Error('useSocialGraph must be used inside SocialGraphProvider.');
  }
  return context;
}

function getContactAccent(contactId: string) {
  const total = Array.from(contactId).reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return accentPalette[total % accentPalette.length];
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
