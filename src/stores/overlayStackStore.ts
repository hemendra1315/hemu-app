import { create } from 'zustand';

type OverlayEntry = { id: string; close: () => void };

/**
 * A stack of currently-open, non-route overlays (the shared `Modal`
 * component, and anything else that wants Android hardware-back to close it
 * before navigation kicks in). Each overlay pushes itself while open and
 * pops itself on close/unmount; the top of the stack is whatever was opened
 * most recently.
 *
 * This is deliberately not persisted — it only ever describes the current
 * render, never something that should survive a reload.
 */
type OverlayStackState = {
  stack: OverlayEntry[];
  pushOverlay: (id: string, close: () => void) => void;
  popOverlay: (id: string) => void;
  /** Closes the topmost overlay, if any. Returns whether one was closed. */
  closeTopOverlay: () => boolean;
};

export const useOverlayStackStore = create<OverlayStackState>((set, get) => ({
  stack: [],
  pushOverlay: (id, close) =>
    set((state) => {
      const index = state.stack.findIndex((entry) => entry.id === id);
      if (index !== -1) {
        const next = [...state.stack];
        next[index] = { id, close };
        return { stack: next };
      }
      return { stack: [...state.stack, { id, close }] };
    }),
  popOverlay: (id) => set((state) => ({ stack: state.stack.filter((entry) => entry.id !== id) })),
  closeTopOverlay: () => {
    const top = get().stack[get().stack.length - 1];
    if (!top) return false;
    top.close();
    return true;
  },
}));
