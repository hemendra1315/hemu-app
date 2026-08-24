/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrap, unwrapVoid } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { UUID } from '@/types';
import type {
  AcademyRecord,
  CreateMatchInput,
  Match,
  MatchAwards,
  MatchBatting,
  MatchBowling,
  MatchCoachNote,
  MatchFielding,
  MatchLineup,
  MatchPartnership,
  PlayerMilestone,
  PlayerStatistics,
  SaveMatchResultPayload,
  UpdateMatchInput,
} from './matchesTypes';

const MATCH_COLUMNS = `
  id, academy_id, match_name, match_date, venue, opponent_name, tournament,
  match_type, format, overs, team_score, wickets_lost, overs_played,
  result, winning_margin, batch_id, status, created_by, created_at, updated_at
`;

function toMatch(row: any): Match {
  return {
    id: row.id,
    academyId: row.academy_id,
    matchName: row.match_name,
    matchDate: row.match_date,
    venue: row.venue,
    opponentName: row.opponent_name,
    tournament: row.tournament,
    matchType: row.match_type,
    format: row.format,
    overs: row.overs,
    teamScore: row.team_score,
    wicketsLost: row.wickets_lost,
    oversPlayed: row.overs_played,
    result: row.result,
    winningMargin: row.winning_margin,
    batchId: row.batch_id,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMatchLineup(row: any): MatchLineup {
  return {
    id: row.id,
    matchId: row.match_id,
    academyMemberId: row.academy_member_id,
    battingOrder: row.batting_order,
    isCaptain: row.is_captain,
    isViceCaptain: row.is_vice_captain,
    isWicketkeeper: row.is_wicketkeeper,
    isGuest: row.is_guest ?? false,
    guestName: row.guest_name ?? null,
    player: row.academy_members?.profiles
      ? {
          id: row.academy_members.id,
          fullName: row.academy_members.profiles.full_name,
          email: row.academy_members.profiles.email,
          avatarUrl: row.academy_members.profiles.avatar_url,
        }
      : {
          id: '',
          fullName: row.guest_name ? `${row.guest_name} (Guest)` : null,
          email: '',
          avatarUrl: null,
        },
  };
}

function toMatchBatting(row: any): MatchBatting {
  return {
    id: row.id,
    matchId: row.match_id,
    academyMemberId: row.academy_member_id,
    runs: row.runs,
    balls: row.balls,
    fours: row.fours,
    sixes: row.sixes,
    isOut: row.is_out,
    dismissalType: row.dismissal_type,
    battingOrder: row.batting_order,
    isGuest: row.is_guest ?? false,
    guestName: row.guest_name ?? null,
    player: row.academy_members?.profiles
      ? {
          id: row.academy_members.id,
          fullName: row.academy_members.profiles.full_name,
          email: row.academy_members.profiles.email,
          avatarUrl: row.academy_members.profiles.avatar_url,
        }
      : {
          id: '',
          fullName: row.guest_name ? `${row.guest_name} (Guest)` : null,
          email: '',
          avatarUrl: null,
        },
  };
}

function toMatchBowling(row: any): MatchBowling {
  return {
    id: row.id,
    matchId: row.match_id,
    academyMemberId: row.academy_member_id,
    overs: row.overs,
    maidens: row.maidens,
    runsConceded: row.runs_conceded,
    wickets: row.wickets,
    wides: row.wides,
    noBalls: row.no_balls,
    isGuest: row.is_guest ?? false,
    guestName: row.guest_name ?? null,
    player: row.academy_members?.profiles
      ? {
          id: row.academy_members.id,
          fullName: row.academy_members.profiles.full_name,
          email: row.academy_members.profiles.email,
          avatarUrl: row.academy_members.profiles.avatar_url,
        }
      : {
          id: '',
          fullName: row.guest_name ? `${row.guest_name} (Guest)` : null,
          email: '',
          avatarUrl: null,
        },
  };
}

function toMatchFielding(row: any): MatchFielding {
  return {
    id: row.id,
    matchId: row.match_id,
    academyMemberId: row.academy_member_id,
    catches: row.catches,
    runOuts: row.run_outs,
    stumpings: row.stumpings,
    isGuest: row.is_guest ?? false,
    guestName: row.guest_name ?? null,
    player: row.academy_members?.profiles
      ? {
          id: row.academy_members.id,
          fullName: row.academy_members.profiles.full_name,
          email: row.academy_members.profiles.email,
          avatarUrl: row.academy_members.profiles.avatar_url,
        }
      : {
          id: '',
          fullName: row.guest_name ? `${row.guest_name} (Guest)` : null,
          email: '',
          avatarUrl: null,
        },
  };
}

function toMatchPartnership(row: any): MatchPartnership {
  return {
    id: row.id,
    matchId: row.match_id,
    batter1Id: row.batter_1_id,
    batter2Id: row.batter_2_id,
    runsAdded: row.runs_added,
    wicketNumber: row.wicket_number,
    batter1: row.batter_1?.profiles
      ? {
          id: row.batter_1.id,
          fullName: row.batter_1.profiles.full_name,
          email: row.batter_1.profiles.email,
          avatarUrl: row.batter_1.profiles.avatar_url,
        }
      : { id: '', fullName: null, email: '', avatarUrl: null },
    batter2: row.batter_2?.profiles
      ? {
          id: row.batter_2.id,
          fullName: row.batter_2.profiles.full_name,
          email: row.batter_2.profiles.email,
          avatarUrl: row.batter_2.profiles.avatar_url,
        }
      : { id: '', fullName: null, email: '', avatarUrl: null },
  };
}

function toMatchAwards(row: any): MatchAwards {
  return {
    id: row.id,
    matchId: row.match_id,
    playerOfMatchId: row.player_of_match_id,
    bestBatterId: row.best_batter_id,
    bestBowlerId: row.best_bowler_id,
    bestFielderId: row.best_fielder_id,
    playerOfMatch: row.player_of_match?.profiles
      ? {
          id: row.player_of_match.id,
          fullName: row.player_of_match.profiles.full_name,
          email: row.player_of_match.profiles.email,
          avatarUrl: row.player_of_match.profiles.avatar_url,
        }
      : null,
    bestBatter: row.best_batter?.profiles
      ? {
          id: row.best_batter.id,
          fullName: row.best_batter.profiles.full_name,
          email: row.best_batter.profiles.email,
          avatarUrl: row.best_batter.profiles.avatar_url,
        }
      : null,
    bestBowler: row.best_bowler?.profiles
      ? {
          id: row.best_bowler.id,
          fullName: row.best_bowler.profiles.full_name,
          email: row.best_bowler.profiles.email,
          avatarUrl: row.best_bowler.profiles.avatar_url,
        }
      : null,
    bestFielder: row.best_fielder?.profiles
      ? {
          id: row.best_fielder.id,
          fullName: row.best_fielder.profiles.full_name,
          email: row.best_fielder.profiles.email,
          avatarUrl: row.best_fielder.profiles.avatar_url,
        }
      : null,
  };
}

function toMatchCoachNote(row: any): MatchCoachNote {
  return {
    id: row.id,
    matchId: row.match_id,
    academyMemberId: row.academy_member_id,
    coachId: row.coach_id,
    notes: row.notes,
    coach: row.coach?.profiles
      ? {
          id: row.coach.id,
          fullName: row.coach.profiles.full_name,
          email: row.coach.profiles.email,
          avatarUrl: row.coach.profiles.avatar_url,
        }
      : null,
  };
}

function toPlayerStatistics(row: any): PlayerStatistics {
  return {
    id: row.id,
    academyId: row.academy_id,
    playerId: row.player_id,
    matchesPlayed: row.matches_played,
    battingInnings: row.batting_innings,
    battingRuns: row.batting_runs,
    battingHighestScore: row.batting_highest_score,
    battingNotOuts: row.batting_not_outs,
    battingFifties: row.batting_fifties,
    battingCenturies: row.batting_centuries,
    battingFours: row.batting_fours,
    battingSixes: row.batting_sixes,
    bowlingInnings: row.bowling_innings,
    bowlingOvers: row.bowling_overs,
    bowlingMaidens: row.bowling_maidens,
    bowlingRunsConceded: row.bowling_runs_conceded,
    bowlingWickets: row.bowling_wickets,
    bowlingBestBowling: row.bowling_best_bowling,
    fieldingCatches: row.fielding_catches,
    fieldingRunOuts: row.fielding_run_outs,
    fieldingStumpings: row.fielding_stumpings,
    awardsPlayerOfMatch: row.awards_player_of_match,
    awardsBestBatter: row.awards_best_batter,
    awardsBestBowler: row.awards_best_bowler,
    awardsBestFielder: row.awards_best_fielder,
    player: row.players
      ? {
          id: row.players.id,
          fullName: row.players.profiles?.full_name,
          email: row.players.profiles?.email ?? '',
          avatarUrl: row.players.profiles?.avatar_url,
        }
      : { id: '', fullName: null, email: '', avatarUrl: null },
  };
}

function toPlayerMilestone(row: any): PlayerMilestone {
  return {
    id: row.id,
    academyId: row.academy_id,
    playerId: row.player_id,
    milestoneType: row.milestone_type,
    matchId: row.match_id,
    achievedAt: row.achieved_at,
    player: row.players?.profiles
      ? {
          id: row.players.id,
          fullName: row.players.profiles.full_name,
          email: row.players.profiles.email,
          avatarUrl: row.players.profiles.avatar_url,
        }
      : { id: '', fullName: null, email: '', avatarUrl: null },
  };
}

function toAcademyRecord(row: any): AcademyRecord {
  return {
    id: row.id,
    academyId: row.academy_id,
    recordType: row.record_type,
    playerId: row.player_id,
    matchId: row.match_id,
    valueNumeric: row.value_numeric,
    valueText: row.value_text,
    achievedAt: row.achieved_at,
    player: row.players?.profiles
      ? {
          id: row.players.id,
          fullName: row.players.profiles.full_name,
          email: row.players.profiles.email,
          avatarUrl: row.players.profiles.avatar_url,
        }
      : null,
  };
}

// ============================================================
// MATCH CRUD
// ============================================================

export async function fetchAcademyMatches(academyId: UUID): Promise<Match[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('matches')
      .select(MATCH_COLUMNS)
      .eq('academy_id', academyId)
      .order('match_date', { ascending: false }),
  );

  return rows.map(toMatch);
}

export async function fetchMatch(matchId: UUID): Promise<Match> {
  const row = await unwrap<any>(
    (supabase as any).from('matches').select(MATCH_COLUMNS).eq('id', matchId).single(),
  );
  return toMatch(row);
}

export async function createMatch(input: CreateMatchInput): Promise<Match> {
  const row = await unwrap<any>(
    (supabase as any)
      .from('matches')
      .insert({
        academy_id: input.academyId,
        match_name: input.matchName,
        match_date: input.matchDate,
        venue: input.venue ?? null,
        opponent_name: input.opponentName ?? null,
        tournament: input.tournament ?? null,
        match_type: input.matchType,
        format: input.format,
        overs: input.overs ?? null,
        batch_id: input.batchId ?? null,
        status: 'created',
      })
      .select(MATCH_COLUMNS)
      .single(),
  );
  return toMatch(row);
}

export async function updateMatch(matchId: UUID, input: UpdateMatchInput): Promise<Match> {
  const row = await unwrap<any>(
    (supabase as any)
      .from('matches')
      .update({
        match_name: input.matchName,
        match_date: input.matchDate,
        venue: input.venue ?? null,
        opponent_name: input.opponentName ?? null,
        tournament: input.tournament ?? null,
        match_type: input.matchType,
        format: input.format,
        overs: input.overs ?? null,
        batch_id: input.batchId ?? null,
      })
      .eq('id', matchId)
      .select(MATCH_COLUMNS)
      .single(),
  );
  return toMatch(row);
}

export async function deleteMatch(matchId: UUID): Promise<void> {
  await unwrapVoid((supabase as any).from('matches').delete().eq('id', matchId));
}

// ============================================================
// MATCH LINEUPS
// ============================================================

export async function fetchMatchLineups(matchId: UUID): Promise<MatchLineup[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('match_lineups')
      .select(
        `
        id, match_id, academy_member_id, batting_order, is_captain, is_vice_captain, is_wicketkeeper, is_guest, guest_name,
        academy_members(
          id,
          profiles!academy_members_user_id_fkey(full_name, email, avatar_url)
        )
      `,
      )
      .eq('match_id', matchId)
      .order('batting_order', { ascending: true, nullsFirst: true }),
  );

  return rows.map(toMatchLineup);
}

