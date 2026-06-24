import type { QueryClient } from '@tanstack/react-query';

import { socialQueryKeys } from '../social/queries';
import type { WallPost } from '../../types/domain';
import {
  applyPendingMemoryEditToPost,
  loadPendingMemoryEdits,
  syncPendingMemoryEdit,
  updatePendingMemoryEditStatus,
  type PendingMemoryEditRecord,
} from './pendingMemoryEditQueue';

export function applyPendingMemoryEditsToCache(queryClient: QueryClient, records: PendingMemoryEditRecord[]) {
  if (records.length === 0) return;
  const sortedRecords = [...records].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
    applyPendingRecords(old ?? [], sortedRecords),
  );
}

export async function retryPendingMemoryEdit(queryClient: QueryClient, pendingEditId: string) {
  const records = await loadPendingMemoryEdits();
  const record = records.find((entry) => entry.id === pendingEditId);
  if (!record) return;
  await syncPendingMemoryEditToCache(queryClient, record);
}

// Mirrors the guard in pendingMemorySync: prevents the same edit from syncing
// twice when launch/foreground/reconnect triggers overlap.
const inFlightEditSyncIds = new Set<string>();

export async function syncAllPendingMemoryEdits(queryClient: QueryClient) {
  const records = await loadPendingMemoryEdits();
  applyPendingMemoryEditsToCache(queryClient, records);
  await Promise.all(records.map((record) => syncPendingMemoryEditToCache(queryClient, record)));
}

export async function syncPendingMemoryEditToCache(queryClient: QueryClient, record: PendingMemoryEditRecord) {
  if (inFlightEditSyncIds.has(record.id)) return;
  inFlightEditSyncIds.add(record.id);
  markPendingMemoryEditInCache(queryClient, { ...record, status: 'saving', error: null });
  try {
    const syncedPost = await syncPendingMemoryEdit(record);
    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
      (old ?? []).map((post) => {
        if (post.id !== record.postId) return post;
        if (post.pendingEditId && post.pendingEditId !== record.id) return post;
        return {
          ...syncedPost,
          syncStatus: undefined,
          syncError: null,
          pendingEditId: null,
        };
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not sync memory edit.';
    const status = isConnectionError(message) ? 'waiting' : 'failed';
    const updated = await updatePendingMemoryEditStatus(record.id, status, message);
    markPendingMemoryEditInCache(queryClient, updated ?? { ...record, status, error: message });
  } finally {
    inFlightEditSyncIds.delete(record.id);
  }
}

function markPendingMemoryEditInCache(queryClient: QueryClient, record: PendingMemoryEditRecord) {
  queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
    applyPendingRecords(old ?? [], [record]),
  );
}

function applyPendingRecords(posts: WallPost[], records: PendingMemoryEditRecord[]) {
  return posts.map((post) => {
    const record = records.find((entry) => entry.postId === post.id);
    return record ? applyPendingMemoryEditToPost(post, record) : post;
  });
}

function isConnectionError(message: string) {
  return /network|offline|timed out|fetch|connection/i.test(message);
}
