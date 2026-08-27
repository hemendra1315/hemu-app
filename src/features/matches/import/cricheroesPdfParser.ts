import type { MatchFormat, MatchResult, MatchType } from '@/types/enums';
import type { ExtractedInnings, ExtractedMatchData } from './cricheroesPdfTypes';
import { toIsoDate } from '@/lib/utils/date';

/**
 * Text-based CricHeroes PDF parser.
 * Works with raw text extracted from CricHeroes scorecard PDFs or client-side PDF text layers.
 */
export function parseCricHeroesText(text: string): ExtractedMatchData {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Bug 2 fix: initialize to '' so the firstLine fallback can run.
  // The final return uses `matchName || 'CricHeroes Match'` as the ultimate default.
  let matchName = '';
  let matchDate = toIsoDate(new Date());
  const venue = '';
  const tournament = '';
  let format: MatchFormat = 't20';
  const matchType: MatchType = 'friendly';
  let result: MatchResult = 'won';
  let winningMargin = '';

  let teamAName = 'Team A';
  let teamAScore = '';
  let teamBName = 'Team B';
  let teamBScore = '';

  const innings: ExtractedInnings[] = [];
  // Bug 1 fix: accumulate parse-quality warnings instead of fabricating data.
  const warnings: string[] = [];

  // Regexes reused for the firstLine heuristic (Bug 2)
  const scoreLine = /\d+\/\d+|\d+\s*\([\d.]+\)/;
  const dateLine = /\b\d{1,2}[-/]([A-Za-z]{3}|\d{1,2})[-/]\d{2,4}\b/;

  // 1. Extract Date (e.g. 15-Aug-2024 or 2024-08-15)
  const dateMatch = text.match(/\b(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{2,4})\b/);
  if (dateMatch) {
    try {
      const d = new Date(dateMatch[0]);
      if (!isNaN(d.getTime())) {
        // toIsoDate reads the date back in the academy's local timezone rather
        // than UTC: `new Date('15-Aug-2024')` parses as *local* midnight, so
        // anchoring the formatted string to UTC (the old `.toISOString()...`
        // here) rolled it back to the previous day for anyone east of UTC
        // (all of India). toIsoDate gives the same calendar day back for both
        // this local-midnight case and the UTC-midnight ISO-date-string case.
        const formatted = toIsoDate(d);
        if (formatted) matchDate = formatted;
      }
    } catch {
      // keep fallback
    }
  }

  // 2. Extract Result / Winner
  if (/won by/i.test(text)) {
    const resultLine = lines.find((l) => /won by/i.test(l));
    if (resultLine) {
      winningMargin = resultLine;
      if (/lost/i.test(resultLine)) result = 'lost';
      else if (/tie/i.test(resultLine)) result = 'tie';
      else if (/draw/i.test(resultLine)) result = 'draw';
      else result = 'won';
    }
  }

  // 3. Extract Format
  if (/t20/i.test(text)) format = 't20';
  else if (/odi/i.test(text)) format = 'odi';
  else if (/test/i.test(text)) format = 'test';
  else if (/t10/i.test(text)) format = 't10';

  // 4. Extract Innings & Scorecards
  // Search for Batting / Bowling sections in text
  let currentInnings: ExtractedInnings | null = null;
  let currentMode: 'none' | 'batting' | 'bowling' = 'none';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Detect Team Scores (e.g., "XI Stars 185/6 (20.0)")
    const scoreMatch = line.match(/^([A-Za-z0-9\s]+?)\s+(\d+\/\d+|\d+)\s*\(([\d.]+)\)/);
    if (scoreMatch) {
      const team = scoreMatch[1]?.trim() ?? '';
      const scoreVal = scoreMatch[2] ?? '';
      const oversVal = scoreMatch[3] ?? '';
      if (!teamAScore) {
        teamAName = team;
        teamAScore = `${scoreVal} (${oversVal} ov)`;
      } else if (!teamBScore && team !== teamAName) {
        teamBName = team;
        teamBScore = `${scoreVal} (${oversVal} ov)`;
      }
    }

    // Detect Innings Header / Batting Header
    if (/batting|scorecard/i.test(line) && !/bowling/i.test(line)) {
      currentMode = 'batting';
      if (!currentInnings) {
        currentInnings = {
          teamName: teamAName,
          runs: 0,
          wickets: 0,
          overs: '20.0',
          batting: [],
          bowling: [],
          fielding: [],
        };
        innings.push(currentInnings);
      }
      continue;
    }

    if (/bowling/i.test(line)) {
      currentMode = 'bowling';
      continue;
    }

    // Parse Batting Line (Name, Dismissal, Runs, Balls, 4s, 6s, SR)
    if (currentMode === 'batting' && currentInnings) {
      const batMatch = line.match(
        /^([A-Za-z\s]+?)\s+(c\s+[A-Za-z\s]+|b\s+[A-Za-z\s]+|lbw|not out|bowled|run out|retired)?\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i,
      );
      if (batMatch) {
        const name = batMatch[1]?.trim() ?? '';
        if (name && !/batsman|player|runs|balls/i.test(name)) {
          const dismissal = batMatch[2] ? batMatch[2].trim() : 'not out';
          const isOut = !/not out/i.test(dismissal);
          const runs = parseInt(batMatch[3] ?? '0', 10);
          const balls = parseInt(batMatch[4] ?? '0', 10);
          const fours = parseInt(batMatch[5] ?? '0', 10);
          const sixes = parseInt(batMatch[6] ?? '0', 10);

          currentInnings.batting.push({
            name,
            battingOrder: currentInnings.batting.length === 0 ? 0 : currentInnings.batting.length,
            runs,
            balls,
            fours,
            sixes,
            isOut,
            dismissalType: isOut ? dismissal : 'not_out',
          });
        }
      }
    }

    // Parse Bowling Line (Name, Overs, Maidens, Runs, Wickets, Wides, NoBalls)
    if (currentMode === 'bowling' && currentInnings) {
      const bowlMatch = line.match(
        /^([A-Za-z\s]+?)\s+([\d.]+)\s+(\d+)\s+(\d+)\s+(\d+)(?:\s+(\d+)\s+(\d+))?/,
      );
      if (bowlMatch) {
        const name = bowlMatch[1]?.trim() ?? '';
        if (name && !/bowler|overs|runs|wickets/i.test(name)) {
          currentInnings.bowling.push({
            name,
            overs: bowlMatch[2] ?? '0.0',
            maidens: parseInt(bowlMatch[3] ?? '0', 10),
            runsConceded: parseInt(bowlMatch[4] ?? '0', 10),
            wickets: parseInt(bowlMatch[5] ?? '0', 10),
            wides: bowlMatch[6] ? parseInt(bowlMatch[6], 10) : 0,
            noBalls: bowlMatch[7] ? parseInt(bowlMatch[7], 10) : 0,
          });
        }
      }
    }
  }

  // Bug 2 fix: use the first line as a title fallback — but only when it is not a
  // score line or a date line (those are data, not a human-readable match title).
  const firstLine = lines[0];
  if (firstLine && !matchName) {
    const isScoreLineCandidate = scoreLine.test(firstLine);
    const isDateLineCandidate = dateLine.test(firstLine);
    if (!isScoreLineCandidate && !isDateLineCandidate) {
      matchName = firstLine;
    }
  }

  // Bug 1 fix: emit warnings when scores could not be detected so the UI can
  // prompt the user to verify, rather than silently trusting fabricated values.
  if (!teamAScore) {
    warnings.push(`Score for "${teamAName}" could not be detected — please verify manually.`);
  }
  if (!teamBScore) {
    warnings.push(`Score for "${teamBName}" could not be detected — please verify manually.`);
  }

  return {
    matchName: matchName || 'CricHeroes Match',
    matchDate,
    venue,
    tournament,
    matchType,
    format,
    result,
    winningMargin,
    teamA: { name: teamAName, score: teamAScore },
    teamB: { name: teamBName, score: teamBScore },
    innings,
    warnings,
  };
}
