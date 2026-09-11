import type { UUID } from '@/types';

/**
 * Identifies one "slot" in a saved scorecard row — either a real academy
 * member, or a guest identified by the name CricHeroes printed for them
 * (guests have no member id, so the name is the only handle on them).
 */
export type MappingIdentity = {
  academyMemberId: UUID | null;
  isGuest: boolean;
  guestName: string | null;
};

type IdentifiableRow = {
  academyMemberId: UUID | null;
  isGuest?: boolean;
  guestName?: string | null;
};

function normalize(name: string | null): string {
  return (name ?? '').trim().toLowerCase();
}

/** Does this saved row currently belong to the given identity? */
export function identityMatches(row: IdentifiableRow, identity: MappingIdentity): boolean {
  const rowIsGuest = row.isGuest ?? false;
  if (identity.isGuest) {
    return rowIsGuest && normalize(row.guestName ?? null) === normalize(identity.guestName);
  }
  return !rowIsGuest && row.academyMemberId === identity.academyMemberId;
}

export type MappingFix = {
  /** The mapping this scorecard row was saved under originally. */
  from: MappingIdentity;
  /** What it should say instead. */
  to: MappingIdentity;
};

/**
 * Applies a set of "this player was actually X, not Y" corrections to a
 * saved scorecard's lineup/batting/bowling/fielding rows, without touching
 * anything else about them (runs, overs, catches, batting order, ...).
 *
 * Used when fixing a past CricHeroes import: the review screen only knows
 * which *identity* changed, not which array index each row lives at, so
 * every row is matched by identity rather than position.
 */
export function applyMappingFix<T extends IdentifiableRow>(rows: T[], fixes: MappingFix[]): T[] {
  if (fixes.length === 0) return rows;
  return rows.map((row) => {
    const fix = fixes.find((f) => identityMatches(row, f.from));
    if (!fix) return row;
    return {
      ...row,
      academyMemberId: fix.to.isGuest ? null : fix.to.academyMemberId,
      isGuest: fix.to.isGuest,
      guestName: fix.to.isGuest ? fix.to.guestName : null,
    };
  });
}
