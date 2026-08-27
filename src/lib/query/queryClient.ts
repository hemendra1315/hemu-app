import {
  dehydrate,
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';

import { ApiErrorCode, toApiError } from '@/lib/api';
import { reportError } from '@/lib/logger';
import { saveOfflineQueryCache } from '@/lib/offline/indexedDb';

/**
 * App-wide TanStack Query client. Auth/permission errors are never retried;
 * transient network errors are retried with exponential backoff.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 24 * 60 * 60_000, // 24 hours to support offline resumption
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const { code } = toApiError(error);
          const fatal: string[] = [
            ApiErrorCode.UNAUTHENTICATED,
            ApiErrorCode.FORBIDDEN,
            ApiErrorCode.NOT_FOUND,
            ApiErrorCode.VALIDATION,
          ];
          if (fatal.includes(code)) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: { retry: 0 },
    },
    queryCache: new QueryCache({
      onError: (error, query) => reportError(error, { scope: 'query', key: query.queryHash }),
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) =>
        reportError(error, { scope: 'mutation', key: mutation.options.mutationKey }),
    }),
  });
}

export const queryClient = createQueryClient();

// Setup IndexedDB automatic query persistence
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleCacheSave() {
  if (typeof window === 'undefined') return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const dehydrated = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) => query.state.status === 'success',
      });
      await saveOfflineQueryCache(dehydrated);
    } catch {
      // Ignore cache persistence failures
    }
  }, 1000);
}

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === 'updated' && event.query.state.status === 'success') {
    scheduleCacheSave();
  }
});

