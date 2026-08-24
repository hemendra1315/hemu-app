import { useCallback, useMemo } from 'react';

import { logger } from '@/lib/logger';

import { canUseWebShare } from '../detect';

/** Public production data shared via the Web Share / copy fallback. */
export const SHARE_APP_DATA = {
  title: 'Cricket Academy Manager',
  text: 'Cricket Academy Manager',
  url: 'https://cricos08.vercel.app',
};

/**
 * Share hook.
 *
 * Uses the native Web Share API when available; otherwise callers fall back to
 * copying the production URL (returned by `copyUrl`).
 */
export function useShare() {
  const supported = useMemo(() => canUseWebShare(), []);

  /** Invoke the native share sheet. Resolves `true` if a share completed. */
  const share = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    try {
      await navigator.share(SHARE_APP_DATA);
      return true;
    } catch (error) {
      // AbortError = the user closed the share sheet; treated as "not shared".
      logger.warn('share_not_completed', { error: String(error) });
      return false;
    }
  }, [supported]);

  /** Copy the production URL to the clipboard. Resolves `true` on success. */
  const copyUrl = useCallback(async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(SHARE_APP_DATA.url);
      return true;
    } catch (error) {
      logger.warn('copy_url_failed', { error: String(error) });
      return false;
    }
  }, []);

  return { supported, share, copyUrl };
}
