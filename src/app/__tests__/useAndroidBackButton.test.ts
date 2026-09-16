import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const addListener = vi.fn();
const exitApp = vi.fn().mockResolvedValue(undefined);
let isNativePlatform = true;

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (...args: unknown[]) => addListener(...args),
    exitApp: (...args: unknown[]) => exitApp(...args),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform,
  },
}));

import { useAndroidBackButton } from '../useAndroidBackButton';

function makeFakeRouter(pathname: string) {
  return {
    state: { location: { pathname } },
    navigate: vi.fn(),
  } as unknown as Parameters<typeof useAndroidBackButton>[0];
}

describe('useAndroidBackButton', () => {
  afterEach(() => {
    vi.clearAllMocks();
    isNativePlatform = true;
  });

  it('registers a single backButton listener when running natively', () => {
    addListener.mockReturnValue(Promise.resolve({ remove: vi.fn() }));
    const router = makeFakeRouter('/dashboard');

    renderHook(() => useAndroidBackButton(router));

    expect(addListener).toHaveBeenCalledOnce();
    expect(addListener).toHaveBeenCalledWith('backButton', expect.any(Function));
  });

  it('does not register any listener when not running as a native app', () => {
    isNativePlatform = false;
    const router = makeFakeRouter('/dashboard');

    const { unmount } = renderHook(() => useAndroidBackButton(router));
    unmount();

    expect(addListener).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', async () => {
    const remove = vi.fn();
    addListener.mockReturnValue(Promise.resolve({ remove }));
    const router = makeFakeRouter('/dashboard');

    const { unmount } = renderHook(() => useAndroidBackButton(router));
    unmount();
    await Promise.resolve();

    expect(remove).toHaveBeenCalledOnce();
  });

  it('navigates back in history on a non-root route', async () => {
    addListener.mockReturnValue(Promise.resolve({ remove: vi.fn() }));
    const router = makeFakeRouter('/batches');

    renderHook(() => useAndroidBackButton(router));
    const handler = addListener.mock.calls[0]![1] as (payload: { canGoBack: boolean }) => void;
    handler({ canGoBack: true });

    expect(router.navigate).toHaveBeenCalledWith(-1);
    expect(exitApp).not.toHaveBeenCalled();
  });

  it('exits the app instead of navigating when at a root route', () => {
    addListener.mockReturnValue(Promise.resolve({ remove: vi.fn() }));
    const router = makeFakeRouter('/dashboard');

    renderHook(() => useAndroidBackButton(router));
    const handler = addListener.mock.calls[0]![1] as (payload: { canGoBack: boolean }) => void;

    expect(() => handler({ canGoBack: false })).not.toThrow();
    expect(exitApp).toHaveBeenCalledOnce();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
