import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import { getAllQueuedAttendance } from '@/lib/offline/indexedDb';
import { syncOfflineAttendanceQueue } from '@/features/attendance/lib/offlineAttendanceQueue';
import { getAllOfflineActions } from './universalOfflineQueue';
import { useUiStore } from '@/stores';

let syncStateVersion = 0;
const syncListeners = new Set<() => void>();

function notifySyncStateChanged() {
  syncStateVersion++;
  syncListeners.forEach((l) => l());
}

function subscribeSyncState(callback: () => void) {
  syncListeners.add(callback);
  if (typeof window !== 'undefined') {
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
    window.addEventListener('cam_offline_attendance_queue_changed', callback);
    window.addEventListener('cam_offline_action_queued', callback);
    window.addEventListener('cam_offline_action_synced', callback);
  }
  return () => {
    syncListeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', callback);
      window.removeEventListener('offline', callback);
      window.removeEventListener('cam_offline_attendance_queue_changed', callback);
      window.removeEventListener('cam_offline_action_queued', callback);
      window.removeEventListener('cam_offline_action_synced', callback);
    }
  };
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const pushToast = useUiStore((s) => s.pushToast);

  useSyncExternalStore(
    subscribeSyncState,
    () => syncStateVersion,
    () => 0,
  );

  const refreshPendingCount = useCallback(async () => {
    try {
      const [attItems, actionItems] = await Promise.all([
        getAllQueuedAttendance(),
        getAllOfflineActions(),
      ]);
      setPendingCount(attItems.length + actionItems.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const handleOnline = () => {
      setIsOnline(true);
      notifySyncStateChanged();
    };
    const handleOffline = () => {
      setIsOnline(false);
      notifySyncStateChanged();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    void (async () => {
      try {
        const [attItems, actionItems] = await Promise.all([
          getAllQueuedAttendance(),
          getAllOfflineActions(),
        ]);
        if (active) {
          setPendingCount(attItems.length + actionItems.length);
        }
      } catch {
        if (active) {
          setPendingCount(0);
        }
      }
    })();

    return () => {
      active = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  const syncNow = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      pushToast({
        title: 'Device is offline',
        description: 'Connect to Wi-Fi or mobile data to sync queued changes.',
        variant: 'info',
      });
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncOfflineAttendanceQueue(
        (msg) => pushToast({ title: msg, variant: 'success' }),
        (title, msg) => pushToast({ title, description: msg, variant: 'error' }),
      );

      await refreshPendingCount();
      notifySyncStateChanged();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [pushToast, refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    syncNow,
    refreshPendingCount,
  };
}
