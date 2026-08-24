import type { UUID } from '@/types';
import type { MatchFormat, MatchResult, MatchType } from '@/types/enums';

export type ExtractedBatter = {
  name: string;
  battingOrder: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate?: number;
  isOut: boolean;
  dismissalType: string;
};

export type ExtractedBowler = {
  name: string;
  overs: string; // e.g. "4.2"
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy?: number;
  wides: number;
  noBalls: number;
};

export type ExtractedFielder = {
  name: string;
  catches: number;
  runOuts: number;
  stumpings: number;
};

export type ExtractedInnings = {
  teamName: string;
  runs: number;
  wickets: number;
  overs: string;
  batting: ExtractedBatter[];
  bowling: ExtractedBowler[];
  fielding: ExtractedFielder[];
};

export type ExtractedMatchData = {
  matchName: string;
  matchDate: string; // YYYY-MM-DD
  opponentName?: string;
  venue: string;
  tournament: string;
  matchType: MatchType;
  format: MatchFormat;
  result: MatchResult;
  winningMargin: string;
  teamA: { name: string; score: string };
  teamB: { name: string; score: string };
  innings: ExtractedInnings[];
  /** Parse-quality warnings. Non-empty when data could not be confidently extracted and needs manual verification. */
  warnings: string[];
  playerOfMatchName?: string;
  bestBatterName?: string;
  bestBowlerName?: string;
  bestFielderName?: string;
};

export type PlayerMappingStatus =
  | 'exact_match'
  | 'high_confidence'
  | 'low_confidence'
  | 'manual_matched'
  | 'guest_player'
  | 'ignored';

export type MappedPlayer = {
  cricheroesName: string;
  cricheroesPlayerId?: string | null;
  academyMemberId: UUID | null; // null if guest or ignored
  academyMemberName: string | null;
  confidenceScore: number; // 0-100
  status: PlayerMappingStatus;
  isGuest: boolean;
  isIgnored: boolean;
  savedMapping?: boolean;
  initialRole?: 'batter' | 'bowler' | 'allrounder';
};

export type MatchImportState = {
  extractedData: ExtractedMatchData | null;
  selectedAcademyTeamName: string | null;
  selectedOpponentName: string | null;
  mappedPlayers: MappedPlayer[];
  isPossibleDuplicate: boolean;
  duplicateMatchName?: string;
};

export function getDefaultOversForFormat(format?: MatchFormat): string {
  switch (format) {
    case 't20':
      return '20.0';
    case 'odi':
      return '50.0';
    case 't10':
      return '10.0';
    case 'test':
    case 'custom':
    default:
      return '';
  }
}
