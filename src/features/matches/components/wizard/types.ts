import type { UUID } from '@/types';
import type { MatchFormat, MatchResult, MatchType } from '@/types/enums';

/** Sentinel batting_order value meaning "Opening" */
export const BATTING_ORDER_OPENING = 0;

export type WizardLineupEntry = {
  memberId: UUID;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  battingOrder: number; // 0 = Opening, 1–N = numbered
  isCaptain: boolean;
  isViceCaptain: boolean;
  isWicketkeeper: boolean;
  isGuest?: boolean;
  guestName?: string | null;
};

export type WizardBattingEntry = {
  memberId: UUID;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalType: string;
  isGuest?: boolean;
  guestName?: string | null;
};

export type WizardBowlingEntry = {
  memberId: UUID;
  overs: string; // stored as string during entry, e.g. "4.2"
  maidens: number;
  runsConceded: number;
  wickets: number;
  wides: number;
  noBalls: number;
  isGuest?: boolean;
  guestName?: string | null;
};

export type WizardFieldingEntry = {
  memberId: UUID;
  catches: number;
  runOuts: number;
  stumpings: number;
  isGuest?: boolean;
  guestName?: string | null;
};

export type WizardAwards = {
  playerOfMatchId: UUID | null;
  bestBatterId: UUID | null;
  bestBowlerId: UUID | null;
  bestFielderId: UUID | null;
};

export type WizardState = {
  // Step 1 — Match details
  matchName: string;
  matchDate: string;
  opponentName: string;
  venue: string;
  matchType: MatchType;
  format: MatchFormat;
  result: MatchResult;
  teamScore: string;
  overs: string;
  tournament: string;

  // Step 2 — Selected player IDs
  selectedPlayerIds: UUID[];

  // Step 3 — Lineup (batting order + roles)
  lineup: WizardLineupEntry[];

  // Step 4 — Scorecard
  batting: WizardBattingEntry[];
  bowling: WizardBowlingEntry[];
  fielding: WizardFieldingEntry[];

  // Step 5 — Awards (optional)
  awards: WizardAwards;
};

export const INITIAL_WIZARD_STATE: WizardState = {
  matchName: '',
  matchDate: new Date().toISOString().split('T')[0] ?? '',
  opponentName: '',
  venue: '',
  matchType: 'friendly',
  format: 't20',
  result: 'won',
  teamScore: '',
  overs: '',
  tournament: '',
  selectedPlayerIds: [],
  lineup: [],
  batting: [],
  bowling: [],
  fielding: [],
  awards: {
    playerOfMatchId: null,
    bestBatterId: null,
    bestBowlerId: null,
    bestFielderId: null,
  },
};

export type WizardStep =
  'details' | 'players' | 'batting-order' | 'scorecard' | 'awards' | 'review';

export const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: 'details', label: 'Match Details' },
  { id: 'players', label: 'Select Players' },
  { id: 'batting-order', label: 'Batting Order' },
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'awards', label: 'Awards' },
  { id: 'review', label: 'Review & Save' },
];
