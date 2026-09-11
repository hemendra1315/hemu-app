import { describe, expect, it } from 'vitest';
import { applyMappingFix, identityMatches } from '../import/applyMappingFix';

const MEMBER_A = '11111111-1111-1111-1111-111111111111';
const MEMBER_B = '22222222-2222-2222-2222-222222222222';

describe('identityMatches', () => {
  it('matches a real-member row by academy member id', () => {
    expect(
      identityMatches(
        { academyMemberId: MEMBER_A, isGuest: false },
        { academyMemberId: MEMBER_A, isGuest: false, guestName: null },
      ),
    ).toBe(true);
  });

  it('matches a guest row by name, case- and whitespace-insensitively', () => {
    expect(
      identityMatches(
        { academyMemberId: null, isGuest: true, guestName: '  Arjun Sharma ' },
        { academyMemberId: null, isGuest: true, guestName: 'arjun sharma' },
      ),
    ).toBe(true);
  });

  it('does not match a guest row against a member identity, even with a null id', () => {
    expect(
      identityMatches(
        { academyMemberId: null, isGuest: true, guestName: 'Arjun Sharma' },
        { academyMemberId: null, isGuest: false, guestName: null },
      ),
    ).toBe(false);
  });
});

describe('applyMappingFix', () => {
  it('turns a guest into a real member without touching the rest of the row', () => {
    const rows = [
      { academyMemberId: null, isGuest: true, guestName: 'Arjun Sharma', runs: 42, balls: 30 },
    ];
    const result = applyMappingFix(rows, [
      {
        from: { academyMemberId: null, isGuest: true, guestName: 'Arjun Sharma' },
        to: { academyMemberId: MEMBER_A, isGuest: false, guestName: null },
      },
    ]);
    expect(result).toEqual([
      { academyMemberId: MEMBER_A, isGuest: false, guestName: null, runs: 42, balls: 30 },
    ]);
  });

  it('turns a real member into a guest', () => {
    const rows = [{ academyMemberId: MEMBER_A, isGuest: false, guestName: null, wickets: 2 }];
    const result = applyMappingFix(rows, [
      {
        from: { academyMemberId: MEMBER_A, isGuest: false, guestName: null },
        to: { academyMemberId: null, isGuest: true, guestName: 'Some Guest' },
      },
    ]);
    expect(result).toEqual([
      { academyMemberId: null, isGuest: true, guestName: 'Some Guest', wickets: 2 },
    ]);
  });

  it('reassigns from one real member to a different one', () => {
    const rows = [{ academyMemberId: MEMBER_A, isGuest: false, catches: 1 }];
    const result = applyMappingFix(rows, [
      {
        from: { academyMemberId: MEMBER_A, isGuest: false, guestName: null },
        to: { academyMemberId: MEMBER_B, isGuest: false, guestName: null },
      },
    ]);
    // A fixed row always gets an explicit guestName (null here, since it's not
    // a guest) even if the original row never had that key at all -- every
    // real caller (the saveMatchResult payload builders) reads all three
    // fields unconditionally, so this is harmless, just worth pinning down.
    expect(result).toEqual([
      { academyMemberId: MEMBER_B, isGuest: false, guestName: null, catches: 1 },
    ]);
  });

  it('leaves rows that match no fix untouched', () => {
    const rows = [
      { academyMemberId: MEMBER_A, isGuest: false, runs: 10 },
      { academyMemberId: null, isGuest: true, guestName: 'Unrelated Guest', runs: 5 },
    ];
    const result = applyMappingFix(rows, [
      {
        from: { academyMemberId: MEMBER_B, isGuest: false, guestName: null },
        to: { academyMemberId: MEMBER_A, isGuest: false, guestName: null },
      },
    ]);
    expect(result).toEqual(rows);
  });

  it('applies multiple independent fixes in one pass', () => {
    const rows = [
      { academyMemberId: null, isGuest: true, guestName: 'Guest One' },
      { academyMemberId: null, isGuest: true, guestName: 'Guest Two' },
    ];
    const result = applyMappingFix(rows, [
      {
        from: { academyMemberId: null, isGuest: true, guestName: 'Guest One' },
        to: { academyMemberId: MEMBER_A, isGuest: false, guestName: null },
      },
      {
        from: { academyMemberId: null, isGuest: true, guestName: 'Guest Two' },
        to: { academyMemberId: MEMBER_B, isGuest: false, guestName: null },
      },
    ]);
    expect(result).toEqual([
      { academyMemberId: MEMBER_A, isGuest: false, guestName: null },
      { academyMemberId: MEMBER_B, isGuest: false, guestName: null },
    ]);
  });

  it('returns the same array reference when there are no fixes', () => {
    const rows = [{ academyMemberId: MEMBER_A, isGuest: false }];
    expect(applyMappingFix(rows, [])).toBe(rows);
  });
});
