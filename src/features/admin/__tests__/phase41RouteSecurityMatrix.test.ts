import { describe, expect, it, beforeEach } from 'vitest';
import { useAcademyStore, useAuthStore, useTestModeStore } from '@/stores';
import { useActiveRoles, useCan } from '@/lib/rbac';
import { renderHook, act } from '@testing-library/react';

describe('Phase 41 — Route Security Matrix & Capability Enforcement', () => {
  beforeEach(() => {
    act(() => {
      useTestModeStore.getState().exitTestMode();
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        profile: {
          id: 'super-admin-user',
          email: 'admin@cricket.app',
          fullName: 'Super Admin',
          phone: null,
          avatarUrl: null,
          dateOfBirth: null,
          locale: 'en-US',
          timezone: 'UTC',
          isSuperAdmin: true,
        },
        memberships: [],
        joinRequests: [],
      });
      useAcademyStore.getState().setActiveAcademy('academy-123');
    });
  });

  describe('1. Student / Player Role Capabilities', () => {
    beforeEach(() => {
      act(() => {
        useTestModeStore.getState().setTestMode('student', 'academy-123');
      });
    });

    it('allows Student to access read-only personal resources', () => {
      expect(renderHook(() => useCan('stats:read_own')).result.current).toBe(true);
      expect(renderHook(() => useCan('sessions:read')).result.current).toBe(true);
      expect(renderHook(() => useCan('matches:read')).result.current).toBe(true);
      expect(renderHook(() => useCan('drills:read')).result.current).toBe(true);
    });

    it('denies Student access to administrative and mutation capabilities', () => {
      expect(renderHook(() => useCan('members:manage')).result.current).toBe(false);
      expect(renderHook(() => useCan('batches:manage')).result.current).toBe(false);
      expect(renderHook(() => useCan('sessions:manage')).result.current).toBe(false);
      expect(renderHook(() => useCan('attendance:mark')).result.current).toBe(false);
      expect(renderHook(() => useCan('matches:manage')).result.current).toBe(false);
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(false);
      expect(renderHook(() => useCan('academy:regenerate_join_code')).result.current).toBe(false);
    });

    it('hides Super Admin role from Student active roles', () => {
      const { result } = renderHook(() => useActiveRoles());
      expect(result.current).toEqual(['player']);
      expect(result.current).not.toContain('super_admin');
    });
  });

  describe('2. Coach Role Capabilities', () => {
    beforeEach(() => {
      act(() => {
        useTestModeStore.getState().setTestMode('coach', 'academy-123');
      });
    });

    it('allows Coach operational session, attendance, drill, and match management', () => {
      expect(renderHook(() => useCan('sessions:read')).result.current).toBe(true);
      expect(renderHook(() => useCan('sessions:manage')).result.current).toBe(true);
      expect(renderHook(() => useCan('attendance:mark')).result.current).toBe(true);
      expect(renderHook(() => useCan('matches:read')).result.current).toBe(true);
      expect(renderHook(() => useCan('matches:manage')).result.current).toBe(true);
      expect(renderHook(() => useCan('drills:manage')).result.current).toBe(true);
    });

    it('denies Coach academy-level configuration and owner controls', () => {
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(false);
      expect(renderHook(() => useCan('academy:regenerate_join_code')).result.current).toBe(false);
    });

    it('hides Super Admin role from Coach active roles', () => {
      const { result } = renderHook(() => useActiveRoles());
      expect(result.current).toEqual(['coach']);
      expect(result.current).not.toContain('super_admin');
    });
  });

  describe('3. Academy Owner Role Capabilities', () => {
    beforeEach(() => {
      act(() => {
        useTestModeStore.getState().setTestMode('academy_owner', 'academy-123');
      });
    });

    it('grants full academy owner capabilities', () => {
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(true);
      expect(renderHook(() => useCan('academy:regenerate_join_code')).result.current).toBe(true);
      expect(renderHook(() => useCan('members:manage')).result.current).toBe(true);
      expect(renderHook(() => useCan('batches:manage')).result.current).toBe(true);
      expect(renderHook(() => useCan('sessions:manage')).result.current).toBe(true);
      expect(renderHook(() => useCan('matches:manage')).result.current).toBe(true);
    });

    it('hides Super Admin role from Owner active roles', () => {
      const { result } = renderHook(() => useActiveRoles());
      expect(result.current).toEqual(['academy_owner']);
      expect(result.current).not.toContain('super_admin');
    });
  });

  describe('5. Phase 42A & 42B — Academy Settings Absolute Top Prominence & Access', () => {
    it('grants Academy Settings access (academy:update) exclusively to Academy Owner and Super Admin at absolute top priority', () => {
      // Student
      act(() => useTestModeStore.getState().setTestMode('student', 'academy-123'));
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(false);

      // Coach
      act(() => useTestModeStore.getState().setTestMode('coach', 'academy-123'));
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(false);

      // Owner
      act(() => useTestModeStore.getState().setTestMode('academy_owner', 'academy-123'));
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(true);

      // Exit test mode -> Super Admin
      act(() => useTestModeStore.getState().exitTestMode());
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(true);
    });
  });
});
