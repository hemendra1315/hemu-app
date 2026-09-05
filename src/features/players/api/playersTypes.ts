import type { UUID } from '@/types';
import type { MatchFormat, MatchResult, MatchType } from '@/types/enums';

export type PlayerProfile = {
  id: UUID;
  academyId: UUID;
  userId: UUID;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
  role: string;
  status: string;
  joinedAt: string | null;
  battingStyle: string | null;
  bowlingStyle: string | null;
  playerRole: string | null;
  jerseyNumber: string | null;
  playerCode: string | null;
  bio: string | null;
  batchId: UUID | null;
  batchName: string | null;
  academyName: string;
  academyLogoUrl: string | null;
};

export type PlayerStatistics = {
  id: UUID;
  academyId: UUID;
  playerId: UUID;
  matchesPlayed: number;
  battingInnings: number;
  battingRuns: number;
  ballsFacedSum: number;
  battingHighestScore: number | null;
  battingNotOuts: number;
  battingFifties: number;
  battingCenturies: number;
  battingFours: number;
  battingSixes: number;
  bowlingInnings: number;
  bowlingOvers: number;
  bowlingMaidens: number;
  bowlingRunsConceded: number;
  bowlingWickets: number;
  bowlingBestBowling: string | null;
  fieldingCatches: number;
  fieldingRunOuts: number;
  fieldingStumpings: number;
  awardsPlayerOfMatch: number;
  awardsBestBatter: number;
  awardsBestBowler: number;
  awardsBestFielder: number;
};

export type PlayerMatch = {
  id: UUID;
  matchName: string;
  matchDate: string;
  opponentName: string | null;
  tournament: string | null;
  matchType: MatchType;
  format: MatchFormat;
  result: MatchResult | null;
  winningMargin: string | null;
  status: string;
  battingOrder?: number | null;
  batting: {
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    isOut: boolean;
    dismissalType: string | null;
  } | null;
  bowling: {
    overs: number;
    maidens: number;
    runsConceded: number;
    wickets: number;
    wides: number;
    noBalls: number;
  } | null;
  fielding: {
    catches: number;
    runOuts: number;
    stumpings: number;
  } | null;
  awards: {
    playerOfMatch: boolean;
    bestBatter: boolean;
    bestBowler: boolean;
    bestFielder: boolean;
  };
};

export type PlayerAward = {
  id: UUID;
  matchId: UUID;
  matchName: string;
  matchDate: string;
  awardType: string;
};

export type PlayerMilestone = {
  id: UUID;
  milestoneType: string;
  achievedAt: string;
  matchId: UUID | null;
};

export type PlayerCoachNote = {
  id: UUID;
  matchId: UUID;
  matchName: string;
  matchDate: string;
  notes: string | null;
  coachName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlayerAttendanceSummary = {
  totalSessions: number;
  attended: number;
  absent: number;
  attendancePercentage: number;
  monthlyData: Array<{
    month: string;
    attended: number;
    total: number;
  }>;
};

type DrillAssignmentRow = {
  id: UUID;
  drillName: string;
  category: string;
  status: string;
  assignedAt: string;
  dueDate: string | null;
};

export type PlayerDrillSummary = {
  assigned: number;
  completed: number;
  pending: number;
  completionPercentage: number;
  /** Most recent 10 assignments regardless of status — an activity feed, not a full list. */
  recentAssignments: Array<DrillAssignmentRow>;
  /** Every assignment still pending, unsliced — for callers that need the real, complete list. */
  pendingAssignments: Array<DrillAssignmentRow>;
  /** Every completed assignment, unsliced. */
  completedAssignments: Array<DrillAssignmentRow>;
};

export type PlayerCareerHighlight = {
  type: string;
  label: string;
  value: string | null;
  matchId: UUID | null;
  matchName: string | null;
};

export type PlayerChartData = {
  runsByMatch: Array<{
    matchName: string;
    matchDate: string;
    runs: number;
  }>;
  wicketsByMatch: Array<{
    matchName: string;
    matchDate: string;
    wickets: number;
  }>;
  strikeRateTrend: Array<{
    matchName: string;
    matchDate: string;
    strikeRate: number;
  }>;
  economyTrend: Array<{
    matchName: string;
    matchDate: string;
    economy: number;
  }>;
  attendanceTrend: Array<{
    month: string;
    percentage: number;
  }>;
};
