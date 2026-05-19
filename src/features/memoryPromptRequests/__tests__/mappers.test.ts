import { describe, expect, it } from '@jest/globals';

import { rowToMemoryPromptRequest, songToPromptResponseDbColumns, songToWallPostDbColumns } from '../mappers';

describe('rowToMemoryPromptRequest', () => {
  it('maps snake_case rows to MemoryPromptRequest', () => {
    expect(rowToMemoryPromptRequest({
      id: 'prompt-1',
      requester_user_id: 'requester-1',
      recipient_user_id: 'recipient-1',
      prompt_type: 'song',
      prompt_text: 'What song reminds you of us?',
      status: 'completed',
      response_body: 'Late night drives.',
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
      updated_at: '2026-05-02T00:00:00Z',
      completed_at: '2026-05-02T00:00:00Z',
    })).toEqual({
      id: 'prompt-1',
      requesterUserId: 'requester-1',
      recipientUserId: 'recipient-1',
      promptType: 'song',
      promptText: 'What song reminds you of us?',
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
      referencedWallPostId: 'post-ref',
      completedWallPostId: 'post-1',
      createdAt: '2026-05-01T00:00:00Z',
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
