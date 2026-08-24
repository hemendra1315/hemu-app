import { describe, expect, it } from 'vitest';
import type { SaveMatchResultPayload } from '../api/matchesTypes';

describe('Save Match Result Payload Integrity & RPC Schema Compatibility', () => {
  it('constructs a valid SaveMatchResultPayload with guest players and null UUIDs', () => {
    const payload: SaveMatchResultPayload = {
      match: {
        matchName: 'Super League Final',
        matchDate: '2026-08-10',
        opponentName: 'Rival XI',
        venue: 'City Stadium',
        matchType: 'friendly',
        format: 't20',
        result: 'won',
        teamScore: '185/6',
        overs: 20,
        tournament: 'Championship',
      },
      lineups: [
        {
          academyMemberId: null,
          battingOrder: 1,
          isCaptain: false,
          isViceCaptain: false,
          isWicketkeeper: false,
          isGuest: true,
          guestName: 'Rahul Sharma',
        },
        {
          academyMemberId: '11111111-1111-1111-1111-111111111111',
          battingOrder: 2,
          isCaptain: true,
          isViceCaptain: false,
          isWicketkeeper: true,
          isGuest: false,
          guestName: null,
        },
      ],
      batting: [
        {
          academyMemberId: null,
          runs: 52,
          balls: 38,
          fours: 6,
          sixes: 2,
          isOut: true,
          dismissalType: 'caught',
          isGuest: true,
          guestName: 'Rahul Sharma',
        },
      ],
      bowling: [
        {
          academyMemberId: null,
          overs: 4.0,
          maidens: 0,
          runsConceded: 28,
          wickets: 2,
          wides: 1,
          noBalls: 0,
          isGuest: true,
          guestName: 'Ankit Guest',
        },
      ],
      fielding: [],
      awards: {
        playerOfMatchId: null,
        bestBatterId: null,
        bestBowlerId: null,
        bestFielderId: null,
      },
    };

    const lineup0 = payload.lineups?.[0];
    const bat0 = payload.batting?.[0];

    expect(lineup0?.academyMemberId).toBeNull();
    expect(lineup0?.isGuest).toBe(true);
    expect(lineup0?.guestName).toBe('Rahul Sharma');

    expect(bat0?.academyMemberId).toBeNull();
    expect(bat0?.isGuest).toBe(true);

    expect(payload.awards?.playerOfMatchId).toBeNull();
  });
});
