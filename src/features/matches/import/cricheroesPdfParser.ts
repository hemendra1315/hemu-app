import type { MatchFormat, MatchResult, MatchType } from '@/types/enums';
import type {
  ExtractedBatter,
  ExtractedBowler,
  ExtractedFielder,
  ExtractedInnings,
  ExtractedMatchData,
} from './cricheroesPdfTypes';
import { toIsoDate } from '@/lib/utils/date';

/**
 * CricHeroes scorecard parser.
 *
 * Two parsers live here, tried in order:
 *
 *  1. `parseStructuredScorecard` — the layout CricHeroes actually exports.
 *     Every batting and bowling row is numbered, the columns are headed
 *     `No Batsman Status R B M 4s 6s SR` and `No Bowler O M R W ...`, and
 *     scores are written `264/10 (46.0 Ov)`.
 *  2. `parseLooseText` — the original heuristic pass, kept unchanged for
 *     hand-pasted text and `.txt` exports that have no column structure.
 *
 * The structured pass exists because the heuristic one, checked against a real
 * CricHeroes PDF for the first time, extracted nothing usable from it: not one
 * of the 22 batting rows, no bowling figures, no team names and no scores. It
 * had been written against an imagined layout — its own unit test supplied
 * text in a shape CricHeroes does not produce — so it looked healthy while
 * being unable to read the only files it will ever be given. Two details did
 * it: the heuristic waits for a line containing "Batting" before reading
 * batters (CricHeroes writes "Batsman"), and its row pattern requires a line
 * to begin with a letter (CricHeroes numbers every row).
 */
export function parseCricHeroesText(text: string): ExtractedMatchData {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return parseStructuredScorecard(lines, text) ?? parseLooseText(lines, text);
}

// ─── Structured CricHeroes export ───────────────────────────────────────────

/** `Jeppiaar Cbse 264/10 (46.0 Ov)` — also opens each innings' scorecard. */
const INNINGS_HEADER = /^(.+?)\s+(\d+)\/(\d+)\s+\((\d+(?:\.\d+)?)\s*Ov\)/i;

/** `1 Naraindra run out Riswanth / Moulish 51 70 107 8 0 72.86 (RHB)` */
const BATTER_ROW =
  /^(\d{1,2})\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)(?:\s*\((?:RHB|LHB)\))?\s*$/i;

/** `1 M. Rohith 4 0 28 0 15 6 0 0 0 7.00` — O M R W 0s 4s 6s WD NB Eco */
const BOWLER_ROW =
  /^(\d{1,2})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s*$/;

/** `Total: Overs 46.0, Wickets 10 264 (CRR: 5.74)` */
const TOTAL_ROW = /^Total:\s*Overs\s+(\d+(?:\.\d+)?)\s*,\s*Wickets\s+(\d+)\s+(\d+)/i;

const BATTING_COLUMNS = /^No\s+Batsman\b/i;
const BOWLING_COLUMNS = /^No\s+Bowler\b/i;

/**
 * How a batter's innings ended, as CricHeroes writes it. Used to find where
 * the player's name stops and the dismissal begins, since the two are run
 * together in one column.
 */
const DISMISSAL_TOKEN =
  /\b(c&b|c|b|lbw|st|run\s+out|not\s+out|retired(?:\s+hurt)?|hit\s+wicket|absent)\b/gi;

/** Captaincy and keeper markers, stripped before looking for the dismissal. */
const ROLE_MARKER = /\(\s*(?:c|wk|vc|c\s*&\s*wk)\s*\)/gi;

const NOT_DISMISSED = /^(not\s+out|absent|did\s+not\s+bat|dnb|retired\s+hurt)/i;

function splitNameAndDismissal(raw: string): { name: string; dismissal: string } {
  // "(c)" would otherwise be read as the dismissal "c" (caught) and cut the
  // name in half, so remove role markers before searching.
  const cleaned = raw.replace(ROLE_MARKER, ' ').replace(/\s+/g, ' ').trim();

  DISMISSAL_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DISMISSAL_TOKEN.exec(cleaned)) !== null) {
    // A dismissal at index 0 would leave no name at all — which happens for a
    // player whose name genuinely begins with "B" or "C", so keep looking.
    if (match.index > 0) {
      const name = cleaned
        .slice(0, match.index)
        .replace(/[.,\s]+$/, '')
        .trim();
      const dismissal = cleaned.slice(match.index).trim();
      if (name) return { name, dismissal };
    }
  }
  return { name: cleaned.replace(/[.,\s]+$/, '').trim(), dismissal: '' };
}

/**
 * Credits fielders from the dismissal text: `c Cheran b Moulish` is a catch
 * for Cheran, `st †Sakthivel .R b Riswanth` a stumping, and
 * `run out Riswanth / Moulish` a run-out shared between two. Nothing
 * populated the fielding table before, so catches never reached a player's
 * record even though the scorecard names who took them.
 */
