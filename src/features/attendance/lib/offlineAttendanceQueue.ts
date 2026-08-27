import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import {
  enqueueAttendanceItem,
  getAllQueuedAttendance,
  getQueuedAttendanceForSession,
  removeQueuedAttendanceItem,
  type QueuedAttendanceItem,
} from '@/lib/offline/indexedDb';
import { markAttendance, fetchSessionAttendance } from '../api/attendanceApi';
import type { AttendanceRecord } from '../api/attendanceTypes';
import { queryClient } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/keys';
import { logger } from '@/lib/logger';
import { useUiStore } from '@/stores';
import type { UUID } from '@/types';
import type { AttendanceStatus } from '@/types/enums';

const QUEUE_CHANGE_EVENT = 'cam_offline_attendance_queue_changed';
let queueVersion = 0;
const listeners = new Set<() => void>();

function notifyQueueChanged() {
  queueVersion++;
  listeners.forEach((l) => l());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(QUEUE_CHANGE_EVENT));
  }
}

function subscribeQueue(callback: () => void) {
  listeners.add(callback);
  if (typeof window !== 'undefined') {
    window.addEventListener(QUEUE_CHANGE_EVENT, callback);
    window.addEventListener('online', callback);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener(QUEUE_CHANGE_EVENT, callback);
      window.removeEventListener('online', callback);
    }
  };
}

let isSyncInProgress = false;

export async function syncOfflineAttendanceQueue(
  onSuccessToast?: (msg: string) => void,
  onErrorToast?: (title: string, msg: string) => void,
): Promise<{ syncedCount: number; failedCount: number }> {
  if (isSyncInProgress || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { syncedCount: 0, failedCount: 0 };
  }

  isSyncInProgress = true;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const items = await getAllQueuedAttendance();
    if (items.length === 0) {
      isSyncInProgress = false;
      return { syncedCount: 0, failedCount: 0 };
    }

    const affectedSessions = new Set<string>();
    const affectedAcademies = new Set<string>();

    // Cache server attendance list by session to minimize network roundtrips
    const serverAttendanceCache = new Map<string, AttendanceRecord[]>();

    for (const item of items) {
      try {
        if (!serverAttendanceCache.has(item.sessionId)) {
          try {
            const records = await fetchSessionAttendance(item.sessionId);
            serverAttendanceCache.set(item.sessionId, records);
          } catch {
            // Ignore fetch error, cache empty array to fallback to normal upsert
            serverAttendanceCache.set(item.sessionId, []);
          }
        }

        const serverRecords = serverAttendanceCache.get(item.sessionId) ?? [];
        const existingRecord = serverRecords.find((r) => r.playerId === item.playerId);

        if (existingRecord && existingRecord.updatedAt) {
          const dbTime = new Date(existingRecord.updatedAt).getTime();
          if (dbTime > item.timestamp) {
            // Discard the offline change because a newer server update exists
            await removeQueuedAttendanceItem(item.id);
            syncedCount++;
            affectedSessions.add(item.sessionId);
            affectedAcademies.add(item.academyId);
            continue;
          }
        }

        await markAttendance(item.sessionId, item.playerId, item.status, item.academyId);
        await removeQueuedAttendanceItem(item.id);
        syncedCount++;
        affectedSessions.add(item.sessionId);
        affectedAcademies.add(item.academyId);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isNetworkErr =
          errMsg.includes('Failed to fetch') ||
          errMsg.includes('NetworkError') ||
          errMsg.includes('offline') ||
          (typeof navigator !== 'undefined' && !navigator.onLine);

        if (isNetworkErr) {
          break;
        } else {
          failedCount++;
          await enqueueAttendanceItem({
            ...item,
            statusState: 'error',
            errorReason: errMsg,
          });
          if (onErrorToast) {
            onErrorToast('Offline sync error for player', `Could not sync attendance: ${errMsg}`);
          }
        }
      }
    }

    for (const academyId of affectedAcademies) {
      for (const sessionId of affectedSessions) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.academy.sessionAttendance(academyId, sessionId),
        });
      }
    }

    if (syncedCount > 0) {
      notifyQueueChanged();
      if (onSuccessToast) {
        onSuccessToast(
          syncedCount === 1
            ? 'Synced 1 offline attendance record'
            : `Synced ${syncedCount} offline attendance records`,
        );
      }
    }
  } catch (e) {
    logger.error('offline_attendance_sync_failed', { error: String(e) });
  } finally {
    isSyncInProgress = false;
  }

  return { syncedCount, failedCount };
}

/**
 * Safety-net sweep interval. Coming back online and returning to the tab both
 * trigger a sync immediately via events, and the attendance screen flushes its
 * own queue on mount — so this only exists to catch a queue left behind on a
 * screen that never revisits attendance. It is deliberately infrequent: every
 * tick opens IndexedDB, so a short interval burns battery and I/O all day for
 * a queue that is empty virtually all of the time.
 */
