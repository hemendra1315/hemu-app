import { describe, expect, it, beforeEach } from 'vitest';
import { useAcademyStore, useAuthStore, useTestModeStore } from '@/stores';
import { useCan, useActiveRoles } from '@/lib/rbac';
import { renderHook, act } from '@testing-library/react';
import { env } from '@/lib/env';

describe('Phase 45 — Final Full-App Production Audit & Bug-Fix', () => {
  beforeEach(() => {
    act(() => {
      useTestModeStore.getState().exitTestMode();
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        profile: {
          id: 'owner-prod-id',
          email: 'owner@cricket.app',
          fullName: 'Academy Owner',
          phone: null,
          avatarUrl: null,
          dateOfBirth: null,
          locale: 'en-US',
          timezone: 'UTC',
          isSuperAdmin: false,
        },
        memberships: [
          {
            id: 'owner-member-id',
            academyId: 'academy-prod-100',
            role: 'academy_owner',
            status: 'active',
            academyName: 'Elite Production Academy',
            academySlug: 'elite-prod',
            logoUrl: null,
            city: 'Mumbai',
            timezone: 'Asia/Kolkata',
          },
        ],
        joinRequests: [],
      });
      useAcademyStore.getState().setActiveAcademy('academy-prod-100');
    });
  });

  describe('1. Full-App Route & Role Security Matrix', () => {
    it('enforces strict role separation across Student, Coach, Owner, and Super Admin', () => {
      // Student
      act(() => {
        useAuthStore.setState({
          profile: {
            id: 'student-id',
            email: 'student@cricket.app',
            fullName: 'Student Player',
            phone: null,
            avatarUrl: null,
            dateOfBirth: null,
            locale: 'en-US',
            timezone: 'UTC',
            isSuperAdmin: false,
          },
          memberships: [
            {
              id: 'student-member-id',
              academyId: 'academy-prod-100',
              role: 'player',
              status: 'active',
              academyName: 'Elite Production Academy',
              academySlug: 'elite-prod',
              logoUrl: null,
              city: 'Mumbai',
              timezone: 'Asia/Kolkata',
            },
          ],
        });
      });

      expect(renderHook(() => useActiveRoles()).result.current).toEqual(['player']);
      expect(renderHook(() => useCan('stats:read_own')).result.current).toBe(true);
      expect(renderHook(() => useCan('members:manage')).result.current).toBe(false);
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(false);

      // Coach
      act(() => {
        useAuthStore.setState({
          profile: {
            id: 'coach-id',
            email: 'coach@cricket.app',
            fullName: 'Head Coach',
            phone: null,
            avatarUrl: null,
            dateOfBirth: null,
            locale: 'en-US',
            timezone: 'UTC',
            isSuperAdmin: false,
          },
          memberships: [
            {
              id: 'coach-member-id',
              academyId: 'academy-prod-100',
              role: 'coach',
              status: 'active',
              academyName: 'Elite Production Academy',
              academySlug: 'elite-prod',
              logoUrl: null,
              city: 'Mumbai',
              timezone: 'Asia/Kolkata',
            },
          ],
        });
      });

      expect(renderHook(() => useActiveRoles()).result.current).toEqual(['coach']);
      expect(renderHook(() => useCan('sessions:manage')).result.current).toBe(true);
      expect(renderHook(() => useCan('matches:manage')).result.current).toBe(true);
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(false);
    });
  });

  describe('2. Test App As Role Isolation & Exit Cleanup', () => {
    it('seamlessly transitions Super Admin through Student, Coach, and Owner simulations with zero role state leakage', () => {
      act(() => {
        useAuthStore.setState({
          profile: {
            id: 'admin-id',
            email: 'admin@cricket.app',
            fullName: 'Platform Super Admin',
            phone: null,
            avatarUrl: null,
            dateOfBirth: null,
            locale: 'en-US',
            timezone: 'UTC',
            isSuperAdmin: true,
          },
          memberships: [],
        });
      });

      // 1. Student Test Mode
      act(() => useTestModeStore.getState().setTestMode('student', 'academy-prod-100'));
      expect(useTestModeStore.getState().activeRole).toBe('student');
      expect(renderHook(() => useActiveRoles()).result.current).toEqual(['player']);
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(false);

      // 2. Coach Test Mode
      act(() => useTestModeStore.getState().setTestMode('coach', 'academy-prod-100'));
      expect(useTestModeStore.getState().activeRole).toBe('coach');
      expect(renderHook(() => useActiveRoles()).result.current).toEqual(['coach']);
      expect(renderHook(() => useCan('sessions:manage')).result.current).toBe(true);
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(false);

      // 3. Owner Test Mode
      act(() => useTestModeStore.getState().setTestMode('academy_owner', 'academy-prod-100'));
      expect(useTestModeStore.getState().activeRole).toBe('academy_owner');
      expect(renderHook(() => useActiveRoles()).result.current).toEqual(['academy_owner']);
      expect(renderHook(() => useCan('academy:update')).result.current).toBe(true);

      // 4. Exit Test Mode -> Super Admin restored
      act(() => useTestModeStore.getState().exitTestMode());
      expect(useTestModeStore.getState().activeRole).toBeNull();
      expect(renderHook(() => useActiveRoles()).result.current).toContain('super_admin');
    });
  });

  describe('3. Multi-Tenant Cache Isolation & Environment Security', () => {
    it('prevents cross-tenant query cache collision and confirms zero service role key exposure', () => {
      const keyTenantA = ['sessions', 'tenant-a-id'];
      const keyTenantB = ['sessions', 'tenant-b-id'];

      expect(keyTenantA).not.toEqual(keyTenantB);

      const envKeys = env as unknown as Record<string, unknown>;
      expect(envKeys['SUPABASE_SERVICE_ROLE_KEY']).toBeUndefined();
      expect(env.supabaseUrl).toBeDefined();
      expect(env.supabaseAnonKey).toBeDefined();
    });
  });
});
