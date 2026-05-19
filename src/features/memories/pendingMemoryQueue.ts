import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { scheduleMemoryDevelopedNotification } from '../../lib/memoryDevelopNotifications';
import { uploadMemoryImage, uploadMemoryVideo } from '../../lib/memoryMediaUpload';
import { createNotification } from '../../lib/notifications';
import { supabase } from '../../lib/supabase';
import { encodeWallPostTextStyle } from '../../lib/wallPostTextStyle';
import { rowToWallPost } from '../social/mappers';
import type { CreateWallPostInput, WallPost } from '../../types/domain';

const PENDING_MEMORY_QUEUE_KEY = 'yourfriends.pendingMemories.v1';
const PENDING_MEDIA_DIR = `${FileSystem.documentDirectory ?? ''}pending-memories`;

export type PendingMemoryStatus = 'saving' | 'waiting' | 'failed';

export interface PendingMemoryRecord {
  id: string;
  authorUserId: string;
  createdAt: string;
  imageUri: string | null;
  videoUri: string | null;
  videoMuted: boolean;
  memoryDate: string | null;
  posts: CreateWallPostInput[];
  status: PendingMemoryStatus;
  error: string | null;
  retryCount: number;
}

export interface AddPendingMemoryInput {
  authorUserId: string;
  imageUri: string | null;
  videoUri?: string | null;
  videoMuted?: boolean;
  memoryDate?: string | null;
  post?: CreateWallPostInput;
  posts?: CreateWallPostInput[];
}

