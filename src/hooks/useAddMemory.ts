import { useMutation, useQueryClient } from '@tanstack/react-query';
import { socialQueryKeys } from '../features/social/SocialGraphContext';
import { CreateWallPostInput, WallPost } from '../types/domain';
import { compareWallPostsByMemoryDateDesc } from '../lib/memoryDate';
import { buildOptimisticWallPosts, createPendingMemory, type PendingMemoryRecord } from '../features/memories/pendingMemoryQueue';
import { syncPendingMemoryToCache } from '../features/memories/pendingMemorySync';
import { recordReviewableMoment } from '../lib/appReview';

interface AddMemoryInput {
  authorUserId: string;
  imageUri: string | null;
  videoUri?: string | null;
  videoMuted?: boolean;
  audioUri?: string | null;
  audioDurationMs?: number | null;
  memoryDate?: string | null;
  post?: CreateWallPostInput;
  posts?: CreateWallPostInput[];
}

async function createLocalMemory(input: AddMemoryInput): Promise<{ record: PendingMemoryRecord; posts: WallPost[] }> {
  const record = await createPendingMemory(input);
  return { record, posts: buildOptimisticWallPosts(record) };
}


/** Mutation hook for creating a memory (optional image upload + wall post). */
export function useAddMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLocalMemory,
    onSuccess: ({ record, posts }) => {
      queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) => [...posts, ...(old ?? [])].sort(compareWallPostsByMemoryDateDesc));
      syncPendingMemoryToCache(queryClient, record).catch((error) => console.warn('[pending memories] immediate sync failed:', error));
      // Creating a memory is a core delightful moment; count it toward asking
      // for an App Store review (gated + spaced out inside the helper).
      void recordReviewableMoment();
    },
  });
}
