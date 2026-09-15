import type {
  MatchBattingEntry,
  MatchBowlingEntry,
  MatchFieldingEntry,
  MatchPlayerLineup,
} from '../components/wizard/types';

export type PlayerPerformanceBreakdown = {
  memberId: string;
  playerName: string;
  isGuest: boolean;
  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
  totalPoints: number;
  statsSummary: {
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: number;
    overs: string;
    wickets: number;
    maidens: number;
    runsConceded: number;
    economy: number;
    catches: number;
    stumpings: number;
    runOuts: number;
  };
};

export type MatchMvpResult = {
  leaderboard: PlayerPerformanceBreakdown[];
  playerOfMatch: PlayerPerformanceBreakdown | null;
  bestBatter: PlayerPerformanceBreakdown | null;
  bestBowler: PlayerPerformanceBreakdown | null;
  bestFielder: PlayerPerformanceBreakdown | null;
};

/**
 * Calculates MVP & performance impact score across batting, bowling, and fielding metrics.
 */
export function calculateMatchMvp(
  lineup: MatchPlayerLineup[],
  batting: MatchBattingEntry[],
  bowling: MatchBowlingEntry[],
  fielding: MatchFieldingEntry[] = [],
): MatchMvpResult {
  const playerMap = new Map<string, PlayerPerformanceBreakdown>();

  // Initialize from lineup
  for (const player of lineup) {
    playerMap.set(player.memberId, {
      memberId: player.memberId,
      playerName: player.fullName || player.guestName || 'Player',
      isGuest: Boolean(player.isGuest),
      battingPoints: 0,
      bowlingPoints: 0,
      fieldingPoints: 0,
      totalPoints: 0,
      statsSummary: {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        overs: '0.0',
        wickets: 0,
        maidens: 0,
        runsConceded: 0,
        economy: 0,
        catches: 0,
        stumpings: 0,
        runOuts: 0,
      },
    });
  }

  // 1. Process Batting
  for (const bat of batting) {
    let entry = playerMap.get(bat.memberId);
    if (!entry) {
      entry = {
        memberId: bat.memberId,
        playerName: bat.guestName || 'Batter',
        isGuest: Boolean(bat.isGuest),
        battingPoints: 0,
        bowlingPoints: 0,
        fieldingPoints: 0,
        totalPoints: 0,
        statsSummary: {
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          overs: '0.0',
          wickets: 0,
          maidens: 0,
          runsConceded: 0,
          economy: 0,
          catches: 0,
          stumpings: 0,
          runOuts: 0,
        },
      };
      playerMap.set(bat.memberId, entry);
    }

    let batPts = bat.runs * 1;
    batPts += bat.fours * 1;
    batPts += bat.sixes * 2;

    // Milestones
    if (bat.runs >= 100) batPts += 16;
    else if (bat.runs >= 50) batPts += 8;
    else if (bat.runs >= 30) batPts += 4;

    // Strike rate bonus (min 10 balls)
    const sr = bat.balls > 0 ? (bat.runs / bat.balls) * 100 : 0;
    if (bat.balls >= 10) {
      if (sr >= 150) batPts += 10;
      else if (sr >= 130) batPts += 6;
    }

    // Duck penalty
    if (bat.runs === 0 && bat.isOut) {
      batPts -= 2;
    }

    entry.battingPoints += batPts;
    entry.statsSummary.runs = bat.runs;
    entry.statsSummary.balls = bat.balls;
    entry.statsSummary.fours = bat.fours;
    entry.statsSummary.sixes = bat.sixes;
    entry.statsSummary.strikeRate = Math.round(sr * 10) / 10;
  }

  // 2. Process Bowling
  for (const bowl of bowling) {
    let entry = playerMap.get(bowl.memberId);
    if (!entry) {
      entry = {
        memberId: bowl.memberId,
        playerName: bowl.guestName || 'Bowler',
        isGuest: Boolean(bowl.isGuest),
        battingPoints: 0,
        bowlingPoints: 0,
        fieldingPoints: 0,
        totalPoints: 0,
        statsSummary: {
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          overs: '0.0',
          wickets: 0,
          maidens: 0,
          runsConceded: 0,
          economy: 0,
          catches: 0,
          stumpings: 0,
          runOuts: 0,
        },
      };
      playerMap.set(bowl.memberId, entry);
    }

    let bowlPts = bowl.wickets * 25;
    bowlPts += bowl.maidens * 8;

    // Haul bonuses
    if (bowl.wickets >= 5) bowlPts += 16;
    else if (bowl.wickets >= 3) bowlPts += 8;

    const parsedOvers = parseFloat(bowl.overs) || 0;
    const fullOvers = Math.floor(parsedOvers);
    const balls = Math.round((parsedOvers % 1) * 10);
    const decimalOvers = fullOvers + balls / 6;
    const econ = decimalOvers > 0 ? bowl.runsConceded / decimalOvers : 0;

    // Economy bonus (min 2.0 overs)
    if (parsedOvers >= 2.0) {
      if (econ <= 4.5) bowlPts += 10;
      else if (econ <= 6.0) bowlPts += 6;
      else if (econ >= 11.0) bowlPts -= 6;
    }

    entry.bowlingPoints += bowlPts;
    entry.statsSummary.overs = bowl.overs;
    entry.statsSummary.wickets = bowl.wickets;
    entry.statsSummary.maidens = bowl.maidens;
    entry.statsSummary.runsConceded = bowl.runsConceded;
    entry.statsSummary.economy = Math.round(econ * 10) / 10;
  }

  // 3. Process Fielding
  for (const field of fielding) {
    const entry = playerMap.get(field.memberId);
    if (entry) {
      let fieldPts = 0;
      fieldPts += (field.catches || 0) * 8;
      fieldPts += (field.stumpings || 0) * 12;
      const direct = field.runOutsDirect ?? field.runOuts ?? 0;
      const assisted = field.runOutsAssisted ?? 0;
      fieldPts += direct * 12;
      fieldPts += assisted * 6;

      entry.fieldingPoints += fieldPts;
      entry.statsSummary.catches = field.catches || 0;
      entry.statsSummary.stumpings = field.stumpings || 0;
      entry.statsSummary.runOuts = direct + assisted;
    }
  }

  // Calculate totals and sort
  const allEntries = Array.from(playerMap.values());
  for (const item of allEntries) {
    item.totalPoints = item.battingPoints + item.bowlingPoints + item.fieldingPoints;
  }

  const sortedLeaderboard = [...allEntries].sort((a, b) => b.totalPoints - a.totalPoints);

  const bestBatterCandidates = [...allEntries].filter(
    (p) => p.statsSummary.runs > 0 || p.battingPoints > 0,
  );
  bestBatterCandidates.sort((a, b) => b.battingPoints - a.battingPoints);

  const bestBowlerCandidates = [...allEntries].filter(
    (p) => p.statsSummary.wickets > 0 || p.bowlingPoints > 0,
  );
  bestBowlerCandidates.sort((a, b) => b.bowlingPoints - a.bowlingPoints);

  const bestFielderCandidates = [...allEntries].filter((p) => p.fieldingPoints > 0);
  bestFielderCandidates.sort((a, b) => b.fieldingPoints - a.fieldingPoints);

  return {
    leaderboard: sortedLeaderboard,
    playerOfMatch: sortedLeaderboard[0] ?? null,
    bestBatter: bestBatterCandidates[0] ?? null,
    bestBowler: bestBowlerCandidates[0] ?? null,
    bestFielder: bestFielderCandidates[0] ?? null,
  };
}
