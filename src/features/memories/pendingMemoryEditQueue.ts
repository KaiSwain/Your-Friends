import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { uploadMemoryAudio, uploadMemoryImageVariants } from '../../lib/memoryMediaUpload';
import { supabase } from '../../lib/supabase';
import { splitWallPostPresentation } from '../../lib/wallPostTextStyle';
import { rowToWallPost } from '../social/mappers';
import type { SongAttachment, VoiceAttachment, WallPost, WallPostVisibility } from '../../types/domain';

const PENDING_MEMORY_EDIT_QUEUE_KEY = 'yourfriends.pendingMemoryEdits.v1';
const PENDING_EDIT_MEDIA_DIR = `${FileSystem.documentDirectory ?? ''}pending-memory-edits`;

export type PendingMemoryEditStatus = 'saving' | 'waiting' | 'failed';

export interface PendingMemoryEditUpdates {
  body: string;
  hasImageChange: boolean;
  imageUri: string | null;
  cardColor?: string | null;
  backText?: string | null;
  filter?: string | null;
  visibility?: WallPostVisibility;
  song?: SongAttachment | null;
  videoMuted?: boolean;
  locationName?: string | null;
  memoryDate?: string | null;
  hasVoiceChange: boolean;
  voice?: VoiceAttachment | null;
}

export interface PendingMemoryEditRecord {
  id: string;
  postId: string;
  authorUserId: string;
  createdAt: string;
  updates: PendingMemoryEditUpdates;
  status: PendingMemoryEditStatus;
  error: string | null;
  retryCount: number;
}