// ============================================================
// MATCH BATTING
// ============================================================

export async function fetchMatchBatting(matchId: UUID): Promise<MatchBatting[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('match_batting')
      .select(
        `
        id, match_id, academy_member_id, runs, balls, fours, sixes, is_out, dismissal_type, batting_order, is_guest, guest_name,
        academy_members(
          id,
          profiles!academy_members_user_id_fkey(full_name, email, avatar_url)
        )
      `,
      )
      .eq('match_id', matchId)
      .order('batting_order', { ascending: true, nullsFirst: true }),
  );

  return rows.map(toMatchBatting);
}

// ============================================================
// MATCH BOWLING
// ============================================================

export async function fetchMatchBowling(matchId: UUID): Promise<MatchBowling[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('match_bowling')
      .select(
        `
        id, match_id, academy_member_id, overs, maidens, runs_conceded, wickets, wides, no_balls, is_guest, guest_name,
        academy_members(
          id,
          profiles!academy_members_user_id_fkey(full_name, email, avatar_url)
        )
      `,
      )
      .eq('match_id', matchId)
      .order('wickets', { ascending: false }),
  );

  return rows.map(toMatchBowling);
}

// ============================================================
// MATCH FIELDING
// ============================================================

export async function fetchMatchFielding(matchId: UUID): Promise<MatchFielding[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('match_fielding')
      .select(
        `
        id, match_id, academy_member_id, catches, run_outs, stumpings, is_guest, guest_name,
        academy_members(
          id,
          profiles!academy_members_user_id_fkey(full_name, email, avatar_url)
        )
      `,
      )
      .eq('match_id', matchId)
      .order('catches', { ascending: false }),
  );

  return rows.map(toMatchFielding);
}

