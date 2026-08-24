import type { Match } from '../api/matchesTypes';
import type { ExtractedMatchData } from './cricheroesPdfTypes';

export type DuplicateCheckResult = {
  isDuplicate: boolean;
  existingMatch?: Match;
  confidenceReason?: string;
};

/** Check if extracted CricHeroes match data is a duplicate of an existing academy match */
export function checkDuplicateMatch(
  extracted: ExtractedMatchData,
  existingMatches: Match[],
): DuplicateCheckResult {
  const normExtractedOpponent = extracted.opponentName
    ? extracted.opponentName.toLowerCase().trim()
    : '';

  for (const match of existingMatches) {
    const isSameDate = match.matchDate === extracted.matchDate;
    const normExistingOpponent = match.opponentName ? match.opponentName.toLowerCase().trim() : '';

    const isSameOpponent =
      normExtractedOpponent && normExistingOpponent
        ? normExtractedOpponent.includes(normExistingOpponent) ||
          normExistingOpponent.includes(normExtractedOpponent)
        : false;

    const isSameVenue =
      extracted.venue && match.venue
        ? extracted.venue.toLowerCase().trim() === match.venue.toLowerCase().trim()
        : false;

    if (isSameDate && (isSameOpponent || isSameVenue)) {
      return {
        isDuplicate: true,
        existingMatch: match,
        confidenceReason: `Match on ${match.matchDate} vs '${match.opponentName || 'Unknown'}' at '${match.venue || 'Unknown'}' already exists.`,
      };
    }
  }

  return { isDuplicate: false };
}
