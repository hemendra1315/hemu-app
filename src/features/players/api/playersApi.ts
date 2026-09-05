/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrap, unwrapMaybe } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import { isUUID } from '@/lib/validators';
import type { UUID } from '@/types';
import type {
  PlayerAward,
  PlayerAttendanceSummary,
  PlayerCareerHighlight,
  PlayerChartData,
  PlayerCoachNote,
  PlayerDrillSummary,
  PlayerMatch,
  PlayerMilestone,
  PlayerProfile,
  PlayerStatistics,
} from './playersTypes';

// ============================================================
// PLAYER PROFILE
// ============================================================

export async function fetchPlayerProfile(academyId: UUID, playerId: UUID): Promise<PlayerProfile> {
  if (!isUUID(academyId) || !isUUID(playerId)) {
    throw new Error('Player not found');
  }
  const row = await unwrapMaybe<any>(
    supabase
      .from('academy_members')
      .select(
        `
        id, academy_id, user_id, role, status, joined_at,
        player_code, batting_style, bowling_style, player_role, jersey_number, bio,
        profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url, phone),
        batch_members!left(batch_id, joined_at, batches!inner(id, name)),
        academies!inner(name, logo_url)
      `,
      )
      .eq('academy_id', academyId)
      .eq('id', playerId)
      .order('joined_at', { foreignTable: 'batch_members', ascending: false })
      .maybeSingle()
      .returns<any>(),
  );

  if (!row) {
    throw new Error('Player not found');
  }

  const batchMember = Array.isArray(row.batch_members) ? row.batch_members[0] : row.batch_members;

  return {
    id: row.id,
    academyId: row.academy_id,
    userId: row.user_id,
    fullName: row.profiles?.full_name ?? null,
    email: row.profiles?.email ?? '',
    avatarUrl: row.profiles?.avatar_url ?? null,
    phone: row.profiles?.phone ?? null,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    battingStyle: row.batting_style ?? null,
    bowlingStyle: row.bowling_style ?? null,
    playerRole: row.player_role ?? null,
    jerseyNumber: row.jersey_number ? String(row.jersey_number) : null,
    playerCode: row.player_code ?? null,
    bio: row.bio ?? null,
    batchId: batchMember?.batch_id ?? null,
    batchName: batchMember?.batches?.name ?? null,
    academyName: row.academies?.name ?? 'Unknown Academy',
    academyLogoUrl: row.academies?.logo_url ?? null,
  };
}

// ============================================================
// UPDATE CRICKET PROFILE
// ============================================================

export async function updateCricketProfile(
  academyId: UUID,
  playerId: UUID,
  data: {
    bio?: string | null;
    battingStyle?: string | null;
    bowlingStyle?: string | null;
    playerRole?: string | null;
    jerseyNumber?: number | null;
  },
): Promise<void> {
  const payload: any = {};
  if (data.bio !== undefined) payload.bio = data.bio;
  if (data.battingStyle !== undefined) payload.batting_style = data.battingStyle;
  if (data.bowlingStyle !== undefined) payload.bowling_style = data.bowlingStyle;
  if (data.playerRole !== undefined) payload.player_role = data.playerRole;
  if (data.jerseyNumber !== undefined) payload.jersey_number = data.jerseyNumber;

  if (Object.keys(payload).length === 0) return;

  await unwrap(
    supabase.from('academy_members').update(payload).eq('academy_id', academyId).eq('id', playerId),
  );
}

// ============================================================
// PLAYER STATISTICS
// ============================================================

export async function fetchPlayerStatistics(
  academyId: UUID,
  playerId: UUID,
): Promise<PlayerStatistics | null> {
  const row = await unwrapMaybe<any>(
    supabase
      .from('player_statistics')
      .select('*')
      .eq('academy_id', academyId)
      .eq('player_id', playerId)
      .maybeSingle()
      .returns<any>(),
  );

  if (!row) return null;

  return {
    id: row.id,
    academyId: row.academy_id,
    playerId: row.player_id,
    matchesPlayed: row.matches_played,
    battingInnings: row.batting_innings,
    battingRuns: row.batting_runs,
    ballsFacedSum: row.balls_faced_sum ?? 0,
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
  };
}

// ============================================================
// PLAYER MATCHES
// ============================================================

