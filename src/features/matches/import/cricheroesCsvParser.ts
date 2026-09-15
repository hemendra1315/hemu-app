import type { MatchFormat, MatchResult, MatchType } from '@/types/enums';
import type {
  ExtractedBatter,
  ExtractedBowler,
  ExtractedFielder,
  ExtractedInnings,
  ExtractedMatchData,
} from './cricheroesPdfTypes';

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

function parseDateSafely(raw: string): string | null {
  const clean = raw.trim();
  const nameMonthMatch = clean.match(/\b(\d{1,2})[-/]([A-Za-z]{3,9})[-/](\d{2,4})\b/);
  if (nameMonthMatch) {
    const d = nameMonthMatch[1]!.padStart(2, '0');
    const mStr = nameMonthMatch[2]!.slice(0, 3).toLowerCase();
    const m = MONTH_MAP[mStr];
    let y = nameMonthMatch[3]!;
    if (y.length === 2) y = `20${y}`;
    if (m) return `${y}-${m}-${d}`;
  }
  const isoMatch = clean.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]!.padStart(2, '0')}-${isoMatch[3]!.padStart(2, '0')}`;
  }
  const numMatch = clean.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (numMatch) {
    const d = numMatch[1]!.padStart(2, '0');
    const m = numMatch[2]!.padStart(2, '0');
    let y = numMatch[3]!;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }
  return null;
}

/**
 * Parses raw CSV content (either CricHeroes CSV exports or generic cricket scorecard CSVs).
 * Supports standard comma, semicolon, or tab-delimited files.
 */
export function parseCricHeroesCsv(csvText: string): ExtractedMatchData {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let matchName = 'CricHeroes Match';
  let matchDate = new Date().toISOString().split('T')[0] ?? '';
  let venue = '';
  let tournament = '';
  let format: MatchFormat = 't20';
  const matchType: MatchType = 'friendly';
  let result: MatchResult = 'won';
  let winningMargin = '';
  let teamAName = 'Team A';
  let teamAScore = '';
  let teamBName = 'Team B';
  let teamBScore = '';

  const warnings: string[] = [];
  const battingA: ExtractedBatter[] = [];
  const bowlingA: ExtractedBowler[] = [];
  const fieldingA: ExtractedFielder[] = [];

  const battingB: ExtractedBatter[] = [];
  const bowlingB: ExtractedBowler[] = [];
  const fieldingB: ExtractedFielder[] = [];

  let currentSection: 'meta' | 'batting_a' | 'bowling_a' | 'batting_b' | 'bowling_b' | 'fielding' =
    'meta';
  let currentTeamIndex: 'A' | 'B' = 'A';

  // Helper to split row by comma or tab or semicolon
  function splitRow(row: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === ',' || char === '\t' || char === ';') && !inQuotes) {
        tokens.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    tokens.push(current.trim());
    return tokens;
  }

  let battingColMap: {
    name: number;
    dismissal: number;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
  } = {
    name: 0,
    dismissal: 1,
    runs: 2,
    balls: 3,
    fours: 4,
    sixes: 5,
  };

  let bowlingColMap: {
    name: number;
    overs: number;
    maidens: number;
    runs: number;
    wickets: number;
    wides: number;
    noBalls: number;
  } = {
    name: 0,
    overs: 1,
    maidens: 2,
    runs: 3,
    wickets: 4,
    wides: 5,
    noBalls: 6,
  };

  let fieldingColMap: { name: number; catches: number; runOuts: number; stumpings: number } = {
    name: 0,
    catches: 1,
    runOuts: 2,
    stumpings: 3,
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const row = splitRow(rawLine);
    const firstCell = (row[0] || '').toLowerCase().replace(/[[\]]/g, '').trim();
    const joined = row.join(' ').toLowerCase().replace(/[[\]]/g, '').trim();

    // 1. Meta fields detection
    if (
      firstCell === 'match' ||
      firstCell === 'match name' ||
      firstCell === 'match title' ||
      (firstCell.includes('match') && (firstCell.includes('title') || firstCell.includes('name')))
    ) {
      if (row[1]) matchName = row[1].trim();
      continue;
    }
    if (firstCell.includes('date')) {
      const parsedDate = row[1] || '';
      const normalized = parseDateSafely(parsedDate);
      if (normalized) {
        matchDate = normalized;
      }
      continue;
    }
    if (firstCell.includes('venue') || firstCell.includes('ground')) {
      venue = row[1] || '';
      continue;
    }
    if (firstCell.includes('tournament') || firstCell.includes('series')) {
      tournament = row[1] || '';
      continue;
    }
    if (firstCell.includes('format')) {
      const f = (row[1] || '').toLowerCase();
      if (f.includes('t20')) format = 't20';
      else if (f.includes('odi') || f.includes('50')) format = 'odi';
      else if (f.includes('test')) format = 'test';
      else if (f.includes('t10') || f.includes('10')) format = 't10';
      continue;
    }
    if (
      firstCell.includes('result') ||
      joined.includes('won by') ||
      joined.includes('match tied')
    ) {
      const resText = row[1] || joined;
      winningMargin = resText;
      if (resText.includes('won')) result = 'won';
      else if (resText.includes('lost')) result = 'lost';
      else if (resText.includes('tie') || resText.includes('tied')) result = 'tie';
      else if (resText.includes('draw')) result = 'draw';
      continue;
    }

    // 2. Section Header switches
    if (
      joined.includes('team a') ||
      joined.includes('1st innings') ||
      joined.includes('first innings')
    ) {
      currentTeamIndex = 'A';
      if (row[1]) teamAName = row[1].replace(/[[\]]/g, '').trim();
      continue;
    }
    if (
      joined.includes('team b') ||
      joined.includes('2nd innings') ||
      joined.includes('second innings')
    ) {
      currentTeamIndex = 'B';
      if (row[1]) teamBName = row[1].replace(/[[\]]/g, '').trim();
      continue;
    }

    if (
      joined.includes('batting') ||
      (joined.includes('batter') && (joined.includes('runs') || joined.includes('r')))
    ) {
      currentSection = currentTeamIndex === 'A' ? 'batting_a' : 'batting_b';
    }
    if (
      joined.includes('bowling') ||
      (joined.includes('bowler') && (joined.includes('overs') || joined.includes('o')))
    ) {
      currentSection = currentTeamIndex === 'A' ? 'bowling_a' : 'bowling_b';
    }
    if (joined.includes('fielding') || joined.includes('catches')) {
      currentSection = 'fielding';
    }

    // Dynamic Header Detection & Column Mapping
    const rowLower = row.map((c) => c.toLowerCase().trim());
    if (rowLower.some((c) => /^(batter|batsman|player|name)$/i.test(c))) {
      const nameIdx = rowLower.findIndex((c) => /^(batter|batsman|player|name)$/i.test(c));
      const disIdx = rowLower.findIndex((c) => /^(dismissal|how out|status)$/i.test(c));
      const runsIdx = rowLower.findIndex((c) => /^(runs|r|score)$/i.test(c));
      const ballsIdx = rowLower.findIndex((c) => /^(balls|b)$/i.test(c));
      const foursIdx = rowLower.findIndex((c) => /^(4s|fours|4)$/i.test(c));
      const sixesIdx = rowLower.findIndex((c) => /^(6s|sixes|6)$/i.test(c));

      battingColMap = {
        name: nameIdx !== -1 ? nameIdx : 0,
        dismissal: disIdx,
        runs: runsIdx !== -1 ? runsIdx : disIdx !== -1 ? 2 : 1,
        balls: ballsIdx !== -1 ? ballsIdx : disIdx !== -1 ? 3 : 2,
        fours: foursIdx !== -1 ? foursIdx : disIdx !== -1 ? 4 : 3,
        sixes: sixesIdx !== -1 ? sixesIdx : disIdx !== -1 ? 5 : 4,
      };
      if (currentSection === 'meta') {
        currentSection = currentTeamIndex === 'A' ? 'batting_a' : 'batting_b';
      }
      continue;
    }

    if (
      rowLower.some((c) => /^(bowler)$/i.test(c)) ||
      (rowLower.includes('overs') && rowLower.includes('wickets'))
    ) {
      const nameIdx = rowLower.findIndex((c) => /^(bowler|player|name)$/i.test(c));
      const oversIdx = rowLower.findIndex((c) => /^(overs|o|ov)$/i.test(c));
      const maidensIdx = rowLower.findIndex((c) => /^(maidens|m)$/i.test(c));
      const runsIdx = rowLower.findIndex((c) => /^(runs|r|runs conceded|rc)$/i.test(c));
      const wicketsIdx = rowLower.findIndex((c) => /^(wickets|w|wkts)$/i.test(c));
      const widesIdx = rowLower.findIndex((c) => /^(wides|wd)$/i.test(c));
      const noBallsIdx = rowLower.findIndex((c) => /^(noballs|no balls|nb)$/i.test(c));

      bowlingColMap = {
        name: nameIdx !== -1 ? nameIdx : 0,
        overs: oversIdx !== -1 ? oversIdx : 1,
        maidens: maidensIdx !== -1 ? maidensIdx : 2,
        runs: runsIdx !== -1 ? runsIdx : 3,
        wickets: wicketsIdx !== -1 ? wicketsIdx : 4,
        wides: widesIdx !== -1 ? widesIdx : 5,
        noBalls: noBallsIdx !== -1 ? noBallsIdx : 6,
      };
      if (currentSection === 'meta' || currentSection.startsWith('batting')) {
        currentSection = currentTeamIndex === 'A' ? 'bowling_a' : 'bowling_b';
      }
      continue;
    }

    if (
      rowLower.includes('fielder') ||
      (rowLower.includes('catches') && rowLower.includes('runouts'))
    ) {
      const nameIdx = rowLower.findIndex((c) => /^(fielder|player|name)$/i.test(c));
      const catchesIdx = rowLower.findIndex((c) => /^(catches|c)$/i.test(c));
      const runOutsIdx = rowLower.findIndex((c) => /^(runouts|run outs|ro)$/i.test(c));
      const stumpingsIdx = rowLower.findIndex((c) => /^(stumpings|st)$/i.test(c));

      fieldingColMap = {
        name: nameIdx !== -1 ? nameIdx : 0,
        catches: catchesIdx !== -1 ? catchesIdx : 1,
        runOuts: runOutsIdx !== -1 ? runOutsIdx : 2,
        stumpings: stumpingsIdx !== -1 ? stumpingsIdx : 3,
      };
      currentSection = 'fielding';
      continue;
    }

    // 3. Score summary rows (e.g. "Total, 185/6, (20.0 Ov)")
    if (firstCell.includes('total') || firstCell.includes('score')) {
      const scoreVal = row[1] || '';
      const oversVal = row[2] || '';
      const formatted = `${scoreVal} ${oversVal}`.trim();
      if (currentTeamIndex === 'A' && !teamAScore) {
        teamAScore = formatted;
      } else if (currentTeamIndex === 'B' && !teamBScore) {
        teamBScore = formatted;
      }
      continue;
    }

    // Skip section headers that have no data
    if (firstCell === 'batting' || firstCell === 'bowling' || firstCell === 'fielding') {
      continue;
    }

    // 4. Data parsing based on section
    if (currentSection === 'batting_a' || currentSection === 'batting_b') {
      const name = row[battingColMap.name];
      if (name && name.length >= 2 && !/total|extras|dnb|did not bat/i.test(name)) {
        const dismissal =
          battingColMap.dismissal !== -1 ? row[battingColMap.dismissal] || 'not out' : 'not out';
        const isOut = !/not out/i.test(dismissal);
        const runs = parseInt(row[battingColMap.runs] || '0', 10) || 0;
        const balls = parseInt(row[battingColMap.balls] || '0', 10) || 0;
        const fours = parseInt(row[battingColMap.fours] || '0', 10) || 0;
        const sixes = parseInt(row[battingColMap.sixes] || '0', 10) || 0;
        const targetList = currentSection === 'batting_a' ? battingA : battingB;

        targetList.push({
          name,
          battingOrder: targetList.length + 1,
          runs,
          balls,
          fours,
          sixes,
          isOut,
          dismissalType: isOut ? dismissal : 'not_out',
        });
      }
    } else if (currentSection === 'bowling_a' || currentSection === 'bowling_b') {
      const name = row[bowlingColMap.name];
      if (name && name.length >= 2 && !/total|extras/i.test(name)) {
        const overs = row[bowlingColMap.overs] || '0.0';
        const maidens = parseInt(row[bowlingColMap.maidens] || '0', 10) || 0;
        const runsConceded = parseInt(row[bowlingColMap.runs] || '0', 10) || 0;
        const wickets = parseInt(row[bowlingColMap.wickets] || '0', 10) || 0;
        const wides = parseInt(row[bowlingColMap.wides] || '0', 10) || 0;
        const noBalls = parseInt(row[bowlingColMap.noBalls] || '0', 10) || 0;
        const targetList = currentSection === 'bowling_a' ? bowlingA : bowlingB;

        targetList.push({
          name,
          overs,
          maidens,
          runsConceded,
          wickets,
          wides,
          noBalls,
        });
      }
    } else if (currentSection === 'fielding') {
      const name = row[fieldingColMap.name];
      if (name && name.length >= 2) {
        const catches = parseInt(row[fieldingColMap.catches] || '0', 10) || 0;
        const runOuts = parseInt(row[fieldingColMap.runOuts] || '0', 10) || 0;
        const stumpings = parseInt(row[fieldingColMap.stumpings] || '0', 10) || 0;
        fieldingA.push({
          name,
          catches,
          runOuts,
          stumpings,
        });
      }
    }
  }

  // Calculate team scores from batting if missing
  if (!teamAScore && battingA.length > 0) {
    const totalRuns = battingA.reduce((sum, b) => sum + b.runs, 0);
    const wickets = battingA.filter((b) => b.isOut).length;
    teamAScore = `${totalRuns}/${wickets}`;
  }
  if (!teamBScore && battingB.length > 0) {
    const totalRuns = battingB.reduce((sum, b) => sum + b.runs, 0);
    const wickets = battingB.filter((b) => b.isOut).length;
    teamBScore = `${totalRuns}/${wickets}`;
  }

  // Construct Innings structures
  const innings: ExtractedInnings[] = [];
  if (battingA.length > 0 || bowlingA.length > 0) {
    innings.push({
      teamName: teamAName,
      runs: parseInt(teamAScore.split('/')[0] || '0', 10) || 0,
      wickets: parseInt(teamAScore.split('/')[1] || '0', 10) || 0,
      overs: '20.0',
      batting: battingA,
      bowling: bowlingA,
      fielding: fieldingA,
    });
  }
  if (battingB.length > 0 || bowlingB.length > 0) {
    innings.push({
      teamName: teamBName,
      runs: parseInt(teamBScore.split('/')[0] || '0', 10) || 0,
      wickets: parseInt(teamBScore.split('/')[1] || '0', 10) || 0,
      overs: '20.0',
      batting: battingB,
      bowling: bowlingB,
      fielding: fieldingB,
    });
  }

  if (innings.length === 0) {
    warnings.push('No innings data could be identified in the CSV file.');
  }

  return {
    matchName: matchName || 'CricHeroes CSV Match',
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
