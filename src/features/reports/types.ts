import type { UUID } from '@/types';

export interface MonthlyAttendanceReportData {
  academyName: string;
  batchId: UUID;
  batchName: string;
  year: number;
  month: number; // 1-12
  daysInMonth: number;
  sessions: Array<{
    sessionId: UUID;
    date: string; // YYYY-MM-DD
    day: number; // 1-31
    title: string;
  }>;
  rows: Array<{
    playerId: UUID;
    playerName: string;
    attendanceByDay: Record<number, 'present' | 'absent' | 'late' | 'excused' | null>;
    presentCount: number;
    totalSessions: number;
    percentage: number;
  }>;
  batchSummary: {
    totalSessions: number;
    averageAttendanceRate: number;
    atRiskCount: number;
  };
}

export interface PlayerPerformanceReportData {
  academyName: string;
  playerId: UUID;
  playerName: string;
  playerRole?: string;
  avatarUrl: string | null;
  batchName: string;
  dateRange: { start: string; end: string };
  matchesPlayed: number;
  batting: {
    innings: number;
    runs: number;
    highestScore: string;
    average: number;
    strikeRate: number;
    fifties: number;
    hundreds: number;
    fours: number;
    sixes: number;
  };
  bowling: {
    overs: string;
    wickets: number;
    runsConceded: number;
    maidens: number;
    bestBowling: string;
    economy: number;
    average: number;
    strikeRate: number;
    threeWickets: number;
    fiveWickets: number;
  };
  fielding: {
    catches: number;
    stumpings: number;
    runOuts: number;
  };
  mvp: {
    totalPoints: number;
    rank: number;
    awards: Array<{ title: string; matchName: string; matchDate: string }>;
  };
  drills: Array<{
    drillName: string;
    category: string;
    score: number;
    maxScore: number;
    rating: number; // 1-5
    date: string;
  }>;
  coachNotes: string[];
}

export interface BatchScheduleReportData {
  academyName: string;
  generatedAt: string;
  batches: Array<{
    batchId: UUID;
    batchName: string;
    ageGroup?: string;
    coachNames: string[];
    venueName: string;
    capacity: number;
    enrolledCount: number;
    utilizationPercent: number;
    schedules: Array<{
      dayOfWeek: string;
      startTime: string;
      endTime: string;
    }>;
  }>;
}
