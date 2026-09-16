import { useOverlayStackStore } from '@/stores';

/**
 * Routes with no "back" above them: the per-role dashboards, the platform
 * admin screen, and the index route that redirects into one of them. Android
 * hardware/gesture back is only allowed to exit the app from one of these.
 */
export const ROOT_PATHS = new Set([
  '/',
  '/dashboard',
  '/owner',
  '/coach',
  '/player',
  '/me',
  '/parent/dashboard',
  '/admin',
]);

export type BackButtonAction = 'overlay-closed' | 'navigate-back' | 'exit-app' | 'navigate-home';

/**
 * Pure decision for what a single Android back-button press should do, given
 * the current route and whether the WebView reports it can go back.
 *
 * Closing an overlay (the shared `Modal` stack) is a real side effect, but
 * everything else returned here is just a decision — the caller (App.tsx)
 * performs the corresponding router navigation or app-exit call. Kept
 * separate from the `@capacitor/app` listener wiring so it can be unit
 * tested without a native runtime.
 */
export function resolveBackButtonAction(pathname: string, canGoBack: boolean): BackButtonAction {
  // A modal (or anything else registered on the shared overlay stack, e.g.
  // AppShell's "More & Account" sheet) closes first — topmost only, and
  // this press does not also navigate.
  if (useOverlayStackStore.getState().closeTopOverlay()) return 'overlay-closed';

  const atRoot = ROOT_PATHS.has(pathname);

  // No overlay open on a normal route: go to the previous route.
  if (canGoBack && !atRoot) return 'navigate-back';

  // Only exit the app from a genuine root/dashboard screen.
  if (atRoot) return 'exit-app';

  // Deep-linked onto a non-root screen with no history to go back to: send
  // the user home instead of doing nothing or exiting unexpectedly.
  return 'navigate-home';
}
