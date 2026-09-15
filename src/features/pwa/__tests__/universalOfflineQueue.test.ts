import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  enqueueOfflineAction,
  getAllOfflineActions,
  removeOfflineAction,
  clearAllOfflineActions,
  type OfflineActionItem,
} from '../offline/universalOfflineQueue';

describe('universalOfflineQueue', () => {
  let mockStore: Map<string, OfflineActionItem>;

  beforeEach(() => {
    mockStore = new Map<string, OfflineActionItem>();

    const fakeObjectStore = {
      put: vi.fn((item: OfflineActionItem) => {
        mockStore.set(item.id, item);
        const req: { onsuccess?: () => void; onerror?: (e: unknown) => void } = {};
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      getAll: vi.fn(() => {
        const items = Array.from(mockStore.values());
        const req: {
          onsuccess?: () => void;
          onerror?: (e: unknown) => void;
          result?: OfflineActionItem[];
        } = {
          result: items,
        };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      delete: vi.fn((id: string) => {
        mockStore.delete(id);
        const req: { onsuccess?: () => void; onerror?: (e: unknown) => void } = {};
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      clear: vi.fn(() => {
        mockStore.clear();
        const req: { onsuccess?: () => void; onerror?: (e: unknown) => void } = {};
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      createIndex: vi.fn(),
    };

    const fakeTransaction = {
      objectStore: vi.fn(() => fakeObjectStore),
      oncomplete: undefined as (() => void) | undefined,
      onerror: undefined as (() => void) | undefined,
    };

    const fakeDb = {
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(true),
      },
      createObjectStore: vi.fn(() => fakeObjectStore),
      transaction: vi.fn((_storeName: string, _mode: string) => {
        setTimeout(() => fakeTransaction.oncomplete?.(), 0);
        return fakeTransaction;
      }),
      close: vi.fn(),
    };

    const fakeOpenRequest: {
      result: typeof fakeDb;
      onsuccess?: () => void;
      onerror?: (e: unknown) => void;
      onupgradeneeded?: (ev: { target: { result: typeof fakeDb } }) => void;
    } = {
      result: fakeDb,
    };

    const fakeIndexedDB = {
      open: vi.fn(() => {
        setTimeout(() => {
          fakeOpenRequest.onupgradeneeded?.({ target: { result: fakeDb } });
          fakeOpenRequest.onsuccess?.();
        }, 0);
        return fakeOpenRequest;
      }),
    };

    Object.defineProperty(window, 'indexedDB', {
      value: fakeIndexedDB,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enqueues an action with automatic ID and dispatches window event', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const id = await enqueueOfflineAction('attendance:mark', {
      sessionId: 'sess-1',
      playerId: 'play-1',
      status: 'present',
    });

    expect(id).toBeDefined();
    expect(id.startsWith('attendance:mark_')).toBe(true);
    expect(mockStore.has(id)).toBe(true);

    const storedItem = mockStore.get(id);
    expect(storedItem).toMatchObject({
      id,
      type: 'attendance:mark',
      payload: { sessionId: 'sess-1', playerId: 'play-1', status: 'present' },
      status: 'pending',
      retryCount: 0,
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cam_offline_action_queued',
      }),
    );
  });

  it('enqueues an action with custom ID', async () => {
    const customId = 'custom_action_123';
    const id = await enqueueOfflineAction(
      'sessions:coach_note',
      { note: 'Great drills' },
      customId,
    );

    expect(id).toBe(customId);
    expect(mockStore.has(customId)).toBe(true);
    expect(mockStore.get(customId)?.type).toBe('sessions:coach_note');
  });

  it('retrieves all offline actions', async () => {
    await enqueueOfflineAction('drills:submit_result', { score: 90 }, 'drill-1');
    await enqueueOfflineAction('attendance:mark_all', { batchId: 'b-1' }, 'batch-1');

    const actions = await getAllOfflineActions();
    expect(actions).toHaveLength(2);
    expect(actions.map((a) => a.id)).toContain('drill-1');
    expect(actions.map((a) => a.id)).toContain('batch-1');
  });

  it('removes an offline action by id and dispatches window event', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    await enqueueOfflineAction('attendance:mark', { sessionId: 'sess-2' }, 'action-to-delete');

    expect(mockStore.has('action-to-delete')).toBe(true);

    await removeOfflineAction('action-to-delete');
    expect(mockStore.has('action-to-delete')).toBe(false);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cam_offline_action_synced',
      }),
    );
  });

  it('clears all offline actions', async () => {
    await enqueueOfflineAction('drills:submit_result', { score: 100 }, 'drill-2');
    await enqueueOfflineAction('sessions:coach_note', { note: 'Note 2' }, 'note-2');

    expect(mockStore.size).toBe(2);

    await clearAllOfflineActions();
    expect(mockStore.size).toBe(0);
  });
});
