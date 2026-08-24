import { describe, expect, it } from 'vitest';
import { parseCricHeroesText } from '../import/cricheroesPdfParser';

describe('CricHeroes PDF Text Parser', () => {
  it('extracts match metadata, teams, scores and innings data correctly', () => {
    const sampleText = `
      Match: Super League T20 Final
      Date: 15-Aug-2024
      City Cricket Ground, T20 Format

      Thunderbolts XI 185/6 (20.0)
      Lightning Cricket Club 172/9 (20.0)

      Thunderbolts XI won by 13 runs

      Thunderbolts XI Batting
      Rahul Sharma c Ankit b Patel 52 38 6 2
      Hemu Kumar b Sharma 45 28 5 3
      Arjun Verma not out 30 15 3 1

      Lightning Cricket Club Bowling
      Ankit Sharma 4.0 0 32 2 1 0
      Vikram Patel 4.0 0 28 1 0 0
    `;

    const result = parseCricHeroesText(sampleText);

    expect(result.format).toBe('t20');
    expect(result.result).toBe('won');
    expect(result.teamA.name).toBe('Thunderbolts XI');
    expect(result.teamA.score).toContain('185/6');

    expect(result.innings.length).toBeGreaterThan(0);
    const batting = result.innings[0]?.batting ?? [];
    expect(batting.length).toBe(3);
    const b0 = batting[0];
    const b2 = batting[2];
    expect(b0?.name).toBe('Rahul Sharma');
    expect(b0?.runs).toBe(52);
    expect(b0?.balls).toBe(38);
    expect(b0?.isOut).toBe(true);

    expect(b2?.name).toBe('Arjun Verma');
    expect(b2?.isOut).toBe(false);
  });
});
