import type { UUID } from '@/types';
import type { AttendanceStatus } from './attendanceTypes';

/**
 * One attendance mark, flattened with the session it belongs to.
 *
 * `attendance` rows carry no date of their own — the date lives on
 * `training_sessions` — so every time-based view has to join. Flattening here
 * keeps that join in one place instead of in every consumer.
 */
export type AttendanceMark = {
  playerId: UUID;
  status: AttendanceStatus;
  sessionId: UUID;
  sessionDate: string; // YYYY-MM-DD
  batchId: UUID | null;
};

export type PlayerAttendanceStat = {
  playerId: UUID;
  fullName: string;
  sessionsRecorded: number;
  present: number;
  absent: number;
  /** Percent present, 0–100, rounded. `null` when nothing was recorded. */
  rate: number | null;
  /** Absences since the player was last marked present, most recent first. */
  currentAbsenceStreak: number;
  lastPresentDate: string | null;
  lastRecordedDate: string | null;
};

export type BatchAttendanceStat = {
  batchId: UUID;
  name: string;
  sessionsRecorded: number;
  present: number;
  absent: number;
  rate: number | null;
};

export type AttendanceInsights = {
  from: string;
  to: string;
  totalMarks: number;
  present: number;
  absent: number;
  overallRate: number | null;
  sessionsHeld: number;
  playersTracked: number;
  players: PlayerAttendanceStat[];
  batches: BatchAttendanceStat[];
  /** Players worth a coach's attention — see `isAtRisk`. */
  atRisk: PlayerAttendanceStat[];
};

/**
 * A player is worth flagging if they have missed the last two or more sessions
 * they were marked for, or if they have attended less than 60% of at least
 * three. One absence is not a pattern; the streak is what a coach actually
 * wants to notice, so it is checked first and independently of the rate.
 */
export function isAtRisk(stat: PlayerAttendanceStat): boolean {
  if (stat.currentAbsenceStreak >= 2) return true;
  return stat.sessionsRecorded >= 3 && stat.rate !== null && stat.rate < 60;
}

function rateOf(present: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((present / total) * 100);
}

/**
 * Aggregate raw marks into everything the attendance screen shows.
 *
 * Kept as a pure function, separate from the query that feeds it, so the
 * arithmetic can be tested against fixed input rather than only being seen on
 * a screen — the mistake that let the CricHeroes import ship four defects.
 *
 * The denominator is deliberately "sessions this player was marked for", not
 * "sessions the academy held". A player who was never marked for a session was
 * not necessarily absent from it — treating unmarked as absent would invent
 * absences for anyone who joined a batch late.
 */
export function buildAttendanceInsights({
  marks,
  playerNames,
  batchNames,
  from,
  to,
}: {
  marks: AttendanceMark[];
  playerNames: Map<UUID, string>;
  batchNames: Map<UUID, string>;
  from: string;
  to: string;
}): AttendanceInsights {
  const byPlayer = new Map<UUID, AttendanceMark[]>();
  const byBatch = new Map<UUID, AttendanceMark[]>();
  const sessionIds = new Set<UUID>();

  for (const mark of marks) {
    sessionIds.add(mark.sessionId);

    const playerMarks = byPlayer.get(mark.playerId);
    if (playerMarks) playerMarks.push(mark);
    else byPlayer.set(mark.playerId, [mark]);

    if (mark.batchId) {
      const batchMarks = byBatch.get(mark.batchId);
      if (batchMarks) batchMarks.push(mark);
      else byBatch.set(mark.batchId, [mark]);
    }
  }

  const players: PlayerAttendanceStat[] = [...byPlayer.entries()].map(([playerId, own]) => {
    // Most recent first, so the leading run of absences is the current streak.
    const ordered = [...own].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));

    let present = 0;
    let absent = 0;
    for (const mark of ordered) {
      if (mark.status === 'present') present += 1;
      else absent += 1;
    }

    let currentAbsenceStreak = 0;
    for (const mark of ordered) {
      if (mark.status !== 'absent') break;
      currentAbsenceStreak += 1;
    }

    return {
      playerId,
      fullName: playerNames.get(playerId) ?? 'Unknown player',
      sessionsRecorded: ordered.length,
      present,
      absent,
      rate: rateOf(present, ordered.length),
      currentAbsenceStreak,
      lastPresentDate: ordered.find((m) => m.status === 'present')?.sessionDate ?? null,
      lastRecordedDate: ordered[0]?.sessionDate ?? null,
    };
  });

  // Worst attendance first — the whole point of the screen is to surface who
  // needs chasing, and a list sorted by name buries them.
  players.sort((a, b) => {
    const aRate = a.rate ?? 101;
    const bRate = b.rate ?? 101;
    if (aRate !== bRate) return aRate - bRate;
    return a.fullName.localeCompare(b.fullName);
  });

  const batches: BatchAttendanceStat[] = [...byBatch.entries()]
    .map(([batchId, own]) => {
      let present = 0;
      let absent = 0;
      for (const mark of own) {
        if (mark.status === 'present') present += 1;
        else absent += 1;
      }
      return {
        batchId,
        name: batchNames.get(batchId) ?? 'Unnamed batch',
        sessionsRecorded: new Set(own.map((m) => m.sessionId)).size,
        present,
        absent,
        rate: rateOf(present, own.length),
      };
    })
    .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));

  const present = players.reduce((sum, p) => sum + p.present, 0);
  const absent = players.reduce((sum, p) => sum + p.absent, 0);

  return {
    from,
    to,
    totalMarks: marks.length,
    present,
    absent,
    overallRate: rateOf(present, present + absent),
    sessionsHeld: sessionIds.size,
    playersTracked: players.length,
    players,
    batches,
    atRisk: players.filter(isAtRisk),
  };
}

/** Inclusive first and last day of a `YYYY-MM` month, as `YYYY-MM-DD`. */
export function monthBounds(month: string): { from: string; to: string } {
  const [yearPart, monthPart] = month.split('-');
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  // Day 0 of the next month is the last day of this one, which avoids having
  // to know month lengths or leap years.
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

/** The last `count` months, most recent first, as `{ value: 'YYYY-MM', label }`. */
export function recentMonths(
  count: number,
  today = new Date(),
): Array<{
  value: string;
  label: string;
}> {
  const months: Array<{ value: string; label: string }> = [];
  for (let back = 0; back < count; back += 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    months.push({
      value,
      label: date.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    });
  }
  return months;
}
