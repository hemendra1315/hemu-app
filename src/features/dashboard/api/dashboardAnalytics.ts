/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrap } from '@/lib/api';
import { normalizeTrainingDays } from '@/features/batches';
import { supabase } from '@/lib/supabase/client';
import { toIsoDate } from '@/lib/utils/date';
import type { UUID } from '@/types';
import {
  fetchPlayerStatistics,
  fetchPlayerMatches,
  fetchPlayerAwards,
  fetchPlayerMilestones,
  fetchPlayerChartData,
  fetchPlayerAttendanceSummary,
  fetchPlayerDrillSummary,
} from '@/features/players/api/playersApi';

// ============================================================
// OWNER DASHBOARD ANALYTICS
// ============================================================

export async function fetchOwnerDashboardAnalytics(academyId: UUID) {
  const [
    playersResult,
    coachesResult,
    batchesResult,
    matchesResult,
    attendanceResult,
    sessionsResult,
    recentMatchesResult,
    upcomingSessionsResult,
    activityResult,
    topBattersResult,
    topBowlersResult,
    topFieldersResult,
    // NOTE: these two must stay in this order — the Promise.all below resolves
    // "Today's Sessions" *before* "Academy records". They were previously
    // swapped here, which silently fed academy_records rows into todaySessions
    // (and vice versa), so the owner dashboard's "Today's Sessions" KPI, its
    // "Players Expected" total and its session list were always empty.
    todaySessionsResult,
    academyRecordsResult,
  ] = await Promise.all([
    // Total active players
    unwrap<any[]>(
      (supabase as any)
        .from('academy_members')
        .select('id')
        .eq('academy_id', academyId)
        .eq('role', 'player')
        .eq('status', 'active'),
    ),
    // Total active coaches
    unwrap<any[]>(
      (supabase as any)
        .from('academy_members')
        .select('id')
        .eq('academy_id', academyId)
        .eq('role', 'coach')
        .eq('status', 'active'),
    ),
    // Total batches (no status column on batches table)
    unwrap<any[]>((supabase as any).from('batches').select('id').eq('academy_id', academyId)),
    // Total matches
    unwrap<any[]>((supabase as any).from('matches').select('id').eq('academy_id', academyId)),
    // Attendance records (join through training_sessions for session_date, last 6 months)
    unwrap<any[]>(
      (supabase as any)
        .from('attendance')
        .select('status, session:training_sessions(session_date)')
        .eq('academy_id', academyId)
        .gte(
          'training_sessions.session_date',
          toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)),
        ),
    ),
    // Sessions this week
    unwrap<any[]>(
      (supabase as any)
        .from('training_sessions')
        .select('id')
        .eq('academy_id', academyId)
        .gte('session_date', toIsoDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
        .lte('session_date', toIsoDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))),
    ),
    // Recent matches
    unwrap<any[]>(
      (supabase as any)
        .from('matches')
        .select('id, match_name, match_date, opponent_name, result, team_score, wickets_lost')
        .eq('academy_id', academyId)
        .order('match_date', { ascending: false })
        .limit(5),
    ),
    // Upcoming sessions
    unwrap<any[]>(
      (supabase as any)
        .from('training_sessions')
        .select(
          'id, title, session_date, start_at, end_at, batch_id, coach_id, batches(name), academy_members!training_sessions_coach_id_fkey(id, profiles!academy_members_user_id_fkey(full_name))',
        )
        .eq('academy_id', academyId)
        .eq('status', 'scheduled')
        .gte('session_date', toIsoDate(new Date()))
        .order('session_date', { ascending: true })
        .limit(5),
    ),
    // Recent activity
    unwrap<any[]>(
      (supabase as any)
        .from('activity_log')
        .select('id, activity_type, description, created_at')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false })
        .limit(10),
    ),
    // Top batters
    unwrap<any[]>(
      (supabase as any)
        .from('player_statistics')
        .select(
          'player_id, batting_runs, batting_innings, batting_not_outs, academy_members!player_statistics_player_id_fkey(id, profiles!academy_members_user_id_fkey(full_name))',
        )
        .eq('academy_id', academyId)
        .order('batting_runs', { ascending: false })
        .limit(5),
    ),
    // Top bowlers
    unwrap<any[]>(
      (supabase as any)
        .from('player_statistics')
        .select(
          'player_id, bowling_wickets, bowling_runs_conceded, bowling_overs, academy_members!player_statistics_player_id_fkey(id, profiles!academy_members_user_id_fkey(full_name))',
        )
        .eq('academy_id', academyId)
        .order('bowling_wickets', { ascending: false })
        .limit(5),
    ),
    // Top fielders
    unwrap<any[]>(
      (supabase as any)
        .from('player_statistics')
        .select(
          'player_id, fielding_catches, fielding_run_outs, academy_members!player_statistics_player_id_fkey(id, profiles!academy_members_user_id_fkey(full_name))',
        )
        .eq('academy_id', academyId)
        .order('fielding_catches', { ascending: false })
        .limit(5),
    ),
    // Today\'s Sessions
    unwrap<any[]>(
      (supabase as any)
        .from('training_sessions')
        .select(
          'id, title, session_date, start_at, end_at, batch_id, coach_id, status, batches (name, player_count:batch_members(count)), academy_members!training_sessions_coach_id_fkey(id, profiles!academy_members_user_id_fkey(full_name)), attendance_count:attendance(count)',
        )
        .eq('academy_id', academyId)
        .eq('session_date', toIsoDate(new Date()))
        .neq('status', 'cancelled')
        .order('start_at', { ascending: true }),
    ),
    // Academy records
    unwrap<any[]>(
      (supabase as any)
        .from('academy_records')
        .select('*')
        .eq('academy_id', academyId)
        .order('achieved_at', { ascending: false })
        .limit(10),
    ),
  ]);

  const totalPlayers = playersResult.length;
  const totalCoaches = coachesResult.length;
  const totalBatches = batchesResult.length;
  const totalMatches = matchesResult.length;

  const totalAttendance = attendanceResult.length;
  const attendedAttendance = attendanceResult.filter((a: any) => a.status === 'present').length;
  const attendancePercentage =
    totalAttendance > 0 ? Math.round((attendedAttendance / totalAttendance) * 100) : 0;

  const sessionsThisWeek = sessionsResult.length;

  // Monthly attendance breakdown (last 6 months)
  const monthlyStats: Record<string, { present: number; total: number }> = {};
  const monthKeys: string[] = [];
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });

  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyStats[key] = { present: 0, total: 0 };
    monthKeys.push(key);
  }

  for (const record of attendanceResult ?? []) {
    const sessionDate = record.session?.session_date;
    if (!sessionDate) continue;
    const key = sessionDate.substring(0, 7);
    if (monthlyStats[key]) {
      monthlyStats[key].total += 1;
      if (record.status === 'present') {
        monthlyStats[key].present += 1;
      }
    }
  }

  const monthlyAttendance = monthKeys.map((key) => {
    const parts = key.split('-');
    const year = parseInt(parts[0] ?? '0', 10);
    const month = parseInt(parts[1] ?? '1', 10);
    const dateObj = new Date(year, month - 1, 1);
    const label = monthFormatter.format(dateObj);
    const stat = monthlyStats[key] ?? { present: 0, total: 0 };
    const value = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0;
    return { label, value };
  });

  const recentMatches = (recentMatchesResult ?? []).map((match: any) => ({
    id: match.id,
    matchName: match.match_name,
    matchDate: match.match_date,
    opponentName: match.opponent_name,
    result: match.result,
    teamScore: match.team_score,
    wicketsLost: match.wickets_lost,
  }));

  const todaySessions = (todaySessionsResult ?? []).map((session: any) => ({
    id: session.id,
    title: session.title,
    sessionDate: session.session_date,
    startAt: session.start_at,
    endAt: session.end_at,
    status: session.status,
    batchName: session.batches?.name ?? null,
    playerCount: session.batches?.player_count?.[0]?.count ?? 0,
    attendanceMarked: (session.attendance_count?.[0]?.count ?? 0) > 0,
    coach: {
      fullName: session.academy_members?.profiles?.full_name ?? null,
    },
  }));

  const upcomingSessions = (upcomingSessionsResult ?? []).map((session: any) => ({
    id: session.id,
    title: session.title,
    sessionDate: session.session_date,
    startAt: session.start_at,
    endAt: session.end_at,
    batchName: session.batches?.name ?? null,
    coach: {
      fullName: session.academy_members?.profiles?.full_name ?? null,
      email: '',
      avatarUrl: null,
    },
  }));

  const activities = (activityResult ?? []).map((activity: any) => ({
    id: activity.id,
    type: activity.activity_type as any,
    message: activity.description,
    timestamp: activity.created_at,
  }));

  const topBatters = (topBattersResult ?? []).map((player: any) => {
    const dismissals = player.batting_innings - (player.batting_not_outs ?? 0);
    const average =
      player.batting_innings > 0
        ? dismissals > 0
          ? (player.batting_runs / dismissals).toFixed(2)
          : player.batting_runs.toFixed(2)
        : '0.00';
    return {
      id: player.player_id,
      name: player.academy_members?.profiles?.full_name ?? 'Unknown',
      runs: player.batting_runs,
      average,
      href: `/members/${player.player_id}`,
    };
  });

  const topBowlers = (topBowlersResult ?? []).map((player: any) => ({
    id: player.player_id,
    name: player.academy_members?.profiles?.full_name ?? 'Unknown',
    wickets: player.bowling_wickets,
    economy:
      player.bowling_overs > 0
        ? (player.bowling_runs_conceded / player.bowling_overs).toFixed(2)
        : '0.00',
    href: `/members/${player.player_id}`,
  }));

  const topFielders = (topFieldersResult ?? []).map((player: any) => ({
    id: player.player_id,
    name: player.academy_members?.profiles?.full_name ?? 'Unknown',
    catches: player.fielding_catches,
    runOuts: player.fielding_run_outs,
    href: `/members/${player.player_id}`,
  }));

  const academyRecords = (academyRecordsResult ?? []).map((record: any) => ({
    id: record.id,
    recordType: record.record_type,
    value: record.value_text ?? record.value_numeric?.toString(),
    achievedAt: record.achieved_at,
    matchId: record.match_id,
    href: record.match_id ? `/matches/${record.match_id}` : '#',
  }));

  return {
    totalPlayers,
    totalCoaches,
    totalBatches,
    totalMatches,
    attendancePercentage,
    sessionsThisWeek,
    recentMatches,
    todaySessions,
    upcomingSessions,
    activities,
    topBatters,
    topBowlers,
    topFielders,
    academyRecords,
    monthlyAttendance,
  };
}

