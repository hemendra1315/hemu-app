import { describe, expect, it } from 'vitest';
import type { UUID } from '@/types';
import {
  type ExtractedInnings,
  type ExtractedMatchData,
  type MappedPlayer,
  getDefaultOversForFormat,
} from '../import/cricheroesPdfTypes';
import { buildImportWizardState } from '../import/buildImportWizardState';

/**
 * These tests used to hold a hand-copied duplicate of the import's transform
 * and assert against that copy, so they agreed with the modal no matter what
 * either of them did. Four defects lived through it untouched:
 *
 *   1. `fielding: []` was hardcoded, so catches, stumpings and run-outs never
 *      reached a player's record through an import.
 *   2. The lineup was built from every name on the scorecard, both sides of
 *      it — twenty-five players on an eleven-player team.
 *   3. Bowling was read from the same innings as the batting. An innings lists
 *      the bowlers who *opposed* the batting side, so this saved the
 *      opposition's figures against academy players.
 *   4. Guest ids were `guest_<array index>` in the lineup and `guest_<name>`
 *      in the scorecard rows, so a guest's own batting row pointed at nobody.
 *
 * They now call the real function.
 */

const ACADEMY_MEMBER_ID = '11111111-1111-4111-8111-111111111111' as UUID;

function innings(over: Partial<ExtractedInnings>): ExtractedInnings {
  return {
    teamName: 'Team',
    runs: 0,
    wickets: 0,
    overs: '20.0',
    batting: [],
    bowling: [],
    fielding: [],
    ...over,
  };
}

/**
 * Academy XI bat first. Their bowlers and fielders therefore appear in the
 * *second* innings, opposite the Rival XI batters — that is how a scorecard is
 * laid out, and getting it backwards is defect 3 above.
 */
const extracted: ExtractedMatchData = {
  matchName: 'IPL T20 Final',
  matchDate: '2026-08-10',
  venue: 'National Stadium',
  opponentName: 'Rival XI',
  tournament: 'Summer Cup',
  matchType: 'tournament',
  format: 't20',
  result: 'won',
  winningMargin: '20 runs',
  teamA: { name: 'Academy XI', score: '180/4 (20.0)' },
  teamB: { name: 'Rival XI', score: '160/9 (20.0)' },
  innings: [
    innings({
      teamName: 'Academy XI',
      runs: 180,
      wickets: 4,
      batting: [
        {
          name: 'Academy Captain',
          battingOrder: 0,
          runs: 75,
          balls: 42,
          fours: 8,
          sixes: 4,
          isOut: true,
          dismissalType: 'c Rival Keeper b Rival Bowler',
          isCaptain: true,
        },
        {
          name: 'Guest Striker',
          battingOrder: 3,
          runs: 20,
          balls: 15,
          fours: 2,
          sixes: 0,
          isOut: false,
          dismissalType: 'not_out',
        },
      ],
      // The bowlers in Academy XI's innings belong to Rival XI.
      bowling: [
        {
          name: 'Rival Bowler',
          overs: '4.0',
          maidens: 0,
          runsConceded: 50,
          wickets: 1,
          wides: 3,
          noBalls: 1,
        },
      ],
      fielding: [{ name: 'Rival Keeper', catches: 1, runOuts: 0, stumpings: 0 }],
    }),
    innings({
      teamName: 'Rival XI',
      runs: 160,
      wickets: 9,
      batting: [
        {
          name: 'Rival Opener',
          battingOrder: 0,
          runs: 30,
          balls: 25,
          fours: 4,
          sixes: 0,
          isOut: true,
          dismissalType: 'c Academy Captain b Guest Bowler',
        },
      ],
      // ...and these belong to Academy XI.
      bowling: [
        {
          name: 'Guest Bowler',
          overs: '4.0',
          maidens: 1,
          runsConceded: 20,
          wickets: 3,
          wides: 1,
          noBalls: 0,
        },
      ],
      fielding: [{ name: 'Academy Captain', catches: 2, runOuts: 1, stumpings: 0 }],
    }),
  ],
  warnings: [],
};

