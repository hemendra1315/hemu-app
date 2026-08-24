import type { UUID } from '@/types';
import type { MatchFormat, MatchResult, MatchStatus, MatchType } from '@/types/enums';

export type Match = {
  id: UUID;
  academyId: UUID;
  matchName: string;
  matchDate: string;
  venue: string | null;
  opponentName: string | null;
  tournament: string | null;
  matchType: MatchType;
  format: MatchFormat;
  overs: number | null;
  teamScore: string | null;
  wicketsLost: number | null;
  oversPlayed: number | null;
  result: MatchResult | null;
  winningMargin: string | null;
  batchId: UUID | null;
  status: MatchStatus;
  createdBy: UUID | null;
  createdAt: string;
  updatedAt: string;
};

export type MatchLineup = {
  id: UUID;
  matchId: UUID;
  academyMemberId: UUID | null;
  battingOrder: number | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isWicketkeeper: boolean;
  isGuest?: boolean;
  guestName?: string | null;
  player: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

export type MatchBatting = {
  id: UUID;
  matchId: UUID;
  academyMemberId: UUID | null;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalType: string | null;
  battingOrder: number | null;
  isGuest?: boolean;
  guestName?: string | null;
  player: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

export type MatchBowling = {
  id: UUID;
  matchId: UUID;
  academyMemberId: UUID | null;
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  wides: number;
  noBalls: number;
  isGuest?: boolean;
  guestName?: string | null;
  player: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

export type MatchFielding = {
  id: UUID;
  matchId: UUID;
  academyMemberId: UUID | null;
  catches: number;
  runOuts: number;
  stumpings: number;
  isGuest?: boolean;
  guestName?: string | null;
  player: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

export type MatchPartnership = {
  id: UUID;
  matchId: UUID;
  batter1Id: UUID;
  batter2Id: UUID;
  runsAdded: number;
  wicketNumber: number | null;
  batter1: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
  batter2: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

export type MatchAwards = {
  id: UUID;
  matchId: UUID;
  playerOfMatchId: UUID | null;
  bestBatterId: UUID | null;
  bestBowlerId: UUID | null;
  bestFielderId: UUID | null;
  playerOfMatch: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  bestBatter: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  bestBowler: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  bestFielder: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
};

export type MatchCoachNote = {
  id: UUID;
  matchId: UUID;
  academyMemberId: UUID;
  coachId: UUID | null;
  notes: string | null;
  coach: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
};

export type PlayerStatistics = {
  id: UUID;
  academyId: UUID;
  playerId: UUID;
  matchesPlayed: number;
  battingInnings: number;
  battingRuns: number;
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
  player: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

export type PlayerMilestone = {
  id: UUID;
  academyId: UUID;
  playerId: UUID;
  milestoneType: string;
  matchId: UUID | null;
  achievedAt: string;
  player: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

export type AcademyRecord = {
  id: UUID;
  academyId: UUID;
  recordType: string;
  playerId: UUID | null;
  matchId: UUID | null;
  valueNumeric: number | null;
  valueText: string | null;
  achievedAt: string;
  player: {
    id: UUID;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
};

export type CreateMatchInput = {
  academyId: UUID;
  matchName: string;
  matchDate: string;
  venue?: string | null;
  opponentName?: string | null;
  tournament?: string | null;
  matchType: MatchType;
  format: MatchFormat;
  overs?: number | null;
  batchId?: UUID | null;
};

export type UpdateMatchInput = Omit<CreateMatchInput, 'academyId'>;

export type SaveMatchResultPayload = {
  match: {
    id?: UUID | null;
    matchName: string;
    matchDate: string;
    venue?: string | null;
    opponentName?: string | null;
    tournament?: string | null;
    matchType: MatchType;
    format: MatchFormat;
    overs?: number | null;
    teamScore?: string | null;
    wicketsLost?: number | null;
    oversPlayed?: number | null;
    result?: MatchResult | null;
    winningMargin?: string | null;
    batchId?: UUID | null;
  };
  lineups?: Array<{
    academyMemberId?: UUID | null;
    battingOrder?: number | null;
    isCaptain?: boolean;
    isViceCaptain?: boolean;
    isWicketkeeper?: boolean;
    isGuest?: boolean;
    guestName?: string | null;
  }>;
  batting?: Array<{
    academyMemberId?: UUID | null;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    isOut: boolean;
    dismissalType?: string | null;
    battingOrder?: number | null;
    isGuest?: boolean;
    guestName?: string | null;
  }>;
  bowling?: Array<{
    academyMemberId?: UUID | null;
    overs: number;
    maidens: number;
    runsConceded: number;
    wickets: number;
    wides: number;
    noBalls: number;
    isGuest?: boolean;
    guestName?: string | null;
  }>;
  fielding?: Array<{
    academyMemberId?: UUID | null;
    catches: number;
    runOuts: number;
    stumpings: number;
    isGuest?: boolean;
    guestName?: string | null;
  }>;
  partnerships?: Array<{
    batter1Id: UUID;
    batter2Id: UUID;
    runsAdded: number;
    wicketNumber?: number | null;
  }>;
  awards?: {
    playerOfMatchId?: UUID | null;
    bestBatterId?: UUID | null;
    bestBowlerId?: UUID | null;
    bestFielderId?: UUID | null;
  };
  notes?: Array<{
    academyMemberId: UUID;
    notes: string;
  }>;
};
