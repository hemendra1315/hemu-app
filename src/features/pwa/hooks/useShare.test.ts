import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SHARE_APP_DATA, useShare } from './useShare';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useShare', () => {
  it('invokes the native share sheet with the production data when supported', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'share', { value: shareSpy, configurable: true });

    const { result } = renderHook(() => useShare());

    let ok = false;
    await act(async () => {
      ok = await result.current.share();
    });

    expect(result.current.supported).toBe(true);
    expect(ok).toBe(true);
    expect(shareSpy).toHaveBeenCalledWith(SHARE_APP_DATA);
  });

  it('reports not supported and declines to share when the API is missing', async () => {
    Object.defineProperty(window.navigator, 'share', { value: undefined, configurable: true });

    const { result } = renderHook(() => useShare());

    let ok = true;
    await act(async () => {
      ok = await result.current.share();
    });

    expect(result.current.supported).toBe(false);
    expect(ok).toBe(false);
  });

  it('copies the production URL to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const { result } = renderHook(() => useShare());

    let ok = false;
    await act(async () => {
      ok = await result.current.copyUrl();
    });

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://cricos08.vercel.app');
  });
});
