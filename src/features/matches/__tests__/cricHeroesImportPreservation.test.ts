import { describe, expect, it } from 'vitest';
import type { UUID } from '@/types';
import {
  type ExtractedMatchData,
  type MappedPlayer,
  getDefaultOversForFormat,
} from '../import/cricheroesPdfTypes';
import type { WizardState } from '../components/wizard/types';

describe('CricHeroes PDF Import to WizardState Preservation', () => {
  it('preserves imported scorecard arrays, guest flags, and guest names into WizardState payload', () => {
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
        {
          teamName: 'Academy XI',
          runs: 180,
          wickets: 4,
          overs: '20.0',
          batting: [
            {
              name: 'Guest Striker',
              battingOrder: 0,
              runs: 75,
              balls: 42,
              fours: 8,
              sixes: 4,
              isOut: true,
              dismissalType: 'caught',
            },
          ],
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
          fielding: [],
        },
      ],
      warnings: [],
    };

    const mappedPlayers: MappedPlayer[] = [
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
    ];

    // Simulate CricHeroesImportModal mapping transformation
    const playerLookup = new Map(mappedPlayers.map((p) => [p.cricheroesName.toLowerCase(), p]));
    const academyInnings = extracted.innings[0];

    const lineup = mappedPlayers
      .filter((p) => !p.isIgnored)
      .map((p, idx) => ({
        memberId: (p.isGuest ? `guest_${idx}` : p.academyMemberId) as unknown as UUID,
        fullName: p.isGuest ? p.cricheroesName : p.academyMemberName,
        email: '',
        avatarUrl: null,
        battingOrder: idx + 1,
        isCaptain: false,
        isViceCaptain: false,
        isWicketkeeper: false,
        isGuest: p.isGuest,
        guestName: p.isGuest ? p.cricheroesName : null,
      }));

    const batting = (academyInnings?.batting || []).map((b) => {
      const mapped = playerLookup.get(b.name.toLowerCase());
      const isGuest = mapped?.isGuest ?? true;
      return {
        memberId: (isGuest ? `guest_${b.name}` : mapped?.academyMemberId) as unknown as UUID,
        runs: b.runs,
        balls: b.balls,
        fours: b.fours,
        sixes: b.sixes,
        isOut: b.isOut,
        dismissalType: b.dismissalType,
        isGuest,
        guestName: isGuest ? b.name : null,
      };
    });

    const bowling = (academyInnings?.bowling || []).map((b) => {
      const mapped = playerLookup.get(b.name.toLowerCase());
      const isGuest = mapped?.isGuest ?? true;
      return {
        memberId: (isGuest ? `guest_${b.name}` : mapped?.academyMemberId) as unknown as UUID,
        overs: b.overs,
        maidens: b.maidens,
        runsConceded: b.runsConceded,
        wickets: b.wickets,
        wides: b.wides,
        noBalls: b.noBalls,
        isGuest,
        guestName: isGuest ? b.name : null,
      };
    });

    const state: WizardState = {
      matchName: extracted.matchName,
      matchDate: extracted.matchDate,
      opponentName: extracted.opponentName || '',
      venue: extracted.venue,
      matchType: extracted.matchType,
      format: extracted.format,
      result: extracted.result,
      teamScore: extracted.teamA.score,
      overs: '20.0',
      tournament: extracted.tournament,
      selectedPlayerIds: lineup.map((l) => l.memberId),
      lineup,
      batting,
      bowling,
      fielding: [],
      awards: {
        playerOfMatchId: null,
        bestBatterId: null,
        bestBowlerId: null,
        bestFielderId: null,
      },
    };

    const bat0 = state.batting[0];
    const bowl0 = state.bowling[0];

    expect(state.batting.length).toBe(1);
    expect(bat0?.isGuest).toBe(true);
    expect(bat0?.guestName).toBe('Guest Striker');
    expect(bat0?.runs).toBe(75);

    expect(state.bowling.length).toBe(1);
    expect(bowl0?.isGuest).toBe(true);
    expect(bowl0?.guestName).toBe('Guest Bowler');
    expect(bowl0?.wickets).toBe(3);
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
