import { supabase } from '../../lib/supabase';
import type { CreateGiftNoteInput, GiftNote } from '../../types/domain';
import { rowToGiftNote } from './mappers';

export const giftQueryKeys = {
  all: ['gifts'] as const,
  notes: (userId: string) => ['gifts', 'notes', userId] as const,
};

export async function fetchGiftNotes(userId: string): Promise<GiftNote[]> {
  const { data, error } = await supabase
    .from('gift_notes')
    .select('*')
    .or(`author_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
    .order('unlock_date', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    if (isGiftNotesMissing(error.message)) return [];
    throw error;
  }
  return (data ?? []).map(rowToGiftNote);
}

export async function createGiftNote(authorUserId: string, input: CreateGiftNoteInput): Promise<GiftNote> {
  const title = input.title?.trim() || 'A surprise note';
  const body = input.body.trim();
  if (!body) throw new Error('Write the gift note before locking it.');
  const { data: noteRow, error: noteError } = await supabase
    .from('gift_notes')
    .insert({
      author_user_id: authorUserId,
      recipient_user_id: input.recipientUserId,
      subject_contact_id: input.subjectContactId ?? null,
      unlock_date: input.unlockDate,
      unlock_time: input.unlockTime ?? '09:00',
      title,
      status: 'locked',
    })
    .select()
    .single();
  if (noteError || !noteRow) throw new Error(noteError?.message ?? 'Could not create gift note.');

  const { error: bodyError } = await supabase
    .from('gift_note_bodies')
    .insert({
      gift_note_id: noteRow.id,
      body,
    });
  if (bodyError) {
    await supabase.from('gift_notes').update({ status: 'cancelled' }).eq('id', noteRow.id).eq('author_user_id', authorUserId);
    throw new Error(bodyError.message);
  }

  return rowToGiftNote(noteRow);
}

export async function cancelGiftNote(noteId: string, authorUserId: string): Promise<GiftNote> {
  const { data, error } = await supabase
    .from('gift_notes')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('author_user_id', authorUserId)
    .eq('status', 'locked')
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Could not cancel gift note.');
  return rowToGiftNote(data);
}

export async function revealDueGiftNotes(): Promise<{ giftNoteId: string; wallPostId: string; authorUserId: string; recipientUserId: string }[]> {
  const { data, error } = await supabase.rpc('reveal_due_gift_notes');
  if (error) {
    if (isGiftNotesMissing(error.message) || /reveal_due_gift_notes/i.test(error.message)) return [];
    throw error;
  }
  return (data ?? []).map((row: any) => ({
    giftNoteId: row.gift_note_id,
    wallPostId: row.wall_post_id,
    authorUserId: row.author_user_id,
    recipientUserId: row.recipient_user_id,
  }));
}

function isGiftNotesMissing(message: string) {
  return /gift_notes|gift_note_bodies/i.test(message) && /(does not exist|schema cache|not find|not found)/i.test(message);
}
