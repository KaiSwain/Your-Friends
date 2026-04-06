import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,   // Data is "fresh" for 2 minutes before background refetch
      gcTime: 10 * 60 * 1000,     // Keep unused cache for 10 minutes
      retry: 2,                    // Retry failed queries twice before showing error
      refetchOnWindowFocus: false, // Disabled — not useful in React Native
    },
  },
});
