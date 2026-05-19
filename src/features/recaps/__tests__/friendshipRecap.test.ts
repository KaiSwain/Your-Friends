import { describe, expect, it } from '@jest/globals';

import { buildFriendshipRecap } from '../friendshipRecap';
import type { WallPost } from '../../../types/domain';

function post(overrides: Partial<WallPost>): WallPost {
  return {
    id: 'post-1',
    authorUserId: 'me',
    subjectUserId: 'friend',
    subjectContactId: null,
    visibility: 'visible_to_subject',
    postType: 'note',
    body: 'Memory',
    imageUri: null,
    cardColor: null,
    backText: null,
    filter: null,
    dateStamp: false,
    song: null,
    memoryDate: '2026-05-10',
    createdAt: '2026-05-10T12:00:00Z',
    ...overrides,
  };
}

describe('buildFriendshipRecap', () => {
  it('filters memories to the selected month and counts types', () => {
    const recap = buildFriendshipRecap({
      currentUserId: 'me',
      friendUserId: 'friend',
      friendName: 'Mina',
      range: 'month',
      cursorDate: new Date(2026, 4, 1),
      posts: [
        post({ id: 'note', postType: 'note', memoryDate: '2026-05-02' }),
        post({ id: 'photo', postType: 'polaroid', imageUri: 'photo.jpg', memoryDate: '2026-05-03' }),
        post({ id: 'song', postType: 'song', memoryDate: '2026-05-04' }),
        post({ id: 'old', memoryDate: '2026-04-01' }),
      ],
    });

    expect(recap.memoryCount).toBe(3);
    expect(recap.noteCount).toBe(1);
    expect(recap.photoCount).toBe(1);
    expect(recap.songCount).toBe(1);
    expect(recap.featuredPost?.id).toBe('song');
  });

  it('includes both directions for yearly shared memories', () => {
    const recap = buildFriendshipRecap({
      currentUserId: 'me',
      friendUserId: 'friend',
      friendName: 'Mina',
      range: 'year',
      cursorDate: new Date(2026, 0, 1),
      posts: [
        post({ id: 'mine', authorUserId: 'me', subjectUserId: 'friend', memoryDate: '2026-01-01' }),
        post({ id: 'theirs', authorUserId: 'friend', subjectUserId: 'me', memoryDate: '2026-02-01' }),
      ],
    });

    expect(recap.memoryCount).toBe(2);
    expect(recap.groupedPosts.map((group) => group.label)).toEqual(['February', 'January']);
  });

  it('excludes private or unrelated memories', () => {
    const recap = buildFriendshipRecap({
      currentUserId: 'me',
      friendUserId: 'friend',
      friendName: 'Mina',
      range: 'year',
      cursorDate: new Date(2026, 0, 1),
      posts: [
        post({ id: 'private', visibility: 'private' }),
        post({ id: 'other', subjectUserId: 'someone-else' }),
      ],
    });

    expect(recap.memoryCount).toBe(0);
  });
});
