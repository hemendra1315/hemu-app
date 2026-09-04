import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockQueryBuilder } from '../../../test/supabaseQueryBuilder';
import type { UUID } from '@/types';
import { fetchCoachDashboardAnalytics, fetchOwnerDashboardAnalytics } from './dashboardAnalytics';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase/client';
const mockedSupabase = vi.mocked(supabase);

// Shared with every other API test; see the note in that file for why this
// is centralised rather than redefined per suite.
const createMockBuilder = createMockQueryBuilder;

describe('fetchCoachDashboardAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty fallback on invalid UUID inputs', async () => {
    const result = await fetchCoachDashboardAnalytics('invalid' as UUID, 'invalid' as UUID);
    expect(result).toEqual({
      todaySession: null,
      recentMatches: [],
      assignedBatches: [],
      wins: 0,
      losses: 0,
      playersNeedingAttention: [],
    });
  });

  it('batches queries and identifies players needing attention', async () => {
    const academyId = '11111111-1111-1111-1111-111111111111';
    const coachId = '22222222-2222-2222-2222-222222222222';
    const player1Id = '33333333-3333-3333-3333-333333333333';
    const player2Id = '44444444-4444-4444-4444-444444444444';

    // 1. Initial 4 parallel queries
    const todaySessionBuilder = createMockBuilder({ data: [], error: null });
    const recentMatchesBuilder = createMockBuilder({
      data: [{ id: 'm1', match_name: 'Match 1', result: 'won' }],
      error: null,
    });
    const assignedBatchesBuilder = createMockBuilder({ data: [], error: null });
    const activePlayersBuilder = createMockBuilder({
      data: [
        { id: player1Id, profiles: { full_name: 'Player One', email: 'p1@test.com' } },
        { id: player2Id, profiles: { full_name: 'Player Two', email: 'p2@test.com' } },
      ],
      error: null,
    });

    // 2. Batched 3 queries
    const attendanceBatchBuilder = createMockBuilder({
      data: [
        { player_id: player1Id, status: 'present', session: { session_date: '2026-08-01' } },
        { player_id: player2Id, status: 'absent', session: { session_date: '2026-08-01' } },
      ],
      error: null,
    });
    const drillsBatchBuilder = createMockBuilder({
      data: [{ player_id: player2Id, status: 'assigned' }],
      error: null,
    });
    const feedbackBatchBuilder = createMockBuilder({
      data: [{ id: 'note-1', academy_member_id: player1Id }],
      error: null,
    });

    mockedSupabase.from
      .mockReturnValueOnce(todaySessionBuilder as never)
      .mockReturnValueOnce(recentMatchesBuilder as never)
      .mockReturnValueOnce(assignedBatchesBuilder as never)
      .mockReturnValueOnce(activePlayersBuilder as never)
      .mockReturnValueOnce(attendanceBatchBuilder as never)
      .mockReturnValueOnce(drillsBatchBuilder as never)
      .mockReturnValueOnce(feedbackBatchBuilder as never);

    const result = await fetchCoachDashboardAnalytics(academyId, coachId);

    expect(result.wins).toBe(1);
    expect(result.playersNeedingAttention).toHaveLength(1);
    expect(result.playersNeedingAttention[0]!.id).toBe(player2Id);
    expect(result.playersNeedingAttention[0]!.issues).toContain('Low attendance');
    expect(result.playersNeedingAttention[0]!.issues).toContain('Pending drills');
    expect(result.playersNeedingAttention[0]!.issues).toContain('No recent feedback');
  });
});

describe('fetchOwnerDashboardAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes the "last 6 months" attendance query to attendance rows, not all-time history', async () => {
    // `training_sessions!inner` plus filtering by the `session` alias (not the
    // table name) is what actually restricts the parent `attendance` rows to
    // the date window. Without either, PostgREST silently returns every
    // attendance row ever recorded while the code claims a 6-month window —
    // this regression test pins the query shape so that can't come back.
    const academyId = '11111111-1111-1111-1111-111111111111';
    const empty = { data: [], error: null };

    const attendanceBuilder = createMockBuilder({
      data: [{ status: 'present', session: { session_date: '2026-08-01' } }],
      error: null,
    });

    const builders = [
      createMockBuilder(empty), // players
      createMockBuilder(empty), // coaches
      createMockBuilder(empty), // batches
      createMockBuilder(empty), // matches
      attendanceBuilder, // attendance — the one under test
      createMockBuilder(empty), // sessions this week
      createMockBuilder(empty), // recent matches
      createMockBuilder(empty), // upcoming sessions
      createMockBuilder(empty), // activity
      createMockBuilder(empty), // top batters
      createMockBuilder(empty), // top bowlers
      createMockBuilder(empty), // top fielders
      createMockBuilder(empty), // today's sessions
      createMockBuilder(empty), // academy records
    ];

    let call = 0;
    mockedSupabase.from.mockImplementation(() => builders[call++] as never);

    await fetchOwnerDashboardAnalytics(academyId as UUID);

    expect(attendanceBuilder.select).toHaveBeenCalledWith(
      expect.stringContaining('training_sessions!inner'),
    );
    expect(attendanceBuilder.gte).toHaveBeenCalledWith('session.session_date', expect.any(String));
  });
});
