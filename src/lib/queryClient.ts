import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient, onlineManager } from '@tanstack/react-query';

// Tell React Query about real connectivity so it pauses fetches while offline
// and automatically resumes/refetches the moment the device reconnects.
onlineManager.setEventListener((setOnline) => {
  const subscription = NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false && state.isInternetReachable !== false);
  });
  return subscription;
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,  // Keep startup-critical cached data fresh long enough to render immediately on relaunch
      gcTime: 7 * 24 * 60 * 60 * 1000, // Keep cache for 7 days so the app still renders after extended offline stretches
      networkMode: 'offlineFirst', // Serve cached data immediately and only hit the network when actually online
      retry: 2,                    // Retry failed queries twice before showing error
      refetchOnWindowFocus: false, // Disabled — not useful in React Native
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'yourfriends-query-cache',
});
