import { describe, expect, it } from 'vitest';
import type { UUID } from '@/types';
import {
  buildAttendanceInsights,
  isAtRisk,
  monthBounds,
  recentMonths,
  type AttendanceMark,
} from '../api/attendanceInsights';

const ANA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as UUID;
const BEN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' as UUID;
const CAT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' as UUID;
const MORNING = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' as UUID;
const EVENING = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' as UUID;

const playerNames = new Map<UUID, string>([
  [ANA, 'Ana'],
  [BEN, 'Ben'],
  [CAT, 'Cat'],
]);
const batchNames = new Map<UUID, string>([
  [MORNING, 'Morning'],
  [EVENING, 'Evening'],
]);

function mark(
  playerId: UUID,
  sessionDate: string,
  status: 'present' | 'absent',
  batchId: UUID = MORNING,
): AttendanceMark {
  return {
    playerId,
    status,
    sessionId: `s-${sessionDate}-${batchId}` as UUID,
    sessionDate,
    batchId,
  };
}

function build(marks: AttendanceMark[]) {
  return buildAttendanceInsights({
    marks,
    playerNames,
    batchNames,
    from: '2026-08-01',
    to: '2026-08-31',
  });
}

describe('buildAttendanceInsights', () => {
  it('counts a rate per player and orders the worst attenders first', () => {
    const insights = build([
      mark(ANA, '2026-08-01', 'present'),
      mark(ANA, '2026-08-03', 'present'),
      mark(ANA, '2026-08-05', 'present'),
      mark(BEN, '2026-08-01', 'present'),
      mark(BEN, '2026-08-03', 'absent'),
      mark(BEN, '2026-08-05', 'absent'),
    ]);

    expect(insights.players.map((p) => p.fullName)).toEqual(['Ben', 'Ana']);
    expect(insights.players[0]?.rate).toBe(33);
    expect(insights.players[1]?.rate).toBe(100);
    expect(insights.overallRate).toBe(67);
    expect(insights.sessionsHeld).toBe(3);
    expect(insights.playersTracked).toBe(2);
  });

  it('counts the current absence streak from the most recent session backwards', () => {
    // Deliberately out of order: the input arrives in whatever order PostgREST
    // returns it, so the streak must not depend on array order.
    const insights = build([
      mark(BEN, '2026-08-05', 'absent'),
      mark(BEN, '2026-08-01', 'absent'),
      mark(BEN, '2026-08-03', 'present'),
      mark(BEN, '2026-08-07', 'absent'),
    ]);

    const ben = insights.players.find((p) => p.fullName === 'Ben');
    expect(ben?.currentAbsenceStreak).toBe(2);
    expect(ben?.lastPresentDate).toBe('2026-08-03');
    expect(ben?.lastRecordedDate).toBe('2026-08-07');
  });

  it('does not count sessions a player was never marked for', () => {
    // Ana was marked for three sessions, Cat only for the last one. Cat is at
    // 100%, not 33% — a player who joined late has not "missed" what happened
    // before they arrived.
    const insights = build([
      mark(ANA, '2026-08-01', 'present'),
      mark(ANA, '2026-08-03', 'present'),
      mark(ANA, '2026-08-05', 'absent'),
      mark(CAT, '2026-08-05', 'present'),
    ]);

    const cat = insights.players.find((p) => p.fullName === 'Cat');
    expect(cat?.sessionsRecorded).toBe(1);
    expect(cat?.rate).toBe(100);
  });

  it('aggregates per batch independently of per player', () => {
    const insights = build([
      mark(ANA, '2026-08-01', 'present', MORNING),
      mark(BEN, '2026-08-01', 'absent', MORNING),
      mark(ANA, '2026-08-02', 'present', EVENING),
      mark(BEN, '2026-08-02', 'present', EVENING),
    ]);

    const morning = insights.batches.find((b) => b.name === 'Morning');
    const evening = insights.batches.find((b) => b.name === 'Evening');
    expect(morning?.rate).toBe(50);
    expect(evening?.rate).toBe(100);
    // Worst batch first, same as players.
    expect(insights.batches[0]?.name).toBe('Morning');
  });

  it('survives a mark whose session has no batch', () => {
    const insights = buildAttendanceInsights({
      marks: [
        {
          playerId: ANA,
          status: 'present',
          sessionId: 's1' as UUID,
          sessionDate: '2026-08-01',
          batchId: null,
        },
      ],
      playerNames,
      batchNames,
      from: '2026-08-01',
      to: '2026-08-31',
    });

    expect(insights.batches).toHaveLength(0);
    expect(insights.players).toHaveLength(1);
  });

  it('returns nulls rather than dividing by zero when nothing was marked', () => {
    const insights = build([]);
    expect(insights.overallRate).toBeNull();
    expect(insights.totalMarks).toBe(0);
    expect(insights.atRisk).toEqual([]);
  });

  it('names a player it has no profile for rather than rendering blank', () => {
    const insights = build([
      mark('99999999-9999-4999-8999-999999999999' as UUID, '2026-08-01', 'present'),
    ]);
    expect(insights.players[0]?.fullName).toBe('Unknown player');
  });
});

describe('isAtRisk', () => {
  const base = {
    playerId: ANA,
    fullName: 'Ana',
    present: 0,
    absent: 0,
    lastPresentDate: null,
    lastRecordedDate: null,
  };

  it('flags two consecutive absences however good the overall rate is', () => {
    expect(isAtRisk({ ...base, sessionsRecorded: 10, rate: 80, currentAbsenceStreak: 2 })).toBe(
      true,
    );
  });

  it('does not flag a single absence', () => {
    expect(isAtRisk({ ...base, sessionsRecorded: 10, rate: 90, currentAbsenceStreak: 1 })).toBe(
      false,
    );
  });

  it('flags a low rate only once there is enough history to mean anything', () => {
    // 1 of 2 is 50%, but two sessions is not a pattern.
    expect(isAtRisk({ ...base, sessionsRecorded: 2, rate: 50, currentAbsenceStreak: 1 })).toBe(
      false,
    );
    expect(isAtRisk({ ...base, sessionsRecorded: 3, rate: 33, currentAbsenceStreak: 1 })).toBe(
      true,
    );
  });
});

describe('month helpers', () => {
  it('bounds a 31-day month, a 30-day month and February', () => {
    expect(monthBounds('2026-08')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(monthBounds('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('gets February right in a leap year', () => {
    expect(monthBounds('2028-02').to).toBe('2028-02-29');
  });

  it('lists recent months newest first and steps back across a year boundary', () => {
    const months = recentMonths(3, new Date(Date.UTC(2026, 0, 15)));
    expect(months.map((m) => m.value)).toEqual(['2026-01', '2025-12', '2025-11']);
  });
});