// ============================================================
// MATCH PARTNERSHIPS
// ============================================================

export async function fetchMatchPartnerships(matchId: UUID): Promise<MatchPartnership[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('match_partnerships')
      .select(
        `
        id, match_id, batter_1_id, batter_2_id, runs_added, wicket_number,
        batter_1:academy_members!match_partnerships_batter_1_id_fkey(
          id,
          profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)
        ),
        batter_2:academy_members!match_partnerships_batter_2_id_fkey(
          id,
          profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)
        )
      `,
      )
      .eq('match_id', matchId)
      .order('runs_added', { ascending: false }),
  );

  return rows.map(toMatchPartnership);
}

// ============================================================
// MATCH AWARDS
// ============================================================

export async function fetchMatchAwards(matchId: UUID): Promise<MatchAwards | null> {
  const row = await unwrap<any>(
    (supabase as any)
      .from('match_awards')
      .select(
        `
        id, match_id, player_of_match_id, best_batter_id, best_bowler_id, best_fielder_id,
        player_of_match:player_of_match_id(
          id,
          profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)
        ),
        best_batter:best_batter_id(
          id,
          profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)
        ),
        best_bowler:best_bowler_id(
          id,
          profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)
        ),
        best_fielder:best_fielder_id(
          id,
          profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)
        )
      `,
      )
      .eq('match_id', matchId)
      .maybeSingle(),
  );

  return row ? toMatchAwards(row) : null;
}

