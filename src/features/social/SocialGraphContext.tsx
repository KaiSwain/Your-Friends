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
  CreateContactInput,
  CreateFriendFactInput,
  CreateWallPostInput,
  FriendFact,
  Friendship,
  Notification,
  PeopleListItem,
  WallPost,
  WallPostVisibility,
} from '../../types/domain';
import { rowToContact, rowToFriendship, rowToUser, rowToWallPost, rowToFriendFact } from './mappers';
import {
  socialQueryKeys,
  fetchUsers,
  fetchContacts,
  fetchFriendships,
  fetchWallPosts,
  fetchFriendFacts,
  fetchNotifications,
} from './queries';

// Re-export so existing imports keep working.
export { socialQueryKeys } from './queries';

interface SocialGraphContextValue {
  loading: boolean;
  contacts: Contact[];
  wallPosts: WallPost[];
  addFriendByCode: (currentUserId: string, friendCode: string) => Promise<{ ok: true; friend: AppUser; contactId: string | null } | { ok: false; error: string }>;
  addManualContact: (ownerUserId: string, input: CreateContactInput) => Promise<Contact>;
  addWallPost: (authorUserId: string, input: CreateWallPostInput) => Promise<WallPost>;
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
  const friendFactsQuery = useQuery({ queryKey: socialQueryKeys.friendFacts, queryFn: fetchFriendFacts, enabled: socialEnabled });
  const notificationsQuery = useQuery({ queryKey: socialQueryKeys.notifications, queryFn: fetchNotifications, enabled: socialEnabled });

  const users = usersQuery.data ?? [];
  const contacts = contactsQuery.data ?? [];
  const friendships = friendshipsQuery.data ?? [];
  const wallPosts = wallPostsQuery.data ?? [];
  const friendFacts = friendFactsQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const loading = usersQuery.isPending || contactsQuery.isPending || friendshipsQuery.isPending;
  const hasSettledInitialData = socialEnabled
    && usersQuery.isFetched
    && contactsQuery.isFetched
    && friendshipsQuery.isFetched
    && wallPostsQuery.isFetched
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

  const didMigrateOrphans = useRef(false);
  useEffect(() => {
    if (!socialEnabled) return;
    if (didMigrateOrphans.current) return;
    if (!usersQuery.isSuccess || !contactsQuery.isSuccess || !friendshipsQuery.isSuccess) return;
    didMigrateOrphans.current = true;

    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const myId = authUser.id;

      const linkedIds = new Set(contacts.filter((c) => c.ownerUserId === myId && c.linkedUserId).map((c) => c.linkedUserId!));
      const myFriendIds = friendships
        .map((f) => f.userLowId === myId ? f.userHighId : f.userHighId === myId ? f.userLowId : null)
        .filter((id): id is string => id !== null);
      const orphanIds = myFriendIds.filter((id) => !linkedIds.has(id));
      if (!orphanIds.length) return;

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
      const { data: rows } = await supabase.from('contacts').upsert(inserts, { onConflict: 'owner_user_id,linked_user_id', ignoreDuplicates: true }).select();
      if (rows?.length) {
        const newContacts = rows.map(rowToContact);
        queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) => [...newContacts, ...(old ?? [])]);
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
      caption: 'Connected friend',
      avatarColor: friend.avatarColor,
      imageUri: friend.avatarPath ?? null,
      tags: [],
    }));

    const contactItems: PeopleListItem[] = contacts
      .filter((contact) => contact.ownerUserId === userId)
      .map((contact) => ({
        id: contact.id,
        entityType: 'contact',
        createdAt: contact.createdAt,
        title: contact.displayName,
        subtitle: contact.nickname ? `Saved as ${contact.nickname}` : contact.linkedUserId ? 'Connected friend' : '',
        caption: contact.linkedUserId ? 'Connected friend' : '',
        avatarColor: getContactAccent(contact.id),
        imageUri: contact.avatarPath ?? null,
        tags: contact.tags ?? [],
        note: contact.note ?? null,
        cardColor: contact.cardColor ?? null,
        linkedUserId: contact.linkedUserId,
        pinned: contact.pinned,
      }));

    const linkedUserIds = new Set(
      contacts.filter((c) => c.ownerUserId === userId && c.linkedUserId).map((c) => c.linkedUserId!),
    );

    return [...friendItems.filter((f) => !linkedUserIds.has(f.id)), ...contactItems].sort(
      (a, b) => {
        const pinA = a.pinned ? 1 : 0;
        const pinB = b.pinned ? 1 : 0;
        if (pinA !== pinB) return pinB - pinA;
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

    if (isConnected(currentUserId, profile.id)) {
      return { ok: false as const, error: 'You are already friends with this person.' };
    }

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

    const friendUser = rowToUser(profile);
    const matchingContact = contacts.find(
      (c) => c.ownerUserId === currentUserId && !c.linkedUserId &&
        c.displayName.toLowerCase() === friendUser.displayName.toLowerCase(),
    );
    if (matchingContact) {
      await supabase.from('contacts').update({ linked_user_id: friendUser.id }).eq('id', matchingContact.id);
      queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
        (old ?? []).map((c) => c.id === matchingContact.id ? { ...c, linkedUserId: friendUser.id } : c),
      );
      await migrateContactPostsToUser(matchingContact.id, friendUser.id);
      return { ok: true as const, friend: friendUser, contactId: matchingContact.id };
    } else {
      const { data: newContactRow } = await supabase
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
      if (newContactRow) {
        const newContact = rowToContact(newContactRow);
        queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) => [newContact, ...(old ?? [])]);
        return { ok: true as const, friend: friendUser, contactId: newContact.id };
      }
    }

    return { ok: true as const, friend: friendUser, contactId: null };
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

  async function updateContact(contactId: string, updates: { displayName?: string; avatarLocalUri?: string | null; tags?: string[]; note?: string | null; cardColor?: string | null; backText?: string | null; profileBg?: string | null; linkedUserId?: string | null; pinned?: boolean }) {
    const dbUpdate: Record<string, unknown> = {};
    if (updates.displayName !== undefined) dbUpdate.display_name = updates.displayName;
    if (updates.tags !== undefined) dbUpdate.tags = updates.tags;
    if (updates.note !== undefined) dbUpdate.note = updates.note;
    if (updates.cardColor !== undefined) dbUpdate.card_color = updates.cardColor;
    if (updates.backText !== undefined) dbUpdate.back_text = updates.backText;
    if (updates.profileBg !== undefined) dbUpdate.profile_bg = updates.profileBg;
    if (updates.linkedUserId !== undefined) dbUpdate.linked_user_id = updates.linkedUserId;
    if (updates.pinned !== undefined) dbUpdate.pinned = updates.pinned;

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
    const { error } = await supabase.from('contacts').update({ pinned: newPinned }).eq('id', contactId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) =>
      (old ?? []).map((c) => (c.id === contactId ? { ...c, pinned: newPinned } : c)),
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
    const { error } = await supabase.from('wall_posts').delete().eq('id', postId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
      (old ?? []).filter((p) => p.id !== postId),
    );
  }

  async function updateWallPost(postId: string, body: string, newLocalImageUri?: string | null, cardColor?: string | null, backText?: string | null, filter?: string | null, visibility?: WallPostVisibility) {
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

    const { error } = await supabase.from('wall_posts').update(updateData).eq('id', postId);
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
        addFriendByCode,
        addManualContact,
        addWallPost,
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
