import type { MatchFormat, MatchResult, MatchType } from '@/types/enums';
import type { ExtractedInnings, ExtractedMatchData } from './cricheroesPdfTypes';

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
  const isoMatch = clean.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const nameMonthMatch = clean.match(/\b(\d{1,2})[-/\s]+([A-Za-z]{3,9})[-/\s,]+(\d{2,4})\b/);
  if (nameMonthMatch && nameMonthMatch[1] && nameMonthMatch[2] && nameMonthMatch[3]) {
    const d = nameMonthMatch[1].padStart(2, '0');
    const mStr = nameMonthMatch[2].slice(0, 3).toLowerCase();
    const m = MONTH_MAP[mStr];
    let y = nameMonthMatch[3];
    if (y.length === 2) y = `20${y}`;
    if (m) return `${y}-${m}-${d}`;
  }
  const numMatch = clean.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (numMatch && numMatch[1] && numMatch[2] && numMatch[3]) {
    const d = numMatch[1].padStart(2, '0');
    const m = numMatch[2].padStart(2, '0');
    let y = numMatch[3];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }
  return null;
}

function cleanPlayerName(raw: string): string {
  return raw
    .replace(/^[\d.)\s-]+/, '') // remove leading numbers like "1. ", "01 ", "1 "
    .replace(/\s*\((?:RHB|LHB|OB|LB|LBG|RF|LF|RMF|LMF|RAM|LAM|RAF|LAF|OB-LB)\)/gi, '') // remove batting/bowling style tags
    .replace(/\s*\((?:c|wk|c\s*&\s*wk|vc|sub)\)/gi, '') // remove (c), (wk), etc.
    .replace(/[*†#]/g, '') // remove captain/wk symbols
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Text-based CricHeroes PDF parser.
 * Works with raw text extracted from CricHeroes scorecard PDFs or client-side PDF text layers.
 */
export function parseCricHeroesText(text: string): ExtractedMatchData {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let matchName = '';
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

  const innings: ExtractedInnings[] = [];
  const warnings: string[] = [];

  // 1. Extract Date
  const normalizedDate = parseDateSafely(text);
  if (normalizedDate) {
    matchDate = normalizedDate;
  }

  // 2. Extract Match Name & Teams from "Match <Team A> vs <Team B>"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const vsMatch = line.match(/^Match\s+([A-Za-z0-9\s.&'-]+?)\s+vs\s+([A-Za-z0-9\s.&'-]+)$/i);
    if (vsMatch && vsMatch[1] && vsMatch[2]) {
      teamAName = vsMatch[1].trim();
      teamBName = vsMatch[2].trim();
      matchName = `${teamAName} vs ${teamBName}`;
      break;
    }
  }

  // 3. Extract Ground / Venue
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const groundMatch = line.match(/^(?:Ground|Venue)\s*[:\-–]?\s*([^\r\n]+)$/i);
    if (groundMatch && groundMatch[1]) {
      let v = groundMatch[1].trim();
      v = v.split(/,\s*(?:Total|Result|Toss|[A-Za-z0-9\s.&'-]+\s+\d+\/\d+)/i)[0]?.trim() || v;
      venue = v;
      break;
    }
    const inlineVenueMatch = line.match(
      /([A-Za-z0-9\s.&'-]+?\s+(?:Ground|Stadium|Oval|Arena|Complex|Park))\b/i,
    );
    if (
      inlineVenueMatch &&
      inlineVenueMatch[1] &&
      !venue &&
      !/^(?:Match|Total|Result)/i.test(line)
    ) {
      venue = inlineVenueMatch[1].trim();
    }
  }

  // 4. Extract Tournament / League title
  for (const line of lines) {
    const tournamentPrefixMatch = line.match(
      /^(?:tournament|league|series|event|cup)\s*[:\-–]\s*([^\r\n]+)/i,
    );
    if (tournamentPrefixMatch && tournamentPrefixMatch[1]) {
      tournament = tournamentPrefixMatch[1].trim();
      break;
    }
    const headerTournamentMatch = line.match(
      /^([A-Za-z0-9\s.&'-]+?\b(?:CHAMPIONS|LEAGUE|TROPHY|CUP|SERIES|TOURNAMENT|PREMIER|DERBY)\b[^\r\n]*)/i,
    );
    if (
      headerTournamentMatch &&
      headerTournamentMatch[1] &&
      !/^(?:Match|Ground|Date|Total|Result|Venue)/i.test(headerTournamentMatch[1])
    ) {
      tournament = headerTournamentMatch[1].replace(/\d+\/\d+\/\d+.*$/g, '').trim();
      break;
    }
  }

  // 5. Extract Result & Winning Margin
  for (const l of lines) {
    const resMatch = l.match(
      /(?:Result\s+)?([A-Za-z0-9\s.&'-]+?\s+won\s+by\s+[^\r\n]+|match\s+tied|match\s+drawn|no\s+result)/i,
    );
    if (resMatch && resMatch[1]) {
      let wm = resMatch[1].trim();
      wm = wm.replace(/^[A-Za-z\s,.-]*Result\s+/i, '').trim();
      winningMargin = wm;
      if (/lost/i.test(winningMargin)) result = 'lost';
      else if (/tie/i.test(winningMargin)) result = 'tie';
      else if (/draw/i.test(winningMargin)) result = 'draw';
      else result = 'won';
      break;
    }
  }

  // 6. Extract Innings & Scorecards
  let currentInnings: ExtractedInnings | null = null;
  let currentMode: 'none' | 'batting' | 'bowling' = 'none';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Detect Total / Score Line from summary (e.g. "Total Jeppiaar Cbse 264/10 (46.0 Ov)", "Jeppiaar Matric 202/10 (45.4 Ov)")
    const scoreMatch = line.match(
      /(?:Total\s+)?([A-Za-z0-9\s.&'-]+?)\s*[:\-–]?\s*(\d+\s*[/-]\s*\d+|\d+)\s*(?:\/|\s*in\s*|\s*overs?\s*|\s*ov\s*)?\s*\(([\d.]+)\s*(?:ov|overs?)?\)/i,
    );
    if (scoreMatch) {
      const team = scoreMatch[1]?.replace(/^Total\s+/i, '').trim() ?? '';
      const scoreVal = scoreMatch[2]?.replace(/\s+/g, '') ?? '';
      if (!/total|extras|fall\s*of|overs/i.test(team) && team.length > 1) {
        if (!teamAScore) {
          if (teamAName === 'Team A') teamAName = team;
          teamAScore = scoreVal;
        } else if (!teamBScore && team.toLowerCase() !== teamAName.toLowerCase()) {
          if (teamBName === 'Team B') teamBName = team;
          teamBScore = scoreVal;
        }
      }
    }

    // Detect true Scorecard Innings Header (e.g. "Jeppiaar Cbse 264/10 (46.0 Ov) (1st Innings)", "Thunderbolts XI Batting")
    const inningsHeaderMatch = line.match(
      /^([A-Za-z0-9\s.&'-]+?)\s+(\d+\s*[/-]\s*\d+|\d+)\s*\(([\d.]+)\s*(?:ov|overs?)?\)\s*(?:\((?:1st|2nd)?\s*innings\))?/i,
    );
    const battingHeaderMatch = line.match(
      /^(?:(?:1st|2nd)?\s*innings\s*[-:]?\s*)?([A-Za-z0-9\s.&'-]+?)\s+batting\s*$/i,
    );
    const bowlingHeaderMatch = line.match(
      /^(?:(?:1st|2nd)?\s*innings\s*[-:]?\s*)?([A-Za-z0-9\s.&'-]+?)\s+bowling\s*$/i,
    );
    const isBattingTableStart = /^(?:No\s+)?Batsman\s+Status\s+R\s+B/i.test(line);

    const hasInningsMarker =
      /\((?:1st|2nd)?\s*innings\)/i.test(line) || Boolean(battingHeaderMatch);
    const isFollowedByBattingTable =
      (i + 1 < lines.length && /^(?:No\s+)?Batsman\s+Status/i.test(lines[i + 1]!)) ||
      (i + 2 < lines.length && /^(?:No\s+)?Batsman\s+Status/i.test(lines[i + 2]!));

    if (inningsHeaderMatch && (hasInningsMarker || isFollowedByBattingTable)) {
      let innTeam = inningsHeaderMatch[1]?.trim() ?? '';
      // Clean off captain name trailing if interlaced e.g. "Jeppiaar Cbse 264/10 (46.0 Ov) (1st Innings) Kabilan"
      innTeam = innTeam.replace(/^Total\s+/i, '').trim();
      const scoreVal = inningsHeaderMatch[2]?.replace(/\s+/g, '') ?? '';
      const oversVal = inningsHeaderMatch[3] ?? '20.0';

      // Infer format from overs
      const oversNum = parseFloat(oversVal);
      if (oversNum > 20) format = 'odi';
      else if (oversNum <= 10) format = 't10';
      else format = 't20';

      const existingInn = innTeam
        ? innings.find(
            (inn) =>
              inn.teamName.toLowerCase() === innTeam.toLowerCase() && inn.batting.length === 0,
          )
        : null;

      if (existingInn) {
        existingInn.runs = parseInt(scoreVal.split(/[/-]/)[0] ?? '0', 10);
        existingInn.wickets = parseInt(scoreVal.split(/[/-]/)[1] ?? '0', 10);
        existingInn.overs = oversVal;
        currentInnings = existingInn;
      } else {
        currentInnings = {
          teamName: innTeam || (innings.length === 0 ? teamAName : teamBName),
          runs: parseInt(scoreVal.split(/[/-]/)[0] ?? '0', 10),
          wickets: parseInt(scoreVal.split(/[/-]/)[1] ?? '0', 10),
          overs: oversVal,
          batting: [],
          bowling: [],
          fielding: [],
        };
        innings.push(currentInnings);
      }
      currentMode = 'batting';
      continue;
    }

    if (battingHeaderMatch) {
      currentMode = 'batting';
      const innTeam = battingHeaderMatch[1]?.trim() ?? '';
      const existingInn = innTeam
        ? innings.find((inn) => inn.teamName.toLowerCase() === innTeam.toLowerCase())
        : null;

      if (existingInn) {
        currentInnings = existingInn;
      } else {
        const emptyInn = innings.find(
          (inn) => inn.batting.length === 0 && inn.bowling.length === 0,
        );
        if (emptyInn) {
          if (innTeam) emptyInn.teamName = innTeam;
          currentInnings = emptyInn;
        } else {
          currentInnings = {
            teamName: innTeam || (innings.length === 0 ? teamAName : teamBName),
            runs: 0,
            wickets: 0,
            overs: '20.0',
            batting: [],
            bowling: [],
            fielding: [],
          };
          innings.push(currentInnings);
        }
      }
      continue;
    }

    if (bowlingHeaderMatch) {
      currentMode = 'bowling';
      continue;
    }

    if (isBattingTableStart) {
      currentMode = 'batting';
      if (!currentInnings) {
        currentInnings = {
          teamName: innings.length === 0 ? teamAName : teamBName,
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

    if (/^(?:No\s+)?Bowler\s+O\s+M\s+R\s+W/i.test(line)) {
      currentMode = 'bowling';
      continue;
    }

    if (
      /^(?:Extras:|Total:|To Bat:|Fall of Wickets|Best Performances|Match Officials)/i.test(line)
    ) {
      currentMode = 'none';
      continue;
    }

    // Parse Batting Line
    if (currentMode === 'batting' && currentInnings) {
      // Find all whitespace-separated numbers at the end of the line
      // CricHeroes standard is 6 numbers: R B M 4s 6s SR (e.g. "51 70 107 8 0 72.86")
      // Other exports have 4 or 5 numbers: R B 4s 6s [SR] (e.g. "52 38 6 2 136.84" or "52 38 6 2")
      const numMatch = line.match(/(?:\s+(\d+[\d.]*|-)){4,8}\s*$/);
      if (numMatch && numMatch.index !== undefined) {
        const numbersStr = numMatch[0].trim();
        const numTokens = numbersStr.split(/\s+/);
        const prefix = line.slice(0, numMatch.index).trim();

        if (
          prefix &&
          !/^(?:no\s+)?(?:batsman|batter|player|status|r\s+b|extras|total|to\s*bat)/i.test(prefix)
        ) {
          // Parse numbers based on token count
          let runs = 0;
          let balls = 0;
          let fours = 0;
          let sixes = 0;
          let strikeRate = 0;

          if (numTokens.length >= 6) {
            // [R, B, M, 4s, 6s, SR]
            runs = parseInt(numTokens[0] ?? '0', 10);
            balls = parseInt(numTokens[1] ?? '0', 10);
            // numTokens[2] is M (Minutes)
            fours = parseInt(numTokens[3] ?? '0', 10);
            sixes = parseInt(numTokens[4] ?? '0', 10);
            const srVal = numTokens[5];
            strikeRate =
              srVal && srVal !== '-'
                ? parseFloat(srVal)
                : balls > 0
                  ? Number(((runs / balls) * 100).toFixed(2))
                  : 0;
          } else if (numTokens.length === 5) {
            // [R, B, 4s, 6s, SR]
            runs = parseInt(numTokens[0] ?? '0', 10);
            balls = parseInt(numTokens[1] ?? '0', 10);
            fours = parseInt(numTokens[2] ?? '0', 10);
            sixes = parseInt(numTokens[3] ?? '0', 10);
            const srVal = numTokens[4];
            strikeRate =
              srVal && srVal !== '-'
                ? parseFloat(srVal)
                : balls > 0
                  ? Number(((runs / balls) * 100).toFixed(2))
                  : 0;
          } else if (numTokens.length === 4) {
            // [R, B, 4s, 6s]
            runs = parseInt(numTokens[0] ?? '0', 10);
            balls = parseInt(numTokens[1] ?? '0', 10);
            fours = parseInt(numTokens[2] ?? '0', 10);
            sixes = parseInt(numTokens[3] ?? '0', 10);
            strikeRate = balls > 0 ? Number(((runs / balls) * 100).toFixed(2)) : 0;
          }

          // In prefix, extract dismissal
          const cleanPrefix = prefix.replace(/^\d+\s+/, ''); // strip leading row number "1 "
          const dismissalMatch = cleanPrefix.match(
            /\s+(not\s*out|c\s+&?\s*b\s+[A-Za-z0-9\s.&'-]+|c\s+[A-Za-z0-9\s.&'-]+\s+b\s+[A-Za-z0-9\s.&'-]+|c\s+[A-Za-z0-9\s.&'-]+|st\s+†?[A-Za-z0-9\s.&'-]+\s+b\s+[A-Za-z0-9\s.&'-]+|st\s+†?[A-Za-z0-9\s.&'-]+|lbw\s+b\s+[A-Za-z0-9\s.&'-]+|lbw\s+[A-Za-z0-9\s.&'-]+|lbw|b\s+[A-Za-z0-9\s.&'-]+|bowled\s+[A-Za-z0-9\s.&'-]+|bowled|run\s*out(?:\s+[A-Za-z0-9\s.&'/-]+|\s*\([A-Za-z0-9\s.&'/-]+\))?|retired(?:\s*hurt|\s*out)?|hit\s*wicket(?:\s*b\s+[A-Za-z0-9\s.&'-]+)?)\s*$/i,
          );

          let rawName = cleanPrefix;
          let dismissal = 'not out';
          if (dismissalMatch && dismissalMatch.index !== undefined) {
            rawName = cleanPrefix.slice(0, dismissalMatch.index).trim();
            dismissal = dismissalMatch[1]?.trim() ?? 'not out';
          }

          const name = cleanPlayerName(rawName);
          if (name) {
            const isOut = !/not\s*out/i.test(dismissal);
            currentInnings.batting.push({
              name,
              battingOrder: currentInnings.batting.length,
              runs,
              balls,
              fours,
              sixes,
              strikeRate,
              isOut,
              dismissalType: isOut ? dismissal : 'not_out',
            });

            // Extract fielding contributions
            if (isOut) {
              const catchMatch = dismissal.match(
                /^c\s+(?:&?\s*b\s+)?([A-Za-z\s.&'-]+?)(?:\s+b\s+|$)/i,
              );
              const stumpMatch = dismissal.match(/^st\s+†?([A-Za-z\s.&'-]+?)(?:\s+b\s+|$)/i);
              const runOutMatch = dismissal.match(
                /run\s*out(?:\s+([A-Za-z0-9\s.&'/-]+)|\s*\(\s*([A-Za-z0-9\s.&'/-]+)\s*\))/i,
              );

              if (catchMatch && catchMatch[1] && !/&/i.test(dismissal.slice(0, 3))) {
                const fielderName = cleanPlayerName(catchMatch[1]);
                if (fielderName) {
                  const existing = currentInnings.fielding.find(
                    (f) => f.name.toLowerCase() === fielderName.toLowerCase(),
                  );
                  if (existing) existing.catches += 1;
                  else
                    currentInnings.fielding.push({
                      name: fielderName,
                      catches: 1,
                      runOuts: 0,
                      stumpings: 0,
                    });
                }
              } else if (stumpMatch && stumpMatch[1]) {
                const keeperName = cleanPlayerName(stumpMatch[1]);
                if (keeperName) {
                  const existing = currentInnings.fielding.find(
                    (f) => f.name.toLowerCase() === keeperName.toLowerCase(),
                  );
                  if (existing) existing.stumpings += 1;
                  else
                    currentInnings.fielding.push({
                      name: keeperName,
                      catches: 0,
                      runOuts: 0,
                      stumpings: 1,
                    });
                }
              } else if (runOutMatch && (runOutMatch[1] || runOutMatch[2])) {
                const fielderRaw = (runOutMatch[1] || runOutMatch[2] || '').trim();
                const fielderParts = fielderRaw.split(/[/,]/);
                for (const part of fielderParts) {
                  const fielderName = cleanPlayerName(part);
                  if (fielderName && fielderName.length > 1) {
                    const existing = currentInnings.fielding.find(
                      (f) => f.name.toLowerCase() === fielderName.toLowerCase(),
                    );
                    if (existing) existing.runOuts += 1;
                    else
                      currentInnings.fielding.push({
                        name: fielderName,
                        catches: 0,
                        runOuts: 1,
                        stumpings: 0,
                      });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Parse Bowling Line
    if (currentMode === 'bowling' && currentInnings) {
      // Numbers at end: O, M, R, W, [0s, 4s, 6s, WD, NB, Eco]
      const numMatch = line.match(/(?:\s+(\d+[\d.]*|-)){4,11}\s*$/);
      if (numMatch && numMatch.index !== undefined) {
        const prefix = line.slice(0, numMatch.index).trim();
        const cleanPrefix = prefix.replace(/^\d+\s+/, ''); // strip row number "1 "
        const name = cleanPlayerName(cleanPrefix);

        if (name && !/^(?:bowler|o\s+m|overs|runs|wickets|eco|wd|nb)$/i.test(name)) {
          const numTokens = numMatch[0].trim().split(/\s+/);
          const overs = numTokens[0] ?? '0.0';
          const maidens = parseInt(numTokens[1] ?? '0', 10);
          const runsConceded = parseInt(numTokens[2] ?? '0', 10);
          const wickets = parseInt(numTokens[3] ?? '0', 10);

          let economy: number | undefined;
          let wides = 0;
          let noBalls = 0;

          if (numTokens.length >= 10) {
            // [O, M, R, W, 0s, 4s, 6s, WD, NB, Eco] (CricHeroes 10-column layout)
            wides = parseInt(numTokens[7] ?? '0', 10);
            noBalls = parseInt(numTokens[8] ?? '0', 10);
            economy = parseFloat(numTokens[9] ?? '0');
          } else if (numTokens.length >= 7) {
            // [O, M, R, W, Econ, WD, NB]
            economy = parseFloat(numTokens[4] ?? '0');
            wides = parseInt(numTokens[5] ?? '0', 10);
            noBalls = parseInt(numTokens[6] ?? '0', 10);
          } else if (numTokens.length >= 5) {
            economy = parseFloat(numTokens[4] ?? '0');
          }

          currentInnings.bowling.push({
            name,
            overs,
            maidens,
            runsConceded,
            wickets,
            economy,
            wides,
            noBalls,
          });
        }
      }
    }
  }

  // 7. Extract Best Performances (Awards) from Page 1 & text
  let bestBatterName: string | undefined;
  let bestBowlerName: string | undefined;
  let bestFielderName: string | undefined;
  let playerOfMatchName: string | undefined;

  let inBestBatsmen = false;
  let inBestBowlers = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/Best Performances - Batsmen/i.test(line)) {
      inBestBatsmen = true;
      inBestBowlers = false;
      continue;
    }
    if (/Best Performances - Bowlers/i.test(line)) {
      inBestBowlers = true;
      inBestBatsmen = false;
      continue;
    }
    if (/Match Officials|Playing Squad/i.test(line)) {
      inBestBatsmen = false;
      inBestBowlers = false;
      continue;
    }

    if (inBestBatsmen && !bestBatterName && !/^(?:Players Name|R\s+B)/i.test(line)) {
      const batPerfMatch = line.match(/^([A-Za-z0-9\s.&'-]+?)\s+\d+/);
      if (batPerfMatch && batPerfMatch[1]) {
        bestBatterName = cleanPlayerName(batPerfMatch[1]);
      }
    }

    if (inBestBowlers && !bestBowlerName && !/^(?:Players Name|O\s+M)/i.test(line)) {
      const bowlPerfMatch = line.match(/^([A-Za-z0-9\s.&'-]+?)\s+[\d.]+/);
      if (bowlPerfMatch && bowlPerfMatch[1]) {
        bestBowlerName = cleanPlayerName(bowlPerfMatch[1]);
      }
    }
  }

  const pomMatch = text.match(
    /(?:player of the match|pom|mom|man of the match)\s*[:\-–]\s*([^\r\n,;]+)/i,
  );
  if (pomMatch && pomMatch[1]) playerOfMatchName = cleanPlayerName(pomMatch[1]);

  const bbMatch = text.match(/(?:best batter|best batsman)\s*[:\-–]\s*([^\r\n,;]+)/i);
  if (bbMatch && bbMatch[1] && !bestBatterName) bestBatterName = cleanPlayerName(bbMatch[1]);

  const bbowlMatch = text.match(/(?:best bowler)\s*[:\-–]\s*([^\r\n,;]+)/i);
  if (bbowlMatch && bbowlMatch[1] && !bestBowlerName)
    bestBowlerName = cleanPlayerName(bbowlMatch[1]);

  const bfMatch = text.match(/(?:best fielder)\s*[:\-–]\s*([^\r\n,;]+)/i);
  if (bfMatch && bfMatch[1]) bestFielderName = cleanPlayerName(bfMatch[1]);

  if (!playerOfMatchName && bestBatterName) {
    playerOfMatchName = bestBatterName;
  }

  // 8. Filter out ghost/empty innings (innings with no batting and no bowling)
  const validInnings = innings.filter((inn) => inn.batting.length > 0 || inn.bowling.length > 0);
  const finalInnings = validInnings.length > 0 ? validInnings : innings;

  // Use valid innings team names & scores if available
  if (validInnings.length >= 1 && validInnings[0]) {
    if (validInnings[0].teamName && !validInnings[0].teamName.startsWith('Team ')) {
      teamAName = validInnings[0].teamName;
    }
    if (validInnings[0].runs > 0) {
      teamAScore = `${validInnings[0].runs}/${validInnings[0].wickets}`;
    }
  }
  if (validInnings.length >= 2 && validInnings[1]) {
    if (validInnings[1].teamName && !validInnings[1].teamName.startsWith('Team ')) {
      teamBName = validInnings[1].teamName;
    }
    if (validInnings[1].runs > 0) {
      teamBScore = `${validInnings[1].runs}/${validInnings[1].wickets}`;
    }
  }

  // Clean up team names if they contain trailing garbage
  teamAName =
    teamAName.replace(/\b(?:Toss|Total|Result|opt to bat|opt to bowl|won by).*$/i, '').trim() ||
    teamAName;
  teamBName =
    teamBName.replace(/\b(?:Toss|Total|Result|opt to bat|opt to bowl|won by).*$/i, '').trim() ||
    teamBName;

  // Final match name
  matchName = `${teamAName} vs ${teamBName}`;

  if (!teamAScore && finalInnings[0]?.batting?.length) {
    const totalRuns = finalInnings[0].batting.reduce((s, b) => s + b.runs, 0);
    const totalWickets = finalInnings[0].batting.filter((b) => b.isOut).length;
    teamAScore = `${totalRuns}/${totalWickets}`;
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
    innings: finalInnings,
    warnings,
    playerOfMatchName,
    bestBatterName,
    bestBowlerName,
    bestFielderName,
  };
}