// ============================================================
// MATCH COACH NOTES
// ============================================================

export async function fetchMatchCoachNotes(matchId: UUID): Promise<MatchCoachNote[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('match_coach_notes')
      .select(
        `
        id, match_id, academy_member_id, coach_id, notes,
        coach:coach_id(
          id,
          profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)
        )
      `,
      )
      .eq('match_id', matchId),
  );

  return rows.map(toMatchCoachNote);
}

// ============================================================
// PLAYER STATISTICS
// ============================================================

export async function fetchPlayerStatistics(academyId: UUID): Promise<PlayerStatistics[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('player_statistics')
      .select(
        `
        id, academy_id, player_id, matches_played, batting_innings, batting_runs, batting_highest_score,
        batting_not_outs, batting_fifties, batting_centuries, batting_fours, batting_sixes,
        bowling_innings, bowling_overs, bowling_maidens, bowling_runs_conceded, bowling_wickets,
        bowling_best_bowling, fielding_catches, fielding_run_outs, fielding_stumpings,
        awards_player_of_match, awards_best_batter, awards_best_bowler, awards_best_fielder,
        players:player_id(
          id,
          profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)
        )
      `,
      )
      .eq('academy_id', academyId)
      .order('batting_runs', { ascending: false }),
  );

  return rows.map(toPlayerStatistics);
}

export async function fetchPlayerStatisticsById(
  academyId: UUID,
  playerId: UUID,
): Promise<PlayerStatistics | null> {
  const row = await unwrap<any>(
    (supabase as any)
      .from('player_statistics')
      .select(
        `
        id, academy_id, player_id, matches_played, batting_innings, batting_runs, batting_highest_score,
        batting_not_outs, batting_fifties, batting_centuries, batting_fours, batting_sixes,
        bowling_innings, bowling_overs, bowling_maidens, bowling_runs_conceded, bowling_wickets,
        bowling_best_bowling, fielding_catches, fielding_run_outs, fielding_stumpings,
        awards_player_of_match, awards_best_batter, awards_best_bowler, awards_best_fielder,
        players:player_id(
          id,
          profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)
        )
      `,
      )
      .eq('academy_id', academyId)
      .eq('player_id', playerId)
      .maybeSingle(),
  );

  return row ? toPlayerStatistics(row) : null;
}

// ============================================================
// PLAYER MILESTONES
// ============================================================

