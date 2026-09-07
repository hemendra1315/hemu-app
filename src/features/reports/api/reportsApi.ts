/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrap } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { UUID } from '@/types';
import { fetchBatchPlayers } from '@/features/batches/api/batchesApi';
import { fetchAttendanceMarks } from '@/features/attendance/api/attendanceApi';
import { buildAttendanceInsights } from '@/features/attendance/api/attendanceInsights';
import { fetchPlayerMatches, fetchPlayerStatistics } from '@/features/players/api/playersApi';
import type { BatchReport, PlayerReport, ReportPlayerRow } from './reportsTypes';

/**
 * Roster + attendance + career stats for every player in one batch, over a
 * date range. `player_statistics` is a running career total (there is no
 * date-scoped version of it anywhere in this app), so the per-player match
 * counts and runs/wickets/catches here are all-time, not scoped to
 * `from`/`to` -- only the attendance figures are actually range-scoped. This
 * mirrors how the owner dashboard's "Performance Leaders" already presents
 * `player_statistics`.
 */
export async function fetchBatchReport(
  academyId: UUID,
  batchId: UUID,
  batchName: string,
  from: string,
  to: string,
): Promise<BatchReport> {
  const batchPlayers = await fetchBatchPlayers(batchId);
  const playerIds = batchPlayers.map((p) => p.academyMemberId);
  const playerNames = new Map(
    batchPlayers.map((p) => [p.academyMemberId, p.fullName ?? p.email ?? 'Unknown player']),
  );

  const marks = (await fetchAttendanceMarks(academyId, from, to)).filter((m) =>
    playerIds.includes(m.playerId),
  );
  const insights = buildAttendanceInsights({
    marks,
    playerNames,
    batchNames: new Map([[batchId, batchName]]),
    from,
    to,
  });
  const insightsByPlayer = new Map(insights.players.map((p) => [p.playerId, p]));

  const statsRows =
    playerIds.length === 0
      ? []
      : await unwrap<any[]>(
          supabase
            .from('player_statistics')
            .select('player_id, matches_played, batting_runs, bowling_wickets, fielding_catches')
            .eq('academy_id', academyId)
            .in('player_id', playerIds)
            .returns<any[]>(),
        );
  const statsByPlayer = new Map(statsRows.map((row) => [row.player_id, row]));

  const players: ReportPlayerRow[] = batchPlayers
    .map((p): ReportPlayerRow => {
      const stat = statsByPlayer.get(p.academyMemberId);
      const attendance = insightsByPlayer.get(p.academyMemberId);
      return {
        playerId: p.academyMemberId,
        fullName: p.fullName ?? p.email ?? 'Unknown player',
        attendanceRate: attendance?.rate ?? null,
        sessionsRecorded: attendance?.sessionsRecorded ?? 0,
        matchesPlayed: stat?.matches_played ?? 0,
        battingRuns: stat?.batting_runs ?? 0,
        bowlingWickets: stat?.bowling_wickets ?? 0,
        fieldingCatches: stat?.fielding_catches ?? 0,
      };
    })
    .sort((a, b) => b.battingRuns - a.battingRuns);

  return {
    scope: 'batch',
    batchId,
    batchName,
    from,
    to,
    overallAttendanceRate: insights.overallRate,
    sessionsHeld: insights.sessionsHeld,
    players,
  };
}

/**
 * One player's report: attendance actually scoped to the date range, plus
 * their all-time career stats and the matches that fall inside the range.
 */
export async function fetchPlayerReport(
  academyId: UUID,
  playerId: UUID,
  fullName: string,
  from: string,
  to: string,
): Promise<PlayerReport> {
  const [marks, statistics, matches] = await Promise.all([
    fetchAttendanceMarks(academyId, from, to),
    fetchPlayerStatistics(academyId, playerId),
    fetchPlayerMatches(academyId, playerId),
  ]);

  const own = marks.filter((m) => m.playerId === playerId);
  const present = own.filter((m) => m.status === 'present').length;
  const absent = own.length - present;

  const recentMatches = matches
    .filter((m) => m.matchDate >= from && m.matchDate <= to)
    .sort((a, b) => b.matchDate.localeCompare(a.matchDate));

  return {
    scope: 'player',
    playerId,
    fullName,
    from,
    to,
    attendanceRate: own.length > 0 ? Math.round((present / own.length) * 100) : null,
    sessionsRecorded: own.length,
    present,
    absent,
    statistics,
    recentMatches,
  };
}
