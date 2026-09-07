import type { UUID } from '@/types';
import type { PlayerMatch, PlayerStatistics } from '@/features/players/api/playersTypes';

/** One row in a batch report's player table. */
export type ReportPlayerRow = {
  playerId: UUID;
  fullName: string;
  attendanceRate: number | null;
  sessionsRecorded: number;
  matchesPlayed: number;
  battingRuns: number;
  bowlingWickets: number;
  fieldingCatches: number;
};

export type BatchReport = {
  scope: 'batch';
  batchId: UUID;
  batchName: string;
  from: string;
  to: string;
  overallAttendanceRate: number | null;
  sessionsHeld: number;
  players: ReportPlayerRow[];
};

export type PlayerReport = {
  scope: 'player';
  playerId: UUID;
  fullName: string;
  from: string;
  to: string;
  /** Attendance in the selected date range only. */
  attendanceRate: number | null;
  sessionsRecorded: number;
  present: number;
  absent: number;
  /** All-time career stats -- `player_statistics` is a running total, not date-scoped. */
  statistics: PlayerStatistics | null;
  /** Matches falling inside [from, to], newest first. */
  recentMatches: PlayerMatch[];
};

export type Report = BatchReport | PlayerReport;
