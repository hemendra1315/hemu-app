import type { AttendanceStatus } from '@/types/enums';
import type { UUID } from '@/types';
import { logger } from '@/lib/logger';

export interface QueuedAttendanceItem {
  id: string; // `${sessionId}:${playerId}`
  academyId: UUID;
  sessionId: UUID;
  playerId: UUID;
  status: AttendanceStatus;
  timestamp: number;
  statusState: 'queued' | 'syncing' | 'error';
  errorReason?: string;
}

const DB_NAME = 'cam_offline_db';
const DB_VERSION = 2;
const ATTENDANCE_STORE = 'offline_attendance_queue';
const CACHE_STORE = 'offline_query_cache';

export function isIndexedDbSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.indexedDB);
}

/**
 * Requests persistent storage from the browser to ensure IndexedDB and offline
 * cache survive under OS storage pressure. Checks `persisted()` first to avoid
 * redundant requests/prompts.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.storage ||
    typeof navigator.storage.persist !== 'function'
  ) {
    return false;
  }

  try {
    const isAlreadyPersisted =
      typeof navigator.storage.persisted === 'function'
        ? await navigator.storage.persisted()
        : false;

    if (isAlreadyPersisted) {
      logger.debug('storage_persistence_already_active');
      return true;
    }

    const granted = await navigator.storage.persist();
    logger.info('storage_persistence_requested', { granted });
    return granted;
  } catch (err) {
    logger.debug('storage_persistence_request_failed', { error: String(err) });
    return false;
  }
}

// Request persistent storage on startup when in browser environment
if (typeof window !== 'undefined') {
  void requestPersistentStorage();
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbSupported()) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(ATTENDANCE_STORE)) {
        const store = db.createObjectStore(ATTENDANCE_STORE, { keyPath: 'id' });
        store.createIndex('sessionId', 'sessionId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueAttendanceItem(item: QueuedAttendanceItem): Promise<void> {
  if (!isIndexedDbSupported()) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTENDANCE_STORE, 'readwrite');
    const store = tx.objectStore(ATTENDANCE_STORE);
    const req = store.put(item);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getQueuedAttendanceForSession(
  sessionId: UUID,
): Promise<QueuedAttendanceItem[]> {
  if (!isIndexedDbSupported()) return [];
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTENDANCE_STORE, 'readonly');
    const store = tx.objectStore(ATTENDANCE_STORE);
    const index = store.index('sessionId');
    const req = index.getAll(sessionId);

    req.onsuccess = () => resolve(req.result as QueuedAttendanceItem[]);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getAllQueuedAttendance(): Promise<QueuedAttendanceItem[]> {
  if (!isIndexedDbSupported()) return [];
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTENDANCE_STORE, 'readonly');
    const store = tx.objectStore(ATTENDANCE_STORE);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result as QueuedAttendanceItem[]);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function removeQueuedAttendanceItem(id: string): Promise<void> {
  if (!isIndexedDbSupported()) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTENDANCE_STORE, 'readwrite');
    const store = tx.objectStore(ATTENDANCE_STORE);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearSyncedAttendanceItems(ids: string[]): Promise<void> {
  if (!isIndexedDbSupported() || ids.length === 0) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTENDANCE_STORE, 'readwrite');
    const store = tx.objectStore(ATTENDANCE_STORE);
    for (const id of ids) {
      store.delete(id);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function saveOfflineQueryCache(dehydratedState: unknown): Promise<void> {
  if (!isIndexedDbSupported()) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readwrite');
    const store = tx.objectStore(CACHE_STORE);
    const req = store.put({
      key: 'tanstack_query_cache',
      data: dehydratedState,
      updatedAt: Date.now(),
    });

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function loadOfflineQueryCache(): Promise<unknown | null> {
  if (!isIndexedDbSupported()) return null;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CACHE_STORE, 'readonly');
    const store = tx.objectStore(CACHE_STORE);
    const req = store.get('tanstack_query_cache');

    req.onsuccess = () => {
      const record = req.result;
      resolve(record ? record.data : null);
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
