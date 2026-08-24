import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Theme } from '@/types/enums';

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
};

/** Persisted theme preference; applied to <html> by useThemeEffect. */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      toggle: () => set({ theme: resolveTheme(get().theme) === 'dark' ? 'light' : 'dark' }),
    }),
    { name: 'cam.theme' },
  ),
);

export function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light';
  return theme;
}
