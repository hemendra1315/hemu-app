import { afterEach, describe, expect, it, vi } from 'vitest';

import { canUseWebShare, isIOSDevice, isStandaloneDisplay } from './detect';

describe('isIOSDevice', () => {
  it('detects iPhone', () => {
    expect(isIOSDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
  });

  it('detects iPad', () => {
    expect(isIOSDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
  });

  it('detects iPod touch', () => {
    expect(isIOSDevice('Mozilla/5.0 (iPod touch; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
  });

  it('returns false for Android and desktop user agents', () => {
    expect(isIOSDevice('Mozilla/5.0 (Linux; Android 13; Pixel 7)')).toBe(false);
    expect(isIOSDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')).toBe(false);
    expect(isIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false);
  });
});

describe('isStandaloneDisplay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is true when display-mode is standalone', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(display-mode: standalone)',
    } as MediaQueryList);
    Object.defineProperty(window.navigator, 'standalone', { value: false, configurable: true });

    expect(isStandaloneDisplay()).toBe(true);
  });

  it('is true when the iOS standalone flag is set', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: '(display-mode: browser)',
    } as MediaQueryList);
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });

    expect(isStandaloneDisplay()).toBe(true);
  });

  it('is false when running inside the regular browser', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: '(display-mode: browser)',
    } as MediaQueryList);
    Object.defineProperty(window.navigator, 'standalone', { value: false, configurable: true });

    expect(isStandaloneDisplay()).toBe(false);
  });
});

describe('canUseWebShare', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is true when navigator.share is available', () => {
    Object.defineProperty(window.navigator, 'share', {
      value: vi.fn(),
      configurable: true,
    });

    expect(canUseWebShare()).toBe(true);
  });

  it('is false when navigator.share is missing', () => {
    Object.defineProperty(window.navigator, 'share', {
      value: undefined,
      configurable: true,
    });

    expect(canUseWebShare()).toBe(false);
  });
});
