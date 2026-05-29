import { describe, expect, it } from '@jest/globals';

import { rowToMemoryPromptRequest, rowToSavedMemoryPrompt, songToPromptResponseDbColumns, songToWallPostDbColumns, voiceToPromptQuestionDbColumns, voiceToPromptResponseDbColumns } from '../mappers';

describe('rowToMemoryPromptRequest', () => {
  it.each(['song', 'text', 'photo', 'photo_reference', 'voice'] as const)('maps %s prompt requests', (promptType) => {
    const request = rowToMemoryPromptRequest({
      id: `prompt-${promptType}`,
      requester_user_id: 'requester-1',
      recipient_user_id: 'recipient-1',
      prompt_type: promptType,
      prompt_text: 'Answer this.',
      status: 'pending',
      created_at: '2026-05-01T00:00:00Z',
    });

    expect(request.promptType).toBe(promptType);
    expect(request.status).toBe('pending');
  });

  it('maps snake_case rows to MemoryPromptRequest', () => {
    expect(rowToMemoryPromptRequest({
      id: 'prompt-1',
      requester_user_id: 'requester-1',
      recipient_user_id: 'recipient-1',
      prompt_type: 'song',
      prompt_text: 'What song reminds you of us?',
      prompt_audio_path: 'https://audio.test/prompt.m4a',
      prompt_audio_duration_ms: 9000,
      status: 'completed',
      response_body: 'Late night drives.',
      response_audio_path: 'https://audio.test/response.m4a',
      response_audio_duration_ms: '15000',
      response_song_provider: 'apple',
      response_song_provider_id: '12345',
      response_song_title: 'Golden Hour',
      response_song_artist: 'Friend Band',
      response_song_artwork_url: 'https://img.test/art.jpg',
      response_song_preview_url: 'https://audio.test/preview.m4a',
      response_song_external_url: 'https://music.test/song',
      referenced_wall_post_id: 'post-ref',
      completed_wall_post_id: 'post-1',
      created_at: '2026-05-01T00:00:00Z',
      expires_at: '2026-05-08T00:00:00Z',
      updated_at: '2026-05-02T00:00:00Z',
      completed_at: '2026-05-02T00:00:00Z',
    })).toEqual({
      id: 'prompt-1',
      requesterUserId: 'requester-1',
      recipientUserId: 'recipient-1',
      promptType: 'song',
      promptText: 'What song reminds you of us?',
      promptVoice: {
        uri: 'https://audio.test/prompt.m4a',
        durationMs: 9000,
      },
      status: 'completed',
      responseBody: 'Late night drives.',
      responseSong: {
        provider: 'apple',
        providerTrackId: '12345',
        title: 'Golden Hour',
        artist: 'Friend Band',
        artworkUrl: 'https://img.test/art.jpg',
        previewUrl: 'https://audio.test/preview.m4a',
        externalUrl: 'https://music.test/song',
      },
      responseVoice: {
        uri: 'https://audio.test/response.m4a',
        durationMs: 15000,
      },
      referencedWallPostId: 'post-ref',
      completedWallPostId: 'post-1',
      createdAt: '2026-05-01T00:00:00Z',
      expiresAt: '2026-05-08T00:00:00Z',
      updatedAt: '2026-05-02T00:00:00Z',
      completedAt: '2026-05-02T00:00:00Z',
    });
  });

  it('defaults unknown status and prompt type safely', () => {
    const request = rowToMemoryPromptRequest({
      id: 'prompt-1',
      requester_user_id: 'requester-1',
      recipient_user_id: 'recipient-1',
      prompt_type: 'weird',
      prompt_text: 'Prompt',
      status: 'unknown',
      created_at: '2026-05-01T00:00:00Z',
    });
    expect(request.promptType).toBe('song');
    expect(request.status).toBe('pending');
  });
});

describe('rowToSavedMemoryPrompt', () => {
  it('maps saved prompt rows', () => {
    expect(rowToSavedMemoryPrompt({
      id: 'saved-1',
      owner_user_id: 'user-1',
      prompt_type: 'photo',
      prompt_text: 'Send a photo that feels like us.',
      category: 'Photo',
      source: 'ai',
      created_at: '2026-05-24T10:00:00.000Z',
      updated_at: '2026-05-24T12:00:00.000Z',
    })).toEqual({
      id: 'saved-1',
      ownerUserId: 'user-1',
      promptType: 'photo',
      promptText: 'Send a photo that feels like us.',
      category: 'Photo',
      source: 'ai',
      createdAt: '2026-05-24T10:00:00.000Z',
      updatedAt: '2026-05-24T12:00:00.000Z',
    });
  });

  it('defaults unknown prompt type and source safely', () => {
    const prompt = rowToSavedMemoryPrompt({
      id: 'saved-1',
      owner_user_id: 'user-1',
      prompt_type: 'unknown',
      prompt_text: 'Prompt',
      source: 'robot',
      created_at: '2026-05-24T10:00:00.000Z',
    });
    expect(prompt.promptType).toBe('song');
    expect(prompt.source).toBe('user');
  });
});

describe('voice db column helpers', () => {
  const voice = {
    uri: 'https://audio.test/note.m4a',
    durationMs: 11000,
  };

  it('maps prompt question voice columns', () => {
    expect(voiceToPromptQuestionDbColumns(voice)).toEqual({
      prompt_audio_path: 'https://audio.test/note.m4a',
      prompt_audio_duration_ms: 11000,
    });
  });

  it('maps response voice columns', () => {
    expect(voiceToPromptResponseDbColumns(voice)).toEqual({
      response_audio_path: 'https://audio.test/note.m4a',
      response_audio_duration_ms: 11000,
    });
  });
});

describe('song db column helpers', () => {
  const song = {
    provider: 'apple' as const,
    providerTrackId: '12345',
    title: 'Golden Hour',
    artist: 'Friend Band',
    artworkUrl: null,
    previewUrl: 'https://audio.test/preview.m4a',
    externalUrl: null,
  };

  it('maps response song columns', () => {
    expect(songToPromptResponseDbColumns(song)).toMatchObject({
      response_song_provider: 'apple',
      response_song_provider_id: '12345',
      response_song_title: 'Golden Hour',
      response_song_artist: 'Friend Band',
    });
  });

  it('maps wall post song columns', () => {
    expect(songToWallPostDbColumns(song)).toMatchObject({
      song_provider: 'apple',
      song_provider_id: '12345',
      song_title: 'Golden Hour',
      song_artist: 'Friend Band',
    });
  });
});
