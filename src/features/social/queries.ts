import { supabase } from '../../lib/supabase';
import { AppUser, Contact, FriendFact, Friendship, Notification, WallPost } from '../../types/domain';
import { rowToContact, rowToFriendFact, rowToFriendship, rowToNotification, rowToUser, rowToWallPost } from './mappers';

export const socialQueryKeys = {
  users: ['social', 'users'] as const,
  contacts: ['social', 'contacts'] as const,
  friendships: ['social', 'friendships'] as const,
  wallPosts: ['social', 'wallPosts'] as const,
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
