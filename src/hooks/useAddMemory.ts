import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { CURE_DURATION_MS } from '../lib/polaroidCure';
import { socialQueryKeys } from '../features/social/SocialGraphContext';
import { useInAppNotification } from '../features/notifications/InAppNotificationContext';
import { CreateWallPostInput, WallPost } from '../types/domain';
import { compareWallPostsByMemoryDateDesc } from '../lib/memoryDate';
import { buildOptimisticWallPosts, createPendingMemory, type PendingMemoryRecord } from '../features/memories/pendingMemoryQueue';
import { syncPendingMemoryToCache } from '../features/memories/pendingMemorySync';

interface AddMemoryInput {
  authorUserId: string;
  imageUri: string | null;
  videoUri?: string | null;
  videoMuted?: boolean;
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
  const { showLocal } = useInAppNotification();

  return useMutation({
    mutationFn: createLocalMemory,
    onSuccess: ({ record, posts }) => {
      queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) => [...posts, ...(old ?? [])].sort(compareWallPostsByMemoryDateDesc));
      syncPendingMemoryToCache(queryClient, record).catch((error) => console.warn('[pending memories] immediate sync failed:', error));
      if (posts.some((newPost) => newPost.imageUri)) {
        setTimeout(() => {
          if (AppState.currentState !== 'active') return;
          showLocal(
            posts.length > 1 ? 'Your shared memory cards have developed!' : 'Your memory card has developed!',
            { referenceId: posts[0]?.id },
          );
        }, CURE_DURATION_MS);
      }
    },
  });
}