import { isUUID } from '@/lib/validators';

// ============================================================
// COACH DASHBOARD ANALYTICS
// ============================================================

export async function fetchCoachDashboardAnalytics(academyId: UUID, coachId: UUID) {
  if (!isUUID(academyId) || !isUUID(coachId)) {
    return {
      todaySession: null,
      recentMatches: [],
      assignedBatches: [],
      wins: 0,
      losses: 0,
      playersNeedingAttention: [],
    };
  }

  const [
    todaySessionResult,
    recentMatchesResult,
    assignedBatchesResult,
    playersNeedingAttentionResult,
  ] = await Promise.all([
    // Today's session
    unwrap<any[]>(
      (supabase as any)
        .from('training_sessions')
        .select('id, title, start_at, end_at, batch_id, batches(name)')
        .eq('academy_id', academyId)
        .eq('coach_id', coachId)
        .eq('session_date', toIsoDate(new Date()))
        .neq('status', 'cancelled')
        .order('start_at', { ascending: true })
        .limit(1),
    ),
    // Last 5 matches
    unwrap<any[]>(
      (supabase as any)
        .from('matches')
        .select('id, match_name, match_date, opponent_name, result, team_score')
        .eq('academy_id', academyId)
        .order('match_date', { ascending: false })
        .limit(5),
    ),
    // Assigned batches. Player counts come from a batch_members aggregate embed
    // (there is no player_count column on batches itself), which keeps the query
    // free of the nonexistent status/player_count columns that caused the old 400.
    unwrap<any[]>(
      (supabase as any)
        .from('batches')
        .select(
          'id, name, age_group, training_days, training_time, player_count:batch_members!left(count)',
        )
        .eq('academy_id', academyId)
        .eq('coach_id', coachId),
    ),
    // Players needing attention
    unwrap<any[]>(
      (supabase as any)
        .from('academy_members')
        .select('id, profiles!academy_members_user_id_fkey(full_name, email)')
        .eq('academy_id', academyId)
        .eq('role', 'player')
        .eq('status', 'active'),
    ),
  ]);

  const todaySessions = (todaySessionResult ?? []).map((session: any) => ({
    id: session.id,
    title: session.title,
    sessionDate: session.session_date,
    startAt: session.start_at,
    endAt: session.end_at,
    status: session.status,
    batchName: session.batches?.name ?? null,
    playerCount: session.batches?.player_count?.[0]?.count ?? 0,
    attendanceMarked: (session.attendance_count?.[0]?.count ?? 0) > 0,
  }));

  const recentMatches = (recentMatchesResult ?? []).map((match: any) => ({
    id: match.id,
    matchName: match.match_name,
    matchDate: match.match_date,
    opponentName: match.opponent_name,
    result: match.result,
    teamScore: match.team_score,
  }));

  const assignedBatches = (assignedBatchesResult ?? []).map((batch: any) => ({
    id: batch.id,
    name: batch.name,
    ageGroup: batch.age_group,
    playerCount: batch.player_count?.[0]?.count ?? 0,
    // Same column-shape hazard as the batches feature — see normalizeTrainingDays.
    trainingDays: normalizeTrainingDays(batch.training_days),
    trainingTime: batch.training_time,
  }));

  // Calculate team performance
  const wins = recentMatches.filter((m) => m.result === 'won').length;
  const losses = recentMatches.filter((m) => m.result === 'lost').length;

  // Get players needing attention (batched queries to eliminate N+1 roundtrips)
  const playersNeedingAttention = [];
  const activePlayers = playersNeedingAttentionResult ?? [];
  const allPlayerIds = activePlayers.map((p: any) => p.id);

  if (allPlayerIds.length > 0) {
    const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [attendanceBatch, drillsBatch, feedbackBatch] = await Promise.all([
      unwrap<any[]>(
        (supabase as any)
          .from('attendance')
          .select('player_id, status, session:training_sessions!inner(session_date)')
          .eq('academy_id', academyId)
          .in('player_id', allPlayerIds)
          .gte('session.session_date', thirtyDaysAgoStr),
      ),
      unwrap<any[]>(
        (supabase as any)
          .from('drill_assignments')
          .select('player_id, status')
          .eq('academy_id', academyId)
          .in('player_id', allPlayerIds)
          .eq('status', 'assigned'),
      ),
      unwrap<any[]>(
        (supabase as any)
          .from('match_coach_notes')
          .select('id, academy_member_id, match:matches!inner(academy_id)')
          .eq('match.academy_id', academyId)
          .in('academy_member_id', allPlayerIds)
          .gte('created_at', thirtyDaysAgoIso),
      ),
    ]);

    const attendanceByPlayer = new Map<string, any[]>();
    for (const record of attendanceBatch ?? []) {
      const list = attendanceByPlayer.get(record.player_id) || [];
      list.push(record);
      attendanceByPlayer.set(record.player_id, list);
    }

    const drillsByPlayer = new Map<string, any[]>();
    for (const record of drillsBatch ?? []) {
      const list = drillsByPlayer.get(record.player_id) || [];
      list.push(record);
      drillsByPlayer.set(record.player_id, list);
    }

    const feedbackByPlayer = new Map<string, any[]>();
    for (const record of feedbackBatch ?? []) {
      const list = feedbackByPlayer.get(record.academy_member_id) || [];
      list.push(record);
      feedbackByPlayer.set(record.academy_member_id, list);
    }

    for (const player of activePlayers) {
      const playerAttendance = attendanceByPlayer.get(player.id) || [];
      const playerDrills = drillsByPlayer.get(player.id) || [];
      const playerFeedback = feedbackByPlayer.get(player.id) || [];

      const attendanceRate =
        playerAttendance.length > 0
          ? (playerAttendance.filter((a: any) => a.status === 'present').length /
              playerAttendance.length) *
            100
          : 0;

      const issues: string[] = [];
      if (attendanceRate < 70) issues.push('Low attendance');
      if (playerDrills.length > 0) issues.push('Pending drills');
      if (playerFeedback.length === 0) issues.push('No recent feedback');

      if (issues.length > 0) {
        playersNeedingAttention.push({
          id: player.id,
          name: player.profiles?.full_name ?? 'Unknown',
          issues,
          attendanceRate: Math.round(attendanceRate),
        });
      }
    }
  }

  return {
    todaySessions,
    recentMatches,
    assignedBatches,
    wins,
    losses,
    playersNeedingAttention,
  };
}

