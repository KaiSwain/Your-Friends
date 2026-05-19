import type { GiftNote, GiftNoteStatus } from '../../types/domain';

export function rowToGiftNote(row: any): GiftNote {
  return {
    id: row.id,
    authorUserId: row.author_user_id,
    recipientUserId: row.recipient_user_id,
    subjectContactId: row.subject_contact_id ?? null,
    unlockDate: row.unlock_date,
    unlockTime: row.unlock_time ?? '09:00',
    title: row.title ?? 'A surprise note',
    status: normalizeGiftNoteStatus(row.status),
    revealedWallPostId: row.revealed_wall_post_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function normalizeGiftNoteStatus(value: unknown): GiftNoteStatus {
  if (value === 'revealed' || value === 'cancelled') return value;
  return 'locked';
}
