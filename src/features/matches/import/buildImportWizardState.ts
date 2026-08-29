import type { UUID } from '@/types';
import type { ExtractedMatchData, MappedPlayer } from './cricheroesPdfTypes';
import { getDefaultOversForFormat } from './cricheroesPdfTypes';
import type { WizardState } from '../components/wizard/types';

/**
 * Turn a parsed CricHeroes scorecard plus the user's player mappings into the
 * WizardState the match wizard saves.
 *
 * This lived inline in `CricHeroesImportModal`, where it could not be tested —
 * and the test that claimed to cover it held a hand-copied duplicate of the
 * same code, so it agreed with the modal no matter what either of them did.
 * Four defects survived under that arrangement: fielding thrown away, both
 * teams merged into one lineup, bowling read off the wrong innings, and guest
 * ids that differed between the lineup and the scorecard rows.
 */
export function buildImportWizardState({
  extracted,
  mappedPlayers,
  selectedAcademyTeamId,
  opponentName,
}: {
  extracted: ExtractedMatchData;
  mappedPlayers: MappedPlayer[];
  selectedAcademyTeamId: 'A' | 'B';
  opponentName: string;
}): WizardState {
  // A scorecard innings lists the *batting* side's batters, and the bowlers
  // and fielders who opposed them. So the academy team's batting comes from
  // its own innings, while its bowling and fielding come from the other one.
  // Reading bowling off the same innings as the batting — as this did —
  // saved the opposition's figures against academy players.
  const teamIndex = selectedAcademyTeamId === 'A' ? 0 : 1;
  const battingInnings = extracted.innings[teamIndex] ?? extracted.innings[0];
  const bowlingInnings = extracted.innings[teamIndex === 0 ? 1 : 0] ?? extracted.innings[0];

  const playerLookup = new Map(mappedPlayers.map((p) => [p.cricheroesName.toLowerCase(), p]));

  // CricHeroes marks the captain and wicketkeeper next to the name, e.g.
  // "Kabilan (c)". The parser lifts those off both the batting and bowling
  // tables — a captain who only bowled is still the captain — so the import
  // can tick the boxes rather than leaving them all false.
  const captains = new Set<string>();
  const keepers = new Set<string>();
  extracted.innings.forEach((inn) => {
    [...inn.batting, ...inn.bowling].forEach((p) => {
      if (p.isCaptain) captains.add(p.name.toLowerCase());
      if (p.isWicketkeeper) keepers.add(p.name.toLowerCase());
    });
  });

  // Only this team's players belong in the lineup. `mappedPlayers` holds
  // every name on the scorecard, both sides of it, so building the lineup
  // from all of them put twenty-five players on an eleven-player team and
  // credited the opposition's appearances to the academy.
  const teamNames = new Set<string>();
  battingInnings?.batting.forEach((b) => teamNames.add(b.name.toLowerCase()));
  bowlingInnings?.bowling.forEach((b) => teamNames.add(b.name.toLowerCase()));
  bowlingInnings?.fielding.forEach((f) => teamNames.add(f.name.toLowerCase()));

  // Guests have no member id, so the wizard identifies them by a synthetic
  // one. It must be derived from the name, because the same guest has to
  // resolve to the same id from the lineup, the batting card, the bowling
  // card and the fielding card. Keying it off the array index — as the
  // lineup did — meant a guest's own batting row pointed at nobody.
  const guestId = (name: string) => `guest_${name.trim().toLowerCase()}` as UUID;
  const idFor = (name: string): UUID | null => {
    const mapped = playerLookup.get(name.toLowerCase());
    if (!mapped || mapped.isIgnored) return null;
    return mapped.isGuest ? guestId(name) : mapped.academyMemberId;
  };

  // CricHeroes prints each batter's position in its own first column; that
  // beats numbering by whatever order the rows happen to arrive in.
  const battingOrderByName = new Map(
    (battingInnings?.batting ?? []).map((b) => [b.name.toLowerCase(), b.battingOrder]),
  );

  const teamPlayers = mappedPlayers.filter(
    (p) => !p.isIgnored && teamNames.has(p.cricheroesName.toLowerCase()),
  );

  const lineup = teamPlayers.map((p, idx) => ({
    memberId: (p.isGuest ? guestId(p.cricheroesName) : p.academyMemberId) as UUID,
    fullName: p.isGuest ? p.cricheroesName : p.academyMemberName,
    email: '',
    avatarUrl: null,
    battingOrder: battingOrderByName.get(p.cricheroesName.toLowerCase()) ?? idx + 1,
    isCaptain: captains.has(p.cricheroesName.toLowerCase()),
    isViceCaptain: false,
    isWicketkeeper: keepers.has(p.cricheroesName.toLowerCase()),
    isGuest: p.isGuest,
    guestName: p.isGuest ? p.cricheroesName : null,
  }));

  const batting = (battingInnings?.batting ?? [])
    .filter((b) => idFor(b.name) !== null)
    .map((b) => {
      const isGuest = playerLookup.get(b.name.toLowerCase())?.isGuest ?? true;
      return {
        memberId: idFor(b.name) as UUID,
        runs: b.runs,
        balls: b.balls,
        fours: b.fours,
        sixes: b.sixes,
        isOut: b.isOut,
        dismissalType: b.dismissalType,
        isGuest,
        guestName: isGuest ? b.name : null,
      };
    });

  const bowling = (bowlingInnings?.bowling ?? [])
    .filter((b) => idFor(b.name) !== null)
    .map((b) => {
      const isGuest = playerLookup.get(b.name.toLowerCase())?.isGuest ?? true;
      return {
        memberId: idFor(b.name) as UUID,
        overs: b.overs,
        maidens: b.maidens,
        runsConceded: b.runsConceded,
        wickets: b.wickets,
        wides: b.wides,
        noBalls: b.noBalls,
        isGuest,
        guestName: isGuest ? b.name : null,
      };
    });

  // The parser credits catches, stumpings and run-outs from the dismissal
  // text, and the import then threw all of it away on a hardcoded empty
  // array — so no fielding has ever reached a player's record through an
  // import. Names that appear only in dismissal text and were never mapped
  // are skipped rather than invented as new guests.
  const fielding = (bowlingInnings?.fielding ?? [])
    .filter((f) => idFor(f.name) !== null)
    .map((f) => {
      const isGuest = playerLookup.get(f.name.toLowerCase())?.isGuest ?? true;
      return {
        memberId: idFor(f.name) as UUID,
        catches: f.catches,
        runOuts: f.runOuts,
        stumpings: f.stumpings,
        isGuest,
        guestName: isGuest ? f.name : null,
      };
    });

  return {
    matchName: extracted.matchName,
    matchDate: extracted.matchDate,
    opponentName: opponentName || extracted.teamB.name,
    venue: extracted.venue,
    matchType: extracted.matchType,
    format: extracted.format,
    result: extracted.result,
    teamScore: selectedAcademyTeamId === 'A' ? extracted.teamA.score : extracted.teamB.score,
    overs: getDefaultOversForFormat(extracted.format),
    tournament: extracted.tournament,
    selectedPlayerIds: lineup.map((l) => l.memberId),
    lineup,
    batting,
    bowling,
    fielding,
    awards: {
      playerOfMatchId: null,
      bestBatterId: null,
      bestBowlerId: null,
      bestFielderId: null,
    },
  };
}
