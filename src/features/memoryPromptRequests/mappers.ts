import type { MemoryPromptRequest, MemoryPromptRequestStatus, MemoryPromptType, SongAttachment, VoiceAttachment } from '../../types/domain';
import { rowToVoiceAttachment, voiceToDbColumns } from '../../lib/voiceAttachmentDb';
import { getPromptExpiresAt } from '../../lib/promptExpiration';

export function rowToMemoryPromptRequest(row: any): MemoryPromptRequest {
  return {
    id: row.id,
    requesterUserId: row.requester_user_id,
    recipientUserId: row.recipient_user_id,
    promptType: normalizeMemoryPromptType(row.prompt_type),
    promptText: String(row.prompt_text ?? ''),
    promptVoice: rowToVoiceAttachment(row, 'prompt'),
    status: normalizeMemoryPromptRequestStatus(row.status),
    responseBody: row.response_body ?? null,
    responseSong: rowToResponseSong(row),
    responseVoice: rowToVoiceAttachment(row, 'response'),
    referencedWallPostId: row.referenced_wall_post_id ?? null,
    completedWallPostId: row.completed_wall_post_id ?? null,
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? getPromptExpiresAt(row.created_at),
    updatedAt: row.updated_at ?? row.created_at,
    completedAt: row.completed_at ?? null,
  };
}

export function songToPromptResponseDbColumns(song: SongAttachment | null | undefined) {
  return {
    response_song_provider: song?.provider ?? null,
    response_song_provider_id: song?.providerTrackId ?? null,
    response_song_title: song?.title ?? null,
    response_song_artist: song?.artist ?? null,
    response_song_artwork_url: song?.artworkUrl ?? null,
    response_song_preview_url: song?.previewUrl ?? null,
    response_song_external_url: song?.externalUrl ?? null,
  };
}

export function songToWallPostDbColumns(song: SongAttachment | null | undefined) {
  return {
    song_provider: song?.provider ?? null,
    song_provider_id: song?.providerTrackId ?? null,
    song_title: song?.title ?? null,
    song_artist: song?.artist ?? null,
    song_artwork_url: song?.artworkUrl ?? null,
    song_preview_url: song?.previewUrl ?? null,
    song_external_url: song?.externalUrl ?? null,
  };
}

export function voiceToPromptResponseDbColumns(voice: VoiceAttachment | null | undefined) {
  return voiceToDbColumns('response', voice);
}

export function voiceToWallPostDbColumns(voice: VoiceAttachment | null | undefined) {
  return voiceToDbColumns('', voice);
}

export function voiceToPromptQuestionDbColumns(voice: VoiceAttachment | null | undefined) {
  return voiceToDbColumns('prompt', voice);
}

function rowToResponseSong(row: any): SongAttachment | null {
  const provider = row.response_song_provider;
  const providerTrackId = row.response_song_provider_id;
  const title = row.response_song_title;
  const artist = row.response_song_artist;
  if ((provider !== 'apple' && provider !== 'spotify') || !providerTrackId || !title || !artist) {
    return null;
  }
  return {
    provider,
    providerTrackId: String(providerTrackId),
    title: String(title),
    artist: String(artist),
    artworkUrl: row.response_song_artwork_url ?? null,
    previewUrl: row.response_song_preview_url ?? null,
    externalUrl: row.response_song_external_url ?? null,
  };
}

function normalizeMemoryPromptType(value: unknown): MemoryPromptType {
  if (value === 'song' || value === 'text' || value === 'photo' || value === 'photo_reference' || value === 'voice') return value;
  return 'song';
}

function normalizeMemoryPromptRequestStatus(value: unknown): MemoryPromptRequestStatus {
  if (value === 'completed' || value === 'cancelled') return value;
  return 'pending';
}

