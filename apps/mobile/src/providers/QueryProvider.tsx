import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { syncMonthVersionFromETag } from '../lib/monthVersion';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // API-26: the `ETag` of every month-scoped response refreshes the cached month version.
  useEffect(() => syncMonthVersionFromETag(queryClient), []);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
