import { useCallback, useState } from 'react';

import { logger } from '@/lib/logger';

/** Typed localStorage state that degrades gracefully when storage is unavailable. */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch (error) {
        logger.warn('local_storage_write_failed', { key, error: String(error) });
      }
    },
    [key],
  );

  return [value, update] as const;
}
