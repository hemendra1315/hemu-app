import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveBackButtonAction, ROOT_PATHS } from '../backButtonAction';
import { useOverlayStackStore } from '@/stores';

describe('resolveBackButtonAction', () => {
  afterEach(() => {
    // Each modal pops itself on close/unmount in real usage; tests push
    // directly onto the store, so reset it explicitly between cases.
    useOverlayStackStore.setState({ stack: [] });
  });

  it('closes the topmost overlay and does not navigate when a modal is open', () => {
    const closeOldest = vi.fn();
    const closeTopmost = vi.fn();
    useOverlayStackStore.getState().pushOverlay('modal-1', closeOldest);
    useOverlayStackStore.getState().pushOverlay('modal-2', closeTopmost);

    const action = resolveBackButtonAction('/dashboard', true);

    expect(action).toBe('overlay-closed');
    expect(closeTopmost).toHaveBeenCalledOnce();
    expect(closeOldest).not.toHaveBeenCalled();
  });

  it('navigates back on a non-root route with no overlay open', () => {
    const action = resolveBackButtonAction('/batches', true);
    expect(action).toBe('navigate-back');
  });

  it('does not throw and signals exit at a root route with no overlay open', () => {
    expect(() => resolveBackButtonAction('/dashboard', false)).not.toThrow();
    expect(resolveBackButtonAction('/dashboard', false)).toBe('exit-app');
  });

  it('signals exit at every declared root path when there is nowhere to go back to', () => {
    for (const path of ROOT_PATHS) {
      expect(resolveBackButtonAction(path, false)).toBe('exit-app');
    }
  });

  it('prefers exiting over navigating back at a root route even if canGoBack is true', () => {
    // e.g. the WebView history has entries, but this app-level root screen
    // should still be treated as the floor, not silently pop into onboarding.
    expect(resolveBackButtonAction('/dashboard', true)).toBe('exit-app');
  });

  it('navigates home on a non-root route with nothing to go back to', () => {
    const action = resolveBackButtonAction('/matches/abc-123', false);
    expect(action).toBe('navigate-home');
  });
});
