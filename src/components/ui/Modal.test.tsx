import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useOverlayStackStore } from '@/stores';

import { Modal } from './Modal';

describe('<Modal /> overlay stack registration', () => {
  afterEach(() => {
    useOverlayStackStore.setState({ stack: [] });
  });

  it('registers itself on the shared overlay stack while open', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Test">
        content
      </Modal>,
    );

    expect(useOverlayStackStore.getState().stack).toHaveLength(1);
  });

  it('does not register when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Test">
        content
      </Modal>,
    );

    expect(useOverlayStackStore.getState().stack).toHaveLength(0);
  });

  it('closing the topmost overlay invokes this modal onClose', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Test">
        content
      </Modal>,
    );

    const closed = useOverlayStackStore.getState().closeTopOverlay();

    expect(closed).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('unregisters itself on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal open onClose={onClose} title="Test">
        content
      </Modal>,
    );

    expect(useOverlayStackStore.getState().stack).toHaveLength(1);
    unmount();
    expect(useOverlayStackStore.getState().stack).toHaveLength(0);
  });

  it('stacks two open modals with the most recently opened on top', () => {
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();

    render(
      <Modal open onClose={closeFirst} title="First">
        content
      </Modal>,
    );
    render(
      <Modal open onClose={closeSecond} title="Second">
        content
      </Modal>,
    );

    expect(useOverlayStackStore.getState().stack).toHaveLength(2);
    useOverlayStackStore.getState().closeTopOverlay();

    expect(closeSecond).toHaveBeenCalledOnce();
    expect(closeFirst).not.toHaveBeenCalled();
  });
});
