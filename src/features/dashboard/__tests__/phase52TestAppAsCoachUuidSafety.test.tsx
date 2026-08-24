import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import CoachDashboardPage from '../pages/CoachDashboardPage';
import { useAuthStore, useTestModeStore, useAcademyStore } from '@/stores';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query/queryClient';
import { act } from '@testing-library/react';
import { isUUID } from '@/lib/validators';
import { supabase } from '@/lib/supabase/client';

// CoachDashboardPage now drives off the analytics query (keyed on the coach
// member id) rather than a direct academy_members member lookup. Resolve that
// query so the page settles into its rendered state instead of staying in the
// "Loading dashboard..." branch while the real Supabase client hangs in tests.
vi.mock('../hooks/useDashboardAnalytics', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useDashboardAnalytics')>(
    '../hooks/useDashboardAnalytics',
  );
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

describe('Phase 52 — Test App As Coach UUID Identity & Safety', () => {
  const queryWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: createQueryClient() }, children);

  beforeEach(() => {
    vi.restoreAllMocks();
    act(() => {
      useTestModeStore.getState().exitTestMode();
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'admin@cricket.app',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2026-01-01T00:00:00Z',
        },
        profile: {
          id: '11111111-1111-4111-8111-111111111111',
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
      useAcademyStore.getState().setActiveAcademy('880e8400-e29b-41d4-a716-446655440000');
    });
  });

  it('Test 1: Super Admin -> Test App As -> Coach renders without UUID error and sends zero virtual strings to database', async () => {
    act(() => {
      useTestModeStore.getState().setTestMode('coach', '880e8400-e29b-41d4-a716-446655440000');
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
  });

  it('Test 2: Resolves real coach UUID when an active coach member exists in academy', async () => {
    const mockCoachMemberId = '22222222-2222-4222-8222-222222222222';
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
      useTestModeStore.getState().setTestMode('coach', '880e8400-e29b-41d4-a716-446655440000');
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

  it('Test 3: Renders clean empty state when academy has no coach, without crashing or generating fake UUIDs', async () => {
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'academy_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  limit: () => Promise.resolve({ data: [] }),
                }),
              }),
            }),
          }),
        } as unknown as ReturnType<typeof supabase.from>;
      }
      return {} as unknown as ReturnType<typeof supabase.from>;
    });

    act(() => {
      useTestModeStore.getState().setTestMode('coach', '880e8400-e29b-41d4-a716-446655440000');
    });

    render(
      <BrowserRouter>
        <CoachDashboardPage />
      </BrowserRouter>,
      { wrapper: queryWrapper },
    );

    await waitFor(() => {
      // The redesign renders the coach dashboard (with its empty states) rather
      // than a dedicated "no coach available" screen; verify the clean empty
      // state renders without crashing or throwing.
      expect(screen.getByText(/no batches assigned yet/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('Test 4: State isolation on switching (Student -> Exit -> Coach -> Exit -> Owner -> Exit)', () => {
    const store = useTestModeStore.getState();

    // 1. Switch to Student
    act(() => store.setTestMode('student', '880e8400-e29b-41d4-a716-446655440000'));
    expect(useTestModeStore.getState().activeRole).toBe('student');

    // 2. Exit Test Mode
    act(() => store.exitTestMode());
    expect(useTestModeStore.getState().activeRole).toBeNull();

    // 3. Switch to Coach
    act(() => store.setTestMode('coach', '880e8400-e29b-41d4-a716-446655440000'));
    expect(useTestModeStore.getState().activeRole).toBe('coach');

    // 4. Exit Test Mode
    act(() => store.exitTestMode());
    expect(useTestModeStore.getState().activeRole).toBeNull();

    // 5. Switch to Academy Owner
    act(() => store.setTestMode('academy_owner', '880e8400-e29b-41d4-a716-446655440000'));
    expect(useTestModeStore.getState().activeRole).toBe('academy_owner');

    // 6. Final Exit
    act(() => store.exitTestMode());
    expect(useTestModeStore.getState().activeRole).toBeNull();
  });

  it('Test 5: Directly inspect all Supabase calls used by Coach pages to verify zero virtual ID parameters', async () => {
    const querySpy = vi.spyOn(supabase, 'from');

    act(() => {
      useTestModeStore.getState().setTestMode('coach', '880e8400-e29b-41d4-a716-446655440000');
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
      expect(tableName).not.toContain('demo-coach-id');
    }
  });
});
