import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UUID } from '@/types';
import {
  createMatch,
  deleteMatch,
  fetchAcademyMatches,
  fetchAcademyRecords,
  fetchMatch,
  fetchMatchAwards,
  fetchMatchBatting,
  fetchMatchBowling,
  fetchMatchCoachNotes,
  fetchMatchFielding,
  fetchMatchLineups,
  fetchMatchPartnerships,
  fetchPlayerMilestones,
  fetchPlayerStatistics,
  fetchPlayerStatisticsById,
  saveMatchResult,
  updateMatch,
} from './matchesApi';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase/client';
const mockedSupabase = vi.mocked(supabase);

function createMockBuilder(response: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then: (onfulfilled?: (val: unknown) => unknown, onrejected?: (reason: unknown) => unknown) =>
      Promise.resolve(response).then(onfulfilled, onrejected),
  };
  return builder;
}

describe('matchesApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAcademyMatches', () => {
    it('scopes query to the given academyId and orders by match_date descending', async () => {
      const academyId = '11111111-1111-1111-1111-111111111111' as UUID;
      const mockMatches = [
        {
          id: 'm-1',
          academy_id: academyId,
          match_name: 'Summer Derby',
          match_date: '2026-08-10',
          venue: 'Ground A',
          opponent_name: 'Warriors',
          tournament: 'Cup',
          match_type: 'tournament',
          format: 't20',
          overs: 20,
          team_score: '150/4',
          wickets_lost: 4,
          overs_played: 20,
          result: 'won',
          winning_margin: '10 runs',
          batch_id: 'b-1',
          status: 'completed',
          created_by: 'u-1',
          created_at: '2026-08-10T00:00:00Z',
          updated_at: '2026-08-10T00:00:00Z',
        },
      ];

      const builder = createMockBuilder({ data: mockMatches, error: null });
      mockedSupabase.from.mockReturnValue(builder as never);

      const matches = await fetchAcademyMatches(academyId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('matches');
      expect(builder.eq).toHaveBeenCalledWith('academy_id', academyId);
      expect(builder.order).toHaveBeenCalledWith('match_date', { ascending: false });
      expect(matches).toHaveLength(1);
      expect(matches[0]!.id).toBe('m-1');
      expect(matches[0]!.academyId).toBe(academyId);
      expect(matches[0]!.matchName).toBe('Summer Derby');
    });
  });

  describe('fetchMatch', () => {
    it('fetches a single match by id', async () => {
      const matchId = 'm-123' as UUID;
      const mockMatch = {
        id: matchId,
        academy_id: 'acad-1',
        match_name: 'Friendly',
        match_date: '2026-08-12',
        match_type: 'practice',
        format: 't20',
        result: 'pending',
      };

      const builder = createMockBuilder({ data: mockMatch, error: null });
      mockedSupabase.from.mockReturnValue(builder as never);

      const match = await fetchMatch(matchId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('matches');
      expect(builder.eq).toHaveBeenCalledWith('id', matchId);
      expect(match.id).toBe(matchId);
      expect(match.matchName).toBe('Friendly');
    });
  });

  describe('createMatch', () => {
    it('creates a match with correct payload structure and returns transformed match', async () => {
      const input = {
        academyId: 'acad-1' as UUID,
        matchName: 'Final Match',
        matchDate: '2026-08-15',
        venue: 'Stadium',
        opponentName: 'Rivals',
        tournament: 'State Cup',
        matchType: 'tournament' as const,
        format: 't20' as const,
        overs: 20,
        batchId: 'batch-1' as UUID,
      };

      const mockCreated = {
        id: 'm-new',
        academy_id: input.academyId,
        match_name: input.matchName,
        match_date: input.matchDate,
        venue: input.venue,
        opponent_name: input.opponentName,
        tournament: input.tournament,
        match_type: input.matchType,
        format: input.format,
        overs: input.overs,
        batch_id: input.batchId,
        status: 'created',
      };

      const builder = createMockBuilder({ data: mockCreated, error: null });
      mockedSupabase.from.mockReturnValue(builder as never);

      const result = await createMatch(input);

      expect(mockedSupabase.from).toHaveBeenCalledWith('matches');
      expect(builder.insert).toHaveBeenCalledWith({
        academy_id: input.academyId,
        match_name: input.matchName,
        match_date: input.matchDate,
        venue: input.venue,
        opponent_name: input.opponentName,
        tournament: input.tournament,
        match_type: input.matchType,
        format: input.format,
        overs: input.overs,
        batch_id: input.batchId,
        status: 'created',
      });
      expect(result.id).toBe('m-new');
      expect(result.status).toBe('created');
    });
  });

  describe('updateMatch', () => {
    it('updates existing match with given fields', async () => {
      const matchId = 'm-up' as UUID;
      const input = {
        matchName: 'Updated Final',
        matchDate: '2026-08-16',
        matchType: 'tournament' as const,
        format: 'odi' as const,
        overs: 50,
      };

      const mockUpdated = {
        id: matchId,
        match_name: input.matchName,
        match_date: input.matchDate,
        match_type: input.matchType,
        format: input.format,
        overs: 50,
      };

      const builder = createMockBuilder({ data: mockUpdated, error: null });
      mockedSupabase.from.mockReturnValue(builder as never);

      const result = await updateMatch(matchId, input);

      expect(mockedSupabase.from).toHaveBeenCalledWith('matches');
      expect(builder.update).toHaveBeenCalledWith({
        match_name: input.matchName,
        match_date: input.matchDate,
        venue: null,
        opponent_name: null,
        tournament: null,
        match_type: input.matchType,
        format: input.format,
        overs: input.overs,
        batch_id: null,
      });
      expect(builder.eq).toHaveBeenCalledWith('id', matchId);
      expect(result.matchName).toBe('Updated Final');
    });
  });

  describe('deleteMatch', () => {
    it('calls delete on matches table with match id', async () => {
      const matchId = 'm-del' as UUID;
      const builder = createMockBuilder({ data: null, error: null });
      mockedSupabase.from.mockReturnValue(builder as never);

      await deleteMatch(matchId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('matches');
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', matchId);
    });
  });

  describe('fetchMatchLineups, fetchMatchBatting, fetchMatchBowling, fetchMatchFielding', () => {
    it('fetches lineups, batting, bowling, and fielding records', async () => {
      const matchId = 'm-1' as UUID;

      const lineupBuilder = createMockBuilder({
        data: [
          {
            id: 'l-1',
            match_id: matchId,
            academy_member_id: 'mem-1',
            batting_order: 1,
            is_captain: true,
            is_vice_captain: false,
            is_wicketkeeper: false,
            academy_members: { profiles: { full_name: 'Player 1' } },
          },
        ],
        error: null,
      });
      const battingBuilder = createMockBuilder({
        data: [
          {
            id: 'bat-1',
            match_id: matchId,
            academy_member_id: 'mem-1',
            runs: 50,
            balls: 30,
            fours: 4,
            sixes: 2,
            is_out: false,
            academy_members: { profiles: { full_name: 'Player 1' } },
          },
        ],
        error: null,
      });
      const bowlingBuilder = createMockBuilder({
        data: [
          {
            id: 'bowl-1',
            match_id: matchId,
            academy_member_id: 'mem-2',
            overs: 4.0,
            maidens: 1,
            runs_conceded: 20,
            wickets: 3,
            wides: 0,
            no_balls: 0,
            academy_members: { profiles: { full_name: 'Player 2' } },
          },
        ],
        error: null,
      });
      const fieldingBuilder = createMockBuilder({
        data: [
          {
            id: 'f-1',
            match_id: matchId,
            academy_member_id: 'mem-1',
            catches: 2,
            run_outs: 1,
            stumpings: 0,
            academy_members: { profiles: { full_name: 'Player 1' } },
          },
        ],
        error: null,
      });

      mockedSupabase.from
        .mockReturnValueOnce(lineupBuilder as never)
        .mockReturnValueOnce(battingBuilder as never)
        .mockReturnValueOnce(bowlingBuilder as never)
        .mockReturnValueOnce(fieldingBuilder as never);

      const lineups = await fetchMatchLineups(matchId);
      const batting = await fetchMatchBatting(matchId);
      const bowling = await fetchMatchBowling(matchId);
      const fielding = await fetchMatchFielding(matchId);

      expect(lineups).toHaveLength(1);
      expect(lineups[0]!.isCaptain).toBe(true);
      expect(batting).toHaveLength(1);
      expect(batting[0]!.runs).toBe(50);
      expect(bowling).toHaveLength(1);
      expect(bowling[0]!.wickets).toBe(3);
      expect(fielding).toHaveLength(1);
      expect(fielding[0]!.catches).toBe(2);
    });
  });

  describe('fetchMatchPartnerships, fetchMatchAwards, fetchMatchCoachNotes', () => {
    it('fetches partnerships, awards, and coach notes', async () => {
      const matchId = 'm-1' as UUID;

      const partnershipsBuilder = createMockBuilder({
        data: [
          {
            id: 'p-1',
            match_id: matchId,
            wicket_number: 1,
            runs_added: 65,
            batter_1: { id: 'b1', profiles: { full_name: 'Player 1' } },
            batter_2: { id: 'b2', profiles: { full_name: 'Player 2' } },
          },
        ],
        error: null,
      });
      const awardsBuilder = createMockBuilder({
        data: {
          id: 'a-1',
          match_id: matchId,
          player_of_match_id: 'mem-1',
          player_of_match: { id: 'mem-1', profiles: { full_name: 'Player 1' } },
        },
        error: null,
      });
      const notesBuilder = createMockBuilder({
        data: [
          {
            id: 'cn-1',
            match_id: matchId,
            academy_member_id: 'mem-1',
            coach_id: 'coach-1',
            notes: 'Good execution',
            coach: { id: 'coach-1', profiles: { full_name: 'Coach 1' } },
          },
        ],
        error: null,
      });

      mockedSupabase.from
        .mockReturnValueOnce(partnershipsBuilder as never)
        .mockReturnValueOnce(awardsBuilder as never)
        .mockReturnValueOnce(notesBuilder as never);

      const partnerships = await fetchMatchPartnerships(matchId);
      const awards = await fetchMatchAwards(matchId);
      const notes = await fetchMatchCoachNotes(matchId);

      expect(partnerships).toHaveLength(1);
      expect(partnerships[0]!.runsAdded).toBe(65);
      expect(awards?.playerOfMatch?.fullName).toBe('Player 1');
      expect(notes).toHaveLength(1);
      expect(notes[0]!.notes).toBe('Good execution');
    });
  });

  describe('Player statistics, milestones, and academy records', () => {
    it('fetches player statistics array and player statistics by id', async () => {
      const academyId = 'acad-1' as UUID;
      const playerId = 'mem-1' as UUID;

      const listBuilder = createMockBuilder({
        data: [
          {
            id: 'stats-1',
            academy_id: academyId,
            player_id: playerId,
            matches_played: 10,
            batting_runs: 350,
            bowling_wickets: 12,
            players: { id: playerId, profiles: { full_name: 'All Rounder', email: 'ar@test.com' } },
          },
        ],
        error: null,
      });
      const singleBuilder = createMockBuilder({
        data: {
          id: 'stats-1',
          academy_id: academyId,
          player_id: playerId,
          matches_played: 10,
          batting_runs: 350,
          bowling_wickets: 12,
          players: { id: playerId, profiles: { full_name: 'All Rounder', email: 'ar@test.com' } },
        },
        error: null,
      });

      mockedSupabase.from
        .mockReturnValueOnce(listBuilder as never)
        .mockReturnValueOnce(singleBuilder as never);

      const statsList = await fetchPlayerStatistics(academyId);
      const singleStats = await fetchPlayerStatisticsById(academyId, playerId);

      expect(statsList).toHaveLength(1);
      expect(statsList[0]!.battingRuns).toBe(350);
      expect(singleStats?.bowlingWickets).toBe(12);
    });

    it('fetches player milestones', async () => {
      const academyId = 'acad-1' as UUID;
      const builder = createMockBuilder({
        data: [
          {
            id: 'mile-1',
            academy_id: academyId,
            player_id: 'mem-1',
            milestone_type: 'fifty',
            match_id: 'm-1',
            achieved_at: '2026-08-01',
            players: { id: 'mem-1', profiles: { full_name: 'Batter 1' } },
          },
        ],
        error: null,
      });
      mockedSupabase.from.mockReturnValue(builder as never);

      const milestones = await fetchPlayerMilestones(academyId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('player_milestones');
      expect(milestones).toHaveLength(1);
      expect(milestones[0]!.milestoneType).toBe('fifty');
    });

    it('fetches academy records', async () => {
      const academyId = 'acad-1' as UUID;
      const builder = createMockBuilder({
        data: [
          {
            id: 'rec-1',
            academy_id: academyId,
            record_type: 'highest_individual_score',
            player_id: 'mem-1',
            match_id: 'm-1',
            value_numeric: 124,
            value_text: '124* vs Rival XI',
            achieved_at: '2026-08-05',
            players: { id: 'mem-1', profiles: { full_name: 'Record Holder' } },
          },
        ],
        error: null,
      });
      mockedSupabase.from.mockReturnValue(builder as never);

      const records = await fetchAcademyRecords(academyId);

      expect(mockedSupabase.from).toHaveBeenCalledWith('academy_records');
      expect(records).toHaveLength(1);
      expect(records[0]!.valueNumeric).toBe(124);
    });
  });

  describe('saveMatchResult', () => {
    it('calls save_match_result RPC with formatted snake_case payload', async () => {
      const academyId = 'acad-1' as UUID;
      const payload = {
        match: {
          matchName: 'Championship',
          matchDate: '2026-08-15',
          matchType: 'tournament' as const,
          format: 't20' as const,
          overs: 20,
          teamScore: '180/4',
          result: 'won' as const,
        },
        lineups: [
          {
            academyMemberId: 'mem-1' as UUID,
            battingOrder: 1,
            isCaptain: true,
            isViceCaptain: false,
            isWicketkeeper: false,
            isGuest: false,
          },
        ],
        batting: [
          {
            academyMemberId: 'mem-1' as UUID,
            runs: 75,
            balls: 45,
            fours: 8,
            sixes: 3,
            isOut: true,
            battingOrder: 1,
            isGuest: false,
          },
        ],
        bowling: [
          {
            academyMemberId: 'mem-2' as UUID,
            overs: 4.0,
            maidens: 1,
            runsConceded: 22,
            wickets: 3,
            wides: 1,
            noBalls: 0,
            isGuest: false,
          },
        ],
        fielding: [
          {
            academyMemberId: 'mem-1' as UUID,
            catches: 2,
            runOuts: 0,
            stumpings: 0,
          },
        ],
      };

      mockedSupabase.rpc.mockResolvedValue({
        data: { match_id: 'm-saved', status: 'saved' },
        error: null,
      } as never);

      const result = await saveMatchResult(academyId, payload);

      expect(mockedSupabase.rpc).toHaveBeenCalledWith('save_match_result', {
        p_payload: expect.objectContaining({
          academy_id: academyId,
          match: expect.objectContaining({ match_name: 'Championship' }),
        }),
      });
      expect(result).toEqual({ matchId: 'm-saved', status: 'saved' });
    });
  });
});
