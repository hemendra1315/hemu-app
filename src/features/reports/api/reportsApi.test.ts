import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockQueryBuilder } from '../../../test/supabaseQueryBuilder';
import type { UUID } from '@/types';
import { fetchBatchReport } from './reportsApi';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase/client';
const mockedSupabase = vi.mocked(supabase);

const ACADEMY_ID = '11111111-1111-1111-1111-111111111111' as UUID;
const BATCH_ID = '22222222-2222-2222-2222-222222222222' as UUID;
const PLAYER_1 = '33333333-3333-3333-3333-333333333333' as UUID;
const PLAYER_2 = '44444444-4444-4444-4444-444444444444' as UUID;

describe('fetchBatchReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('joins the roster, in-range attendance and career stats into one player table', async () => {
    // 1. fetchBatchPlayers (batch_members select)
    const batchPlayersBuilder = createMockQueryBuilder({
      data: [
        {
          id: 'bm-1',
          batch_id: BATCH_ID,
          academy_member_id: PLAYER_1,
          joined_at: '2026-01-01',
          academy_members: {
            id: PLAYER_1,
            role: 'player',
            status: 'active',
            profiles: { full_name: 'Player One', email: 'p1@test.com', avatar_url: null },
          },
        },
        {
          id: 'bm-2',
          batch_id: BATCH_ID,
          academy_member_id: PLAYER_2,
          joined_at: '2026-01-02',
          academy_members: {
            id: PLAYER_2,
            role: 'player',
            status: 'active',
            profiles: { full_name: 'Player Two', email: 'p2@test.com', avatar_url: null },
          },
        },
      ],
      error: null,
    });

    // 2. fetchAttendanceMarks (attendance select) -- includes a mark for a
    // player outside this batch, which fetchBatchReport must filter out.
    const attendanceBuilder = createMockQueryBuilder({
      data: [
        {
          player_id: PLAYER_1,
          status: 'present',
          training_sessions: { id: 's1', session_date: '2026-08-01', batch_id: BATCH_ID },
        },
        {
          player_id: PLAYER_1,
          status: 'absent',
          training_sessions: { id: 's2', session_date: '2026-08-08', batch_id: BATCH_ID },
        },
        {
          player_id: '55555555-5555-5555-5555-555555555555',
          status: 'present',
          training_sessions: { id: 's3', session_date: '2026-08-01', batch_id: 'other-batch' },
        },
      ],
      error: null,
    });

    // 3. raw player_statistics select
    const statsBuilder = createMockQueryBuilder({
      data: [
        {
          player_id: PLAYER_1,
          matches_played: 5,
          batting_runs: 120,
          bowling_wickets: 3,
          fielding_catches: 2,
        },
      ],
      error: null,
    });

    mockedSupabase.from
      .mockReturnValueOnce(batchPlayersBuilder as never)
      .mockReturnValueOnce(attendanceBuilder as never)
      .mockReturnValueOnce(statsBuilder as never);

    const report = await fetchBatchReport(
      ACADEMY_ID,
      BATCH_ID,
      'Morning Batch',
      '2026-08-01',
      '2026-08-31',
    );

    expect(report.scope).toBe('batch');
    expect(report.players).toHaveLength(2);

    const playerOne = report.players.find((p) => p.playerId === PLAYER_1);
    expect(playerOne?.attendanceRate).toBe(50);
    expect(playerOne?.matchesPlayed).toBe(5);
    expect(playerOne?.battingRuns).toBe(120);

    // Never attended in range and has no career stats row -- should show as
    // zeros/null, not throw or get dropped from the roster.
    const playerTwo = report.players.find((p) => p.playerId === PLAYER_2);
    expect(playerTwo?.attendanceRate).toBeNull();
    expect(playerTwo?.matchesPlayed).toBe(0);
  });

  it('returns an empty roster without querying stats when the batch has no players', async () => {
    const batchPlayersBuilder = createMockQueryBuilder({ data: [], error: null });
    const attendanceBuilder = createMockQueryBuilder({ data: [], error: null });

    mockedSupabase.from
      .mockReturnValueOnce(batchPlayersBuilder as never)
      .mockReturnValueOnce(attendanceBuilder as never);

    const report = await fetchBatchReport(
      ACADEMY_ID,
      BATCH_ID,
      'Empty Batch',
      '2026-08-01',
      '2026-08-31',
    );

    expect(report.players).toEqual([]);
    expect(mockedSupabase.from).toHaveBeenCalledTimes(2);
  });
});
