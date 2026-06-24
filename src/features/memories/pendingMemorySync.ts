import type { QueryClient } from '@tanstack/react-query';

import { compareWallPostsByMemoryDateDesc } from '../../lib/memoryDate';
import { socialQueryKeys } from '../social/SocialGraphContext';
import type { WallPost } from '../../types/domain';
import {
  buildOptimisticWallPosts,
  loadPendingMemories,
  type PendingMemoryRecord,
  syncPendingMemory,
  updatePendingMemoryStatus,
} from './pendingMemoryQueue';

export function applyPendingMemoriesToCache(queryClient: QueryClient, records: PendingMemoryRecord[]) {
  if (records.length === 0) return;
  const optimisticPosts = records.flatMap(buildOptimisticWallPosts);
  queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) =>
    mergeWallPosts(optimisticPosts, old ?? []),
  );
}

export async function retryPendingMemory(queryClient: QueryClient, pendingMemoryId: string) {
  const records = await loadPendingMemories();
  const record = records.find((entry) => entry.id === pendingMemoryId);
  if (!record) return;
  await syncPendingMemoryToCache(queryClient, record);
}

// Guards against the same pending memory being uploaded twice at once. Sync can
// be triggered concurrently (app launch, foreground, and reconnect), and because
// the upload is a non-idempotent INSERT that only removes the queue record after
// it finishes, an unguarded double-run would create duplicate memories.
const inFlightSyncIds = new Set<string>();

export async function syncAllPendingMemories(queryClient: QueryClient) {
  const records = await loadPendingMemories();
  applyPendingMemoriesToCache(queryClient, records);
  await Promise.all(records.map((record) => syncPendingMemoryToCache(queryClient, record)));
}

export async function syncPendingMemoryToCache(queryClient: QueryClient, record: PendingMemoryRecord) {
  if (inFlightSyncIds.has(record.id)) return;
  inFlightSyncIds.add(record.id);
  markPendingMemoryInCache(queryClient, { ...record, status: 'saving', error: null });
  try {
    const syncedPosts = await syncPendingMemory(record);
    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) => {
      const withoutPending = (old ?? []).filter((post) => post.pendingMemoryId !== record.id);
      return mergeWallPosts(syncedPosts, withoutPending);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not sync memory.';
    const status = isConnectionError(message) ? 'waiting' : 'failed';
    const updated = await updatePendingMemoryStatus(record.id, status, message);
    markPendingMemoryInCache(queryClient, updated ?? { ...record, status, error: message });
  } finally {
    inFlightSyncIds.delete(record.id);
  }
}

function markPendingMemoryInCache(queryClient: QueryClient, record: PendingMemoryRecord) {
  const optimisticPosts = buildOptimisticWallPosts(record);
  queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) => {
    const withoutPending = (old ?? []).filter((post) => post.pendingMemoryId !== record.id);
    return mergeWallPosts(optimisticPosts, withoutPending);
  });
}

function mergeWallPosts(incoming: WallPost[], current: WallPost[]) {
  const seen = new Set<string>();
  const merged: WallPost[] = [];
  for (const post of [...incoming, ...current]) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    merged.push(post);
  }
  return merged.sort(compareWallPostsByMemoryDateDesc);
}

function isConnectionError(message: string) {
  return /network|offline|timed out|fetch|connection/i.test(message);
}
