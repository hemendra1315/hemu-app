import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePushNotifications } from '../hooks/usePushNotifications';
import * as nativePush from '@/lib/push/nativePush';

const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } });

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: vi.fn(() => ({
      upsert: (...args: unknown[]) => mockUpsert(...args),
    })),
  },
}));

vi.mock('@/stores', async () => {
  const actual = await vi.importActual('@/stores');
  return {
    ...actual,
    useAcademyStore: {
      getState: () => ({ activeAcademyId: 'academy-1' }),
    },
    useAuthStore: {
      getState: () => ({ memberships: [{ status: 'active', academyId: 'academy-1' }] }),
    },
    useUiStore: vi.fn(() => vi.fn()),
  };
});

describe('usePushNotifications', () => {
  const originalNotification = window.Notification;
  const originalNavigator = window.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUpsert.mockClear().mockResolvedValue({ error: null });
    mockGetUser.mockClear().mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  afterEach(() => {
    Object.defineProperty(window, 'Notification', {
      value: originalNotification,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('detects unsupported environment when Notification is not in window', async () => {
    Object.defineProperty(window, 'Notification', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.checkStatus();
    });

    expect(result.current.permission).toBe('unsupported');
    expect(result.current.isSubscribed).toBe(false);
  });

  it('checks and reflects existing permission and subscription', async () => {
    const mockSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-sub',
    };

    const mockPushManager = {
      getSubscription: vi.fn().mockResolvedValue(mockSubscription),
      subscribe: vi.fn().mockResolvedValue(mockSubscription),
    };

    const mockServiceWorker = {
      ready: Promise.resolve({
        pushManager: mockPushManager,
        showNotification: vi.fn().mockResolvedValue(undefined),
      }),
    };

    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'granted',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: mockServiceWorker,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.checkStatus();
    });

    expect(result.current.permission).toBe('granted');
    expect(result.current.isSubscribed).toBe(true);
  });

  it('handles user denying permission during subscription', async () => {
    const mockPushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
    };

    const mockServiceWorker = {
      ready: Promise.resolve({
        pushManager: mockPushManager,
      }),
    };

    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('denied'),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: mockServiceWorker,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePushNotifications());

    let success = true;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(success).toBe(false);
    expect(result.current.permission).toBe('denied');
    expect(result.current.isSubscribed).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('successfully subscribes with valid permissions and persists to DB', async () => {
    const mockSubscription = {
      endpoint: 'https://push.example.com/sub/12345',
      toJSON: () => ({
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-secret',
        },
      }),
    };

    const mockPushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(mockSubscription),
    };

    const mockServiceWorker = {
      ready: Promise.resolve({
        pushManager: mockPushManager,
        showNotification: vi.fn().mockResolvedValue(undefined),
      }),
    };

    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: mockServiceWorker,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePushNotifications());

    let success = false;
    await act(async () => {
      success = await result.current.subscribe('mock-vapid-key', 'academy-1');
    });

    expect(success).toBe(true);
    expect(result.current.permission).toBe('granted');
    expect(result.current.isSubscribed).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        academy_id: 'academy-1',
        endpoint: 'https://push.example.com/sub/12345',
      }),
      { onConflict: 'user_id,endpoint' },
    );
  });

  it('does NOT report success when the browser subscribes but DB persist fails', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'db connection failed' } });

    const mockSubscription = {
      endpoint: 'https://push.example.com/sub/67890',
      toJSON: () => ({
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-secret',
        },
      }),
    };

    const mockPushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockResolvedValue(mockSubscription),
    };

    const mockServiceWorker = {
      ready: Promise.resolve({
        pushManager: mockPushManager,
        showNotification: vi.fn().mockResolvedValue(undefined),
      }),
    };

    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: mockServiceWorker,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePushNotifications());

    let success = true;
    await act(async () => {
      success = await result.current.subscribe('mock-vapid-key', 'academy-1');
    });

    expect(success).toBe(false);
    expect(result.current.isSubscribed).toBe(false);
  });

  it('does NOT report success when the browser subscribe() call throws', async () => {
    const mockPushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockRejectedValue(new Error('Push service error')),
    };

    const mockServiceWorker = {
      ready: Promise.resolve({
        pushManager: mockPushManager,
      }),
    };

    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'navigator', {
      value: {
        ...originalNavigator,
        serviceWorker: mockServiceWorker,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePushNotifications());

    let success = true;
    await act(async () => {
      success = await result.current.subscribe('mock-vapid-key', 'academy-1');
    });

    expect(success).toBe(false);
    expect(result.current.isSubscribed).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('delegates to subscribeToNativePush when on native Android and reflects result honestly', async () => {
    vi.spyOn(nativePush, 'isNativePush').mockReturnValue(true);
    vi.spyOn(nativePush, 'getNativePushPermission').mockResolvedValue('default');
    vi.spyOn(nativePush, 'isNativePushSubscribed').mockResolvedValue(false);
    const nativeSpy = vi
      .spyOn(nativePush, 'subscribeToNativePush')
      .mockResolvedValueOnce({ ok: false, reason: 'permission_denied' })
      .mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => usePushNotifications());

    // 1. First attempt: denied
    let firstResult = true;
    await act(async () => {
      firstResult = await result.current.subscribe(undefined, 'academy-1');
    });

    expect(firstResult).toBe(false);
    expect(result.current.isSubscribed).toBe(false);
    expect(result.current.permission).toBe('denied');

    // 2. Second attempt: success
    let secondResult = false;
    await act(async () => {
      secondResult = await result.current.subscribe(undefined, 'academy-1');
    });

    expect(secondResult).toBe(true);
    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.permission).toBe('granted');
    expect(nativeSpy).toHaveBeenCalledTimes(2);
  });
});
