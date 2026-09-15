import { logger } from '@/lib/logger';
import { isIndexedDbSupported } from '@/lib/offline/indexedDb';

export type OfflineActionType =
  'attendance:mark' | 'attendance:mark_all' | 'sessions:coach_note' | 'drills:submit_result';

export interface OfflineActionItem {
  id: string;
  type: OfflineActionType;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  errorReason?: string;
}

const DB_NAME = 'cam_offline_db';
const DB_VERSION = 2;
const ACTION_QUEUE_STORE = 'universal_offline_queue';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbSupported()) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(ACTION_QUEUE_STORE)) {
        const store = db.createObjectStore(ACTION_QUEUE_STORE, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOfflineAction(
  type: OfflineActionType,
  payload: Record<string, unknown>,
  customId?: string,
): Promise<string> {
  const id = customId || `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const item: OfflineActionItem = {
    id,
    type,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  };

  if (!isIndexedDbSupported()) return id;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ACTION_QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(ACTION_QUEUE_STORE);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cam_offline_action_queued', { detail: item }));
    }
  } catch (err) {
    logger.warn('enqueue_offline_action_failed', { error: String(err) });
  }

  return id;
}

export async function getAllOfflineActions(): Promise<OfflineActionItem[]> {
  if (!isIndexedDbSupported()) return [];

  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ACTION_QUEUE_STORE, 'readonly');
      const store = tx.objectStore(ACTION_QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as OfflineActionItem[]);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
}

export async function removeOfflineAction(id: string): Promise<void> {
  if (!isIndexedDbSupported()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ACTION_QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(ACTION_QUEUE_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cam_offline_action_synced', { detail: { id } }));
    }
  } catch (err) {
    logger.warn('remove_offline_action_failed', { error: String(err) });
  }
}

export async function clearAllOfflineActions(): Promise<void> {
  if (!isIndexedDbSupported()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ACTION_QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(ACTION_QUEUE_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    logger.warn('clear_offline_actions_failed', { error: String(err) });
  }
}
