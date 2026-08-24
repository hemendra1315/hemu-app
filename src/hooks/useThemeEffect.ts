import { useEffect } from 'react';

import { resolveTheme, useThemeStore } from '@/stores';

/**
 * Applies the resolved theme to <html> and follows the OS preference while the
 * stored theme is "system".
 */
export function useThemeEffect(): void {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(theme);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
      document.documentElement.style.colorScheme = resolved;
    };

    apply();

    if (theme !== 'system') return;
    const list = window.matchMedia('(prefers-color-scheme: dark)');
    list.addEventListener('change', apply);
    return () => list.removeEventListener('change', apply);
  }, [theme]);
}
