import { ReactNode, useEffect } from 'react';
import { AppState } from 'react-native';
import { onlineManager, useQueryClient } from '@tanstack/react-query';

import { replayPrivateNoteOps } from '../social/privateNoteQueue';
import { syncAllPendingMemories } from './pendingMemorySync';
import { syncAllPendingMemoryEdits } from './pendingMemoryEditSync';

export function PendingMemorySyncProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    syncAllPendingWork(queryClient).catch((error) => console.warn('[pending sync] initial sync failed:', error));
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncAllPendingWork(queryClient).catch((error) => console.warn('[pending sync] foreground sync failed:', error));
      }
    });
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (online) {
        syncAllPendingWork(queryClient).catch((error) => console.warn('[pending sync] reconnect sync failed:', error));
      }
    });
    return () => {
      subscription.remove();
      unsubscribeOnline();
    };
  }, [queryClient]);

  return <>{children}</>;
}

async function syncAllPendingWork(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    syncAllPendingMemories(queryClient),
    syncAllPendingMemoryEdits(queryClient),
    replayPrivateNoteOps(),
  ]);
}
