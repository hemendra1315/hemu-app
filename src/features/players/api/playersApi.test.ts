/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createMockQueryBuilder } from '../../../test/supabaseQueryBuilder';

import {
  fetchPlayerProfile,
  fetchPlayerStatistics,
  fetchPlayerMatches,
  fetchPlayerAttendanceSummary,
  fetchPlayerDrillSummary,
  fetchPlayerCareerHighlights,
  fetchPlayerChartData,
} from './playersApi';

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

const academyId = '11111111-1111-1111-1111-111111111111';
const playerId = '22222222-2222-2222-2222-222222222222';
const memberId = '33333333-3333-3333-3333-333333333333';

describe('playersApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPlayerProfile', () => {
    it('scopes by both academy_id and player id (member id)', async () => {
      const mockBuilder = createMockBuilder({
        data: {
          id: memberId,
          academy_id: academyId,
          user_id: 'u-1',
          role: 'player',
          status: 'active',
          joined_at: '2026-01-01T00:00:00Z',
          profiles: {
            full_name: 'Player One',
            email: 'p@test.com',
            avatar_url: null,
            phone: '123',
          },
          batch_members: [
            { batch_id: 'b1', joined_at: '2026-01-01T00:00:00Z', batches: { name: 'U16' } },
          ],
        },
        error: null,
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchPlayerProfile(academyId, memberId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('academy_members');
      expect(mockBuilder.eq).toHaveBeenCalledWith('academy_id', academyId);
      expect(mockBuilder.eq).toHaveBeenCalledWith('id', memberId);
      expect(result.academyId).toBe(academyId);
      expect(result.fullName).toBe('Player One');
    });

    it('throws "Player not found" when row is null', async () => {
      const mockBuilder = createMockBuilder({ data: null, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(fetchPlayerProfile(academyId, memberId)).rejects.toThrow('Player not found');
    });

    it('throws "Player not found" for invalid UUIDs', async () => {
      await expect(fetchPlayerProfile('not-a-uuid', 'also-not')).rejects.toThrow(
        'Player not found',
      );
    });

    it('throws when query returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(fetchPlayerProfile(academyId, memberId)).rejects.toThrow();
    });
  });

  describe('fetchPlayerStatistics', () => {
    it('scopes by both academy_id and player_id using maybeSingle', async () => {
      const mockBuilder = createMockBuilder({
        data: {
          id: 's1',
          academy_id: academyId,
          player_id: playerId,
          matches_played: 10,
          batting_innings: 15,
          batting_runs: 300,
          balls_faced_sum: 250,
          batting_highest_score: 75,
          batting_not_outs: 3,
          batting_fifties: 2,
          batting_centuries: 1,
          batting_fours: 20,
          batting_sixes: 5,
          bowling_innings: 8,
          bowling_overs: 20,
          bowling_maidens: 2,
          bowling_runs_conceded: 80,
          bowling_wickets: 6,
          bowling_best_bowling: '4/20',
          fielding_catches: 3,
          fielding_run_outs: 1,
          fielding_stumpings: 0,
          awards_player_of_match: 2,
          awards_best_batter: 1,
          awards_best_bowler: 0,
          awards_best_fielder: 1,
        },
        error: null,
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchPlayerStatistics(academyId, playerId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('player_statistics');
      expect(mockBuilder.eq).toHaveBeenCalledWith('academy_id', academyId);
      expect(mockBuilder.eq).toHaveBeenCalledWith('player_id', playerId);
      expect(result!.academyId).toBe(academyId);
      expect(result!.battingRuns).toBe(300);
    });

    it('returns null when stats row is null', async () => {
      const mockBuilder = createMockBuilder({ data: null, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchPlayerStatistics(academyId, playerId);
      expect(result).toBeNull();
    });

    it('throws when query returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(fetchPlayerStatistics(academyId, playerId)).rejects.toThrow();
    });
  });

  describe('fetchPlayerMatches', () => {
    it('queries five tables in parallel, all scoped by academy_id', async () => {
      const battingBuilder = createMockBuilder({ data: [], error: null });
      const bowlingBuilder = createMockBuilder({ data: [], error: null });
      const fieldingBuilder = createMockBuilder({ data: [], error: null });
      const awardsBuilder = createMockBuilder({ data: [], error: null });
      const lineupBuilder = createMockBuilder({ data: [], error: null });

      mockedSupabase.from
        .mockReturnValueOnce(battingBuilder)
        .mockReturnValueOnce(bowlingBuilder)
        .mockReturnValueOnce(fieldingBuilder)
        .mockReturnValueOnce(awardsBuilder)
        .mockReturnValueOnce(lineupBuilder);

      const result = await fetchPlayerMatches(academyId, playerId);

      expect(result).toEqual([]);
      expect(mockedSupabase.from).toHaveBeenCalledWith('match_batting');
      expect(mockedSupabase.from).toHaveBeenCalledWith('match_bowling');
      expect(mockedSupabase.from).toHaveBeenCalledWith('match_fielding');
      expect(mockedSupabase.from).toHaveBeenCalledWith('match_awards');
      // The team sheet is what makes a match appear at all: a player who was
      // selected but never batted, bowled or fielded has no row in any of the
      // other four tables, and used to vanish from their own match history.
      expect(mockedSupabase.from).toHaveBeenCalledWith('match_lineups');
    });

    it('lists a match the player was selected for but did not bat in', async () => {
      const emptyBuilder = createMockBuilder({ data: [], error: null });
      const lineupBuilder = createMockBuilder({
        data: [
          {
            match_id: 'm9',
            batting_order: 6,
            matches: {
              id: 'm9',
              match_name: 'Selected But Did Not Bat',
              match_date: '2026-02-02',
              opponent_name: 'Team B',
              tournament: null,
              match_type: 'league',
              format: 't20',
              result: 'won',
              winning_margin: '20 runs',
              status: 'completed',
            },
          },
        ],
        error: null,
      });

      mockedSupabase.from
        .mockReturnValueOnce(emptyBuilder)
        .mockReturnValueOnce(emptyBuilder)
        .mockReturnValueOnce(emptyBuilder)
        .mockReturnValueOnce(emptyBuilder)
        .mockReturnValueOnce(lineupBuilder);

      const result = await fetchPlayerMatches(academyId, playerId);

      expect(result).toHaveLength(1);
      expect(result[0]!.matchName).toBe('Selected But Did Not Bat');
      expect(result[0]!.battingOrder).toBe(6);
      expect(result[0]!.batting).toBeNull();
      expect(result[0]!.bowling).toBeNull();
    });

    it('maps batting rows correctly', async () => {
      const battingBuilder = createMockBuilder({
        data: [
          {
            match_id: 'm1',
            runs: 50,
            balls: 30,
            fours: 4,
            sixes: 2,
            is_out: false,
            dismissal_type: null,
            batting_order: 1,
            matches: {
              id: 'm1',
              match_name: 'Match 1',
              match_date: '2026-01-01',
              opponent_name: 'Team A',
              tournament: null,
              match_type: 'friendly',
              format: 't20',
              result: 'won',
              winning_margin: '5w',
              status: 'completed',
            },
          },
        ],
        error: null,
      });
      const emptyBuilder = createMockBuilder({ data: [], error: null });
      mockedSupabase.from
        .mockReturnValueOnce(battingBuilder)
        .mockReturnValueOnce(emptyBuilder)
        .mockReturnValueOnce(emptyBuilder)
        .mockReturnValueOnce(emptyBuilder)
        .mockReturnValueOnce(emptyBuilder);

      const result = await fetchPlayerMatches(academyId, playerId);

      expect(result).toHaveLength(1);
      expect(result[0]!.batting).toBeDefined();
      expect(result[0]!.batting!.runs).toBe(50);
      expect(result[0]!.matchName).toBe('Match 1');
    });

    it('throws when any of the parallel queries returns an error', async () => {
      const errorBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(errorBuilder);

      await expect(fetchPlayerMatches(academyId, playerId)).rejects.toThrow();
    });
  });

  describe('fetchPlayerAttendanceSummary', () => {
    it('scopes the query by academy_id and player_id', async () => {
      const mockBuilder = createMockBuilder({
        data: [
          { status: 'present', session: { session_date: '2026-01-15' } },
          { status: 'absent', session: { session_date: '2026-01-16' } },
        ],
        error: null,
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchPlayerAttendanceSummary(academyId, playerId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('attendance');
      expect(mockBuilder.eq).toHaveBeenCalledWith('academy_id', academyId);
      expect(mockBuilder.eq).toHaveBeenCalledWith('player_id', playerId);
      expect(result.totalSessions).toBe(2);
      expect(result.attended).toBe(1);
      expect(result.absent).toBe(1);
      expect(result.attendancePercentage).toBe(50);
    });

    it('throws when the query returns an error', async () => {
      const mockBuilder = createMockBuilder({
        data: null,
        error: { message: 'RLS denied', code: '42501' },
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      await expect(fetchPlayerAttendanceSummary(academyId, playerId)).rejects.toThrow();
    });
  });

  describe('fetchPlayerDrillSummary', () => {
    it('scopes by academy_id and player_id', async () => {
      const mockBuilder = createMockBuilder({ data: [], error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchPlayerDrillSummary(academyId, playerId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('drill_assignments');
      expect(mockBuilder.eq).toHaveBeenCalledWith('academy_id', academyId);
      expect(mockBuilder.eq).toHaveBeenCalledWith('player_id', playerId);
      expect(result.assigned).toBe(0);
      expect(result.completed).toBe(0);
    });

    it('does not embed drills with !inner, so an RLS-blocked drill row degrades to null instead of silently deleting the whole assignment', () => {
      // Regression: `drills` is staff-only under RLS. `!inner` would drop an
      // entire assignment row whenever the linked drill isn't readable,
      // which is exactly what made every player's drill list look empty no
      // matter what a coach assigned them. A migration also grants players
      // read access to drills they're assigned, but this query must never
      // regress back to `!inner`.
      const src = readFileSync(resolve('src/features/players/api/playersApi.ts'), 'utf8');
      const summarySection = src.slice(src.indexOf('fetchPlayerDrillSummary'));
      expect(summarySection.slice(0, 400)).not.toContain('drills!inner');
    });

    it('computes completion percentage correctly', async () => {
      const mockBuilder = createMockBuilder({
        data: [
          {
            id: 'd1',
            status: 'assigned',
            assigned_at: '2026-01-01',
            due_date: null,
            drills: { name: 'D1', category: 'batting' },
          },
          {
            id: 'd2',
            status: 'completed',
            assigned_at: '2026-01-02',
            due_date: null,
            drills: { name: 'D2', category: 'bowling' },
          },
          {
            id: 'd3',
            status: 'completed',
            assigned_at: '2026-01-03',
            due_date: null,
            drills: { name: 'D3', category: 'fielding' },
          },
        ],
        error: null,
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchPlayerDrillSummary(academyId, playerId);

      expect(result.assigned).toBe(3);
      expect(result.completed).toBe(2);
      expect(result.pending).toBe(1);
      expect(result.completionPercentage).toBe(67);
    });

    it('does not truncate pendingAssignments/completedAssignments to 10, unlike the recent-activity feed', async () => {
      // Regression: the dashboard used to build its Pending/Completed cards
      // from `recentAssignments` (capped at 10), so a player with more than
      // 10 total assignments saw a dashboard that disagreed with their own
      // profile page's "assigned"/"completion %" stats, which were always
      // computed from the full list.
      const rows = Array.from({ length: 15 }, (_, i) => ({
        id: `a${i}`,
        status: i < 12 ? 'completed' : 'assigned',
        assigned_at: `2026-01-${String(i + 1).padStart(2, '0')}`,
        due_date: null,
        drills: { name: `Drill ${i}`, category: 'batting' },
      }));
      const mockBuilder = createMockBuilder({ data: rows, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchPlayerDrillSummary(academyId, playerId);

      expect(result.recentAssignments).toHaveLength(10);
      expect(result.completedAssignments).toHaveLength(12);
      expect(result.pendingAssignments).toHaveLength(3);
    });
  });

  describe('fetchPlayerCareerHighlights', () => {
    it('returns empty array when no statistics', async () => {
      const mockBuilder = createMockBuilder({ data: null, error: null });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchPlayerCareerHighlights(academyId, playerId);
      expect(result).toEqual([]);
    });

    it('builds highlights from statistics', async () => {
      const mockBuilder = createMockBuilder({
        data: {
          id: 's1',
          academy_id: academyId,
          player_id: playerId,
          matches_played: 10,
          batting_innings: 15,
          batting_runs: 300,
          balls_faced_sum: 250,
          batting_highest_score: 75,
          batting_not_outs: 3,
          batting_fifties: 2,
          batting_centuries: 1,
          batting_fours: 20,
          batting_sixes: 5,
          bowling_innings: 8,
          bowling_overs: 20,
          bowling_maidens: 2,
          bowling_runs_conceded: 80,
          bowling_wickets: 6,
          bowling_best_bowling: '4/20',
          fielding_catches: 3,
          fielding_run_outs: 1,
          fielding_stumpings: 0,
          awards_player_of_match: 2,
          awards_best_batter: 1,
          awards_best_bowler: 0,
          awards_best_fielder: 1,
        },
        error: null,
      });
      mockedSupabase.from.mockReturnValue(mockBuilder as any);

      const result = await fetchPlayerCareerHighlights(academyId, playerId);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'highest_score', value: '75' }),
          expect.objectContaining({ type: 'best_bowling', value: '4/20' }),
          expect.objectContaining({ type: 'total_runs', value: '300' }),
          expect.objectContaining({ type: 'total_wickets', value: '6' }),
          expect.objectContaining({ type: 'total_catches', value: '3' }),
          expect.objectContaining({ type: 'player_of_match', value: '2' }),
        ]),
      );
    });
  });

  describe('fetchPlayerChartData', () => {
    it('scopes queries correctly for both matches and attendance', async () => {
      const sessionBuilder = createMockBuilder({ data: [], error: null });
      mockedSupabase.from
        .mockReturnValueOnce(sessionBuilder)
        .mockReturnValueOnce(sessionBuilder)
        .mockReturnValueOnce(sessionBuilder)
        .mockReturnValueOnce(sessionBuilder)
        .mockReturnValueOnce(sessionBuilder)
        .mockReturnValueOnce(sessionBuilder);

      const result = await fetchPlayerChartData(academyId, playerId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('match_batting');
      expect(mockedSupabase.from).toHaveBeenCalledWith('match_bowling');
      expect(mockedSupabase.from).toHaveBeenCalledWith('match_fielding');
      expect(mockedSupabase.from).toHaveBeenCalledWith('match_awards');
      expect(mockedSupabase.from).toHaveBeenCalledWith('attendance');
      expect(result.runsByMatch).toEqual([]);
      expect(result.wicketsByMatch).toEqual([]);
    });

    it('computes strike rate correctly', async () => {
      const battingBuilder = createMockBuilder({
        data: [
          {
            match_id: 'm1',
            runs: 100,
            balls: 50,
            fours: 5,
            sixes: 3,
            is_out: true,
            dismissal_type: 'bowled',
            batting_order: 3,
            matches: {
              id: 'm1',
              match_name: 'Match 1',
              match_date: '2026-01-01',
              opponent_name: 'Team A',
              tournament: null,
              match_type: 'friendly',
              format: 't20',
              result: 'won',
              winning_margin: '5w',
              status: 'completed',
            },
          },
        ],
        error: null,
      });
      const emptyBuilder = createMockBuilder({ data: [], error: null });
      const attendanceBuilder = createMockBuilder({ data: [], error: null });

      mockedSupabase.from
        .mockReturnValueOnce(battingBuilder)
        .mockReturnValueOnce(emptyBuilder)
        .mockReturnValueOnce(emptyBuilder)
        .mockReturnValueOnce(emptyBuilder)
        .mockReturnValueOnce(emptyBuilder)
        .mockReturnValueOnce(attendanceBuilder);

      const result = await fetchPlayerChartData(academyId, playerId);

      expect(result.strikeRateTrend).toHaveLength(1);
      expect(result.strikeRateTrend[0]!.strikeRate).toBe(200);
    });
  });
});
