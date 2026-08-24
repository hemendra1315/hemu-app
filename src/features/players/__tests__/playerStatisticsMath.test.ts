import { describe, expect, it } from 'vitest';

describe('Cricket Player Statistics Mathematics Verification', () => {
  it('calculates batting average correctly with not-outs (Runs / (Innings - NotOuts))', () => {
    const innings = 2;
    const notOuts = 1;
    const runs = 60;

    const dismissals = innings - notOuts;
    const average = dismissals > 0 ? runs / dismissals : runs;

    expect(dismissals).toBe(1);
    expect(average).toBe(60.0);
  });

  it('calculates strike rate accurately using total balls faced', () => {
    const runs = 80;
    const ballsFaced = 50;

    const strikeRate = (runs / ballsFaced) * 100;
    expect(strikeRate).toBe(160.0);
  });

  it('handles 0 balls faced or 0 overs without producing NaN or Infinity', () => {
    const runs = 0;
    const balls = 0;
    const overs = 0;

    const strikeRate = balls > 0 ? (runs / balls) * 100 : 0;
    const economy = overs > 0 ? runs / overs : 0;

    expect(strikeRate).toBe(0);
    expect(economy).toBe(0);
    expect(Number.isNaN(strikeRate)).toBe(false);
    expect(Number.isNaN(economy)).toBe(false);
  });

  it('aggregates multi-match stats correctly', () => {
    const match1 = { runs: 30, balls: 20, wickets: 2, overs: 4 };
    const match2 = { runs: 50, balls: 40, wickets: 1, overs: 4 };

    const totalRuns = match1.runs + match2.runs;
    const totalBalls = match1.balls + match2.balls;
    const totalWickets = match1.wickets + match2.wickets;
    const totalOvers = match1.overs + match2.overs;

    expect(totalRuns).toBe(80);
    expect(totalBalls).toBe(60);
    expect(totalWickets).toBe(3);
    expect(totalOvers).toBe(8);
  });
});
