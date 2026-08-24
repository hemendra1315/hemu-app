import { create } from 'zustand';

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: 'info' | 'success' | 'warning' | 'error';
};

/** Ephemeral UI state: sidebar, command palette and the toast queue. */
type UiState = {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toasts: Toast[];
  pushToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;
};

export const useUiStore = create<UiState>((set, get) => ({
  sidebarOpen: false,
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toasts: [],
  pushToast: (toast) => {
    const id = crypto.randomUUID();
    set({ toasts: [...get().toasts, { ...toast, id }] });
    return id;
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
}));
