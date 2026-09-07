import type { UUID } from '@/types';

/**
 * A coach's profile, backed by the `coaches` table. `coaches.id` (`coachId`
 * here) is that table's own identity, distinct from `academy_members.id` --
 * the id `batches.coach_id` and every other coach-select dropdown in the app
 * already use. `academyMemberId` carries that second id alongside, so this
 * feature can write to both worlds without forcing a migration of either.
 *
 * Both ids are nullable, for two different edge cases: `coachId` is `null`
 * when the `coaches` row hasn't been created yet for this member (the
 * `ensure_person_row` trigger creates it synchronously when a role becomes
 * `coach`, so this should only ever be a brief race, not a steady state) --
 * a coach with no `coachId` can't be linked to a profile page or assigned to
 * a batch (`assign_coach_to_batch` needs a real `coaches.id`), so callers
 * must check it before using it as one. `academyMemberId` is `null` when the
 * membership row can't be found (e.g. deactivated after the `coaches` row
 * was created). The two must never be assumed equal, and neither should ever
 * be compared to the other for "is this the same coach" -- always compare
 * `coachId` to `coachId` or `academyMemberId` to `academyMemberId`.
 */
export type Coach = {
  coachId: UUID | null;
  academyMemberId: UUID | null;
  userId: UUID;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  specialization: string[];
  certifications: string[];
  experienceYears: number | null;
  isActive: boolean;
};

export type UpdateCoachProfileInput = {
  bio: string | null;
  specialization: string[];
  certifications: string[];
  experienceYears: number | null;
};

/** One batch a coach is assigned to, and whether they're the head coach there. */
export type CoachBatchAssignment = {
  batchId: UUID;
  batchName: string;
  isPrimary: boolean;
};

/**
 * `fetchCoach` always looks a coach up BY their `coaches.id`, so unlike the
 * list form (`Coach`), `coachId` here is always a real, non-null id -- the
 * override narrows it back for `CoachProfilePage`'s edit/assign calls.
 */
export type CoachWithBatches = Omit<Coach, 'coachId'> & {
  coachId: UUID;
  batches: CoachBatchAssignment[];
};

/** One row of `batch_coaches` for a single batch, joined with the coach's profile. */
export type BatchCoachRow = {
  coachId: UUID;
  academyMemberId: UUID | null;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  isPrimary: boolean;
};
