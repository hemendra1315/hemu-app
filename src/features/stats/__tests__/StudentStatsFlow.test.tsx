/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

import StatsPage from '../pages/StatsPage';
import { createQueryClient } from '@/lib/query/queryClient';
import { useAcademyStore, useAuthStore, useTestModeStore } from '@/stores';

// Exercise the REAL usePlayerDashboardAnalytics -> fetchPlayerDashboardAnalytics
// data flow (only the Supabase transport is mocked), so the regression test covers
// the exact queries the Stats page issues for a student.
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase/client';

const mockedSupabase = vi.mocked(supabase);

// Seed values: the local academy + player-1 academy_members.id.
const ACADEMY_ID = 'b8c91ab7-4f70-4267-8c17-8ff1ce83c421';
// The authenticated student's own academy_members.id (what the app sends as the
// player id for player_statistics / match_* / attendance / drill_assignments).
const OWN_MEMBER_ID = 'ca6671b8-9fe7-4990-97b3-76748d521c37';
// Another player's academy_members.id that the student MUST never query with.
const OTHER_MEMBER_ID = 'cf25e313-8012-45a7-8de5-13947ef5a6ca';

const PLAYER_STATS_ROW = {
  id: 'ps-1',
  academy_id: ACADEMY_ID,
  player_id: OWN_MEMBER_ID,
  matches_played: 12,
  batting_innings: 10,
  batting_runs: 450,
  balls_faced_sum: 333,
  batting_highest_score: 87,
  batting_not_outs: 1,
  batting_fifties: 2,
  batting_centuries: 0,
  batting_fours: 40,
  batting_sixes: 6,
  bowling_innings: 8,
  bowling_overs: 5,
  bowling_maidens: 0,
  bowling_runs_conceded: 150,
  bowling_wickets: 15,
  bowling_best_bowling: '4/18',
  fielding_catches: 7,
  fielding_run_outs: 2,
  fielding_stumpings: 0,
  awards_player_of_match: 1,
  awards_best_batter: 0,
  awards_best_bowler: 1,
  awards_best_fielder: 0,
};

type Builder = any;

/** Supabase query-builder chain that resolves table-appropriate data. */
function createBuilder(table: string) {
  const eqArgs: string[][] = [];

  const response =
    table === 'player_statistics'
      ? { data: PLAYER_STATS_ROW, error: null }
      : { data: [], error: null };

  const builder: Builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((col: string, val: unknown) => {
      eqArgs.push([col, String(val)]);
      return builder;
    }),
    or: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    then: (onFulfilled: (val: any) => any, onRejected: (reason: any) => any) =>
      Promise.resolve(response).then(onFulfilled, onRejected),
    // `single`/`maybeSingle` return the builder rather than a resolved promise
    // so that `.single().returns<T>()` chains; the builder is thenable, so
    // awaiting either still yields `response`.
    maybeSingle: vi.fn(() => builder),
    single: vi.fn(() => builder),
    returns: vi.fn(() => builder),
  };

  return { builder, eqArgs };
}

const queryWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: createQueryClient() }, children);
describe('Student Stats flow (production regression)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    act(() => {
      useTestModeStore.getState().exitTestMode();
      // A normal authenticated student (NOT super admin / test mode).
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        profile: {
          id: '00000000-0000-4000-8000-000000000001',
          email: 'player1@demo.com',
          fullName: 'Arjun Sharma',
          avatarUrl: null,
          phone: '+919876543210',
          phoneVerified: true,
          dateOfBirth: '2010-01-01',
          locale: 'en',
          timezone: 'Asia/Kolkata',
          isSuperAdmin: false,
        },
        memberships: [
          {
            id: OWN_MEMBER_ID,
            academyId: ACADEMY_ID,
            role: 'player',
            status: 'active',
            academyName: 'Elite Cricket Academy',
            academySlug: 'elite-cricket',
            logoUrl: null,
            city: 'Mumbai',
            timezone: 'Asia/Kolkata',
          },
        ],
        joinRequests: [],
      });
      useAcademyStore.getState().setActiveAcademy(ACADEMY_ID);
    });
  });

  it("renders the student head-to-head stats without the generic error and only queries the student's OWN player id", async () => {
    const buildersByTable = new Map<string, ReturnType<typeof createBuilder>>();
    mockedSupabase.from.mockImplementation((table: string) => {
      if (!buildersByTable.has(table)) buildersByTable.set(table, createBuilder(table));
      return buildersByTable.get(table)!.builder;
    });

    render(
      <BrowserRouter>
        <StatsPage />
      </BrowserRouter>,
      { wrapper: queryWrapper },
    );

    // The page must not show the "Something went wrong" error state.
    await waitFor(
      () => {
        expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Headline stats are visible (player_statistics row resolved).
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
    expect(screen.getByText('450')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Match Statistics')).toBeInTheDocument();

    // The player_statistics read was scoped to the authenticated student's own
    // academy_members.id — and NEVER to another player's id.
    const ps = buildersByTable.get('player_statistics')!;
    const psEq = ps.eqArgs.map(([col]) => col);
    expect(psEq).toContain('academy_id');
    expect(psEq).toContain('player_id');
    const playerIdFilters = ps.eqArgs.filter(([col]) => col === 'player_id');
    expect(playerIdFilters.length).toBeGreaterThan(0);
    expect(playerIdFilters.every(([, v]) => v === OWN_MEMBER_ID)).toBe(true);

    // Every other stats query must be scoped to the student's own id too.
    for (const table of [
      'match_batting',
      'match_bowling',
      'match_fielding',
      'match_awards',
      'player_milestones',
      'attendance',
      'drill_assignments',
      'training_sessions',
    ]) {
      const entry = buildersByTable.get(table);
      if (!entry) continue;
      const leaked = entry.eqArgs.filter(
        (pair) => pair[0]?.includes('member_id') && pair[1] === OTHER_MEMBER_ID,
      );
      expect(leaked).toEqual([]);
    }
    // Sanity: the queries actually ran (data was requested), so the assertions
    // above aren't vacuously true.
    expect(buildersByTable.has('player_statistics')).toBe(true);
    expect(mockedSupabase.from).toHaveBeenCalled();
  });

  it('surfaces an error instead of silently succeeding when the RLS authorization is missing (42501)', async () => {
    // Simulate the production failure: policy evaluation throws
    // `permission denied for function my_player_id` (code 42501).
    mockedSupabase.from.mockImplementation(() => {
      const denied = {
        data: null,
        error: { code: '42501', message: 'permission denied for function my_player_id' },
      };
      const builder: Builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        or: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        in: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        gte: vi.fn(() => builder),
        lte: vi.fn(() => builder),
        then: (f: any, r: any) => Promise.resolve(denied).then(f, r),
        maybeSingle: vi.fn(() => builder),
        single: vi.fn(() => builder),
        returns: vi.fn(() => builder),
      };
      return builder;
    });

    render(
      <BrowserRouter>
        <StatsPage />
      </BrowserRouter>,
      { wrapper: queryWrapper },
    );

    await waitFor(() => {
      expect(screen.queryByText(/something went wrong/i)).toBeInTheDocument();
    });
    // ... and it must not fabricate the student's stats in that case.
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });
});
