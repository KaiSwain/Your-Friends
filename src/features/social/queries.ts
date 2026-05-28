import { supabase } from '../../lib/supabase';
import {
  AppUser,
  CalendarEventReaction,
  CalendarEventReactionValue,
  Contact,
  ContactPrivateNote,
  ContactPrivateNoteBlock,
  FriendFact,
  FriendRequest,
  Friendship,
  MemoryReply,
  Notification,
  ProfileWallItem,
  SaveWallPostLayoutInput,
  WallPost,
  WallPostLayout,
} from '../../types/domain';
import { rowToCalendarEventReaction, rowToContact, rowToContactPrivateNote, rowToContactPrivateNoteBlock, rowToFriendFact, rowToFriendRequest, rowToFriendship, rowToMemoryReply, rowToNotification, rowToProfileWallItem, rowToUser, rowToWallPost, rowToWallPostLayout } from './mappers';

export const socialQueryKeys = {
  users: ['social', 'users'] as const,
  contacts: ['social', 'contacts'] as const,
  friendships: ['social', 'friendships'] as const,
  friendRequests: ['social', 'friendRequests'] as const,
  wallPosts: ['social', 'wallPosts'] as const,
  memoryReplies: ['social', 'memoryReplies'] as const,
  profileWallItems: ['social', 'profileWallItems'] as const,
  wallPostLayouts: ['social', 'wallPostLayouts'] as const,
  privateNotes: ['social', 'privateNotes'] as const,
  privateNoteBlocks: ['social', 'privateNoteBlocks'] as const,
  friendFacts: ['social', 'friendFacts'] as const,
  notifications: ['social', 'notifications'] as const,
  calendarEventReactions: ['social', 'calendarEventReactions'] as const,
  all: ['social'] as const,
};

export async function fetchUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  return (data ?? []).map(rowToUser);
}

export async function fetchContacts(): Promise<Contact[]> {
  const { data, error } = await supabase.from('contacts').select('*');
  if (error) throw error;
  return (data ?? []).map(rowToContact);
}

export async function fetchFriendships(): Promise<Friendship[]> {
  const { data, error } = await supabase.from('friendships').select('*');
  if (error) throw error;
  return (data ?? []).map(rowToFriendship);
}

export async function fetchFriendRequests(): Promise<FriendRequest[]> {
  const { data, error } = await supabase.from('friend_requests').select('*').order('created_at', { ascending: false });
  if (error) {
    if (isMissingTable(error.message, 'friend_requests')) return [];
    throw error;
  }
  return (data ?? []).map(rowToFriendRequest);
}

export async function fetchWallPosts(): Promise<WallPost[]> {
  const { data, error } = await supabase.from('wall_posts').select('*');
  if (error) throw error;
  return (data ?? []).map(rowToWallPost);
}

export async function fetchMemoryReplies(): Promise<MemoryReply[]> {
  const { data, error } = await supabase.from('memory_replies').select('*').order('created_at', { ascending: true });
  if (error) {
    if (isMissingTable(error.message, 'memory_replies')) return [];
    throw error;
  }
  return (data ?? []).map(rowToMemoryReply);
}

export async function fetchProfileWallItems(): Promise<ProfileWallItem[]> {
  const { data, error } = await supabase.from('profile_wall_items').select('*').order('created_at', { ascending: false });
  if (error) {
    if (isMissingTable(error.message, 'profile_wall_items')) return [];
    throw error;
  }
  return (data ?? []).map(rowToProfileWallItem);
}

export async function fetchWallPostLayouts(): Promise<WallPostLayout[]> {
  const { data, error } = await supabase.from('wall_post_layouts').select('*');
  if (error) {
    if (isMissingTable(error.message, 'wall_post_layouts')) return [];
    throw error;
  }
  return (data ?? []).map(rowToWallPostLayout);
}

export async function upsertWallPostLayout(input: SaveWallPostLayoutInput): Promise<WallPostLayout> {
  const { data, error } = await supabase
    .from('wall_post_layouts')
    .upsert(
      {
        owner_user_id: input.ownerUserId,
        wall_context: input.wallContext,
        wall_context_id: input.wallContextId,
        wall_post_id: input.wallPostId,
        x: input.x,
        y: input.y,
        scale: input.scale,
        rotation: input.rotation,
        z_index: input.zIndex,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_user_id,wall_context,wall_context_id,wall_post_id' },
    )
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Could not save board layout.');
  return rowToWallPostLayout(data);
}

export async function deleteWallPostLayout(input: {
  ownerUserId: string;
  wallContext: string;
  wallContextId: string;
  wallPostId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('wall_post_layouts')
    .delete()
    .eq('owner_user_id', input.ownerUserId)
    .eq('wall_context', input.wallContext)
    .eq('wall_context_id', input.wallContextId)
    .eq('wall_post_id', input.wallPostId);
  if (error) throw new Error(error.message);
}

export async function fetchPrivateNotes(): Promise<ContactPrivateNote[]> {
  const { data, error } = await supabase.from('contact_private_notes').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToContactPrivateNote);
}

export async function fetchPrivateNoteBlocks(): Promise<ContactPrivateNoteBlock[]> {
  const { data, error } = await supabase.from('contact_private_note_blocks').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToContactPrivateNoteBlock);
}

export async function fetchFriendFacts(): Promise<FriendFact[]> {
  const { data, error } = await supabase.from('friend_facts').select('*');
  if (error) throw error;
  return (data ?? []).map(rowToFriendFact);
}

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToNotification);
}

export async function fetchCalendarEventReactions(): Promise<CalendarEventReaction[]> {
  const { data, error } = await supabase.from('calendar_event_reactions').select('*');
  if (error) {
    if (isCalendarEventReactionsMissing(error.message)) return [];
    throw error;
  }
  return (data ?? []).map(rowToCalendarEventReaction);
}

/** `calendar_event_reactions.notification_id` is a UUID FK; synthetic inbox rows use string ids like `calendar-share-fallback:…`. */
function uuidForNotificationColumn(value: string | null | undefined): string | null {
  if (!value) return null;
  // Postgres `uuid` type; synthetic notification ids (e.g. calendar-share-fallback:…) must not be sent as FK.
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRe.test(value) ? value : null;
}

export async function upsertCalendarEventReaction(input: {
  eventId: string;
  userId: string;
  notificationId?: string | null;
  value: CalendarEventReactionValue;
}): Promise<CalendarEventReaction> {
  const notificationIdDb = uuidForNotificationColumn(input.notificationId ?? undefined);
  const { data, error } = await supabase
    .from('calendar_event_reactions')
    .upsert(
      {
        event_id: input.eventId,
        user_id: input.userId,
        notification_id: notificationIdDb,
        value: input.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,user_id' },
    )
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to save reaction.');
  return rowToCalendarEventReaction(data);
}

export async function deleteCalendarEventReaction(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_event_reactions')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

function isCalendarEventReactionsMissing(message: string) {
  return isMissingTable(message, 'calendar_event_reactions');
}

function isMissingTable(message: string, tableName: string) {
  return new RegExp(tableName, 'i').test(message) && /(does not exist|schema cache|not find|not found)/i.test(message);
}
