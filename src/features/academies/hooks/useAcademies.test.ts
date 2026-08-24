import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAcademyStore, useAuthStore } from '@/stores';
import type { JoinRequest, Membership } from '@/types';

import { useMemberships } from './useAcademies';

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

const request = (overrides: Partial<JoinRequest> = {}): JoinRequest => ({
  id: 'r-1',
  academyId: 'a-9',
  academyName: 'Pending Academy',
  requestedRole: 'player',
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('useMemberships', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
    useAcademyStore.getState().setActiveAcademy(null);
    useAuthStore.getState().setIdentityStatus('ready');
  });

  it('reports loading until identity resolves', () => {
    useAuthStore.getState().setIdentityStatus('loading');
    expect(renderHook(() => useMemberships()).result.current.isLoading).toBe(true);
  });

  it('treats only active memberships as academy access', () => {
    useAuthStore
      .getState()
      .setMemberships([
        membership({ academyId: 'a-1', status: 'pending' }),
        membership({ academyId: 'a-2', status: 'left' }),
      ]);

    const { result } = renderHook(() => useMemberships());
    expect(result.current.hasAnyAcademy).toBe(false);
    expect(result.current.isAwaitingApproval).toBe(true);
    expect(result.current.current).toBeNull();
  });

  it('flags a pending join request as awaiting approval', () => {
    useAuthStore.getState().setJoinRequests([request()]);

    const { result } = renderHook(() => useMemberships());
    expect(result.current.isAwaitingApproval).toBe(true);
    expect(result.current.pendingRequests).toHaveLength(1);
  });

  it('resolves the current membership from the selected academy', () => {
    useAuthStore
      .getState()
      .setMemberships([
        membership({ academyId: 'a-1', role: 'academy_owner' }),
        membership({ academyId: 'a-2', role: 'coach' }),
      ]);
    useAcademyStore.getState().setActiveAcademy('a-2');

    const { result } = renderHook(() => useMemberships());
    expect(result.current.active).toHaveLength(2);
    expect(result.current.current?.role).toBe('coach');
    expect(result.current.isAwaitingApproval).toBe(false);
  });

  it('ignores a stale selection that is not an active membership', () => {
    useAuthStore.getState().setMemberships([membership({ academyId: 'a-1' })]);
    useAcademyStore.getState().setActiveAcademy('a-deleted');

    expect(renderHook(() => useMemberships()).result.current.current).toBeNull();
  });
});
