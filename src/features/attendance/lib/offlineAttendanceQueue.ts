import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import {
  enqueueAttendanceItem,
  getAllQueuedAttendance,
  getQueuedAttendanceForSession,
  removeQueuedAttendanceItem,
  type QueuedAttendanceItem,
} from '@/lib/offline/indexedDb';
import { markAttendance } from '../api/attendanceApi';
import { queryClient } from '@/lib/query/queryClient';
import { queryKeys } from '@/lib/query/keys';
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

    for (const item of items) {
      try {
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
    console.error('Error processing offline attendance sync:', e);
  } finally {
    isSyncInProgress = false;
  }

  return { syncedCount, failedCount };
}

// Background sync triggers: online event, visibility change, periodic interval
if (typeof window !== 'undefined') {
  const triggerAutoSync = () => {
    if (navigator.onLine) {
      void syncOfflineAttendanceQueue(
        (msg) => {
          useUiStore.getState().pushToast({ title: msg, variant: 'success' });
        },
        (title, msg) => {
          useUiStore.getState().pushToast({ title, description: msg, variant: 'error' });
        },
      );
    }
  };

  window.addEventListener('online', triggerAutoSync);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') triggerAutoSync();
  });
  setInterval(triggerAutoSync, 2000);

  // Expose global helper for testing/debugging
  (
    window as unknown as { __syncOfflineAttendanceQueue__: typeof syncOfflineAttendanceQueue }
  ).__syncOfflineAttendanceQueue__ = syncOfflineAttendanceQueue;
}

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
