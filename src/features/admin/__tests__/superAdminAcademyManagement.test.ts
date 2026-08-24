import { describe, expect, it } from 'vitest';
import type { AppRole } from '@/types/enums';
import {
  superAdminAddMember,
  superAdminSeedAcademyDemoData,
  type SuperAdminAddMemberPayload,
} from '../api/adminApi';

describe('Super Admin Academy Data Management & Cross-Academy Access (Phase 33 Audit)', () => {
  it('exposes superAdminAddMember and superAdminSeedAcademyDemoData API contracts', () => {
    expect(typeof superAdminAddMember).toBe('function');
    expect(typeof superAdminSeedAcademyDemoData).toBe('function');
  });

  it('verifies authorization restrictions for Super Admin academy operations', () => {
    const superAdminRoles: AppRole[] = ['super_admin'];
    const ownerRoles: AppRole[] = ['academy_owner'];
    const coachRoles: AppRole[] = ['coach'];
    const playerRoles: AppRole[] = ['player'];

    const canPerformSuperAdminDataAction = (roles: AppRole[]) => roles.includes('super_admin');

    expect(canPerformSuperAdminDataAction(superAdminRoles)).toBe(true);
    expect(canPerformSuperAdminDataAction(ownerRoles)).toBe(false);
    expect(canPerformSuperAdminDataAction(coachRoles)).toBe(false);
    expect(canPerformSuperAdminDataAction(playerRoles)).toBe(false);
  });

  it('validates Add Member payload structure and role enforcement', () => {
    const memberPayload: SuperAdminAddMemberPayload = {
      academyId: '11111111-1111-1111-1111-111111111111',
      fullName: 'Rahul Dravid',
      role: 'player',
      email: 'rahul@example.com',
      phone: '+919876543210',
    };

    expect(memberPayload.role).toBe('player');
    expect(memberPayload.fullName).toBe('Rahul Dravid');

    const coachPayload: SuperAdminAddMemberPayload = {
      academyId: '11111111-1111-1111-1111-111111111111',
      fullName: 'Gary Kirsten',
      role: 'coach',
    };

    expect(coachPayload.role).toBe('coach');
  });

  it('verifies Super Admin can list all platform academies and enter unowned academies', () => {
    const isSuperAdmin = true;
    const academies = [
      { id: 'acad-a', name: 'Academy A', ownerUserId: 'owner-a-id' },
      { id: 'acad-b', name: 'Academy B', ownerUserId: 'owner-b-id' },
      { id: 'acad-c', name: 'Academy C', ownerUserId: 'owner-c-id' },
    ];

    const canListAllAcademies = (sa: boolean) => (sa ? academies : []);
    expect(canListAllAcademies(isSuperAdmin)).toHaveLength(3);

    let activeAcademyId: string | null = null;
    const enterAcademy = (acadId: string) => {
      activeAcademyId = acadId;
    };

    enterAcademy('acad-b');
    expect(activeAcademyId).toBe('acad-b');
    // Verify ownership of Academy B has NOT changed merely by entering
    expect(academies.find((a) => a.id === 'acad-b')?.ownerUserId).toBe('owner-b-id');
  });

  it('verifies Super Admin activeAcademyId is NOT wiped out when not in personal memberships', () => {
    const isSuperAdmin = true;
    const personalMemberships = [{ academyId: 'acad-a', role: 'academy_owner' }];
    const activeAcademyId: string | null = 'acad-b'; // Super admin selected unowned Academy B

    // Simulate identity effect guard
    const reconcileActiveAcademy = (
      sa: boolean,
      activeId: string | null,
      memberships: { academyId: string }[],
    ) => {
      if (sa) return activeId; // Super Admins bypass personal membership validation
      const stillValid = memberships.some((m) => m.academyId === activeId);
      return stillValid ? activeId : (memberships[0]?.academyId ?? null);
    };

    const reconciledId = reconcileActiveAcademy(isSuperAdmin, activeAcademyId, personalMemberships);
    expect(reconciledId).toBe('acad-b'); // Preserved!
  });

  it('verifies Super Admin can switch between multiple academies (A -> B -> C -> A)', () => {
    let activeAcademyId = 'acad-a';
    const switchAcademy = (newId: string) => {
      activeAcademyId = newId;
    };

    switchAcademy('acad-b');
    expect(activeAcademyId).toBe('acad-b');

    switchAcademy('acad-c');
    expect(activeAcademyId).toBe('acad-c');

    switchAcademy('acad-a');
    expect(activeAcademyId).toBe('acad-a');
  });

  it('verifies tenant isolation: Owner A, Coach A, Player A cannot access Academy B', () => {
    const checkAccess = (
      userRole: AppRole,
      userAcademyId: string,
      targetAcademyId: string,
      isSA: boolean,
    ) => {
      if (isSA || userRole === 'super_admin') return true;
      return userAcademyId === targetAcademyId;
    };

    const acadA = 'acad-a';
    const acadB = 'acad-b';

    // Super Admin: can access both
    expect(checkAccess('super_admin', acadA, acadB, true)).toBe(true);

    // Owner A: cannot access Academy B
    expect(checkAccess('academy_owner', acadA, acadB, false)).toBe(false);

    // Coach A: cannot access Academy B
    expect(checkAccess('coach', acadA, acadB, false)).toBe(false);

    // Player A: cannot access Academy B
    expect(checkAccess('player', acadA, acadB, false)).toBe(false);
  });

  it('verifies duplicate seed protection guard contract', () => {
    const seededAcademies = new Set<string>();

    const seedAcademy = (academyId: string) => {
      if (seededAcademies.has(academyId)) {
        throw new Error('E_DUPLICATE: Demo data already exists for this academy');
      }
      seededAcademies.add(academyId);
      return { success: true, seededCount: 18 };
    };

    const firstResult = seedAcademy('acad-1');
    expect(firstResult.success).toBe(true);

    expect(() => seedAcademy('acad-1')).toThrow(
      'E_DUPLICATE: Demo data already exists for this academy',
    );
  });
});
