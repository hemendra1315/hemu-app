import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAcademyStore, useAuthStore } from '@/stores';
import type { Membership, Profile } from '@/types';

import { useActiveRoles, useCan } from './useCan';

const membership = (overrides: Partial<Membership> & { academyId: string }): Membership => ({
  id: `m-${overrides.academyId}`,
  academyName: 'Academy',
  academySlug: 'academy',
  logoUrl: null,
  city: null,
  timezone: 'Asia/Kolkata',
  role: 'player',
  status: 'active',
  ...overrides,
});

const profile = (isSuperAdmin: boolean): Profile => ({
  id: 'u-1',
  fullName: 'Test User',
  email: 'test@example.com',
  avatarUrl: null,
  phone: null,
  dateOfBirth: null,
  locale: 'en',
  timezone: 'Asia/Kolkata',
  isSuperAdmin,
});

describe('useActiveRoles', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    useAcademyStore.getState().setActiveAcademy(null);
  });

  it('only counts active memberships in the active academy', () => {
    useAuthStore
      .getState()
      .setMemberships([
        membership({ academyId: 'a-1', role: 'academy_owner' }),
        membership({ academyId: 'a-2', role: 'coach' }),
        membership({ academyId: 'a-2', role: 'player', status: 'pending' }),
      ]);
    useAcademyStore.getState().setActiveAcademy('a-2');

    expect(renderHook(() => useActiveRoles()).result.current).toEqual(['coach']);
  });

  it('adds super_admin from the profile flag regardless of academy', () => {
    useAuthStore.getState().setProfile(profile(true));
    expect(renderHook(() => useActiveRoles()).result.current).toEqual(['super_admin']);
  });
});

describe('useCan', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    useAcademyStore.getState().setActiveAcademy('a-1');
  });

  it('denies owner-only capabilities to a player', () => {
    useAuthStore.getState().setMemberships([membership({ academyId: 'a-1', role: 'player' })]);
    expect(renderHook(() => useCan('members:manage')).result.current).toBe(false);
    expect(renderHook(() => useCan('stats:read_own')).result.current).toBe(true);
  });

  it('grants join-code rotation to the academy owner', () => {
    useAuthStore
      .getState()
      .setMemberships([membership({ academyId: 'a-1', role: 'academy_owner' })]);
    expect(renderHook(() => useCan('academy:regenerate_join_code')).result.current).toBe(true);
  });

  it('grants nothing while a membership is still pending', () => {
    useAuthStore
      .getState()
      .setMemberships([membership({ academyId: 'a-1', role: 'coach', status: 'pending' })]);
    expect(renderHook(() => useCan('attendance:mark')).result.current).toBe(false);
  });
});
