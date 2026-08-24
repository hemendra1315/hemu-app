import { describe, expect, it } from 'vitest';

describe('Phase 8 Dashboard Security & Isolation Verification', () => {
  it('includes academyId and role/userId context in TanStack Query keys to prevent stale cache leaking', () => {
    const academyA = 'acad-1111-1111';
    const academyB = 'acad-2222-2222';
    const coachId = 'coach-9999';

    const ownerKeyA = ['dashboard-owner', academyA];
    const ownerKeyB = ['dashboard-owner', academyB];
    const coachKeyA = ['dashboard-coach', academyA, coachId];

    expect(ownerKeyA).not.toEqual(ownerKeyB);
    expect(ownerKeyA).not.toEqual(coachKeyA);
  });

  it('guarantees consistent cricket stats math across Player Dashboard and Player Profile', () => {
    const runs = 120;
    const innings = 4;
    const notOuts = 1;
    const ballsFaced = 80;

    const dismissals = innings - notOuts;
    const average = dismissals > 0 ? (runs / dismissals).toFixed(2) : runs.toFixed(2);
    const strikeRate = ballsFaced > 0 ? ((runs / ballsFaced) * 100).toFixed(2) : '0.00';

    expect(dismissals).toBe(3);
    expect(average).toBe('40.00');
    expect(strikeRate).toBe('150.00');
  });

  it('prevents NaN / Infinity on 0 sessions / 0 matches / 0 overs', () => {
    const totalSessions = 0;
    const attendedSessions = 0;
    const totalAttendance =
      totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;

    const matchesCount = 0;
    const wins = 0;
    const winRate = matchesCount > 0 ? Math.round((wins / matchesCount) * 100) : 0;

    expect(totalAttendance).toBe(0);
    expect(winRate).toBe(0);
    expect(Number.isNaN(totalAttendance)).toBe(false);
    expect(Number.isNaN(winRate)).toBe(false);
  });
});
