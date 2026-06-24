import { dedupeMemoriesForDisplay, getMemoryGroupKey } from '../memoryGrouping';
import type { WallPost } from '../../types/domain';

function post(overrides: Partial<WallPost>): WallPost {
  return {
    id: Math.random().toString(36).slice(2),
    authorUserId: 'author-1',
    subjectUserId: null,
    subjectContactId: null,
    visibility: 'visible_to_subject',
    postType: 'polaroid',
    body: '',
    imageUri: null,
    imageThumbUri: null,
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
    memoryDate: null,
    locationName: null,
    createdAt: '2026-06-01T12:00:00.000Z',
    ...overrides,
  } as WallPost;
}

describe('getMemoryGroupKey', () => {
  it('groups the same photo shared to multiple walls (different subjects)', () => {
    const a = post({ imageUri: 'memories/photo-xyz.jpg', subjectUserId: 'friend-a' });
    const b = post({ imageUri: 'memories/photo-xyz.jpg', subjectContactId: 'contact-b' });
    expect(getMemoryGroupKey(a)).toBe(getMemoryGroupKey(b));
  });

  it('keeps a tagged copy in the same group when it inherits the original memory date', () => {
    // Original memory authored June 1.
    const original = post({ imageUri: 'memories/photo-xyz.jpg', createdAt: '2026-06-01T12:00:00.000Z' });
    // Tagged copy created later (today) but with memoryDate carried back to June 1.
    const taggedCopy = post({
      imageUri: 'memories/photo-xyz.jpg',
      createdAt: '2026-06-21T09:00:00.000Z',
      memoryDate: '2026-06-01',
    });
    expect(getMemoryGroupKey(original)).toBe(getMemoryGroupKey(taggedCopy));
  });

  it('does not group different photos', () => {
    const a = post({ imageUri: 'memories/photo-a.jpg' });
    const b = post({ imageUri: 'memories/photo-b.jpg' });
    expect(getMemoryGroupKey(a)).not.toBe(getMemoryGroupKey(b));
  });

  it('does not group distinct text notes written the same day', () => {
    const a = post({ postType: 'note', body: 'first note' });
    const b = post({ postType: 'note', body: 'second note' });
    expect(getMemoryGroupKey(a)).not.toBe(getMemoryGroupKey(b));
  });

  it('groups optimistic copies by their shared pending memory id', () => {
    const a = post({ pendingMemoryId: 'local_memory_1', subjectUserId: 'friend-a' });
    const b = post({ pendingMemoryId: 'local_memory_1', subjectContactId: 'contact-b' });
    expect(getMemoryGroupKey(a)).toBe(getMemoryGroupKey(b));
  });
});

describe('dedupeMemoriesForDisplay', () => {
  it('collapses a memory shared to four walls into a single card', () => {
    const shared = ['w1', 'w2', 'w3', 'w4'].map((w) =>
      post({ imageUri: 'memories/photo-xyz.jpg', subjectContactId: w }),
    );
    const deduped = dedupeMemoriesForDisplay(shared);
    expect(deduped).toHaveLength(1);
  });

  it('keeps genuinely different memories', () => {
    const posts = [
      post({ imageUri: 'memories/a.jpg' }),
      post({ imageUri: 'memories/b.jpg' }),
      post({ imageUri: 'memories/a.jpg', subjectContactId: 'other-wall' }),
    ];
    expect(dedupeMemoriesForDisplay(posts)).toHaveLength(2);
  });

  it('preserves input order, keeping the first occurrence', () => {
    const first = post({ id: 'first', imageUri: 'memories/a.jpg' });
    const second = post({ id: 'second', imageUri: 'memories/a.jpg' });
    const deduped = dedupeMemoriesForDisplay([first, second]);
    expect(deduped[0].id).toBe('first');
  });
});
