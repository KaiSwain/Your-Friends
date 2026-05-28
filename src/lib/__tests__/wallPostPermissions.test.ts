import { canDeleteWallPost, canEditWallPostContent } from '../wallPostPermissions';
import type { WallPost } from '../../types/domain';

function makePost(overrides: Partial<WallPost> = {}): WallPost {
  return {
    id: 'post-1',
    authorUserId: 'responder-1',
    subjectUserId: 'requester-1',
    subjectContactId: null,
    visibility: 'visible_to_subject',
    postType: 'note',
    body: 'A response',
    imageUri: null,
    imageThumbUri: null,
    cardColor: null,
    backText: null,
    filter: null,
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
    createdAt: '2026-05-27T10:00:00Z',
    ...overrides,
  };
}

describe('wallPostPermissions', () => {
  it('lets the responder edit and delete their own response', () => {
    const post = makePost({ memoryPromptRequestId: 'prompt-1' });

    expect(canEditWallPostContent(post, 'responder-1')).toBe(true);
    expect(canDeleteWallPost(post, 'responder-1')).toBe(true);
  });

  it('lets the prompt sender delete a completed response without editing it', () => {
    const post = makePost({ memoryPromptRequestId: 'prompt-1' });

    expect(canEditWallPostContent(post, 'requester-1')).toBe(false);
    expect(canDeleteWallPost(post, 'requester-1')).toBe(true);
  });

  it('does not let the subject delete regular non-response memories', () => {
    const post = makePost();

    expect(canDeleteWallPost(post, 'requester-1')).toBe(false);
  });
});
