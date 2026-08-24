import { useCallback, useEffect, useMemo, useState } from 'react';

import { logger } from '@/lib/logger';

import { type BeforeInstallPromptEvent, isIOSDevice, isStandaloneDisplay } from '../detect';

const BEFORE_INSTALL_PROMPT = 'beforeinstallprompt';
const APP_INSTALLED = 'appinstalled';
const STANDALONE_QUERY = '(display-mode: standalone)';

/**
 * Central install experience hook.
 *
 * - Captures the `beforeinstallprompt` event and exposes it as `canInstall`.
 * - Detects the already-installed (standalone) state so we never nag users.
 * - Detects iOS/Safari, where the native prompt is unavailable.
 * - `install()` triggers the native prompt and reports accept / dismiss.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandaloneDisplay());
  const isIOS = useMemo(() => isIOSDevice(), []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Prevent the browser from showing its own default mini-infobar; we render
      // our own Install App button instead.
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener(BEFORE_INSTALL_PROMPT, onBeforeInstallPrompt);
    window.addEventListener(APP_INSTALLED, onAppInstalled);

    // Some browsers switch to standalone in place; keep the UI in sync.
    const media =
      typeof window.matchMedia === 'function' ? window.matchMedia(STANDALONE_QUERY) : undefined;
    const onDisplayModeChange = (event: MediaQueryListEvent) => setIsInstalled(event.matches);
    media?.addEventListener('change', onDisplayModeChange);

    return () => {
      window.removeEventListener(BEFORE_INSTALL_PROMPT, onBeforeInstallPrompt);
      window.removeEventListener(APP_INSTALLED, onAppInstalled);
      media?.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  /** Trigger the native install prompt. Resolves `true` when the user accepts. */
  const install = useCallback(async (): Promise<boolean> => {
    const prompt = deferredPrompt;
    if (!prompt) return false;

    // Consume the stored prompt so it cannot be triggered twice.
    setDeferredPrompt(null);

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setIsInstalled(true);
        return true;
      }
      return false;
    } catch (error) {
      logger.warn('pwa_install_prompt_error', { error: String(error) });
      return false;
    }
  }, [deferredPrompt]);

  return {
    /** Native `beforeinstallprompt` has been captured and is installable. */
    canInstall: deferredPrompt !== null,
    /** The app is already installed / running in standalone mode. */
    isInstalled,
    /** Running on iOS/Safari where the native prompt is unavailable. */
    isIOS,
    install,
  };
}
