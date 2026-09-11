/**
 * True only in builds explicitly flagged for E2E testing — CI's Playwright
 * build step (see .github/workflows/ci.yml), or a developer running
 * `VITE_E2E_TEST_MODE=true npm run build` locally. Never true in the build
 * Vercel deploys for real users.
 *
 * This is the single gate around every E2E-auth-injection code path
 * (installing `window.__E2E_SET_AUTH__`, honoring a `cam.e2e_auth` entry
 * already sitting in sessionStorage, and suppressing the real Supabase
 * session while one is active) — see AuthProvider.tsx and authStore.ts.
 * Without it, any of those paths shipping in the production bundle would
 * let a real visitor fake a signed-in session (including super-admin)
 * client-side, just by writing to sessionStorage themselves.
 *
 * Deliberately a function, not a module-level constant: it's called fresh
 * at each check rather than cached once at import time, which also means
 * Vitest's `vi.stubEnv` (called inside a test body, after this module has
 * already been imported) is actually observed by the next call.
 */
export function isE2ETestBuild(): boolean {
  return import.meta.env.VITE_E2E_TEST_MODE === 'true';
}
