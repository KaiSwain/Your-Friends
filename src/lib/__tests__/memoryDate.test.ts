import { compareWallPostsByMemoryDateDesc, getWallPostMemoryDayKey } from '../memoryDate';
import type { WallPost } from '../../types/domain';

describe('memory date sorting', () => {
  it('sorts same-day posts by creation time even when one has a date-only memory date', () => {
    const priorPolaroid = makePost({
      id: 'prior-polaroid',
      createdAt: '2026-05-26T15:00:00.000Z',
      memoryDate: null,
    });
    const newerMovieReview = makePost({
      id: 'newer-movie',
      createdAt: '2026-05-26T18:00:00.000Z',
      memoryDate: '2026-05-26',
      postType: 'movie',
    });

    expect([priorPolaroid, newerMovieReview].sort(compareWallPostsByMemoryDateDesc).map((post) => post.id)).toEqual([
      'newer-movie',
      'prior-polaroid',
    ]);
  });

  it('still keeps newer memory days above older memory days', () => {
    const olderCreatedLater = makePost({
      id: 'older-day-created-later',
      createdAt: '2026-05-27T18:00:00.000Z',
      memoryDate: '2026-05-25',
    });
    const newerMemoryDay = makePost({
      id: 'newer-memory-day',
      createdAt: '2026-05-26T08:00:00.000Z',
      memoryDate: '2026-05-26',
    });

    expect([olderCreatedLater, newerMemoryDay].sort(compareWallPostsByMemoryDateDesc).map((post) => post.id)).toEqual([
      'newer-memory-day',
      'older-day-created-later',
    ]);
  });

  it('derives day keys consistently for date-only and timestamp values', () => {
    expect(getWallPostMemoryDayKey(makePost({ createdAt: '2026-05-26T18:00:00.000Z', memoryDate: '2026-05-26' }))).toBe('2026-05-26');
    expect(getWallPostMemoryDayKey(makePost({ createdAt: '2026-05-26T18:00:00.000Z', memoryDate: null }))).toBe('2026-05-26');
  });
});

function makePost(overrides: Partial<WallPost>): WallPost {
  return {
    id: 'post',
    authorUserId: 'alice',
    subjectUserId: 'bob',
    subjectContactId: null,
    visibility: 'visible_to_subject',
    postType: 'polaroid',
    body: '',
    imageUri: null,
    videoUri: null,
    videoMuted: false,
    cardColor: null,
    backText: null,
    filter: null,
    textFont: null,
    textSize: null,
    textEffect: null,
    textColor: null,
    dateStamp: false,
    song: null,
    voice: null,
    movie: null,
    memoryPromptRequestId: null,
    referencedWallPostId: null,
    promptText: null,
    promptType: null,
    promptVoice: null,
    memoryDate: null,
    locationName: null,
    createdAt: '2026-05-26T12:00:00.000Z',
    ...overrides,
  };
}
