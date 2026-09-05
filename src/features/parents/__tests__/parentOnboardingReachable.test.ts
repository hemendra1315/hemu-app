import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { hasCapability } from '@/lib/rbac/permissions';
import type { AppRole } from '@/types/enums';

/**
 * Regression guard: a parent must be able to get into the app at all.
 *
 * The parent feature shipped completely unreachable. `/parent/link-player` —
 * the only screen where a linking code can be redeemed — sat behind
 * `RequireAcademy` and `RequireRole allow={['parent']}`. But redeeming that
 * code is the *only* thing in the entire system that creates a `parent`
 * membership: join codes are restricted to player and coach by
 * `join_requests_requested_role_check`, and no UI ever inserts one. So a new
 * parent was sent to `/onboarding`, offered a join code that cannot make them
 * a parent, and bounced back out of the one page that would have worked.
 *
 * Nothing failed loudly. Every screen rendered; the parent simply had nowhere
 * to go. These tests pin the two halves of the loop that were missing.
 */

const ROUTER = resolve('src/app/router.tsx');
const ONBOARDING_START = resolve('src/features/onboarding/pages/OnboardingStartPage.tsx');

describe('a parent can reach the redeem screen before they belong to an academy', () => {
  const router = readFileSync(ROUTER, 'utf8');

  it('registers the redeem screen inside the onboarding routes', () => {
    expect(router).toContain("path: '/onboarding/link-child'");
  });

  it('keeps that route outside RequireAcademy', () => {
    // The onboarding block ends where the post-onboarding AppShell block
    // begins; RequireAcademy lives inside the latter. If the route is declared
    // after that point it is academy-gated again and the loop is closed.
    const linkChild = router.indexOf("path: '/onboarding/link-child'");
    const requireAcademy = router.indexOf('<RequireAcademy />');
    expect(linkChild).toBeGreaterThan(-1);
    expect(requireAcademy).toBeGreaterThan(-1);
    expect(linkChild).toBeLessThan(requireAcademy);
  });

  it('offers it from the first screen a user with no academy sees', () => {
    const start = readFileSync(ONBOARDING_START, 'utf8');
    expect(start).toContain('/onboarding/link-child');
  });
});

describe('a coach can issue the code a parent is told to ask them for', () => {
  it('grants coaches the capability the linking-code card is gated on', () => {
    const coach: AppRole[] = ['coach'];
    // `generate_parent_linking_code` checks `is_staff`, which includes coaches.
    // The UI gate must not be narrower than the database's.
    expect(hasCapability(coach, 'parents:link')).toBe(true);
  });

  it('still grants owners the same capability', () => {
    expect(hasCapability(['academy_owner'], 'parents:link')).toBe(true);
  });

  it('does not grant it to players or parents', () => {
    expect(hasCapability(['player'], 'parents:link')).toBe(false);
    expect(hasCapability(['parent'], 'parents:link')).toBe(false);
  });
});