export async function fetchPlayerMatches(academyId: UUID, playerId: UUID): Promise<PlayerMatch[]> {
  const matchSelect = `
    id, match_name, match_date, opponent_name, tournament, match_type, format, result, winning_margin, status
  `;

  const [battingRows, bowlingRows, fieldingRows, awardsRows, lineupRows] = await Promise.all([
    unwrap<any[]>(
      supabase
        .from('match_batting')
        .select(
          `
          match_id,
          runs, balls, fours, sixes, is_out, dismissal_type, batting_order,
          matches!inner(${matchSelect})
        `,
        )
        .eq('academy_member_id', playerId)
        .eq('matches.academy_id', academyId)
        .eq('matches.status', 'completed')
        .order('match_date', { foreignTable: 'matches', ascending: false })
        .returns<any[]>(),
    ),
    unwrap<any[]>(
      supabase
        .from('match_bowling')
        .select(
          `
          match_id,
          overs, maidens, runs_conceded, wickets, wides, no_balls,
          matches!inner(${matchSelect})
        `,
        )
        .eq('academy_member_id', playerId)
        .eq('matches.academy_id', academyId)
        .eq('matches.status', 'completed')
        .order('match_date', { foreignTable: 'matches', ascending: false })
        .returns<any[]>(),
    ),
    unwrap<any[]>(
      supabase
        .from('match_fielding')
        .select(
          `
          match_id,
          catches, run_outs, stumpings,
          matches!inner(${matchSelect})
        `,
        )
        .eq('academy_member_id', playerId)
        .eq('matches.academy_id', academyId)
        .eq('matches.status', 'completed')
        .order('match_date', { foreignTable: 'matches', ascending: false })
        .returns<any[]>(),
    ),
    unwrap<any[]>(
      supabase
        .from('match_awards')
        .select(
          `
          match_id,
          player_of_match_id, best_batter_id, best_bowler_id, best_fielder_id,
          matches!inner(${matchSelect})
        `,
        )
        .eq('matches.academy_id', academyId)
        .eq('matches.status', 'completed')
        .or(
          `player_of_match_id.eq.${playerId},best_batter_id.eq.${playerId},best_bowler_id.eq.${playerId},best_fielder_id.eq.${playerId}`,
        )
        .order('match_date', { foreignTable: 'matches', ascending: false })
        .returns<any[]>(),
    ),
    // A player selected for a match who did not bat, bowl, field, or win an
    // award has no row in any of the four tables above -- so the match used to
    // disappear from their history entirely, while the headline "matches
    // played" (which counts lineup appearances) still included it. That
    // mismatch showed on the profile as "MATCHES 2" above a list of one.
    // Selection is the real record of having played, so the lineup seeds the
    // list and the performance tables fill it in.
    unwrap<any[]>(
      supabase
        .from('match_lineups')
        .select(
          `
          match_id, batting_order,
          matches!inner(${matchSelect})
        `,
        )
        .eq('academy_member_id', playerId)
        .eq('matches.academy_id', academyId)
        .eq('matches.status', 'completed')
        .order('match_date', { foreignTable: 'matches', ascending: false })
        .returns<any[]>(),
    ),
  ]);

  const map = new Map<string, any>();

  const baseEntry = (match: any) => ({
    id: match.id,
    matchName: match.match_name,
    matchDate: match.match_date,
    opponentName: match.opponent_name,
    tournament: match.tournament,
    matchType: match.match_type,
    format: match.format,
    result: match.result,
    winningMargin: match.winning_margin,
    status: match.status,
    battingOrder: null,
    batting: null,
    bowling: null,
    fielding: null,
    awards: {
      playerOfMatch: false,
      bestBatter: false,
      bestBowler: false,
      bestFielder: false,
    },
  });

  for (const row of lineupRows) {
    const match = row.matches;
    const entry = map.get(match.id) ?? baseEntry(match);
    if (row.batting_order != null) entry.battingOrder = row.batting_order;
    map.set(match.id, entry);
  }

  for (const row of battingRows) {
    const match = row.matches;
    const entry = map.get(match.id) ?? baseEntry(match);
    entry.battingOrder = row.batting_order ?? entry.battingOrder ?? null;
    entry.batting = {
      runs: row.runs,
      balls: row.balls,
      fours: row.fours,
      sixes: row.sixes,
      isOut: row.is_out,
      dismissalType: row.dismissal_type,
    };
    map.set(match.id, entry);
  }

  for (const row of bowlingRows) {
    const match = row.matches;
    const existing = map.get(match.id) ?? {
      id: match.id,
      matchName: match.match_name,
      matchDate: match.match_date,
      opponentName: match.opponent_name,
      tournament: match.tournament,
      matchType: match.match_type,
      format: match.format,
      result: match.result,
      winningMargin: match.winning_margin,
      status: match.status,
      batting: null,
      fielding: null,
      awards: {
        playerOfMatch: false,
        bestBatter: false,
        bestBowler: false,
        bestFielder: false,
      },
    };
    existing.bowling = {
      overs: row.overs,
      maidens: row.maidens,
      runsConceded: row.runs_conceded,
      wickets: row.wickets,
      wides: row.wides,
      noBalls: row.no_balls,
    };
    map.set(match.id, existing);
  }

  for (const row of fieldingRows) {
    const match = row.matches;
    const existing = map.get(match.id) ?? {
      id: match.id,
      matchName: match.match_name,
      matchDate: match.match_date,
      opponentName: match.opponent_name,
      tournament: match.tournament,
      matchType: match.match_type,
      format: match.format,
      result: match.result,
      winningMargin: match.winning_margin,
      status: match.status,
      batting: null,
      bowling: null,
      awards: {
        playerOfMatch: false,
        bestBatter: false,
        bestBowler: false,
        bestFielder: false,
      },
    };
    existing.fielding = {
      catches: row.catches,
      runOuts: row.run_outs,
      stumpings: row.stumpings,
    };
    map.set(match.id, existing);
  }

  for (const row of awardsRows) {
    const match = row.matches;
    const existing = map.get(match.id) ?? {
      id: match.id,
      matchName: match.match_name,
      matchDate: match.match_date,
      opponentName: match.opponent_name,
      tournament: match.tournament,
      matchType: match.match_type,
      format: match.format,
      result: match.result,
      winningMargin: match.winning_margin,
      status: match.status,
      batting: null,
      bowling: null,
      fielding: null,
      awards: {
        playerOfMatch: false,
        bestBatter: false,
        bestBowler: false,
        bestFielder: false,
      },
    };
    existing.awards = {
      playerOfMatch: row.player_of_match_id === playerId,
      bestBatter: row.best_batter_id === playerId,
      bestBowler: row.best_bowler_id === playerId,
      bestFielder: row.best_fielder_id === playerId,
    };
    map.set(match.id, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.matchDate.localeCompare(a.matchDate));
}

// ============================================================
// PLAYER AWARDS
// ============================================================

export async function fetchPlayerAwards(academyId: UUID, playerId: UUID): Promise<PlayerAward[]> {
  const rows = await unwrap<any[]>(
    supabase
      .from('match_awards')
      .select(
        `
        id, match_id,
        matches!inner(match_name, match_date),
        player_of_match_id, best_batter_id, best_bowler_id, best_fielder_id
      `,
      )
      .eq('matches.academy_id', academyId)
      .eq('matches.status', 'completed')
      .or(
        `player_of_match_id.eq.${playerId},best_batter_id.eq.${playerId},best_bowler_id.eq.${playerId},best_fielder_id.eq.${playerId}`,
      )
      .order('match_date', { foreignTable: 'matches', ascending: false })
      .returns<any[]>(),
  );

  return rows.map((row: any) => {
    const match = row.matches;
    let awardType = '';
    if (row.player_of_match_id === playerId) awardType = 'Player of the Match';
    else if (row.best_batter_id === playerId) awardType = 'Best Batter';
    else if (row.best_bowler_id === playerId) awardType = 'Best Bowler';
    else if (row.best_fielder_id === playerId) awardType = 'Best Fielder';

    return {
      id: row.id,
      matchId: row.match_id,
      matchName: match.match_name,
      matchDate: match.match_date,
      awardType,
    };
  });
}

// ============================================================
// PLAYER MILESTONES
// ============================================================

export async function fetchPlayerMilestones(
  academyId: UUID,
  playerId: UUID,
): Promise<PlayerMilestone[]> {
  const rows = await unwrap<any[]>(
    supabase
      .from('player_milestones')
      .select('id, milestone_type, achieved_at, match_id')
      .eq('academy_id', academyId)
      .eq('player_id', playerId)
      .order('achieved_at', { ascending: false })
      .returns<any[]>(),
  );

  return rows.map((row: any) => ({
    id: row.id,
    milestoneType: row.milestone_type,
    achievedAt: row.achieved_at,
    matchId: row.match_id,
  }));
}

// ============================================================
// PLAYER COACH NOTES
// ============================================================

export async function fetchPlayerCoachNotes(
  academyId: UUID,
  playerId: UUID,
): Promise<PlayerCoachNote[]> {
  const rows = await unwrap<any[]>(
    supabase
      .from('match_coach_notes')
      .select(
        `
        id, match_id, notes, created_at, updated_at,
        matches!inner(match_name, match_date, academy_id),
        coach:coach_id(profiles!academy_members_user_id_fkey!inner(full_name))
      `,
      )
      .eq('matches.academy_id', academyId)
      .eq('academy_member_id', playerId)
      .order('created_at', { ascending: false })
      .returns<any[]>(),
  );

  return rows.map((row: any) => ({
    id: row.id,
    matchId: row.match_id,
    matchName: row.matches?.match_name ?? null,
    matchDate: row.matches?.match_date ?? null,
    notes: row.notes,
    coachName: row.coach?.profiles?.full_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ============================================================
// PLAYER ATTENDANCE SUMMARY
// ============================================================

export async function fetchPlayerAttendanceSummary(
  academyId: UUID,
  playerId: UUID,
): Promise<PlayerAttendanceSummary> {
  const { data: records, error } = await supabase
    .from('attendance')
    .select('status, session:training_sessions(session_date)')
    .eq('academy_id', academyId)
    .eq('player_id', playerId);

  if (error) throw error;

  const total = records?.length ?? 0;
  const attended = records?.filter((r: any) => r.status === 'present').length ?? 0;
  const absent = total - attended;
  const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

  const monthlyMap = new Map<string, { attended: number; total: number }>();
  for (const record of records ?? []) {
    const date = new Date(record.session?.session_date ?? '');
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = monthlyMap.get(key) ?? { attended: 0, total: 0 };
    current.total += 1;
    if (record.status === 'present') current.attended += 1;
    monthlyMap.set(key, current);
  }

  const monthlyData = Array.from(monthlyMap.entries())
    .map(([month, values]) => ({ month, ...values }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  return {
    totalSessions: total,
    attended,
    absent,
    attendancePercentage: percentage,
    monthlyData,
  };
}

// ============================================================
// PLAYER DRILL SUMMARY
// ============================================================

export async function fetchPlayerDrillSummary(
  academyId: UUID,
  playerId: UUID,
): Promise<PlayerDrillSummary> {
  const assignments = await unwrap<any[]>(
    supabase
      .from('drill_assignments')
      .select(
        `
        id, status, assigned_at, due_date,
        drills(name, category)
      `,
      )
      .eq('academy_id', academyId)
      .eq('player_id', playerId)
      .order('assigned_at', { ascending: false })
      .returns<any[]>(),
  );

  const assigned = assignments.length;
  const completed = assignments.filter((a) => a.status === 'completed').length;
  const pending = assigned - completed;
  const completionPercentage = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

  const toRow = (a: any) => ({
    id: a.id,
    drillName: a.drills?.name ?? 'Unknown',
    category: a.drills?.category ?? 'general',
    status: a.status,
    assignedAt: a.assigned_at,
    dueDate: a.due_date,
  });

  // `recentAssignments` is an activity feed (most recent 10, any status) —
  // fine for that. It is NOT a substitute for the full pending/completed
  // lists: the dashboard used to derive its "Pending"/"Completed" cards by
  // filtering this same truncated list, so a player with more than 10
  // assignments saw a dashboard that disagreed with their own profile's
  // "23 assigned, 65% completion" stat (computed from the untruncated
  // `assignments` array above). These two fields are the real, complete
  // lists for exactly that purpose.
  const recentAssignments = assignments.slice(0, 10).map(toRow);
  const pendingAssignments = assignments.filter((a) => a.status !== 'completed').map(toRow);
  const completedAssignments = assignments.filter((a) => a.status === 'completed').map(toRow);

  return {
    assigned,
    completed,
    pending,
    completionPercentage,
    recentAssignments,
    pendingAssignments,
    completedAssignments,
  };
}

// ============================================================
// PLAYER CAREER HIGHLIGHTS
// ============================================================

export async function fetchPlayerCareerHighlights(
  academyId: UUID,
  playerId: UUID,
): Promise<PlayerCareerHighlight[]> {
  const stats = await fetchPlayerStatistics(academyId, playerId);
  const highlights: PlayerCareerHighlight[] = [];

  if (!stats) return highlights;

  // Highest score
  if (stats.battingHighestScore && stats.battingHighestScore > 0) {
    highlights.push({
      type: 'highest_score',
      label: 'Highest Score',
      value: stats.battingHighestScore.toString(),
      matchId: null,
      matchName: null,
    });
  }

  // Best bowling
  if (stats.bowlingBestBowling) {
    highlights.push({
      type: 'best_bowling',
      label: 'Best Bowling',
      value: stats.bowlingBestBowling,
      matchId: null,
      matchName: null,
    });
  }

  // Most runs
  highlights.push({
    type: 'total_runs',
    label: 'Total Runs',
    value: stats.battingRuns.toString(),
    matchId: null,
    matchName: null,
  });

  // Most wickets
  highlights.push({
    type: 'total_wickets',
    label: 'Total Wickets',
    value: stats.bowlingWickets.toString(),
    matchId: null,
    matchName: null,
  });

  // Most catches
  highlights.push({
    type: 'total_catches',
    label: 'Total Catches',
    value: stats.fieldingCatches.toString(),
    matchId: null,
    matchName: null,
  });

  // Player of the match awards
  if (stats.awardsPlayerOfMatch > 0) {
    highlights.push({
      type: 'player_of_match',
      label: 'Player of the Match',
      value: stats.awardsPlayerOfMatch.toString(),
      matchId: null,
      matchName: null,
    });
  }

  return highlights;
}

// ============================================================
// PLAYER CHART DATA
// ============================================================

export async function fetchPlayerChartData(
  academyId: UUID,
  playerId: UUID,
  /**
   * Callers that already have these (e.g. the player dashboard, which fetches
   * both alongside this in the same `Promise.all`) can pass them in so this
   * function skips its own copies. `fetchPlayerDashboardAnalytics` was firing
   * the matches and attendance queries twice per dashboard load — once here,
   * once for its own `matches`/`attendance` results — for identical data.
   */
  preFetched?: { matches?: PlayerMatch[]; attendanceSummary?: PlayerAttendanceSummary },
): Promise<PlayerChartData> {
  const matches = preFetched?.matches ?? (await fetchPlayerMatches(academyId, playerId));

  const runsByMatch = matches
    .filter((m) => m.batting)
    .map((m) => ({
      matchName: m.matchName,
      matchDate: m.matchDate,
      runs: m.batting!.runs,
    }));

  const wicketsByMatch = matches
    .filter((m) => m.bowling)
    .map((m) => ({
      matchName: m.matchName,
      matchDate: m.matchDate,
      wickets: m.bowling!.wickets,
    }));

  const strikeRateTrend = matches
    .filter((m) => m.batting && m.batting.balls > 0)
    .map((m) => ({
      matchName: m.matchName,
      matchDate: m.matchDate,
      strikeRate: parseFloat(((m.batting!.runs / m.batting!.balls) * 100).toFixed(2)),
    }));

  const economyTrend = matches
    .filter((m) => m.bowling && m.bowling.overs > 0)
    .map((m) => ({
      matchName: m.matchName,
      matchDate: m.matchDate,
      economy: parseFloat((m.bowling!.runsConceded / m.bowling!.overs).toFixed(2)),
    }));

  const attendanceSummary =
    preFetched?.attendanceSummary ?? (await fetchPlayerAttendanceSummary(academyId, playerId));
  const attendanceTrend = attendanceSummary.monthlyData.map(
    (md: { month: string; attended: number; total: number }) => ({
      month: md.month,
      percentage: Math.round((md.attended / md.total) * 100),
    }),
  );

  return {
    runsByMatch,
    wicketsByMatch,
    strikeRateTrend,
    economyTrend,
    attendanceTrend,
  };
}
