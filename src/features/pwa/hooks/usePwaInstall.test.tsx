import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BeforeInstallPromptEvent } from '../detect';
import { usePwaInstall } from './usePwaInstall';

type Outcome = 'accepted' | 'dismissed';

/** A minimal MediaQueryList stub with listener support for the standalone effect. */
function mockMatchMedia(matches: boolean): MediaQueryList {
  const listeners = new Set<EventListener>();
  return {
    matches,
    media: matches ? '(display-mode: standalone)' : '(display-mode: browser)',
    onchange: null,
    addEventListener: (_type: string, cb: EventListener) => listeners.add(cb),
    removeEventListener: (_type: string, cb: EventListener) => listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;
}

function mockBeforeInstallPrompt(outcome: Outcome) {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt');
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
  return { prompt, event: event as unknown as BeforeInstallPromptEvent };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePwaInstall', () => {
  it('reports not installed and not installable by default', () => {
    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.isInstalled).toBe(false);
    expect(result.current.canInstall).toBe(false);
    expect(result.current.isIOS).toBe(false);
  });

  it('becomes installable when beforeinstallprompt fires', () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event } = mockBeforeInstallPrompt('accepted');

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.canInstall).toBe(true);
  });

  it('triggers the native prompt and marks installed on acceptance', async () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event, prompt } = mockBeforeInstallPrompt('accepted');

    act(() => {
      window.dispatchEvent(event);
    });

    let accepted = false;
    await act(async () => {
      accepted = await result.current.install();
    });

    expect(prompt).toHaveBeenCalledOnce();
    expect(accepted).toBe(true);
    expect(result.current.isInstalled).toBe(true);
    // The stored prompt is cleared after use so it cannot be re-triggered.
    expect(result.current.canInstall).toBe(false);
  });

  it('reports dismissal without marking installed', async () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event, prompt } = mockBeforeInstallPrompt('dismissed');

    act(() => {
      window.dispatchEvent(event);
    });

    let accepted = false;
    await act(async () => {
      accepted = await result.current.install();
    });

    expect(prompt).toHaveBeenCalledOnce();
    expect(accepted).toBe(false);
    expect(result.current.isInstalled).toBe(false);
    expect(result.current.canInstall).toBe(false);
  });

  it('no-ops and returns false when no prompt has been captured', async () => {
    const { result } = renderHook(() => usePwaInstall());

    let accepted = true;
    await act(async () => {
      accepted = await result.current.install();
    });

    expect(accepted).toBe(false);
    expect(result.current.isInstalled).toBe(false);
  });

  it('reports installed when already running in standalone mode', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(mockMatchMedia(true));

    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it('clears installability and marks installed on the appinstalled event', () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event } = mockBeforeInstallPrompt('accepted');

    act(() => {
      window.dispatchEvent(event);
    });
    expect(result.current.canInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.canInstall).toBe(false);
    expect(result.current.isInstalled).toBe(true);
  });
});
