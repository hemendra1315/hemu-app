import { describe, it, expect } from 'vitest';
import { parseCricHeroesCsv } from '../import/cricheroesCsvParser';

describe('CricHeroes CSV Scorecard Parser', () => {
  it('parses standard sectioned cricket scorecard CSV', () => {
    const csvData = `
Match Name, Strikers vs Royals Final
Date, 15-Aug-2024
Venue, Wankhede Stadium
Format, T20
Result, Strikers won by 24 runs

[Team A], Strikers Cricket Academy
[Batting]
Batter, Dismissal, Runs, Balls, 4s, 6s, SR
Rohit Sharma, c Khan b Patel, 64, 42, 6, 3, 152.3
Virat Kohli, not out, 52, 35, 4, 1, 148.5
Hardik Pandya, b Ahmed, 28, 14, 2, 2, 200.0
Total, 185/6, (20.0 Ov)

[Bowling]
Bowler, Overs, Maidens, Runs, Wickets, Wides, NoBalls
Jasprit Bumrah, 4.0, 1, 18, 3, 1, 0
Mohammed Shami, 4.0, 0, 32, 2, 2, 0
Ravindra Jadeja, 4.0, 0, 24, 1, 0, 0

[Fielding]
Fielder, Catches, RunOuts, Stumpings
Ravindra Jadeja, 2, 1, 0
MS Dhoni, 1, 0, 1
`;

    const parsed = parseCricHeroesCsv(csvData);

    expect(parsed.matchName).toBe('Strikers vs Royals Final');
    expect(parsed.matchDate).toBe('2024-08-15');
    expect(parsed.venue).toBe('Wankhede Stadium');
    expect(parsed.format).toBe('t20');
    expect(parsed.result).toBe('won');
    expect(parsed.winningMargin).toContain('Strikers won by 24 runs');

    expect(parsed.innings.length).toBeGreaterThan(0);
    const inn = parsed.innings[0]!;
    expect(inn.teamName).toBe('Strikers Cricket Academy');
    expect(inn.batting.length).toBe(3);
    expect(inn.batting[0]!.name).toBe('Rohit Sharma');
    expect(inn.batting[0]!.runs).toBe(64);
    expect(inn.batting[0]!.fours).toBe(6);
    expect(inn.batting[0]!.sixes).toBe(3);
    expect(inn.batting[0]!.isOut).toBe(true);
    expect(inn.batting[1]!.name).toBe('Virat Kohli');
    expect(inn.batting[1]!.isOut).toBe(false);

    expect(inn.bowling.length).toBe(3);
    expect(inn.bowling[0]!.name).toBe('Jasprit Bumrah');
    expect(inn.bowling[0]!.wickets).toBe(3);
    expect(inn.bowling[0]!.maidens).toBe(1);

    expect(inn.fielding.length).toBe(2);
    expect(inn.fielding[0]!.name).toBe('Ravindra Jadeja');
    expect(inn.fielding[0]!.catches).toBe(2);
    expect(inn.fielding[0]!.runOuts).toBe(1);
  });

  it('handles tab-delimited and semicolon-delimited CSV formats', () => {
    const tsvData = `Match\tTitans vs Warriors\nFormat\tODI\nResult\tTitans won by 5 wickets\nBatter\tDismissal\tRuns\tBalls\t4s\t6s\nGill\tnot out\t85\t72\t8\t2`;
    const parsed = parseCricHeroesCsv(tsvData);

    expect(parsed.matchName).toBe('Titans vs Warriors');
    expect(parsed.format).toBe('odi');
    expect(parsed.innings[0]?.batting[0]?.name).toBe('Gill');
    expect(parsed.innings[0]?.batting[0]?.runs).toBe(85);
  });

  it('gracefully handles missing columns and warns without crashing', () => {
    const minimalCsv = `Match, Friendly Game\nBatter, Runs\nPlayer One, 25`;
    const parsed = parseCricHeroesCsv(minimalCsv);

    expect(parsed.matchName).toBe('Friendly Game');
    expect(parsed.innings[0]?.batting[0]?.name).toBe('Player One');
    expect(parsed.innings[0]?.batting[0]?.runs).toBe(25);
  });
});