function creditFielders(dismissal: string, into: Map<string, ExtractedFielder>): void {
  const add = (rawName: string, kind: 'catches' | 'runOuts' | 'stumpings') => {
    const name = rawName
      .replace(/[†*]/g, '')
      .replace(/[.,\s]+$/, '')
      .trim();
    if (name.length < 2) return;
    const entry = into.get(name) ?? { name, catches: 0, runOuts: 0, stumpings: 0 };
    entry[kind] += 1;
    into.set(name, entry);
  };

  const caught = dismissal.match(/^c\s+(?!&)(.+?)\s+b\s+/i);
  if (caught?.[1]) add(caught[1], 'catches');

  // "c&b Bowler" — the bowler caught it off their own bowling.
  const caughtAndBowled = dismissal.match(/^c&b\s+(.+)$/i);
  if (caughtAndBowled?.[1]) add(caughtAndBowled[1], 'catches');

  const stumped = dismissal.match(/^st\s+†?\s*(.+?)\s+b\s+/i);
  if (stumped?.[1]) add(stumped[1], 'stumpings');

  const runOut = dismissal.match(/^run\s+out\s+(.+)$/i);
  if (runOut?.[1]) {
    for (const part of runOut[1].split('/')) add(part, 'runOuts');
  }
}

function formatFromOvers(overs: number): MatchFormat {
  if (!overs) return 'custom';
  if (overs <= 10) return 't10';
  if (overs <= 20) return 't20';
  if (overs <= 50) return 'odi';
  return 'test';
}

function matchTypeFromTitle(title: string): MatchType {
  if (/\btournament\b|\bcup\b|\btrophy\b|\bchampionship\b/i.test(title)) return 'tournament';
  if (/\bleague\b/i.test(title)) return 'league';
  if (/\bpractice\b|\bnets\b/i.test(title)) return 'practice';
  return 'friendly';
}

