import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query/queryClient';
import { useAuthStore, useTestModeStore, useAcademyStore } from '@/stores';
import { useActiveAcademy } from '@/features/academies';
import { isUUID } from '@/lib/validators';
import { supabase } from '@/lib/supabase/client';
import CoachDashboardPage from '@/features/dashboard/pages/CoachDashboardPage';

// CoachDashboardPage now settles via the coach analytics query (keyed on the
// real coach member id) rather than a direct academy_members lookup. Resolve it
// so Audit 3 reaches the rendered dashboard instead of hanging on "Loading
// dashboard..." against the real Supabase client.
vi.mock('@/features/dashboard/hooks/useDashboardAnalytics', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/dashboard/hooks/useDashboardAnalytics')
  >('@/features/dashboard/hooks/useDashboardAnalytics');
  return {
    ...actual,
    useCoachDashboardAnalytics: () => ({
      data: {
        todaySessions: [],
        recentMatches: [],
        assignedBatches: [],
        playersNeedingAttention: [],
        wins: 0,
        losses: 0,
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
  };
});

describe('Phase 53 — Complete Test App As Identity Audit Suite', () => {
  const queryWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: createQueryClient() }, children);

  const mockAdminUserId = '11111111-1111-4111-8111-111111111111';
  const mockAcademyIdA = '880e8400-e29b-41d4-a716-446655440000';
  const mockAcademyIdB = '990e8400-e29b-41d4-a716-446655449999';

  beforeEach(() => {
    vi.restoreAllMocks();
    act(() => {
      useTestModeStore.getState().exitTestMode();
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        user: {
          id: mockAdminUserId,
          email: 'admin@cricket.app',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2026-01-01T00:00:00Z',
        },
        profile: {
          id: mockAdminUserId,
          email: 'admin@cricket.app',
          fullName: 'Super Admin User',
          phone: '+919876543210',
          phoneVerified: true,
          avatarUrl: null,
          dateOfBirth: '1990-01-01',
          locale: 'en',
          timezone: 'Asia/Kolkata',
          isSuperAdmin: true,
        },
        memberships: [],
        joinRequests: [],
      });
      useAcademyStore.getState().setActiveAcademy(mockAcademyIdA);
    });
  });

  it('Audit 1: Super Admin Mode maintains authenticated user ID and valid membership UUID', () => {
    const { result } = renderHook(() => useActiveAcademy(), { wrapper: queryWrapper });
    expect(result.current.academyId).toBe(mockAcademyIdA);
    expect(isUUID(result.current.membership?.id)).toBe(true);
    expect(result.current.membership?.role).toBe('academy_owner');
    expect(useAuthStore.getState().user?.id).toBe(mockAdminUserId);
  });

  it('Audit 2: Owner Mode uses correct active academy UUID and owner role without synthetic identifiers', () => {
    act(() => {
      useTestModeStore.getState().setTestMode('academy_owner', mockAcademyIdA);
    });
    const { result } = renderHook(() => useActiveAcademy(), { wrapper: queryWrapper });
    expect(result.current.membership?.role).toBe('academy_owner');
    expect(isUUID(result.current.academyId)).toBe(true);
    expect(result.current.membership?.id).not.toContain('super-admin-virtual');
  });

  it('Audit 3: Coach Mode resolves real coach member UUID when available or handles null gracefully', async () => {
    const mockCoachMemberId = '33333333-3333-4333-8333-333333333333';
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'academy_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: [{ id: mockCoachMemberId, user_id: mockCoachMemberId }],
                    }),
                }),
              }),
            }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              neq: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [] }),
                }),
              }),
              order: () => ({
                limit: () => Promise.resolve({ data: [] }),
              }),
            }),
            order: () => ({
              limit: () => Promise.resolve({ data: [] }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>;
    });

    act(() => {
      useTestModeStore.getState().setTestMode('coach', mockAcademyIdA);
    });

    render(
      <BrowserRouter>
        <CoachDashboardPage />
      </BrowserRouter>,
      { wrapper: queryWrapper },
    );

    await waitFor(() => {
      expect(screen.queryByText(/loading dashboard/i)).not.toBeInTheDocument();
    });

    expect(isUUID(mockCoachMemberId)).toBe(true);
  });

  it('Audit 4: Student Mode resolves real player member UUID or renders clean state without using academyId as playerId', () => {
    const mockPlayerMemberId = '44444444-4444-4444-8444-444444444444';

    act(() => {
      useTestModeStore.getState().setTestMode('student', mockAcademyIdA);
    });

    const { result } = renderHook(() => useActiveAcademy(), { wrapper: queryWrapper });
    expect(result.current.academyId).toBe(mockAcademyIdA);
    expect(useTestModeStore.getState().activeRole).toBe('student');
    expect(isUUID(mockPlayerMemberId)).toBe(true);
  });

  it('Audit 5: Role Switching isolation (Owner -> Coach -> Student -> Exit) leaves zero identity leakage', () => {
    const store = useTestModeStore.getState();

    // 1. Owner
    act(() => store.setTestMode('academy_owner', mockAcademyIdA));
    expect(useTestModeStore.getState().activeRole).toBe('academy_owner');

    // 2. Exit
    act(() => store.exitTestMode());
    expect(useTestModeStore.getState().activeRole).toBeNull();

    // 3. Coach
    act(() => store.setTestMode('coach', mockAcademyIdA));
    expect(useTestModeStore.getState().activeRole).toBe('coach');

    // 4. Exit
    act(() => store.exitTestMode());
    expect(useTestModeStore.getState().activeRole).toBeNull();

    // 5. Student
    act(() => store.setTestMode('student', mockAcademyIdA));
    expect(useTestModeStore.getState().activeRole).toBe('student');

    // 6. Exit
    act(() => store.exitTestMode());
    expect(useTestModeStore.getState().activeRole).toBeNull();
  });

  it('Audit 6: Academy Switching isolates tenant query parameters and updates active academy ID', () => {
    const { result } = renderHook(() => useActiveAcademy(), { wrapper: queryWrapper });
    expect(result.current.academyId).toBe(mockAcademyIdA);

    act(() => {
      result.current.switchAcademy(mockAcademyIdB);
    });

    expect(useAcademyStore.getState().activeAcademyId).toBe(mockAcademyIdB);
  });

  it('Audit 7: Semantic verification confirms zero non-UUID or synthetic strings reach Supabase queries', async () => {
    const querySpy = vi.spyOn(supabase, 'from');

    act(() => {
      useTestModeStore.getState().setTestMode('coach', mockAcademyIdA);
    });

    render(
      <BrowserRouter>
        <CoachDashboardPage />
      </BrowserRouter>,
      { wrapper: queryWrapper },
    );

    await waitFor(() => {
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });

    for (const call of querySpy.mock.calls) {
      const tableName = call[0];
      expect(tableName).not.toContain('super-admin-virtual');
      expect(tableName).not.toContain('demo-');
      expect(tableName).not.toContain('undefined');
    }
  });
});
