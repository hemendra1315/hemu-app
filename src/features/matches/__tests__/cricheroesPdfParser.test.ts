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

  /**
   * The suite above feeds the parser text in a shape CricHeroes does not
   * produce, which is how a parser that could not read a single real
   * scorecard went on passing. This fixture is verbatim from an actual
   * CricHeroes PDF export (trimmed to two batters and two bowlers per
   * innings), so a regression against the real format fails here.
   */
  const REAL_CRICHEROES_EXPORT = `
ERS CHAMPIONS VS CHAMPIONS (League Matches)
 8/10/26, 7:52 AM   cricheroes.com   1 of 4
 Match Details
 Ground   JEPPIAAR ERS FLOODLIGHT GROUND,
Chennai
 Date   2026-07-29, 03:27 AM UTC
 Match Result
 Toss   Jeppiaar Cbse opt to bat
 Total   Jeppiaar Cbse 264/10   (46.0 Ov)
 Jeppiaar Matric 202/10   (45.4 Ov)
 Result   Jeppiaar Cbse won by 62 runs

 Jeppiaar Cbse 264/10 (46.0 Ov)   (1st Innings)   Kabilan (Jeppiaar Cbse)
No   Batsman   Status   R   B   M   4s   6s   SR
 1   Naraindra   (RHB)   run out Riswanth / Moulish   51   70   107   8   0   72.86
4   Kabilan (c)   (RHB)   lbw b Charan Abishek. M. R   75   73   91   10   2   102.74
9   Koushik S   (RHB)   not out   18   13   19   1   1   138.46
 Total: Overs 46.0, Wickets 10   264 (CRR: 5.74)
 No   Bowler   O   M   R   W   0s   4s   6s   WD   NB   Eco
 1   M. Rohith   4   0   28   0   15   6   0   0   0   7.00
5   Moulish   7   0   53   4   18   5   2   2   0   7.57

 Jeppiaar Matric 202/10 (45.4 Ov)   (2nd Innings)
No   Batsman   Status   R   B   M   4s   6s   SR
 1   Cheran   (RHB)   c Kabilan b Koushik S   14   15   34   2   0   93.33
3   Sakthivel .R (wk)   (LHB)   run out Naraindra / \u2020 Ajay   14   22   26   2   0   63.64
 Total: Overs 45.4, Wickets 10   202 (CRR: 4.42)
 No   Bowler   O   M   R   W   0s   4s   6s   WD   NB   Eco
 1   Koushik S   7.4   2   16   3   35   1   0   1   0   2.09
`;

  it('reads a real CricHeroes PDF export', () => {
    const r = parseCricHeroesText(REAL_CRICHEROES_EXPORT);

    // The date must come from Match Details, not the export stamp in the page
    // footer ("8/10/26") — that footer is what the loose parser latched onto,
    // dating every imported match to the day it was downloaded.
    expect(r.matchDate).toBe('2026-07-29');
    expect(r.matchName).toBe('ERS CHAMPIONS VS CHAMPIONS (League Matches)');
    expect(r.venue).toBe('JEPPIAAR ERS FLOODLIGHT GROUND');
    expect(r.matchType).toBe('league');
    // 46 overs an innings is not a T20, which is what the old default gave.
    expect(r.format).toBe('odi');
    expect(r.winningMargin).toBe('62 runs');

    expect(r.teamA.name).toBe('Jeppiaar Cbse');
    expect(r.teamA.score).toBe('264/10 (46.0 ov)');
    expect(r.teamB.name).toBe('Jeppiaar Matric');
    expect(r.teamB.score).toBe('202/10 (45.4 ov)');
    // Page 1's Match Result summary repeats both scores; only the two real
    // scorecards (marked "1st Innings" / "2nd Innings") may become innings.
    expect(r.innings).toHaveLength(2);

    const [firstInnings, secondInnings] = r.innings;
    expect(firstInnings?.batting).toHaveLength(3);
    expect(firstInnings?.bowling).toHaveLength(2);

    // "(c)" must not be mistaken for the dismissal "c" (caught) and cut the
    // name in half.
    const kabilan = firstInnings?.batting[1];
    expect(kabilan?.name).toBe('Kabilan');
    expect(kabilan?.runs).toBe(75);
    expect(kabilan?.balls).toBe(73);
    expect(kabilan?.fours).toBe(10);
    expect(kabilan?.sixes).toBe(2);
    expect(kabilan?.isOut).toBe(true);
    // Batting position comes from the scorecard's own numbering.
    expect(kabilan?.battingOrder).toBe(3);
    // The marker is removed from the name but the role it carried is kept, so
    // the import can tick the captain box instead of the user doing it.
    expect(kabilan?.isCaptain).toBe(true);
    expect(kabilan?.isWicketkeeper).toBe(false);

    const koushik = firstInnings?.batting[2];
    expect(koushik?.name).toBe('Koushik S');
    expect(koushik?.isOut).toBe(false);

    const moulish = firstInnings?.bowling[1];
    expect(moulish?.name).toBe('Moulish');
    expect(moulish?.overs).toBe('7');
    expect(moulish?.runsConceded).toBe(53);
    expect(moulish?.wickets).toBe(4);
    // Wides and no-balls sit after the dot-ball/boundary columns, not
    // immediately after wickets.
    expect(moulish?.wides).toBe(2);
    expect(moulish?.noBalls).toBe(0);

    // Fielding is credited from the dismissal text, which nothing did before,
    // so catches never reached a player's record.
    const catcher = secondInnings?.fielding.find((f) => f.name === 'Kabilan');
    expect(catcher?.catches).toBe(1);
    const keeper = secondInnings?.fielding.find((f) => f.name === 'Ajay');
    expect(keeper?.runOuts).toBe(1);

    const sakthivel = secondInnings?.batting.find((b) => b.name === 'Sakthivel .R');
    expect(sakthivel?.isWicketkeeper).toBe(true);
    expect(sakthivel?.isCaptain).toBe(false);
  });
});
