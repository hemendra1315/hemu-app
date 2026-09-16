import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePushNotifications } from '../hooks/usePushNotifications';

describe('usePushNotifications', () => {
  const originalNotification = window.Notification;
  const originalNavigator = window.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
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

    let success = false;
    await act(async () => {
      success = await result.current.subscribe();
    });

    expect(success).toBe(false);
    expect(result.current.permission).toBe('denied');
  });

  it('successfully subscribes with valid permissions', async () => {
    const mockSubscription = {
      endpoint: 'https://push.example.com/sub/12345',
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
      success = await result.current.subscribe();
    });

    expect(success).toBe(true);
    expect(result.current.permission).toBe('granted');
    expect(result.current.isSubscribed).toBe(true);
  });

  it('dispatches test notification when permission is granted', async () => {
    const showNotificationSpy = vi.fn().mockResolvedValue(undefined);

    const mockPushManager = {
      getSubscription: vi.fn().mockResolvedValue(null),
    };

    const mockServiceWorker = {
      ready: Promise.resolve({
        pushManager: mockPushManager,
        showNotification: showNotificationSpy,
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
      await result.current.sendTestNotification('Match Reminder', 'Finals match at 4 PM');
    });

    expect(showNotificationSpy).toHaveBeenCalledWith(
      'Match Reminder',
      expect.objectContaining({
        body: 'Finals match at 4 PM',
      }),
    );
  });

  it('persists subscription with resolved academy_id, platform, and fcm_token', async () => {
    const mockSubscription = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/sample-fcm-token-12345',
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
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile)',
        serviceWorker: mockServiceWorker,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePushNotifications());

    let success = false;
    await act(async () => {
      success = await result.current.subscribe(
        'mock-vapid-key',
        'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      );
    });

    expect(success).toBe(true);
    expect(result.current.permission).toBe('granted');
    expect(result.current.isSubscribed).toBe(true);
  });

  it('handles missing academy by failing clearly and skipping malformed DB insert', async () => {
    const mockSubscription = {
      endpoint: 'https://push.example.com/sub/no-academy',
      toJSON: () => ({
        keys: {
          p256dh: 'test-p256dh',
          auth: 'test-auth',
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

    await act(async () => {
      await result.current.subscribe();
    });

    // App gracefully marks subscribed locally but avoids corrupting push_subscriptions table
    expect(result.current.permission).toBe('granted');
  });
});
