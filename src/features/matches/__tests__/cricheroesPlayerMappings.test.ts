import { describe, expect, it } from 'vitest';
import { matchPlayers, type SavedMappingCandidate } from '../import/playerNameMatcher';

describe('Persistent CricHeroes Player Identity Mappings', () => {
  const academyRoster = [
    { id: 'member-1', fullName: 'Hemendra Kumar', email: 'hemendra@academy.com' },
    { id: 'member-2', fullName: 'Ankit Sharma', email: 'ankit@academy.com' },
  ];

  it('uses saved mapping on subsequent imports instead of fuzzy matching', () => {
    const savedMappings: SavedMappingCandidate[] = [
      {
        cricheroesName: 'Hemu K',
        academyMemberId: 'member-1',
        isGuest: false,
      },
    ];

    const extractedNames = ['Hemu K', 'Ankit Sharma', 'New Guest Batter'];

    const matched = matchPlayers(extractedNames, academyRoster, savedMappings);

    const m0 = matched[0];
    const m1 = matched[1];
    const m2 = matched[2];

    // Hemu K matches saved mapping -> member-1
    expect(m0?.cricheroesName).toBe('Hemu K');
    expect(m0?.academyMemberId).toBe('member-1');
    expect(m0?.savedMapping).toBe(true);
    expect(m0?.isGuest).toBe(false);

    // Ankit Sharma matches exact name -> member-2
    expect(m1?.cricheroesName).toBe('Ankit Sharma');
    expect(m1?.academyMemberId).toBe('member-2');
    expect(m1?.status).toBe('exact_match');

    // New Guest Batter -> fallback to Guest Player
    expect(m2?.cricheroesName).toBe('New Guest Batter');
    expect(m2?.isGuest).toBe(true);
    expect(m2?.academyMemberId).toBeNull();
  });

  it('isolates saved mappings between different academies', () => {
    const academyAMappings: SavedMappingCandidate[] = [
      {
        cricheroesName: 'Samir P',
        academyMemberId: 'acad-a-member-1',
        isGuest: false,
      },
    ];

    // Searching with Academy B roster (which does NOT have acad-a-member-1)
    const academyBRoster = [
      { id: 'acad-b-member-1', fullName: 'Samir Patel', email: 'samir@academy-b.com' },
    ];

    const matched = matchPlayers(['Samir P'], academyBRoster, academyAMappings);

    // Should NOT automatically attach Academy A's member ID
    expect(matched[0]?.academyMemberId).not.toBe('acad-a-member-1');
  });
});
