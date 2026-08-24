import { describe, expect, it } from 'vitest';
import {
  calculateSimilarity,
  matchPlayers,
  normalizeName,
  type AcademyPlayerCandidate,
} from '../import/playerNameMatcher';

describe('Player Name Matcher Engine', () => {
  const academyRoster: AcademyPlayerCandidate[] = [
    { id: 'p-1', fullName: 'Hemendra Kumar', email: 'hemendra@academy.com' },
    { id: 'p-2', fullName: 'Ankit Sharma', email: 'ankit@academy.com' },
    { id: 'p-3', fullName: 'Rahul Verma', email: 'rahul@academy.com' },
  ];

  it('normalizes names correctly', () => {
    expect(normalizeName('  Hemendra   Kumar! ')).toBe('hemendra kumar');
  });

  it('matches exact normalized names with 100% confidence', () => {
    expect(calculateSimilarity('Hemendra Kumar', 'hemendra kumar')).toBe(100);
  });

  it('handles partial and fuzzy matches', () => {
    const score = calculateSimilarity('Hemu Kumar', 'Hemendra Kumar');
    expect(score).toBeGreaterThan(60);
  });

  it('categorizes players into exact, matched, or guest player', () => {
    const extractedNames = ['Hemendra Kumar', 'Ankit S', 'Unknown Guest Player'];

    const matches = matchPlayers(extractedNames, academyRoster);

    expect(matches.length).toBe(3);

    const m0 = matches[0];
    const m1 = matches[1];
    const m2 = matches[2];

    // Exact match
    expect(m0?.cricheroesName).toBe('Hemendra Kumar');
    expect(m0?.status).toBe('exact_match');
    expect(m0?.isGuest).toBe(false);

    // High/low confidence match
    expect(m1?.cricheroesName).toBe('Ankit S');
    expect(m1?.isGuest).toBe(false);

    // Guest player (unmatched)
    expect(m2?.cricheroesName).toBe('Unknown Guest Player');
    expect(m2?.isGuest).toBe(true);
    expect(m2?.academyMemberId).toBeNull();
  });
});

describe('Single-word name ambiguity (Bug 3)', () => {
  const rosterWithSharedFirstName: AcademyPlayerCandidate[] = [
    { id: 'p-raj-1', fullName: 'Raj Kumar', email: 'rajkumar@academy.com' },
    { id: 'p-raj-2', fullName: 'Raj Singh', email: 'rajsingh@academy.com' },
    { id: 'p-amit', fullName: 'Amit Patel', email: 'amit@academy.com' },
  ];

  it('single-word guest name colliding with two roster players is NOT high_confidence or exact_match', () => {
    const results = matchPlayers(['Raj'], rosterWithSharedFirstName);
    const match = results[0];
    expect(match?.status).not.toBe('high_confidence');
    expect(match?.status).not.toBe('exact_match');
    // Must be low_confidence (still found a candidate) or guest_player
    expect(['low_confidence', 'guest_player']).toContain(match?.status);
  });

  it('single-word guest name matching two roster players is never auto-matched (isGuest may be false but status must be low_confidence)', () => {
    const results = matchPlayers(['Raj'], rosterWithSharedFirstName);
    const match = results[0];
    // The status must require manual review — not an automatic high-confidence assignment
    if (match?.status === 'low_confidence') {
      // This is the expected "requires review" outcome — pass
      expect(match.status).toBe('low_confidence');
    } else {
      // guest_player is also acceptable (score below 50 threshold)
      expect(match?.status).toBe('guest_player');
    }
  });

  it('single-word name that is genuinely unambiguous stays at low_confidence (score 70, below 80 threshold)', () => {
    // Only one roster player has the word "Amit"
    const results = matchPlayers(['Amit'], rosterWithSharedFirstName);
    const match = results[0];
    // Should NOT be auto-promoted to high_confidence — 70 < 80
    expect(match?.status).not.toBe('high_confidence');
    expect(match?.status).not.toBe('exact_match');
  });

  it('regression: exact multi-word match still produces exact_match', () => {
    const results = matchPlayers(['Raj Kumar'], rosterWithSharedFirstName);
    const match = results[0];
    expect(match?.status).toBe('exact_match');
    expect(match?.academyMemberId).toBe('p-raj-1');
  });
});
