import { supabase } from '../../lib/supabase';
import { AppUser, Contact, ContactPrivateNote, ContactPrivateNoteBlock, FriendFact, Friendship, Notification, WallPost } from '../../types/domain';
import { rowToContact, rowToContactPrivateNote, rowToContactPrivateNoteBlock, rowToFriendFact, rowToFriendship, rowToNotification, rowToUser, rowToWallPost } from './mappers';

export const socialQueryKeys = {
  users: ['social', 'users'] as const,
  contacts: ['social', 'contacts'] as const,
  friendships: ['social', 'friendships'] as const,
  wallPosts: ['social', 'wallPosts'] as const,
  privateNotes: ['social', 'privateNotes'] as const,
  privateNoteBlocks: ['social', 'privateNoteBlocks'] as const,
  friendFacts: ['social', 'friendFacts'] as const,
  notifications: ['social', 'notifications'] as const,
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

export async function fetchWallPosts(): Promise<WallPost[]> {
  const { data, error } = await supabase.from('wall_posts').select('*');
  if (error) throw error;
  return (data ?? []).map(rowToWallPost);
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
