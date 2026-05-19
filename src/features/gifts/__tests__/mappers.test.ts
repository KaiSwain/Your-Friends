import { describe, expect, it } from '@jest/globals';

import { rowToGiftNote } from '../mappers';

describe('rowToGiftNote', () => {
  it('maps snake_case rows to GiftNote', () => {
    expect(rowToGiftNote({
      id: 'gift-1',
      author_user_id: 'author-1',
      recipient_user_id: 'recipient-1',
      subject_contact_id: 'contact-1',
      unlock_date: '2026-06-01',
      title: 'Open later',
      status: 'revealed',
      revealed_wall_post_id: 'post-1',
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-02T00:00:00Z',
    })).toEqual({
      id: 'gift-1',
      authorUserId: 'author-1',
      recipientUserId: 'recipient-1',
      subjectContactId: 'contact-1',
      unlockDate: '2026-06-01',
      unlockTime: '09:00',
      title: 'Open later',
      status: 'revealed',
      revealedWallPostId: 'post-1',
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-02T00:00:00Z',
    });
  });

  it('defaults unknown status to locked', () => {
    expect(rowToGiftNote({
      id: 'gift-1',
      author_user_id: 'author-1',
      recipient_user_id: 'recipient-1',
      unlock_date: '2026-06-01',
      created_at: '2026-05-01T00:00:00Z',
      status: 'weird',
    }).status).toBe('locked');
  });
});
