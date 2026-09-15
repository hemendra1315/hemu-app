import { describe, it, expect } from 'vitest';
import { calculateMatchMvp } from '../import/cricketMvpCalculator';
import type { MatchPlayerLineup } from '../components/wizard/types';
import type { UUID } from '@/types';

describe('Cricket MVP & Impact Calculator', () => {
  const mockLineup: MatchPlayerLineup[] = [
    {
      memberId: 'p1' as UUID,
      fullName: 'Rohit Sharma',
      email: 'rohit@cricket.com',
      avatarUrl: null,
      battingOrder: 1,
      isCaptain: true,
      isViceCaptain: false,
      isWicketkeeper: false,
    },
    {
      memberId: 'p2' as UUID,
      fullName: 'Jasprit Bumrah',
      email: 'bumrah@cricket.com',
      avatarUrl: null,
      battingOrder: 2,
      isCaptain: false,
      isViceCaptain: true,
      isWicketkeeper: false,
    },
    {
      memberId: 'p3' as UUID,
      fullName: 'Ravindra Jadeja',
      email: 'jadeja@cricket.com',
      avatarUrl: null,
      battingOrder: 3,
      isCaptain: false,
      isViceCaptain: false,
      isWicketkeeper: false,
    },
  ];

  it('correctly calculates batting impact points, milestones and boundaries', () => {
    const batting = [
      {
        memberId: 'p1' as UUID,
        runs: 75,
        balls: 45,
        fours: 8,
        sixes: 4,
        isOut: true,
        dismissalType: 'caught',
      },
    ];

    const result = calculateMatchMvp(mockLineup, batting, [], []);

    // 75 runs + (8*1 fours) + (4*2 sixes) + (50+ milestone: 8) + (SR 166.7 >= 150: 10) = 75 + 8 + 8 + 8 + 10 = 109
    const p1 = result.leaderboard.find((p) => p.memberId === 'p1');
    expect(p1).toBeDefined();
    expect(p1!.battingPoints).toBe(109);
    expect(result.bestBatter?.memberId).toBe('p1');
  });

  it('correctly calculates bowling points, wickets, maidens and economy bonuses', () => {
    const bowling = [
      {
        memberId: 'p2' as UUID,
        overs: '4.0',
        maidens: 1,
        runsConceded: 16,
        wickets: 4,
        wides: 0,
        noBalls: 0,
      },
    ];

    const result = calculateMatchMvp(mockLineup, [], bowling, []);

    // (4 * 25 wickets = 100) + (1 * 8 maiden = 8) + (3-fer bonus = 8) + (econ 4.0 <= 4.5: 10) = 126
    const p2 = result.leaderboard.find((p) => p.memberId === 'p2');
    expect(p2).toBeDefined();
    expect(p2!.bowlingPoints).toBe(126);
    expect(result.bestBowler?.memberId).toBe('p2');
  });

  it('correctly calculates fielding points (catches, stumpings, run-outs)', () => {
    const fielding = [
      {
        memberId: 'p3' as UUID,
        catches: 2,
        stumpings: 1,
        runOuts: 1,
        runOutsDirect: 1,
        runOutsAssisted: 0,
      },
    ];

    const result = calculateMatchMvp(mockLineup, [], [], fielding);

    // (2 * 8 catches = 16) + (1 * 12 stump = 12) + (1 * 12 run-out = 12) = 40
    const p3 = result.leaderboard.find((p) => p.memberId === 'p3');
    expect(p3).toBeDefined();
    expect(p3!.fieldingPoints).toBe(40);
    expect(result.bestFielder?.memberId).toBe('p3');
  });

  it('accurately ranks allrounders combining batting, bowling and fielding for MVP', () => {
    const batting = [
      {
        memberId: 'p3' as UUID,
        runs: 45,
        balls: 25,
        fours: 4,
        sixes: 2,
        isOut: false,
        dismissalType: 'not_out',
      },
      {
        memberId: 'p1' as UUID,
        runs: 35,
        balls: 30,
        fours: 3,
        sixes: 0,
        isOut: true,
        dismissalType: 'bowled',
      },
    ];
    const bowling = [
      {
        memberId: 'p3' as UUID,
        overs: '4.0',
        maidens: 0,
        runsConceded: 22,
        wickets: 2,
        wides: 1,
        noBalls: 0,
      },
    ];
    const fielding = [
      {
        memberId: 'p3' as UUID,
        catches: 1,
        stumpings: 0,
        runOuts: 0,
        runOutsDirect: 0,
        runOutsAssisted: 0,
      },
    ];

    const result = calculateMatchMvp(mockLineup, batting, bowling, fielding);

    expect(result.playerOfMatch?.memberId).toBe('p3');
    expect(result.bestBatter?.memberId).toBe('p3');
    expect(result.bestBowler?.memberId).toBe('p3');
    expect(result.bestFielder?.memberId).toBe('p3');
  });
});