export async function createPendingMemory(input: AddPendingMemoryInput) {
  const posts = input.posts ?? (input.post ? [input.post] : []);
  if (posts.length === 0) throw new Error('Choose at least one wall.');

  const id = `local_memory_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  const imageUri = input.imageUri ? await persistPendingMemoryMedia(input.imageUri, id, 'image') : null;
  const videoUri = input.videoUri ? await persistPendingMemoryMedia(input.videoUri, id, 'video') : null;
  const record: PendingMemoryRecord = {
    id,
    authorUserId: input.authorUserId,
    createdAt,
    imageUri,
    videoUri,
    videoMuted: input.videoMuted ?? false,
    memoryDate: input.memoryDate ?? null,
    posts,
    status: 'saving',
    error: null,
    retryCount: 0,
  };
  await upsertPendingMemory(record);
  return record;
}

export function buildOptimisticWallPosts(record: PendingMemoryRecord): WallPost[] {
  return record.posts.map((entry, index) => {
    const postType = entry.postType ?? (entry.song ? 'song' : record.imageUri ? 'polaroid' : 'note');
    return {
      id: `local_post_${record.id}_${index}`,
      authorUserId: record.authorUserId,
      subjectUserId: entry.subjectUserId,
      subjectContactId: entry.subjectContactId,
      visibility: entry.visibility,
      postType,
      body: entry.body,
      imageUri: record.imageUri,
      videoUri: record.videoUri,
      videoMuted: entry.videoMuted ?? record.videoMuted,
      cardColor: entry.cardColor ?? null,
      backText: entry.backText ?? null,
      filter: postType === 'note'
        ? encodeWallPostTextStyle(entry.textFont, entry.textSize, entry.textEffect, entry.textColor)
        : (entry.filter ?? null),
      textFont: entry.textFont ?? null,
      textSize: entry.textSize ?? null,
      textEffect: entry.textEffect ?? null,
      textColor: entry.textColor ?? null,
      dateStamp: entry.dateStamp ?? false,
      song: entry.song ?? null,
      movie: entry.movie ?? null,
      memoryDate: entry.memoryDate ?? record.memoryDate,
      createdAt: record.createdAt,
      syncStatus: record.status,
      syncError: record.error,
      pendingMemoryId: record.id,
    };
  });
}

export async function loadPendingMemories() {
  const raw = await AsyncStorage.getItem(PENDING_MEMORY_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PendingMemoryRecord[] : [];
  } catch {
    return [];
  }
}

export async function upsertPendingMemory(record: PendingMemoryRecord) {
  const records = await loadPendingMemories();
  const next = [record, ...records.filter((entry) => entry.id !== record.id)];
  await AsyncStorage.setItem(PENDING_MEMORY_QUEUE_KEY, JSON.stringify(next));
}

export async function updatePendingMemoryStatus(id: string, status: PendingMemoryStatus, error: string | null = null) {
  const records = await loadPendingMemories();
  let updated: PendingMemoryRecord | null = null;
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
  await AsyncStorage.setItem(PENDING_MEMORY_QUEUE_KEY, JSON.stringify(next));
  return updated;
}

export async function removePendingMemory(id: string) {
  const records = await loadPendingMemories();
  const removed = records.find((record) => record.id === id);
  await AsyncStorage.setItem(PENDING_MEMORY_QUEUE_KEY, JSON.stringify(records.filter((record) => record.id !== id)));
  if (removed) cleanupPendingMemoryMedia(removed).catch(() => undefined);
}

export async function syncPendingMemory(record: PendingMemoryRecord): Promise<WallPost[]> {
  await updatePendingMemoryStatus(record.id, 'saving');
  let storedImagePath: string | null = null;
  let storedVideoPath: string | null = null;

  if (record.imageUri) {
    storedImagePath = await uploadMemoryImage(record.imageUri, { prefix: record.authorUserId, randomSuffix: false });
  }

  if (record.videoUri) {
    storedVideoPath = await uploadMemoryVideo(record.videoUri, { prefix: record.authorUserId });
  }

  const { data, error } = await supabase
    .from('wall_posts')
    .insert(record.posts.map((entry) => {
      const postType = entry.postType ?? (entry.movie ? 'movie' : entry.song ? 'song' : storedImagePath ? 'polaroid' : 'note');
      return {
        author_user_id: record.authorUserId,
        subject_user_id: entry.subjectUserId,
        subject_contact_id: entry.subjectContactId,
        visibility: entry.visibility,
        post_type: postType,
        body: entry.body,
        image_path: storedImagePath,
        video_path: storedVideoPath,
        video_muted: entry.videoMuted ?? record.videoMuted,
        card_color: entry.cardColor ?? null,
        back_text: entry.backText ?? null,
        filter: postType === 'note'
          ? encodeWallPostTextStyle(entry.textFont, entry.textSize, entry.textEffect, entry.textColor)
          : (entry.filter ?? null),
        date_stamp: entry.dateStamp ?? false,
        memory_date: entry.memoryDate ?? record.memoryDate,
        song_provider: entry.song?.provider ?? null,
        song_provider_id: entry.song?.providerTrackId ?? null,
        song_title: entry.song?.title ?? null,
        song_artist: entry.song?.artist ?? null,
        song_artwork_url: entry.song?.artworkUrl ?? null,
        song_preview_url: entry.song?.previewUrl ?? null,
        song_external_url: entry.song?.externalUrl ?? null,
        movie_tmdb_id: entry.movie?.tmdbId ?? null,
        movie_title: entry.movie?.title ?? null,
        movie_year: entry.movie?.year ?? null,
        movie_poster_url: entry.movie?.posterUrl ?? null,
        movie_overview: entry.movie?.overview ?? null,
        movie_release_date: entry.movie?.releaseDate ?? null,
        movie_vote_average: entry.movie?.voteAverage ?? null,
        movie_review_rating: entry.movie?.reviewRating ?? null,
        movie_review_request_id: entry.movie?.reviewRequestId ?? null,
      };
    }))
    .select()
    .order('created_at', { ascending: false });

  if (error || !data) throw new Error(error?.message ?? 'Failed to create memory');
  const wallPosts = data.map(rowToWallPost);

  await Promise.all(
    wallPosts
      .filter((wallPost) => wallPost.imageUri)
      .map((wallPost) => scheduleMemoryDevelopedNotification(wallPost.id, wallPost.createdAt)
        .catch((err) => console.warn('[cure notification] schedule failed:', err))),
  );

  const { data: authorRow } = await supabase.from('profiles').select('display_name').eq('id', record.authorUserId).single();
  const authorName = authorRow?.display_name ?? 'Someone';
  await Promise.all(wallPosts.map(async (wallPost) => {
    let recipientId: string | null = wallPost.subjectUserId;
    if (!recipientId && wallPost.subjectContactId) {
      const { data: contactRow } = await supabase.from('contacts').select('linked_user_id').eq('id', wallPost.subjectContactId).single();
      recipientId = contactRow?.linked_user_id ?? null;
    }
    if (recipientId && recipientId !== record.authorUserId) {
      createNotification({
        recipientUserId: recipientId,
        actorUserId: record.authorUserId,
        type: 'wall_post',
        referenceId: wallPost.id,
        metadata: {
          wallPostId: wallPost.id,
          postType: wallPost.postType,
          source: 'wall_post',
        },
        message: `${authorName} added a ${wallPost.postType === 'song' ? 'song memory' : 'memory'} about you`,
      }).catch((notificationError) => console.warn('[notification] wall_post insert failed:', notificationError));
    }
  }));

  await removePendingMemory(record.id);
  return wallPosts;
}

async function persistPendingMemoryMedia(uri: string, pendingId: string, kind: 'image' | 'video') {
  if (!FileSystem.documentDirectory) return uri;
  await ensurePendingMediaDirectory();
  const ext = getUriExtension(uri, kind === 'image' ? 'jpg' : 'mp4');
  const targetUri = `${PENDING_MEDIA_DIR}/${pendingId}_${kind}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: targetUri });
  return targetUri;
}

async function ensurePendingMediaDirectory() {
  const info = await FileSystem.getInfoAsync(PENDING_MEDIA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PENDING_MEDIA_DIR, { intermediates: true });
  }
}

function getUriExtension(uri: string, fallback: string) {
  const clean = uri.split('?')[0]?.toLowerCase() ?? '';
  const match = /\.([a-z0-9]+)$/.exec(clean);
  return match?.[1] ?? fallback;
}

async function cleanupPendingMemoryMedia(record: PendingMemoryRecord) {
  await Promise.all([record.imageUri, record.videoUri].filter(Boolean).map(async (uri) => {
    if (!uri?.startsWith(PENDING_MEDIA_DIR)) return;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  }));
}
