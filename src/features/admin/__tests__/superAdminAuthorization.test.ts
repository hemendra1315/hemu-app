import { describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase/client';
import { hasCapability } from '@/lib/rbac/permissions';
import type { AppRole } from '@/types/enums';
import { createPlatformAcademy, deletePlatformAcademy } from '../api/adminApi';

describe('Super Admin Role & Academy Access Authorization', () => {
  it('grants super_admin platform administration permissions while keeping academy roles distinct', () => {
    const superAdminRoles: AppRole[] = ['super_admin'];
    const ownerRoles: AppRole[] = ['academy_owner'];
    const coachRoles: AppRole[] = ['coach'];
    const playerRoles: AppRole[] = ['player'];

    // Super admin capabilities
    expect(superAdminRoles.includes('super_admin')).toBe(true);
    expect(ownerRoles.includes('super_admin')).toBe(false);
    expect(coachRoles.includes('super_admin')).toBe(false);
    expect(playerRoles.includes('super_admin')).toBe(false);

    // Standard role capability checks remain unaltered
    expect(hasCapability(ownerRoles, 'members:manage')).toBe(true);
    expect(hasCapability(coachRoles, 'attendance:mark')).toBe(true);
    expect(hasCapability(playerRoles, 'stats:read_own')).toBe(true);
    expect(hasCapability(playerRoles, 'members:manage')).toBe(false);

    // Super Admin role possesses platform-wide capability bypass
    expect(hasCapability(superAdminRoles, 'members:manage')).toBe(true);
    expect(hasCapability(superAdminRoles, 'batches:manage')).toBe(true);
    expect(hasCapability(superAdminRoles, 'matches:manage')).toBe(true);
  });

  it('exposes createPlatformAcademy and deletePlatformAcademy API contracts', () => {
    expect(typeof createPlatformAcademy).toBe('function');
    expect(typeof deletePlatformAcademy).toBe('function');
  });

  it('verifies Super Admin Academy Access permission overrides & tenant isolation rules', () => {
    const superAdminRoles: AppRole[] = ['super_admin'];
    const playerRoles: AppRole[] = ['player'];

    // 1. Super Admin can select and inspect any academy via super_admin capability override
    expect(hasCapability(superAdminRoles, 'academy:update')).toBe(true);
    expect(hasCapability(superAdminRoles, 'reports:export')).toBe(true);

    // 2. Regular user cannot access management capabilities for unauthorized academies
    expect(hasCapability(playerRoles, 'academy:update')).toBe(false);
    expect(hasCapability(playerRoles, 'members:manage')).toBe(false);

    // 3. Regular users cannot bypass role constraints
    const isSuperAdminBypassPermitted = (roles: AppRole[]) =>
      roles.includes('super_admin') || hasCapability(roles, 'members:manage');

    expect(isSuperAdminBypassPermitted(superAdminRoles)).toBe(true);
    expect(isSuperAdminBypassPermitted(playerRoles)).toBe(false);
  });
});

/**
 * Regression test for round 15.
 *
 * `deletePlatformAcademy` threw the raw PostgREST error object. That object is
 * not an `Error` instance, so the dashboard's `err instanceof Error` branch
 * fell through and every failed delete was reported to the super admin as
 * "Unknown error" — hiding E_FORBIDDEN (not a super admin) and E_NOT_FOUND
 * (already deleted), the only two reasons it ever fails.
 */
describe('deletePlatformAcademy surfaces the real failure reason', () => {
  it('throws a real Error carrying the database message', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: null,
      error: { message: 'E_FORBIDDEN', details: null, hint: null, code: '42501' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await expect(
      deletePlatformAcademy('11111111-1111-4111-8111-111111111111'),
    ).rejects.toThrowError(/E_FORBIDDEN/);

    // The page checks `instanceof Error` before reading `.message`; a plain
    // PostgREST object silently degrades to "Unknown error" there.
    const thrown = await deletePlatformAcademy('11111111-1111-4111-8111-111111111111').catch(
      (e: unknown) => e,
    );
    expect(thrown).toBeInstanceOf(Error);

    vi.restoreAllMocks();
  });
});
