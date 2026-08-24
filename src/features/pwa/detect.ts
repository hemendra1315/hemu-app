/**
 * Pure detection helpers for the PWA install / share experience.
 *
 * Kept dependency-free so they can be unit tested in isolation and reused by
 * both the install hook and the share hook without duplicating logic.
 */

/** The browser's native install prompt event (Chromium / Android / desktop). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface NavigatorWithStandalone extends Navigator {
  /** iOS Safari exposes `standalone === true` when added to the home screen. */
  standalone?: boolean;
}

/** True when the page is running as an installed PWA / standalone window. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return (window.navigator as NavigatorWithStandalone).standalone === true;
}

/** True on iPhone / iPad / iPod, where Safari hides `beforeinstallprompt`. */
export function isIOSDevice(ua: string = navigator.userAgent): boolean {
  return /iphone|ipad|ipod/i.test(ua);
}

/** True when the Web Share API is available for a native share sheet. */
export function canUseWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}