export async function createPendingMemoryEdit(input: {
  postId: string;
  authorUserId: string;
  updates: PendingMemoryEditUpdates;
}) {
  const id = `local_memory_edit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const imageUri = input.updates.hasImageChange && input.updates.imageUri && isLocalMediaUri(input.updates.imageUri)
    ? await persistPendingEditMedia(input.updates.imageUri, id, 'image')
    : input.updates.imageUri;
  const voice = input.updates.hasVoiceChange && input.updates.voice?.uri && isLocalMediaUri(input.updates.voice.uri)
    ? { ...input.updates.voice, uri: await persistPendingEditMedia(input.updates.voice.uri, id, 'audio') }
    : input.updates.voice;
  const record: PendingMemoryEditRecord = {
    id,
    postId: input.postId,
    authorUserId: input.authorUserId,
    createdAt: new Date().toISOString(),
    updates: {
      ...input.updates,
      imageUri,
      voice,
    },
    status: 'saving',
    error: null,
    retryCount: 0,
  };
  await upsertPendingMemoryEdit(record);
  return record;
}

export function applyPendingMemoryEditToPost(post: WallPost, record: PendingMemoryEditRecord): WallPost {
  const updates = record.updates;
  const updated: WallPost = {
    ...post,
    body: updates.body,
    syncStatus: record.status,
    syncError: record.error,
    pendingEditId: record.id,
  };
  if (updates.hasImageChange) {
    updated.imageUri = updates.imageUri;
    updated.imageThumbUri = updates.imageUri;
  }
  if (updates.cardColor !== undefined) updated.cardColor = updates.cardColor;
  if (updates.backText !== undefined) updated.backText = updates.backText;
  if (updates.filter !== undefined) {
    const presentation = splitWallPostPresentation(updates.filter);
    updated.filter = presentation.filter;
    updated.textFont = presentation.textFont;
    updated.textSize = presentation.textSize;
    updated.textEffect = presentation.textEffect;
    updated.textColor = presentation.textColor;
  }
  if (updates.visibility !== undefined) updated.visibility = updates.visibility;
  if (updates.song !== undefined) updated.song = updates.song;
  if (updates.videoMuted !== undefined) updated.videoMuted = updates.videoMuted;
  if (updates.locationName !== undefined) updated.locationName = updates.locationName;
  if (updates.memoryDate !== undefined) updated.memoryDate = updates.memoryDate;
  if (updates.hasVoiceChange) updated.voice = updates.voice ?? null;
  return updated;
}

export async function loadPendingMemoryEdits() {
  const raw = await AsyncStorage.getItem(PENDING_MEMORY_EDIT_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PendingMemoryEditRecord[] : [];
  } catch {
    return [];
  }
}

export async function upsertPendingMemoryEdit(record: PendingMemoryEditRecord) {
  const records = await loadPendingMemoryEdits();
  const next = [record, ...records.filter((entry) => entry.id !== record.id && entry.postId !== record.postId)];
  await AsyncStorage.setItem(PENDING_MEMORY_EDIT_QUEUE_KEY, JSON.stringify(next));
}

export async function updatePendingMemoryEditStatus(id: string, status: PendingMemoryEditStatus, error: string | null = null) {
  const records = await loadPendingMemoryEdits();
  let updated: PendingMemoryEditRecord | null = null;
  const next = records.map((record) => {
    if (record.id !== id) return record;
    updated = {
      ...record,
      status,
      error,
      retryCount: status === 'failed' || status === 'waiting' ? record.retryCount + 1 : record.retryCount,
    };
    return updated;
  });
  await AsyncStorage.setItem(PENDING_MEMORY_EDIT_QUEUE_KEY, JSON.stringify(next));
  return updated;
}

export async function removePendingMemoryEdit(id: string) {
  const records = await loadPendingMemoryEdits();
  const removed = records.find((record) => record.id === id);
  await AsyncStorage.setItem(PENDING_MEMORY_EDIT_QUEUE_KEY, JSON.stringify(records.filter((record) => record.id !== id)));
  if (removed) cleanupPendingEditMedia(removed).catch(() => undefined);
}

export async function syncPendingMemoryEdit(record: PendingMemoryEditRecord): Promise<WallPost> {
  await updatePendingMemoryEditStatus(record.id, 'saving');
  const updateData: Record<string, unknown> = { body: record.updates.body };

  if (record.updates.visibility !== undefined) updateData.visibility = record.updates.visibility;
  if (record.updates.backText !== undefined) updateData.back_text = record.updates.backText;
  if (record.updates.cardColor !== undefined) updateData.card_color = record.updates.cardColor;
  if (record.updates.filter !== undefined) updateData.filter = record.updates.filter;
  if (record.updates.song !== undefined) {
    updateData.song_provider = record.updates.song?.provider ?? null;
    updateData.song_provider_id = record.updates.song?.providerTrackId ?? null;
    updateData.song_title = record.updates.song?.title ?? null;
    updateData.song_artist = record.updates.song?.artist ?? null;
    updateData.song_artwork_url = record.updates.song?.artworkUrl ?? null;
    updateData.song_preview_url = record.updates.song?.previewUrl ?? null;
    updateData.song_external_url = record.updates.song?.externalUrl ?? null;
  }
  if (record.updates.videoMuted !== undefined) updateData.video_muted = record.updates.videoMuted;
  if (record.updates.locationName !== undefined) updateData.location_name = record.updates.locationName;
  if (record.updates.memoryDate !== undefined) updateData.memory_date = record.updates.memoryDate;

  if (record.updates.hasVoiceChange) {
    const voice = record.updates.voice;
    const uploadedVoiceUri = voice?.uri && isLocalMediaUri(voice.uri)
      ? await uploadMemoryAudio(voice.uri, { prefix: `${record.authorUserId}/voice` })
      : voice?.uri ?? null;
    updateData.audio_path = uploadedVoiceUri;
    updateData.audio_duration_ms = voice?.durationMs ?? null;
  }

  if (record.updates.hasImageChange) {
    if (record.updates.imageUri) {
      const uploadedImage = await uploadMemoryImageVariants(record.updates.imageUri, { prefix: record.authorUserId, randomSuffix: false });
      updateData.image_path = uploadedImage.imageUri;
      updateData.image_thumb_path = uploadedImage.imageThumbUri;
    } else {
      updateData.image_path = null;
      updateData.image_thumb_path = null;
    }
  }

  const { data, error } = await supabase
    .from('wall_posts')
    .update(updateData)
    .eq('id', record.postId)
    .eq('author_user_id', record.authorUserId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Could not update memory.');

  await removePendingMemoryEdit(record.id);
  return rowToWallPost(data);
}

function isLocalMediaUri(uri: string) {
  return /^(file|ph|assets-library|content):/i.test(uri);
}

async function persistPendingEditMedia(uri: string, pendingId: string, kind: 'image' | 'audio') {
  if (!FileSystem.documentDirectory) return uri;
  await ensurePendingEditMediaDirectory();
  const ext = getUriExtension(uri, kind === 'image' ? 'jpg' : 'm4a');
  const targetUri = `${PENDING_EDIT_MEDIA_DIR}/${pendingId}_${kind}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: targetUri });
  return targetUri;
}

async function ensurePendingEditMediaDirectory() {
  const info = await FileSystem.getInfoAsync(PENDING_EDIT_MEDIA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PENDING_EDIT_MEDIA_DIR, { intermediates: true });
  }
}

function getUriExtension(uri: string, fallback: string) {
  const clean = uri.split('?')[0]?.toLowerCase() ?? '';
  const match = /\.([a-z0-9]+)$/.exec(clean);
  return match?.[1] ?? fallback;
}

async function cleanupPendingEditMedia(record: PendingMemoryEditRecord) {
  const uris = [
    record.updates.hasImageChange ? record.updates.imageUri : null,
    record.updates.hasVoiceChange ? record.updates.voice?.uri : null,
  ];
  await Promise.all(uris.filter(Boolean).map(async (uri) => {
    if (!uri?.startsWith(PENDING_EDIT_MEDIA_DIR)) return;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  }));
}
