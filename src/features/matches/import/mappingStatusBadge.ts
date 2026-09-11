import type { MappedPlayer } from './cricheroesPdfTypes';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'brand';

/**
 * One label for a player-mapping row, used both while importing (PlayerMappingStep)
 * and when reviewing a past import (CricHeroesImportsPage). Previously each screen
 * decided this independently, and the import step only showed the confidence
 * percentage for two of the five statuses — a low_confidence or guest_player match
 * (the ones most worth double-checking) showed no number at all.
 */
export function mappingStatusBadge(player: {
  isIgnored: boolean;
  savedMapping?: boolean;
  isGuest: boolean;
  status: MappedPlayer['status'];
  confidenceScore: number;
}): { label: string; tone: BadgeTone } {
  if (player.isIgnored) return { label: 'Ignored', tone: 'neutral' };
  if (player.savedMapping) return { label: 'Saved Mapping ✓', tone: 'success' };
  if (player.status === 'exact_match') return { label: 'Exact Match (100%)', tone: 'success' };
  if (player.isGuest)
    return { label: `Guest Player (${player.confidenceScore}% sure)`, tone: 'warning' };
  if (player.status === 'high_confidence') {
    return { label: `Matched (${player.confidenceScore}% sure)`, tone: 'success' };
  }
  if (player.status === 'low_confidence') {
    return { label: `Needs review (${player.confidenceScore}% sure)`, tone: 'warning' };
  }
  if (player.status === 'manual_matched') return { label: 'Matched by hand', tone: 'brand' };
  return { label: `Matched (${player.confidenceScore}% sure)`, tone: 'brand' };
}
