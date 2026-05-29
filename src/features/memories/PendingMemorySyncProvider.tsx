import { ReactNode, useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { syncAllPendingMemories } from './pendingMemorySync';
import { syncAllPendingMemoryEdits } from './pendingMemoryEditSync';

export function PendingMemorySyncProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    syncAllPendingWork(queryClient).catch((error) => console.warn('[pending memories] initial sync failed:', error));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncAllPendingWork(queryClient).catch((error) => console.warn('[pending memories] foreground sync failed:', error));
      }
    });
    return () => subscription.remove();
  }, [queryClient]);

  return <>{children}</>;
}

async function syncAllPendingWork(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    syncAllPendingMemories(queryClient),
    syncAllPendingMemoryEdits(queryClient),
  ]);
}