const mappedPlayers: MappedPlayer[] = [
  {
    cricheroesName: 'Academy Captain',
    isGuest: false,
    isIgnored: false,
    confidenceScore: 100,
    status: 'exact_match',
    academyMemberId: ACADEMY_MEMBER_ID,
    academyMemberName: 'Academy Captain',
  },
  {
    cricheroesName: 'Guest Striker',
    isGuest: true,
    isIgnored: false,
    confidenceScore: 0,
    status: 'guest_player',
    academyMemberId: null,
    academyMemberName: null,
  },
  {
    cricheroesName: 'Guest Bowler',
    isGuest: true,
    isIgnored: false,
    confidenceScore: 0,
    status: 'guest_player',
    academyMemberId: null,
    academyMemberName: null,
  },
  {
    cricheroesName: 'Rival Bowler',
    isGuest: true,
    isIgnored: false,
    confidenceScore: 0,
    status: 'guest_player',
    academyMemberId: null,
    academyMemberName: null,
  },
  {
    cricheroesName: 'Rival Opener',
    isGuest: true,
    isIgnored: false,
    confidenceScore: 0,
    status: 'guest_player',
    academyMemberId: null,
    academyMemberName: null,
  },
];

function build() {
  return buildImportWizardState({
    extracted,
    mappedPlayers,
    selectedAcademyTeamId: 'A',
    opponentName: 'Rival XI',
  });
}

describe('CricHeroes import to WizardState', () => {
  it('keeps the scorecard rows, guest flags and guest names', () => {
    const state = build();

    const striker = state.batting.find((b) => b.guestName === 'Guest Striker');
    expect(striker?.runs).toBe(20);
    expect(striker?.isGuest).toBe(true);

    const bowler = state.bowling.find((b) => b.guestName === 'Guest Bowler');
    expect(bowler?.wickets).toBe(3);
    expect(bowler?.isGuest).toBe(true);
  });

  it('carries fielding through instead of dropping it', () => {
    const state = build();

    expect(state.fielding.length).toBeGreaterThan(0);
    const keeper = state.fielding.find((f) => f.memberId === ACADEMY_MEMBER_ID);
    expect(keeper?.catches).toBe(2);
    expect(keeper?.runOuts).toBe(1);

    // The opposition's fielder was in the *first* innings and must not be here.
    expect(state.fielding.some((f) => f.guestName === 'Rival Keeper')).toBe(false);
  });

  it('puts only the academy team in the lineup', () => {
    const state = build();

    const names = state.lineup.map((l) => l.guestName ?? l.fullName);
    expect(names).toContain('Academy Captain');
    expect(names).toContain('Guest Striker');
    expect(names).toContain('Guest Bowler');
    expect(names).not.toContain('Rival Bowler');
    expect(names).not.toContain('Rival Opener');
  });

  it('takes bowling from the innings the team bowled in, not the one it batted in', () => {
    const state = build();

    expect(state.bowling.map((b) => b.guestName)).toEqual(['Guest Bowler']);
    // Conceding 50 off 4 was the opposition's spell, not the academy's.
    expect(state.bowling.some((b) => b.runsConceded === 50)).toBe(false);
  });

  it('gives a guest the same id everywhere so their rows join up', () => {
    const state = build();

    const lineupEntry = state.lineup.find((l) => l.guestName === 'Guest Striker');
    const battingEntry = state.batting.find((b) => b.guestName === 'Guest Striker');
    expect(lineupEntry?.memberId).toBe(battingEntry?.memberId);

    const bowlLineup = state.lineup.find((l) => l.guestName === 'Guest Bowler');
    const bowlEntry = state.bowling.find((b) => b.guestName === 'Guest Bowler');
    expect(bowlLineup?.memberId).toBe(bowlEntry?.memberId);
  });

  it("uses the scorecard's own batting positions and the captain marker", () => {
    const state = build();

    const captain = state.lineup.find((l) => l.memberId === ACADEMY_MEMBER_ID);
    expect(captain?.isCaptain).toBe(true);
    expect(captain?.battingOrder).toBe(0);

    const striker = state.lineup.find((l) => l.guestName === 'Guest Striker');
    expect(striker?.battingOrder).toBe(3);
  });

  it('infers correct default overs for match formats', () => {
    expect(getDefaultOversForFormat('t20')).toBe('20.0');
    expect(getDefaultOversForFormat('odi')).toBe('50.0');
    expect(getDefaultOversForFormat('t10')).toBe('10.0');
    expect(getDefaultOversForFormat('test')).toBe('');
    expect(getDefaultOversForFormat('custom')).toBe('');
    expect(getDefaultOversForFormat(undefined)).toBe('');
  });
});