export async function fetchPlayerMilestones(academyId: UUID): Promise<PlayerMilestone[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('player_milestones')
      .select(
        `
        id, academy_id, player_id, milestone_type, match_id, achieved_at,
        players:player_id(
          id,
          profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)
        )
      `,
      )
      .eq('academy_id', academyId)
      .order('achieved_at', { ascending: false }),
  );

  return rows.map(toPlayerMilestone);
}

// ============================================================
// ACADEMY RECORDS
// ============================================================

export async function fetchAcademyRecords(academyId: UUID): Promise<AcademyRecord[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('academy_records')
      .select(
        `
        id, academy_id, record_type, player_id, match_id, value_numeric, value_text, achieved_at,
        players:player_id(
          id,
          profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)
        )
      `,
      )
      .eq('academy_id', academyId),
  );

  return rows.map(toAcademyRecord);
}

// ============================================================
// SAVE MATCH RESULT
// ============================================================

export async function saveMatchResult(
  academyId: UUID,
  payload: SaveMatchResultPayload,
): Promise<{ matchId: UUID; status: string }> {
  const snakePayload = {
    academy_id: academyId,
    match: {
      id: payload.match.id,
      match_name: payload.match.matchName,
      match_date: payload.match.matchDate,
      venue: payload.match.venue || null,
      opponent_name: payload.match.opponentName || null,
      tournament: payload.match.tournament || null,
      match_type: payload.match.matchType,
      format: payload.match.format,
      overs: payload.match.overs != null ? payload.match.overs : null,
      team_score: payload.match.teamScore || null,
      wickets_lost: payload.match.wicketsLost != null ? payload.match.wicketsLost : null,
      overs_played: payload.match.oversPlayed != null ? payload.match.oversPlayed : null,
      result: payload.match.result || null,
      winning_margin: payload.match.winningMargin || null,
      batch_id: payload.match.batchId || null,
    },
    lineups: (payload.lineups ?? []).map((l) => ({
      academy_member_id: l.academyMemberId || null,
      batting_order: l.battingOrder != null ? l.battingOrder : 0,
      is_captain: l.isCaptain ?? false,
      is_vice_captain: l.isViceCaptain ?? false,
      is_wicketkeeper: l.isWicketkeeper ?? false,
      is_guest: l.isGuest ?? false,
      guest_name: l.guestName || null,
    })),
    batting: (payload.batting ?? []).map((b) => ({
      academy_member_id: b.academyMemberId || null,
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      is_out: b.isOut,
      dismissal_type: b.dismissalType || null,
      batting_order: b.battingOrder != null ? b.battingOrder : 0,
      is_guest: b.isGuest ?? false,
      guest_name: b.guestName || null,
    })),
    bowling: (payload.bowling ?? []).map((b) => ({
      academy_member_id: b.academyMemberId || null,
      overs: b.overs,
      maidens: b.maidens,
      runs_conceded: b.runsConceded,
      wickets: b.wickets,
      wides: b.wides,
      no_balls: b.noBalls,
      is_guest: b.isGuest ?? false,
      guest_name: b.guestName || null,
    })),
    fielding: (payload.fielding ?? []).map((f) => ({
      academy_member_id: f.academyMemberId || null,
      catches: f.catches,
      run_outs: f.runOuts,
      stumpings: f.stumpings,
      is_guest: f.isGuest ?? false,
      guest_name: f.guestName || null,
    })),
    partnerships: (payload.partnerships ?? []).map((p) => ({
      batter_1_id: p.batter1Id,
      batter_2_id: p.batter2Id,
      runs_added: p.runsAdded,
      wicket_number: p.wicketNumber || null,
    })),
    awards: payload.awards
      ? {
          player_of_match_id: payload.awards.playerOfMatchId || null,
          best_batter_id: payload.awards.bestBatterId || null,
          best_bowler_id: payload.awards.bestBowlerId || null,
          best_fielder_id: payload.awards.bestFielderId || null,
        }
      : {},
  };

  const { data, error } = await (supabase as any).rpc('save_match_result', {
    p_payload: snakePayload,
  });

  if (error) {
    throw error;
  }

  return {
    matchId: (data as any)?.match_id ?? (data as any)?.id,
    status: (data as any)?.status ?? 'completed',
  };
}

// ============================================================
// REFRESH ACADEMY RECORDS
// ============================================================

export async function refreshAcademyRecords(academyId: UUID): Promise<void> {
  const { error } = await (supabase as any).rpc('refresh_academy_records', {
    p_academy: academyId,
  });

  if (error) {
    throw error;
  }
}