// ============================================================
// PLAYER DASHBOARD ANALYTICS
// ============================================================

export async function fetchPlayerDashboardAnalytics(academyId: UUID, playerId: UUID) {
  if (!isUUID(academyId) || !isUUID(playerId)) {
    return null;
  }

  const [
    statistics,
    matches,
    awards,
    milestones,
    chartData,
    attendance,
    drillSummary,
    upcomingSessionsResult,
  ] = await Promise.all([
    fetchPlayerStatistics(academyId, playerId),
    fetchPlayerMatches(academyId, playerId),
    fetchPlayerAwards(academyId, playerId),
    fetchPlayerMilestones(academyId, playerId),
    fetchPlayerChartData(academyId, playerId),
    fetchPlayerAttendanceSummary(academyId, playerId),
    fetchPlayerDrillSummary(academyId, playerId),
    unwrap<any[]>(
      (supabase as any)
        .from('training_sessions')
        .select(
          `
          id, title, session_date, start_at, end_at,
          academy_members!training_sessions_coach_id_fkey(id, profiles!academy_members_user_id_fkey(full_name))
        `,
        )
        .eq('academy_id', academyId)
        .eq('status', 'scheduled')
        .gte('session_date', toIsoDate(new Date()))
        .order('session_date', { ascending: true })
        .limit(3),
    ),
  ]);

  const dismissals = statistics ? statistics.battingInnings - statistics.battingNotOuts : 0;

  const stats = statistics
    ? {
        matchesPlayed: statistics.matchesPlayed,
        battingRuns: statistics.battingRuns,
        bowlingWickets: statistics.bowlingWickets,
        battingAverage:
          statistics.battingInnings > 0
            ? dismissals > 0
              ? (statistics.battingRuns / dismissals).toFixed(2)
              : statistics.battingRuns.toFixed(2)
            : '0.00',
        strikeRate:
          statistics.ballsFacedSum > 0
            ? ((statistics.battingRuns / statistics.ballsFacedSum) * 100).toFixed(2)
            : '0.00',
        economy:
          statistics.bowlingOvers > 0
            ? (statistics.bowlingRunsConceded / statistics.bowlingOvers).toFixed(2)
            : '0.00',
        attendancePercentage: attendance.attendancePercentage,
      }
    : null;

  const recentMatches = matches.slice(0, 5).map((m: any) => ({
    id: m.id,
    matchName: m.matchName,
    matchDate: m.matchDate,
    opponentName: m.opponentName,
    result: m.result,
    batting: m.batting ? { runs: m.batting.runs, balls: m.batting.balls } : null,
    bowling: m.bowling
      ? { wickets: m.bowling.wickets, runsConceded: m.bowling.runsConceded }
      : null,
    awards: {
      playerOfMatch: m.awards.playerOfMatch,
      bestBatter: m.awards.bestBatter,
      bestBowler: m.awards.bestBowler,
      bestFielder: m.awards.bestFielder,
    },
  }));

  const upcomingSessions = (upcomingSessionsResult ?? []).map((session: any) => ({
    id: session.id,
    title: session.title,
    sessionDate: session.session_date,
    startAt: session.start_at,
    endAt: session.end_at,
    coach: {
      fullName: session.academy_members?.profiles?.full_name ?? null,
      email: '',
      avatarUrl: null,
    },
  }));

  const pendingAssignments = drillSummary.recentAssignments
    .filter((a: any) => a.status === 'assigned')
    .map((a: any) => ({
      ...a,
      drill: { name: a.drillName, category: a.category },
    }));

  const completedAssignments = drillSummary.recentAssignments
    .filter((a: any) => a.status === 'completed')
    .map((a: any) => ({
      ...a,
      drill: { name: a.drillName, category: a.category },
    }));

  const recentAwards = awards.slice(0, 5).map((award: any) => ({
    id: award.id,
    matchId: award.matchId,
    matchName: award.matchName,
    matchDate: award.matchDate,
  }));

  const careerHighlights = milestones.slice(0, 10).map((milestone: any) => ({
    type: milestone.milestoneType,
    label: milestone.milestoneType.replace(/_/g, ' '),
    value: null,
    matchId: milestone.matchId,
    matchName: null,
  }));

  const runsTrend = chartData.runsByMatch.slice(0, 10).map((row: any) => ({
    matchName: row.matchName,
    matchDate: row.matchDate,
    runs: row.runs,
  }));

  return {
    stats,
    recentMatches,
    upcomingSessions,
    pendingAssignments,
    completedAssignments,
    recentAwards,
    careerHighlights,
    runsTrend,
    /** Last six months of attendance as a percentage, oldest first. */
    attendanceTrend: chartData.attendanceTrend,
  };
}
