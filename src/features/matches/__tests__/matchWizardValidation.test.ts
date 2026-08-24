import { describe, expect, it } from 'vitest';
import { BATTING_ORDER_OPENING, type WizardLineupEntry } from '../components/wizard/types';

function hasDuplicateNumbered(
  lineup: WizardLineupEntry[],
  entryId: string,
  order: number,
): boolean {
  if (order === BATTING_ORDER_OPENING) return false;
  return lineup.some((l) => l.memberId !== entryId && l.battingOrder === order && order > 0);
}

describe('Match Wizard Validation Logic', () => {
  it('allows multiple players in Opening position (battingOrder = 0)', () => {
    const lineup: WizardLineupEntry[] = [
      {
        memberId: 'p1',
        fullName: 'Player 1',
        email: 'p1@test.com',
        avatarUrl: null,
        battingOrder: BATTING_ORDER_OPENING,
        isCaptain: false,
        isViceCaptain: false,
        isWicketkeeper: false,
      },
      {
        memberId: 'p2',
        fullName: 'Player 2',
        email: 'p2@test.com',
        avatarUrl: null,
        battingOrder: BATTING_ORDER_OPENING,
        isCaptain: false,
        isViceCaptain: false,
        isWicketkeeper: false,
      },
    ];

    expect(hasDuplicateNumbered(lineup, 'p1', BATTING_ORDER_OPENING)).toBe(false);
    expect(hasDuplicateNumbered(lineup, 'p2', BATTING_ORDER_OPENING)).toBe(false);
  });

  it('detects duplicate numbered batting positions (> 0)', () => {
    const lineup: WizardLineupEntry[] = [
      {
        memberId: 'p1',
        fullName: 'Player 1',
        email: 'p1@test.com',
        avatarUrl: null,
        battingOrder: 3,
        isCaptain: false,
        isViceCaptain: false,
        isWicketkeeper: false,
      },
      {
        memberId: 'p2',
        fullName: 'Player 2',
        email: 'p2@test.com',
        avatarUrl: null,
        battingOrder: 3,
        isCaptain: false,
        isViceCaptain: false,
        isWicketkeeper: false,
      },
    ];

    expect(hasDuplicateNumbered(lineup, 'p1', 3)).toBe(true);
    expect(hasDuplicateNumbered(lineup, 'p2', 3)).toBe(true);
  });

  it('allows distinct numbered batting positions', () => {
    const lineup: WizardLineupEntry[] = [
      {
        memberId: 'p1',
        fullName: 'Player 1',
        email: 'p1@test.com',
        avatarUrl: null,
        battingOrder: 3,
        isCaptain: false,
        isViceCaptain: false,
        isWicketkeeper: false,
      },
      {
        memberId: 'p2',
        fullName: 'Player 2',
        email: 'p2@test.com',
        avatarUrl: null,
        battingOrder: 4,
        isCaptain: false,
        isViceCaptain: false,
        isWicketkeeper: false,
      },
    ];

    expect(hasDuplicateNumbered(lineup, 'p1', 3)).toBe(false);
    expect(hasDuplicateNumbered(lineup, 'p2', 4)).toBe(false);
  });

  describe('Cricket Overs Notation Validation', () => {
    const isOversValid = (overs: string) => /^\d+(\.[0-5])?$/.test(overs.trim());

    it('accepts valid base-6 overs notation', () => {
      expect(isOversValid('0')).toBe(true);
      expect(isOversValid('0.0')).toBe(true);
      expect(isOversValid('4')).toBe(true);
      expect(isOversValid('4.0')).toBe(true);
      expect(isOversValid('4.1')).toBe(true);
      expect(isOversValid('4.5')).toBe(true);
      expect(isOversValid('10.5')).toBe(true);
      expect(isOversValid('20.0')).toBe(true);
      expect(isOversValid('50.0')).toBe(true);
    });

    it('rejects invalid base-6 overs notation', () => {
      expect(isOversValid('4.6')).toBe(false);
      expect(isOversValid('4.7')).toBe(false);
      expect(isOversValid('4.8')).toBe(false);
      expect(isOversValid('4.9')).toBe(false);
      expect(isOversValid('-1')).toBe(false);
      expect(isOversValid('4.5.1')).toBe(false);
      expect(isOversValid('abc')).toBe(false);
    });
  });
});
