const mockCreateNotification = jest.fn();
const mockFrom = jest.fn();
const mockUploadMemoryImageVariants = jest.fn();
const mockUploadMemoryVideo = jest.fn();

jest.mock('../../../lib/notifications', () => ({
  createNotification: mockCreateNotification,
}));

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

jest.mock('../../../lib/memoryMediaUpload', () => ({
  uploadMemoryImageVariants: mockUploadMemoryImageVariants,
  uploadMemoryVideo: mockUploadMemoryVideo,
}));

import type { CompleteMemoryPromptRequestInput, MemoryPromptType, SongAttachment, VoiceAttachment } from '../../../types/domain';
import { completeMemoryPromptRequest, createMemoryPromptRequest, createSavedMemoryPrompt, deleteSavedMemoryPrompt, fetchSavedMemoryPrompts } from '../queries';

type BuilderCapture = {
  eq?: Array<[string, unknown]>;
  insert?: unknown;
  update?: unknown;
};

const promptTypes = ['song', 'text', 'photo', 'photo_reference', 'voice'] as const;
const voice: VoiceAttachment = { uri: 'https://audio.test/voice.m4a', durationMs: 12_000 };
const promptVoice: VoiceAttachment = { uri: 'https://audio.test/prompt.m4a', durationMs: 8_000 };
const song: SongAttachment = {
  provider: 'apple',
  providerTrackId: 'song-1',
  title: 'Golden Hour',
  artist: 'Friend Band',
  artworkUrl: 'https://img.test/art.jpg',
  previewUrl: 'https://audio.test/preview.m4a',
  externalUrl: 'https://music.test/song',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-05-24T12:00:00.000Z');
  mockCreateNotification.mockResolvedValue(undefined);
  mockUploadMemoryImageVariants.mockResolvedValue({ imageUri: 'https://cdn.test/photo.jpg', imageThumbUri: 'https://cdn.test/photo-thumb.jpg' });
  mockUploadMemoryVideo.mockResolvedValue('https://cdn.test/video.mp4');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('createMemoryPromptRequest', () => {
  it.each(promptTypes)('creates %s prompt requests', async (promptType) => {
    const insertCapture: BuilderCapture = {};
    queueFromCalls(
      ['memory_prompt_requests', makeSingleBuilder(promptRequestRow({ prompt_type: promptType }), insertCapture)],
      ['profiles', makeSingleBuilder({ display_name: 'Requester' })],
    );

    const request = await createMemoryPromptRequest('requester-1', {
      recipientUserId: 'recipient-1',
      promptType,
      promptText: '  Answer this prompt.  ',
      promptVoice,
    });

    expect(request.promptType).toBe(promptType);
    expect(insertCapture.insert).toMatchObject({
      requester_user_id: 'requester-1',
      recipient_user_id: 'recipient-1',
      prompt_type: promptType,
      prompt_text: 'Answer this prompt.',
      prompt_audio_path: promptVoice.uri,
      prompt_audio_duration_ms: promptVoice.durationMs,
      status: 'pending',
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'recipient-1',
      type: 'memory_prompt_request',
      metadata: expect.objectContaining({ promptType }),
    }));
  });

  it('rejects empty prompt text before writing', async () => {
    await expect(createMemoryPromptRequest('requester-1', {
      recipientUserId: 'recipient-1',
      promptType: 'text',
      promptText: '   ',
    })).rejects.toThrow('Write a prompt first.');

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('completeMemoryPromptRequest', () => {
  it.each([
    {
      promptType: 'song' as const,
      input: { song, body: 'This is the one.', voice },
      expectedPost: {
        post_type: 'song',
        body: 'This is the one.',
        song_provider: 'apple',
        audio_path: voice.uri,
      },
      expectedUpdate: {
        response_body: 'This is the one.',
        response_song_provider: 'apple',
        response_audio_path: voice.uri,
      },
    },
    {
      promptType: 'text' as const,
      input: { body: 'A typed answer.' },
      expectedPost: {
        post_type: 'note',
        body: 'A typed answer.',
      },
      expectedUpdate: {
        response_body: 'A typed answer.',
      },
    },
    {
      promptType: 'text' as const,
      input: { voice },
      expectedPost: {
        post_type: 'note',
        body: '',
        audio_path: voice.uri,
      },
      expectedUpdate: {
        response_body: null,
        response_audio_path: voice.uri,
      },
    },
    {
      promptType: 'photo' as const,
      input: { responsePostType: 'polaroid' as const, imageUri: 'file:///photo.jpg', videoUri: 'file:///video.mp4', body: 'New photo.' },
      expectedPost: {
        post_type: 'polaroid',
        body: 'New photo.',
        image_path: 'https://cdn.test/photo.jpg',
        video_path: 'https://cdn.test/video.mp4',
      },
      expectedUpdate: {
        response_body: 'New photo.',
      },
    },
    {
      promptType: 'photo' as const,
      input: { responsePostType: 'media' as const, imageUri: 'file:///photo.jpg' },
      expectedPost: {
        post_type: 'media',
        body: '',
        image_path: 'https://cdn.test/photo.jpg',
      },
      expectedUpdate: {
        response_body: null,
      },
    },
    {
      promptType: 'photo_reference' as const,
      input: { referencedWallPostId: 'post-ref', body: 'This one.' },
      expectedPost: {
        post_type: 'note',
        body: 'This one.',
        referenced_wall_post_id: 'post-ref',
      },
      expectedUpdate: {
        response_body: 'This one.',
        referenced_wall_post_id: 'post-ref',
      },
    },
    {
      promptType: 'voice' as const,
      input: { voice, body: 'Listen.' },
      expectedPost: {
        post_type: 'voice',
        body: 'Listen.',
        audio_path: voice.uri,
      },
      expectedUpdate: {
        response_body: 'Listen.',
        response_audio_path: voice.uri,
      },
    },
  ])('completes $promptType prompts with the correct wall post and response columns', async ({ promptType, input, expectedPost, expectedUpdate }) => {
    const wallPostCapture: BuilderCapture = {};
    const updateCapture: BuilderCapture = {};
    queueCompletePrompt({ promptType, wallPostCapture, updateCapture });

    const result = await completeMemoryPromptRequest('recipient-1', {
      requestId: `request-${promptType}`,
      ...input,
    } as CompleteMemoryPromptRequestInput);

    expect(result.wallPost.memoryPromptRequestId).toBe(`request-${promptType}`);
    expect(wallPostCapture.insert).toMatchObject({
      author_user_id: 'recipient-1',
      subject_user_id: 'requester-1',
      visibility: 'visible_to_subject',
      memory_prompt_request_id: `request-${promptType}`,
      prompt_text: `${promptType} prompt`,
      prompt_type: promptType,
      prompt_audio_path: promptVoice.uri,
      prompt_audio_duration_ms: promptVoice.durationMs,
      ...expectedPost,
    });
    expect(updateCapture.update).toMatchObject({
      status: 'completed',
      completed_wall_post_id: `wall-${promptType}`,
      ...expectedUpdate,
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'requester-1',
      type: 'wall_post',
      metadata: expect.objectContaining({
        memoryPromptRequestId: `request-${promptType}`,
        promptType,
      }),
    }));
  });

  it.each([
    ['song', {}, 'Choose a song before sending.'],
    ['voice', {}, 'Record a voice memory before sending.'],
    ['text', {}, 'Write or record a response before sending.'],
    ['photo', { responsePostType: 'media' }, 'Choose a photo or video before sending.'],
    ['photo', { imageUri: 'file:///photo.jpg' }, 'Choose Memory Card or media before sending.'],
    ['photo_reference', {}, 'Choose a photo memory before sending.'],
  ] as const)('validates missing %s prompt responses', async (promptType, input, message) => {
    queueFromCalls(['memory_prompt_requests', makeSingleBuilder(promptRequestRow({ prompt_type: promptType }))]);

    await expect(completeMemoryPromptRequest('recipient-1', {
      requestId: `request-${promptType}`,
      ...input,
    } as CompleteMemoryPromptRequestInput)).rejects.toThrow(message);

    expect(mockUploadMemoryImageVariants).not.toHaveBeenCalled();
  });
});

describe('saved memory prompts', () => {
  it('fetches saved prompts ordered by update time', async () => {
    queueFromCalls(['saved_memory_prompts', makeListBuilder([savedPromptRow()])]);

    const prompts = await fetchSavedMemoryPrompts('user-1');

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ id: 'saved-1', ownerUserId: 'user-1', promptText: 'A saved prompt.' });
  });

  it('creates saved prompts with trimmed text', async () => {
    const insertCapture: BuilderCapture = {};
    queueFromCalls(['saved_memory_prompts', makeSingleBuilder(savedPromptRow({ prompt_text: 'A saved prompt.' }), insertCapture)]);

    const prompt = await createSavedMemoryPrompt('user-1', {
      promptType: 'text',
      promptText: '  A saved prompt.  ',
      category: 'Deep',
      source: 'user',
    });

    expect(prompt.promptText).toBe('A saved prompt.');
    expect(insertCapture.insert).toMatchObject({
      owner_user_id: 'user-1',
      prompt_type: 'text',
      prompt_text: 'A saved prompt.',
      category: 'Deep',
      source: 'user',
    });
  });

  it('deletes saved prompts by id and owner', async () => {
    const deleteCapture: BuilderCapture = {};
    queueFromCalls(['saved_memory_prompts', makeDeleteBuilder(deleteCapture)]);

    await deleteSavedMemoryPrompt('saved-1', 'user-1');

    expect(deleteCapture.eq).toEqual([
      ['id', 'saved-1'],
      ['owner_user_id', 'user-1'],
    ]);
  });
});

function queueCompletePrompt({
  promptType,
  wallPostCapture,
  updateCapture,
}: {
  promptType: MemoryPromptType;
  wallPostCapture: BuilderCapture;
  updateCapture: BuilderCapture;
}) {
  queueFromCalls(
    ['memory_prompt_requests', makeSingleBuilder(promptRequestRow({ prompt_type: promptType }))],
    ['wall_posts', makeSingleBuilder(wallPostRow(promptType), wallPostCapture)],
    ['memory_prompt_requests', makeSingleBuilder(promptRequestRow({ prompt_type: promptType, status: 'completed', completed_wall_post_id: `wall-${promptType}` }), updateCapture)],
    ['profiles', makeSingleBuilder({ display_name: 'Recipient' })],
  );
}

function queueFromCalls(...calls: Array<[string, any]>) {
  mockFrom.mockImplementation((table: string) => {
    const next = calls.shift();
    if (!next) throw new Error(`Unexpected Supabase table: ${table}`);
    const [expectedTable, builder] = next;
    expect(table).toBe(expectedTable);
    return builder;
  });
}

function makeSingleBuilder(data: unknown, capture: BuilderCapture = {}) {
  const builder = {
    insert(payload: unknown) {
      capture.insert = payload;
      return builder;
    },
    update(payload: unknown) {
      capture.update = payload;
      return builder;
    },
    select() {
      return builder;
    },
    eq(column: string, value: unknown) {
      capture.eq = [...(capture.eq ?? []), [column, value]];
      return builder;
    },
    single: jest.fn(async () => ({ data, error: null })),
  };
  return builder;
}

function makeListBuilder(data: unknown[], capture: BuilderCapture = {}) {
  const builder = {
    select() {
      return builder;
    },
    eq(column: string, value: unknown) {
      capture.eq = [...(capture.eq ?? []), [column, value]];
      return builder;
    },
    order: jest.fn(async () => ({ data, error: null })),
  };
  return builder;
}

function makeDeleteBuilder(capture: BuilderCapture = {}) {
  const builder = {
    delete() {
      return builder;
    },
    eq(column: string, value: unknown) {
      capture.eq = [...(capture.eq ?? []), [column, value]];
      return builder;
    },
    then(resolve: (value: { error: null }) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve({ error: null }).then(resolve, reject);
    },
  };
  return builder;
}

function promptRequestRow(overrides: Record<string, unknown> = {}) {
  const promptType = String(overrides.prompt_type ?? 'text');
  return {
    id: `request-${promptType}`,
    requester_user_id: 'requester-1',
    recipient_user_id: 'recipient-1',
    prompt_type: promptType,
    prompt_text: `${promptType} prompt`,
    prompt_audio_path: promptVoice.uri,
    prompt_audio_duration_ms: promptVoice.durationMs,
    status: 'pending',
    response_body: null,
    completed_wall_post_id: null,
    created_at: '2026-05-24T10:00:00.000Z',
    expires_at: '2026-06-01T10:00:00.000Z',
    updated_at: '2026-05-24T10:00:00.000Z',
    ...overrides,
  };
}

function savedPromptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'saved-1',
    owner_user_id: 'user-1',
    prompt_type: 'text',
    prompt_text: 'A saved prompt.',
    category: 'Deep',
    source: 'user',
    created_at: '2026-05-24T10:00:00.000Z',
    updated_at: '2026-05-24T12:00:00.000Z',
    ...overrides,
  };
}

function wallPostRow(promptType: MemoryPromptType) {
  return {
    id: `wall-${promptType}`,
    author_user_id: 'recipient-1',
    subject_user_id: 'requester-1',
    subject_contact_id: null,
    visibility: 'visible_to_subject',
    post_type: promptType === 'song' ? 'song' : promptType === 'voice' ? 'voice' : 'note',
    body: '',
    memory_prompt_request_id: `request-${promptType}`,
    prompt_text: `${promptType} prompt`,
    prompt_type: promptType,
    prompt_audio_path: promptVoice.uri,
    prompt_audio_duration_ms: promptVoice.durationMs,
    created_at: '2026-05-24T12:00:00.000Z',
  };
}
