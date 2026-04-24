import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,  // Keep startup-critical cached data fresh long enough to render immediately on relaunch
      gcTime: 24 * 60 * 60 * 1000, // Keep cache for 24 hours (needed for offline persistence)
      retry: 2,                    // Retry failed queries twice before showing error
      refetchOnWindowFocus: false, // Disabled — not useful in React Native
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'yourfriends-query-cache',
});
