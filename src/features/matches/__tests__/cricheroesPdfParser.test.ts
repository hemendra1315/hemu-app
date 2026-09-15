import { describe, expect, it } from 'vitest';
import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseCricHeroesText } from '../import/cricheroesPdfParser';

describe('User PDF Scorecard Inspection', () => {
  it('extracts and parses the actual user uploaded PDF', async () => {
    const pdfPath =
      'C:\\Users\\SELVI\\.gemini\\antigravity\\brain\\7d2e2f1a-2984-4dd4-93d6-97c343a4f595\\.user_uploaded\\media_1789459682419.pdf';
    expect(fs.existsSync(pdfPath)).toBe(true);

    const buffer = fs.readFileSync(pdfPath);
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
    });

    const pdf = await loadingTask.promise;
    const pagesText: string[] = [];
    const allPageItems: unknown[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const items: { str: string; x: number; y: number; width: number; height: number }[] = [];
      for (const item of content.items) {
        if ('str' in item && typeof item.str === 'string' && item.str.trim().length > 0) {
          const transform = (item as { transform?: number[] }).transform ?? [1, 0, 0, 1, 0, 0];
          const x = transform[4] ?? 0;
          const y = transform[5] ?? 0;
          const width = (item as { width?: number }).width ?? 0;
          const height = (item as { height?: number }).height ?? (transform[0] || 10);
          items.push({ str: item.str, x, y, width, height });
        }
      }

      allPageItems.push({ pageNum, itemCount: items.length, sampleItems: items.slice(0, 30) });

      // Group items into lines based on Y coordinate with tolerance
      const ROW_TOLERANCE = 7.0;
      const rows: { str: string; x: number; y: number; width: number; height: number }[][] = [];

      items.sort((a, b) => b.y - a.y || a.x - b.x);

      for (const item of items) {
        let placed = false;
        for (const row of rows) {
          const avgY = row.reduce((sum, it) => sum + it.y, 0) / row.length;
          if (Math.abs(item.y - avgY) <= ROW_TOLERANCE) {
            row.push(item);
            placed = true;
            break;
          }
        }
        if (!placed) {
          rows.push([item]);
        }
      }

      rows.sort((r1, r2) => {
        const avgY1 = r1.reduce((s, it) => s + it.y, 0) / r1.length;
        const avgY2 = r2.reduce((s, it) => s + it.y, 0) / r2.length;
        return avgY2 - avgY1;
      });

      const pageLines = rows.map((row) => {
        row.sort((a, b) => a.x - b.x);
        return row
          .map((it) => it.str.trim())
          .filter(Boolean)
          .join(' ');
      });

      pagesText.push(pageLines.join('\n'));
    }

    const fullText = pagesText.join('\n');
    const parsed = parseCricHeroesText(fullText);

    expect(parsed.matchName).toBe('Jeppiaar Cbse vs Jeppiaar Matric');
    expect(parsed.teamA.name).toBe('Jeppiaar Cbse');
    expect(parsed.teamA.score).toBe('264/10');
    expect(parsed.teamB.name).toBe('Jeppiaar Matric');
    expect(parsed.teamB.score).toBe('202/10');
    expect(parsed.innings.length).toBe(2);

    expect(parsed.innings[0]?.teamName).toBe('Jeppiaar Cbse');
    expect(parsed.innings[0]?.batting.length).toBe(11);
    expect(parsed.innings[0]?.batting[0]?.name).toBe('Naraindra');
    expect(parsed.innings[0]?.batting[0]?.runs).toBe(51);
    expect(parsed.innings[0]?.batting[3]?.name).toBe('Kabilan');
    expect(parsed.innings[0]?.batting[3]?.runs).toBe(75);

    expect(parsed.innings[1]?.teamName).toBe('Jeppiaar Matric');
    expect(parsed.innings[1]?.batting.length).toBe(11);
  });

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

    // Verify fielding attribution extracted from dismissals
    const fielding = result.innings[0]?.fielding ?? [];
    expect(fielding.length).toBeGreaterThan(0);
    const ankitFielding = fielding.find((f) => f.name.toLowerCase() === 'ankit');
    expect(ankitFielding?.catches).toBe(1);
  });

  it('extracts match awards when present in text footer', () => {
    const textWithAwards = `
      Match: Academy Derby
      Date: 20-Aug-2024
      Thunderbolts 150/4 (20.0)
      Royals 140/8 (20.0)
      Thunderbolts won by 10 runs

      Player of the Match: Rahul Sharma
      Best Bowler: Vikram Patel
    `;

    const result = parseCricHeroesText(textWithAwards);
    expect(result.playerOfMatchName).toBe('Rahul Sharma');
    expect(result.bestBowlerName).toBe('Vikram Patel');
  });

  it('parses real-world CricHeroes scorecard with player roles, dots, LBW, and strike rates', () => {
    const cricHeroesRealText = `
      TOURNAMENT: Champions Cup 2025
      MATCH REPORT
      Date: 24 Jan 2025
      Ground: Wankhede Stadium

      Rising Stars Academy 198/4 (20.0 Ov)
      Super Kings CC 165/8 (20.0 Ov)
      Rising Stars Academy won by 33 runs

      1st Innings - Rising Stars Academy Batting
      V. Kohli (c) c S. Smith b Pat Cummins 76 44 8 3 172.73
      R. Sharma (wk) lbw b Mitchell Starc 34 20 4 2 170.00
      S. Gill run out (Maxwell / Stoinis) 45 28 5 1 160.71
      KL Rahul * not out 32 18 3 2 177.78

      Super Kings CC Bowling
      Mitchell Starc 4.0 0 38 1 9.50 2 0
      Pat Cummins (c) 4.0 1 24 1 6.00 0 0
      Adam Zampa 4.0 0 32 0 8.00 1 0

      2nd Innings - Super Kings CC Batting
      Travis Head c V. Kohli b Jasprit Bumrah 42 22 6 2 190.91
      David Warner b Mohammed Shami 18 12 2 1 150.00

      Player of the Match: V. Kohli
      Best Batter: V. Kohli
      Best Bowler: Pat Cummins
    `;

    const result = parseCricHeroesText(cricHeroesRealText);

    expect(result.tournament).toBe('Champions Cup 2025');
    expect(result.matchDate).toBe('2025-01-24');
    expect(result.venue).toBe('Wankhede Stadium');
    expect(result.teamA.name).toBe('Rising Stars Academy');
    expect(result.teamA.score).toContain('198/4');
    expect(result.teamB.name).toBe('Super Kings CC');
    expect(result.teamB.score).toContain('165/8');
    expect(result.result).toBe('won');
    expect(result.playerOfMatchName).toBe('V. Kohli');
    expect(result.bestBatterName).toBe('V. Kohli');
    expect(result.bestBowlerName).toBe('Pat Cummins');

    expect(result.innings.length).toBe(2);

    // First innings
    const inn1 = result.innings[0]!;
    expect(inn1.batting.length).toBe(4);
    expect(inn1.batting[0]?.name).toBe('V. Kohli');
    expect(inn1.batting[0]?.runs).toBe(76);
    expect(inn1.batting[0]?.balls).toBe(44);
    expect(inn1.batting[0]?.fours).toBe(8);
    expect(inn1.batting[0]?.sixes).toBe(3);
    expect(inn1.batting[0]?.strikeRate).toBe(172.73);
    expect(inn1.batting[0]?.isOut).toBe(true);

    expect(inn1.batting[1]?.name).toBe('R. Sharma');
    expect(inn1.batting[1]?.dismissalType).toContain('lbw');

    expect(inn1.batting[3]?.name).toBe('KL Rahul');
    expect(inn1.batting[3]?.isOut).toBe(false);

    expect(inn1.bowling.length).toBe(3);
    expect(inn1.bowling[0]?.name).toBe('Mitchell Starc');
    expect(inn1.bowling[0]?.overs).toBe('4.0');
    expect(inn1.bowling[0]?.wickets).toBe(1);
    expect(inn1.bowling[0]?.runsConceded).toBe(38);

    // Second innings
    const inn2 = result.innings[1]!;
    expect(inn2.batting.length).toBe(2);
    expect(inn2.batting[0]?.name).toBe('Travis Head');
    expect(inn2.batting[0]?.runs).toBe(42);
    expect(inn2.batting[1]?.name).toBe('David Warner');
    expect(inn2.batting[1]?.runs).toBe(18);
  });

  it('parses authentic CricHeroes PDF format with 6-number batting and 10-number bowling rows', () => {
    const jeppiaarMatchText = `
      ERS CHAMPIONS VS CHAMPIONS (League Matches)
      Jeppiaar Cbse 264/10 (46.0 Ov)
      Jeppiaar Matric 202/10 (45.4 Ov)
      Jeppiaar Cbse won by 62 runs
      Date: 27-Feb-2025
      Venue: Jeppiaar Ground
      Tournament: ERS CHAMPIONS TROPHY

      Jeppiaar Cbse 264/10 (46.0 Ov) (1st Innings)
      No Batsman Status R B M 4s 6s SR
      1 Naraindra (RHB) run out Riswanth / Moulish 51 70 107 8 0 72.86
      2 B.M.Rohith (LHB) c & b Sanjay 12 18 22 2 0 66.67
      3 Kaviraj (RHB) (c) c Sanjay b S.M.Rithish 88 95 120 12 1 92.63
      4 G.Abishek (RHB) (wk) not out 45 35 40 4 2 128.57

      Jeppiaar Matric Bowling
      No Bowler O M R W 0s 4s 6s WD NB Eco
      1 M. Rohith 4 0 28 0 15 6 0 0 0 7.00
      2 S.M.Rithish 9 1 42 1 35 5 0 2 0 4.67
      3 Sanjay 8 0 38 1 28 4 1 1 0 4.75

      Jeppiaar Matric 202/10 (45.4 Ov) (1st Innings)
      No Batsman Status R B M 4s 6s SR
      1 Riswanth (RHB) b Kaviraj 35 40 55 5 0 87.50
      2 Moulish (LHB) c Naraindra b B.M.Rohith 28 32 45 4 0 87.50

      Jeppiaar Cbse Bowling
      No Bowler O M R W 0s 4s 6s WD NB Eco
      1 Kaviraj 10 2 34 3 42 3 0 1 0 3.40
      2 B.M.Rohith 8 1 25 2 30 2 0 0 0 3.13

      Best Performances - Batsmen
      Players Name R B 4s 6s SR Team
      Kaviraj 88 95 12 1 92.63 Jeppiaar Cbse
      Naraindra 51 70 8 0 72.86 Jeppiaar Cbse

      Best Performances - Bowlers
      Players Name O M R W Eco Team
      Kaviraj 10.0 2 34 3 3.40 Jeppiaar Cbse
    `;

    const result = parseCricHeroesText(jeppiaarMatchText);

    expect(result.teamA.name).toBe('Jeppiaar Cbse');
    expect(result.teamA.score).toBe('264/10');
    expect(result.teamB.name).toBe('Jeppiaar Matric');
    expect(result.teamB.score).toBe('202/10');
    expect(result.result).toBe('won');
    expect(result.winningMargin).toContain('62 runs');
    expect(result.bestBatterName).toBe('Kaviraj');
    expect(result.bestBowlerName).toBe('Kaviraj');

    expect(result.innings.length).toBe(2);

    // Innings 1
    const inn1 = result.innings[0]!;
    expect(inn1.teamName).toBe('Jeppiaar Cbse');
    expect(inn1.batting.length).toBe(4);
    expect(inn1.batting[0]?.name).toBe('Naraindra');
    expect(inn1.batting[0]?.runs).toBe(51);
    expect(inn1.batting[0]?.balls).toBe(70);
    expect(inn1.batting[0]?.fours).toBe(8);
    expect(inn1.batting[0]?.sixes).toBe(0);
    expect(inn1.batting[0]?.strikeRate).toBe(72.86);

    expect(inn1.batting[2]?.name).toBe('Kaviraj');
    expect(inn1.batting[2]?.runs).toBe(88);
    expect(inn1.batting[2]?.fours).toBe(12);
    expect(inn1.batting[2]?.sixes).toBe(1);

    expect(inn1.batting[3]?.name).toBe('G.Abishek');
    expect(inn1.batting[3]?.isOut).toBe(false);

    expect(inn1.bowling.length).toBe(3);
    expect(inn1.bowling[0]?.name).toBe('M. Rohith');
    expect(inn1.bowling[0]?.overs).toBe('4');
    expect(inn1.bowling[0]?.runsConceded).toBe(28);
    expect(inn1.bowling[0]?.wickets).toBe(0);
    expect(inn1.bowling[0]?.economy).toBe(7);

    // Innings 2
    const inn2 = result.innings[1]!;
    expect(inn2.teamName).toBe('Jeppiaar Matric');
    expect(inn2.batting.length).toBe(2);
    expect(inn2.bowling.length).toBe(2);
    expect(inn2.bowling[0]?.name).toBe('Kaviraj');
    expect(inn2.bowling[0]?.wickets).toBe(3);
  });
});
