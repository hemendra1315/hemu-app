import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PlayerDashboardPage from '../pages/PlayerDashboardPage';
import { useAuthStore, useTestModeStore, useAcademyStore } from '@/stores';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query/queryClient';

vi.mock('../hooks/useDashboardAnalytics', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useDashboardAnalytics')>(
    '../hooks/useDashboardAnalytics',
  );
  return {
    ...actual,
    usePlayerDashboardAnalytics: () => ({
      data: {
        stats: {
          matchesPlayed: 12,
          battingRuns: 450,
          bowlingWickets: 15,
          battingAverage: '45.00',
          strikeRate: '135.50',
          economy: '6.20',
          attendancePercentage: 92,
        },
        recentMatches: [],
        upcomingSessions: [],
        pendingAssignments: [],
        completedAssignments: [],
        recentAwards: [],
        careerHighlights: [],
        runsTrend: [],
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
  };
});

describe('Phase 51 — Test App As Student Home Fix Verification', () => {
  const queryWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: createQueryClient() }, children);

  beforeEach(() => {
    act(() => {
      useTestModeStore.getState().exitTestMode();
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        profile: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'superadmin@cricket.app',
          fullName: 'Super Admin User',
          phone: '+91 99999 88888',
          avatarUrl: null,
          dateOfBirth: null,
          locale: 'en-US',
          timezone: 'Asia/Kolkata',
          isSuperAdmin: true,
        },
        memberships: [
          {
            id: '770e8400-e29b-41d4-a716-446655440000',
            academyId: '880e8400-e29b-41d4-a716-446655440000',
            role: 'academy_owner',
            status: 'active',
            academyName: 'Super Cricket Academy',
            academySlug: 'super-cricket',
            logoUrl: null,
            city: 'Mumbai',
            timezone: 'Asia/Kolkata',
          },
        ],
        joinRequests: [],
      });
      useAcademyStore.getState().setActiveAcademy('880e8400-e29b-41d4-a716-446655440000');
    });
  });

  it('renders Student Home dashboard when Super Admin activates Test App As Student mode', () => {
    act(() => {
      useTestModeStore.getState().setTestMode('student', '880e8400-e29b-41d4-a716-446655440000');
    });

    render(
      <BrowserRouter>
        <PlayerDashboardPage />
      </BrowserRouter>,
      { wrapper: queryWrapper },
    );

    expect(screen.getByText(/my cricket dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/super cricket academy/i)).toBeInTheDocument();

    // Verify key student dashboard stat cards are present
    expect(screen.getByText(/^Matches$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Runs$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Wickets$/i)).toBeInTheDocument();
  });

  it('guarantees Super Admin management actions are hidden in Student Test Mode', () => {
    act(() => {
      useTestModeStore.getState().setTestMode('student', '880e8400-e29b-41d4-a716-446655440000');
    });

    render(
      <BrowserRouter>
        <PlayerDashboardPage />
      </BrowserRouter>,
      { wrapper: queryWrapper },
    );

    expect(screen.queryByText(/super admin controls/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/add player/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/add coach/i)).not.toBeInTheDocument();
  });

  it('cleans up test mode state without state leakage when exiting test mode', () => {
    act(() => {
      useTestModeStore.getState().setTestMode('student', '880e8400-e29b-41d4-a716-446655440000');
    });
    expect(useTestModeStore.getState().activeRole).toBe('student');

    act(() => {
      useTestModeStore.getState().exitTestMode();
    });
    expect(useTestModeStore.getState().activeRole).toBeNull();
  });
});