const BACKGROUND_SYNC_INTERVAL_MS = 60_000;

/**
 * Guards against stacking listeners and intervals when this module is evaluated
 * more than once (dev-server hot reload). The flag lives on `window` rather than
 * in module scope precisely because module scope is what gets re-created.
 */
type BackgroundSyncHost = { __camOfflineAttendanceSyncStarted__?: boolean };

/**
 * Wires the background sync triggers exactly once per page: the `online` and
 * `visibilitychange` events (immediate), a slow periodic sweep, and one attempt
 * on load, since neither event fires on a normal page load.
 */
function startBackgroundAttendanceSync(): void {
  if (typeof window === 'undefined') return;

  const host = window as unknown as BackgroundSyncHost;
  if (host.__camOfflineAttendanceSyncStarted__) return;
  host.__camOfflineAttendanceSyncStarted__ = true;

  const triggerAutoSync = () => {
    if (!navigator.onLine) return;
    void syncOfflineAttendanceQueue(
      (msg) => {
        useUiStore.getState().pushToast({ title: msg, variant: 'success' });
      },
      (title, msg) => {
        useUiStore.getState().pushToast({ title, description: msg, variant: 'error' });
      },
    );
  };

  window.addEventListener('online', triggerAutoSync);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') triggerAutoSync();
  });

  const backgroundSyncTimer = setInterval(triggerAutoSync, BACKGROUND_SYNC_INTERVAL_MS);
  window.addEventListener('pagehide', () => clearInterval(backgroundSyncTimer), { once: true });

  triggerAutoSync();

  // Expose global helper for testing/debugging.
  (
    window as unknown as { __syncOfflineAttendanceQueue__: typeof syncOfflineAttendanceQueue }
  ).__syncOfflineAttendanceQueue__ = syncOfflineAttendanceQueue;
}

startBackgroundAttendanceSync();

export function useOfflineAttendanceQueue(sessionId: UUID | null, academyId: UUID | null) {
  const [queuedItems, setQueuedItems] = useState<QueuedAttendanceItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const pushToast = useUiStore((state) => state.pushToast);

  const version = useSyncExternalStore(
    subscribeQueue,
    () => queueVersion,
    () => 0,
  );

  const loadQueue = useCallback(async () => {
    if (!sessionId) {
      setQueuedItems([]);
      return;
    }
    try {
      const items = await getQueuedAttendanceForSession(sessionId);
      setQueuedItems(items);
    } catch {
      setQueuedItems([]);
    }
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!sessionId) {
        if (active) setQueuedItems([]);
        return;
      }
      try {
        const items = await getQueuedAttendanceForSession(sessionId);
        if (active) setQueuedItems(items);
      } catch {
        if (active) setQueuedItems([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionId, version]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine && queuedItems.length > 0) {
      void syncOfflineAttendanceQueue(
        (msg) => {
          pushToast({ title: msg, variant: 'success' });
        },
        (title, msg) => {
          pushToast({ title, description: msg, variant: 'error' });
        },
      );
    }
  }, [queuedItems.length, pushToast]);

  const queueAttendance = useCallback(
    async (playerId: UUID, status: AttendanceStatus) => {
      if (!sessionId || !academyId) return;

      const item: QueuedAttendanceItem = {
        id: `${sessionId}:${playerId}`,
        academyId,
        sessionId,
        playerId,
        status,
        timestamp: Date.now(),
        statusState: 'queued',
      };

      await enqueueAttendanceItem(item);
      notifyQueueChanged();
    },
    [sessionId, academyId],
  );

  const queueAllPresent = useCallback(
    async (playerIds: UUID[]) => {
      if (!sessionId || !academyId) return;

      for (const playerId of playerIds) {
        const item: QueuedAttendanceItem = {
          id: `${sessionId}:${playerId}`,
          academyId,
          sessionId,
          playerId,
          status: 'present',
          timestamp: Date.now(),
          statusState: 'queued',
        };
        await enqueueAttendanceItem(item);
      }

      notifyQueueChanged();
    },
    [sessionId, academyId],
  );

  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncOfflineAttendanceQueue(
        (msg) => {
          pushToast({ title: msg, variant: 'success' });
        },
        (title, msg) => {
          pushToast({ title, description: msg, variant: 'error' });
        },
      );
      await loadQueue();
    } finally {
      setIsSyncing(false);
    }
  }, [loadQueue, pushToast]);

  const queuedByPlayer = new Map<string, QueuedAttendanceItem>();
  for (const item of queuedItems) {
    queuedByPlayer.set(item.playerId, item);
  }

  return {
    queuedItems,
    queuedByPlayer,
    queueAttendance,
    queueAllPresent,
    triggerSync,
    isSyncing,
  };
}
