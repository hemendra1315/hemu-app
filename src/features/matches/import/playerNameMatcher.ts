import type { UUID } from '@/types';
import type { MappedPlayer, PlayerMappingStatus } from './cricheroesPdfTypes';

export type AcademyPlayerCandidate = {
  id: UUID;
  fullName: string | null;
  email: string;
};

/** Normalize string for comparison (lowercase, remove punctuation, collapse spaces) */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Calculate Levenshtein distance between two strings */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: b.length + 1 }, () =>
    Array(a.length + 1).fill(0),
  );

  for (let i = 0; i <= b.length; i++) {
    const row = matrix[i];
    if (row) row[0] = i;
  }
  for (let j = 0; j <= a.length; j++) {
    const row = matrix[0];
    if (row) row[j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const prevRow = matrix[i - 1];
      const currRow = matrix[i];
      if (!prevRow || !currRow) continue;

      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        currRow[j] = prevRow[j - 1] ?? 0;
      } else {
        currRow[j] = Math.min(
          (prevRow[j - 1] ?? 0) + 1, // substitution
          (currRow[j - 1] ?? 0) + 1, // insertion
          (prevRow[j] ?? 0) + 1, // deletion
        );
      }
    }
  }

  const lastRow = matrix[b.length];
  return lastRow ? (lastRow[a.length] ?? 0) : 0;
}

/** Calculate similarity percentage (0 to 100) */
export function calculateSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  if (norm1 === norm2) return 100;
  if (!norm1 || !norm2) return 0;

  // Check initial / word overlap
  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');

  // Single-word overlap: return a moderate baseline (70) rather than a hard 90.
  // 70 is intentionally below the 80-point high_confidence threshold so that
  // matchPlayers() — which has full roster visibility — decides the final status.
  // If the match is genuinely unambiguous it stays low_confidence; if it is
  // ambiguous (multiple roster players share the word) it gets capped there too.
  const matchingWords = words1.filter((w) => words2.includes(w));
  if (matchingWords.length > 0 && (words1.length === 1 || words2.length === 1)) {
    return 70;
  }

  const maxLength = Math.max(norm1.length, norm2.length);
  const dist = levenshteinDistance(norm1, norm2);
  const score = Math.max(0, Math.round((1 - dist / maxLength) * 100));

  return score;
}

export type SavedMappingCandidate = {
  cricheroesPlayerId?: string | null;
  cricheroesName: string;
  academyMemberId: UUID | null;
  isGuest: boolean;
};

/** Automatically match a list of extracted CricHeroes player names against active academy roster & saved mappings */
export function matchPlayers(
  extractedNames: string[],
  academyPlayers: AcademyPlayerCandidate[],
  savedMappings?: SavedMappingCandidate[],
): MappedPlayer[] {
  const uniqueNames = Array.from(new Set(extractedNames.map((n) => n.trim()))).filter(Boolean);

  const savedMap = new Map<string, SavedMappingCandidate>();
  if (savedMappings) {
    for (const sm of savedMappings) {
      if (sm.cricheroesPlayerId) {
        savedMap.set(sm.cricheroesPlayerId.toLowerCase(), sm);
      }
      savedMap.set(sm.cricheroesName.toLowerCase(), sm);
    }
  }

  const academyMap = new Map(academyPlayers.map((p) => [p.id, p]));

  /**
   * Best roster candidate for a name, ignoring saved mappings entirely.
   * Needed up front because a saved *guest* decision must not outlive the
   * player joining the academy (see below).
   */
  function bestRosterMatch(chName: string): {
    player: AcademyPlayerCandidate | null;
    score: number;
  } {
    let player: AcademyPlayerCandidate | null = null;
    let score = 0;
    for (const candidate of academyPlayers) {
      const targetName = candidate.fullName || candidate.email.split('@')[0] || '';
      const s = calculateSimilarity(chName, targetName);
      if (s > score) {
        score = s;
        player = candidate;
      }
    }
    return { player, score };
  }

  return uniqueNames.map((chName) => {
    // 1. Check persistent saved mapping first
    const saved = savedMap.get(chName.toLowerCase());
    if (saved) {
      if (saved.isGuest || !saved.academyMemberId) {
        // A saved "guest" decision is only valid while that name still has no
        // home on the roster. The first import of a scorecard is often done
        // before the players are added to the academy, so every name gets
        // saved as a guest; without this check that verdict is permanent and
        // later imports keep filing real, exactly-named members as guests
        // however many times the user corrects them.
        const { player, score } = bestRosterMatch(chName);
        if (player && score === 100) {
          return {
            cricheroesName: chName,
            cricheroesPlayerId: saved.cricheroesPlayerId,
            academyMemberId: player.id,
            academyMemberName: player.fullName ?? player.email,
            confidenceScore: 100,
            status: 'exact_match',
            isGuest: false,
            isIgnored: false,
            savedMapping: false,
          };
        }

        return {
          cricheroesName: chName,
          cricheroesPlayerId: saved.cricheroesPlayerId,
          academyMemberId: null,
          academyMemberName: null,
          confidenceScore: 100,
          status: 'guest_player',
          isGuest: true,
          isIgnored: false,
          savedMapping: true,
        };
      }

      const member = academyMap.get(saved.academyMemberId);
      if (member) {
        return {
          cricheroesName: chName,
          cricheroesPlayerId: saved.cricheroesPlayerId,
          academyMemberId: member.id,
          academyMemberName: member.fullName ?? member.email,
          confidenceScore: 100,
          status: 'exact_match',
          isGuest: false,
          isIgnored: false,
          savedMapping: true,
        };
      }
    }

    // 2. Fallback to Levenshtein name similarity engine
    const { player: bestMatch, score: highestScore } = bestRosterMatch(chName);

    let status: PlayerMappingStatus = 'guest_player';
    let isGuest = true;

    if (highestScore === 100 && bestMatch) {
      status = 'exact_match';
      isGuest = false;
    } else if (highestScore >= 80 && bestMatch) {
      status = 'high_confidence';
      isGuest = false;
    } else if (highestScore >= 50 && bestMatch) {
      status = 'low_confidence';
      isGuest = false;
    }

    // Bug 3 fix: check for ambiguity — if multiple roster players scored in the
    // same top tier for this extracted name, the match is not safe to auto-confirm.
    // We count players whose score is within 5 points of the best and >= 50.
    // If more than one qualifies AND the best is below the 80-point high_confidence
    // boundary, downgrade to low_confidence to force manual disambiguation in the UI.
    if (highestScore >= 50 && highestScore < 80) {
      const topTierCount = academyPlayers.filter((p) => {
        const targetName = p.fullName || p.email.split('@')[0] || '';
        const s = calculateSimilarity(chName, targetName);
        return s >= highestScore - 5 && s >= 50;
      }).length;

      if (topTierCount > 1) {
        // Multiple players are equally plausible — require human review
        status = 'low_confidence';
        isGuest = false;
      }
    }

    return {
      cricheroesName: chName,
      academyMemberId: isGuest ? null : (bestMatch?.id ?? null),
      academyMemberName: isGuest ? null : (bestMatch?.fullName ?? bestMatch?.email ?? null),
      confidenceScore: highestScore,
      status,
      isGuest,
      isIgnored: false,
      savedMapping: false,
    };
  });
}