function parseStructuredScorecard(lines: string[], text: string): ExtractedMatchData | null {
  // Only claim this text if it really is a CricHeroes export.
  if (!lines.some((l) => BATTING_COLUMNS.test(l) || BOWLING_COLUMNS.test(l))) return null;

  const warnings: string[] = [];
  const innings: ExtractedInnings[] = [];

  let current: ExtractedInnings | null = null;
  let fielders = new Map<string, ExtractedFielder>();
  let mode: 'none' | 'batting' | 'bowling' = 'none';

  const closeInnings = () => {
    if (current) current.fielding = [...fielders.values()];
  };

  for (const line of lines) {
    const header = line.match(INNINGS_HEADER);
    if (header) {
      closeInnings();
      fielders = new Map();
      current = {
        teamName: header[1]?.trim() ?? '',
        runs: Number(header[2] ?? 0),
        wickets: Number(header[3] ?? 0),
        overs: header[4] ?? '',
        batting: [],
        bowling: [],
        fielding: [],
      };
      innings.push(current);
      mode = 'none';
      continue;
    }

    if (BATTING_COLUMNS.test(line)) {
      mode = 'batting';
      continue;
    }
    if (BOWLING_COLUMNS.test(line)) {
      mode = 'bowling';
      continue;
    }

    const total = line.match(TOTAL_ROW);
    if (total && current) {
      current.overs = total[1] ?? current.overs;
      current.wickets = Number(total[2] ?? current.wickets);
      current.runs = Number(total[3] ?? current.runs);
      continue;
    }

    if (!current) continue;

    if (mode === 'batting') {
      const row = line.match(BATTER_ROW);
      if (row) {
        const { name, dismissal } = splitNameAndDismissal(row[2] ?? '');
        if (!name) continue;
        const isOut = Boolean(dismissal) && !NOT_DISMISSED.test(dismissal);
        const batter: ExtractedBatter = {
          name,
          // CricHeroes prints the batting position in the first column, which
          // beats inferring it from row order.
          battingOrder: Number(row[1] ?? 1) - 1,
          runs: Number(row[3] ?? 0),
          balls: Number(row[4] ?? 0),
          // row[5] is minutes at the crease, which this app does not store.
          fours: Number(row[6] ?? 0),
          sixes: Number(row[7] ?? 0),
          strikeRate: Number(row[8] ?? 0),
          isOut,
          dismissalType: isOut ? dismissal : 'not_out',
        };
        current.batting.push(batter);
        if (isOut) creditFielders(dismissal, fielders);
      }
      continue;
    }

    if (mode === 'bowling') {
      const row = line.match(BOWLER_ROW);
      if (row) {
        const name = (row[2] ?? '').replace(/[.,\s]+$/, '').trim();
        if (!name) continue;
        const bowler: ExtractedBowler = {
          name,
          overs: row[3] ?? '0.0',
          maidens: Number(row[4] ?? 0),
          runsConceded: Number(row[5] ?? 0),
          wickets: Number(row[6] ?? 0),
          // row[7]–row[9] are dot balls, fours and sixes conceded.
          wides: Number(row[10] ?? 0),
          noBalls: Number(row[11] ?? 0),
          economy: Number(row[12] ?? 0),
        };
        current.bowling.push(bowler);
      }
    }
  }
  closeInnings();

  if (innings.length === 0) return null;

  const title = lines[0] ?? '';
  const first = innings[0];
  const second = innings[1];

  // Prefer the full ISO timestamp CricHeroes prints in Match Details. The
  // loose parser's d/m/y pattern latches onto the export date in the page
  // footer instead, dating every imported match to the day it was downloaded.
  let matchDate = toIsoDate(new Date());
  const isoDate = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDate) {
    matchDate = `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  } else {
    warnings.push('Match date could not be read from the PDF — please check it.');
  }

  let result: MatchResult = 'won';
  let winningMargin = '';
  const resultLine = lines.find((l) => /\bwon by\b/i.test(l));
  if (resultLine) {
    const parts = resultLine.match(/^(.*?)\s+won by\s+(.+?)(?:\s+Result)?$/i);
    winningMargin = parts?.[2]?.trim() ?? '';
    const winner = parts?.[1]?.trim();
    if (winner) {
      warnings.push(
        `Recorded as a win for "${winner}" — switch the result to Lost if that is not your team.`,
      );
    }
  } else if (/\bmatch tied\b/i.test(text)) {
    result = 'tie';
  } else if (/\bmatch drawn\b/i.test(text)) {
    result = 'draw';
  } else {
    result = 'no_result';
    warnings.push('No result line found in the PDF — please set the result manually.');
  }

  let venue = '';
  const groundLine = lines.find((l) => /\bGround\s*$/i.test(l) && l.length > 8);
  if (groundLine) {
    venue = groundLine
      .replace(/\s*Ground\s*$/i, '')
      .replace(/[,\s]+$/, '')
      .trim();
  }

  const tournament = title.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() ?? '';

  for (const inn of innings) {
    if (inn.batting.length === 0) {
      warnings.push(`No batting rows could be read for "${inn.teamName}".`);
    }
    if (inn.bowling.length === 0) {
      warnings.push(`No bowling rows could be read against "${inn.teamName}".`);
    }
  }

  return {
    matchName: title || 'CricHeroes Match',
    matchDate,
    venue,
    tournament,
    matchType: matchTypeFromTitle(title),
    format: formatFromOvers(Number(first?.overs ?? 0)),
    result,
    winningMargin,
    teamA: {
      name: first?.teamName ?? 'Team A',
      score: first ? `${first.runs}/${first.wickets} (${first.overs} ov)` : '',
    },
    teamB: {
      name: second?.teamName ?? 'Team B',
      score: second ? `${second.runs}/${second.wickets} (${second.overs} ov)` : '',
    },
    innings,
    warnings,
  };
}

// ─── Loose text fallback (original heuristic pass) ──────────────────────────

/**
 * Best-effort reader for text with no CricHeroes column structure — a
 * copy-paste, or a `.txt` export. Left as it was so those inputs behave
 * exactly as before.
 */
function parseLooseText(lines: string[], text: string): ExtractedMatchData {
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
  const warnings: string[] = [];

  const scoreLine = /\d+\/\d+|\d+\s*\([\d.]+\)/;
  const dateLine = /\b\d{1,2}[-/]([A-Za-z]{3}|\d{1,2})[-/]\d{2,4}\b/;

  const dateMatch = text.match(/\b(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{2,4})\b/);
  if (dateMatch) {
    try {
      const d = new Date(dateMatch[0]);
      if (!isNaN(d.getTime())) {
        // toIsoDate reads the date back in the academy's local timezone rather
        // than UTC, so a locally-parsed midnight isn't rolled back a day.
        const formatted = toIsoDate(d);
        if (formatted) matchDate = formatted;
      }
    } catch {
      // keep fallback
    }
  }

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

  if (/t20/i.test(text)) format = 't20';
  else if (/odi/i.test(text)) format = 'odi';
  else if (/test/i.test(text)) format = 'test';
  else if (/t10/i.test(text)) format = 't10';

  let currentInnings: ExtractedInnings | null = null;
  let currentMode: 'none' | 'batting' | 'bowling' = 'none';

  for (const line of lines) {
    if (!line) continue;

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

    if (currentMode === 'batting' && currentInnings) {
      const batMatch = line.match(
        /^([A-Za-z\s]+?)\s+(c\s+[A-Za-z\s]+|b\s+[A-Za-z\s]+|lbw|not out|bowled|run out|retired)?\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i,
      );
      if (batMatch) {
        const name = batMatch[1]?.trim() ?? '';
        if (name && !/batsman|player|runs|balls/i.test(name)) {
          const dismissal = batMatch[2] ? batMatch[2].trim() : 'not out';
          const isOut = !/not out/i.test(dismissal);
          currentInnings.batting.push({
            name,
            battingOrder: currentInnings.batting.length === 0 ? 0 : currentInnings.batting.length,
            runs: parseInt(batMatch[3] ?? '0', 10),
            balls: parseInt(batMatch[4] ?? '0', 10),
            fours: parseInt(batMatch[5] ?? '0', 10),
            sixes: parseInt(batMatch[6] ?? '0', 10),
            isOut,
            dismissalType: isOut ? dismissal : 'not_out',
          });
        }
      }
    }

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

  const firstLine = lines[0];
  if (firstLine && !matchName) {
    if (!scoreLine.test(firstLine) && !dateLine.test(firstLine)) {
      matchName = firstLine;
    }
  }

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
