import { WifiOff, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui';
import { useOfflineSync } from '../offline/useOfflineSync';

export function OfflineSyncBanner() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();

  // If online and no items pending, render nothing
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <aside
      aria-label="Offline Sync Status"
      className={`border-b px-4 py-2.5 text-xs font-medium transition-colors ${
        !isOnline
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'bg-primary/10 border-primary/30 text-primary'
      }`}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <WifiOff className="h-4 w-4 shrink-0 animate-pulse" />
              <span>
                <strong>Offline Mode Active</strong> — changes saved locally to IndexedDB and will
                auto-sync when online.
              </span>
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 shrink-0" />
              <span>
                <strong>
                  {pendingCount} offline change{pendingCount === 1 ? '' : 's'} queued
                </strong>{' '}
                — ready to sync with cloud.
              </span>
            </>
          )}
        </div>

        {isOnline && pendingCount > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void syncNow()}
            disabled={isSyncing}
            className="flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </Button>
        )}

        {!isOnline && pendingCount > 0 && (
          <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
            {pendingCount} Queued
          </span>
        )}
      </div>
    </aside>
  );
}
