import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useAcademyStore, useAuthStore, useTestModeStore } from '@/stores';
import { useActiveAcademy } from '@/features/academies';
import { useActiveRoles, useCan } from '@/lib/rbac';
import { isUUID } from '@/lib/validators';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query/queryClient';
import { renderHook, act } from '@testing-library/react';

describe('Phase 46 — Production Smoke Test & Super Admin Test-App-As Validation', () => {
  const queryWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: createQueryClient() }, children);

  beforeEach(() => {
    act(() => {
      useTestModeStore.getState().exitTestMode();
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        profile: {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Valid UUID
          email: 'admin@cricket.app',
          fullName: 'Platform Super Admin',
          phone: null,
          avatarUrl: null,
          dateOfBirth: null,
          locale: 'en-US',
          timezone: 'UTC',
          isSuperAdmin: true,
        },
        memberships: [], // Super Admin is NOT in academy_members table for target academy!
        joinRequests: [],
      });
      useAcademyStore.getState().setActiveAcademy('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
    });
  });

  describe('1. Non-Member Super Admin Academy Inspection', () => {
    it('successfully loads effectiveMembership for an unjoined academy with a valid UUID and zero virtual prefixes', () => {
      const { result } = renderHook(() => useActiveAcademy(), { wrapper: queryWrapper });

      expect(result.current.academyId).toBe('b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      expect(result.current.membership).not.toBeNull();
      expect(result.current.membership?.id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(result.current.membership?.id).not.toContain('super-admin-virtual');
      expect(isUUID(result.current.membership?.id)).toBe(true);
      expect(isUUID(result.current.membership?.academyId)).toBe(true);
    });
  });

  describe('2. Test App As → Owner Mode Validation', () => {
    it('simulates Owner role correctly while preserving valid database UUIDs', () => {
      act(() => {
        useTestModeStore
          .getState()
          .setTestMode('academy_owner', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      });

      const { result: roles } = renderHook(() => useActiveRoles());
      const { result: canUpdateAcademy } = renderHook(() => useCan('academy:update'));
      const { result: canManageMembers } = renderHook(() => useCan('members:manage'));

      expect(roles.current).toEqual(['academy_owner']);
      expect(canUpdateAcademy.current).toBe(true);
      expect(canManageMembers.current).toBe(true);

      const { result: academy } = renderHook(() => useActiveAcademy(), { wrapper: queryWrapper });
      expect(isUUID(academy.current.membership?.id)).toBe(true);
    });
  });

  describe('3. Test App As → Coach Mode Validation', () => {
    it('simulates Coach role correctly, granting session/attendance capabilities while denying academy updates', () => {
      act(() => {
        useTestModeStore.getState().setTestMode('coach', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      });

      const { result: roles } = renderHook(() => useActiveRoles());
      const { result: canManageSessions } = renderHook(() => useCan('sessions:manage'));
      const { result: canUpdateAcademy } = renderHook(() => useCan('academy:update'));

      expect(roles.current).toEqual(['coach']);
      expect(canManageSessions.current).toBe(true);
      expect(canUpdateAcademy.current).toBe(false);

      const { result: academy } = renderHook(() => useActiveAcademy(), { wrapper: queryWrapper });
      expect(isUUID(academy.current.membership?.id)).toBe(true);
    });
  });

  describe('4. Test App As → Student/Player Mode Validation', () => {
    it('simulates Player role correctly, restricting management controls while preserving valid user UUID', () => {
      act(() => {
        useTestModeStore.getState().setTestMode('student', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      });

      const { result: roles } = renderHook(() => useActiveRoles());
      const { result: canReadOwnStats } = renderHook(() => useCan('stats:read_own'));
      const { result: canManageMembers } = renderHook(() => useCan('members:manage'));
      const { result: canUpdateAcademy } = renderHook(() => useCan('academy:update'));

      expect(roles.current).toEqual(['player']);
      expect(canReadOwnStats.current).toBe(true);
      expect(canManageMembers.current).toBe(false);
      expect(canUpdateAcademy.current).toBe(false);

      const { result: academy } = renderHook(() => useActiveAcademy(), { wrapper: queryWrapper });
      expect(isUUID(academy.current.membership?.id)).toBe(true);
    });
  });

  describe('5. Data Integrity & Test State Teardown', () => {
    it('restores Super Admin identity upon exiting test mode without persisting simulated role state', () => {
      act(() => {
        useTestModeStore.getState().setTestMode('student', 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      });

      expect(useTestModeStore.getState().activeRole).toBe('student');

      act(() => {
        useTestModeStore.getState().exitTestMode();
      });

      expect(useTestModeStore.getState().activeRole).toBeNull();
      expect(useTestModeStore.getState().targetAcademyId).toBeNull();

      const { result: roles } = renderHook(() => useActiveRoles());
      expect(roles.current).toContain('super_admin');
    });
  });
});
