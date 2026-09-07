/* eslint-disable @typescript-eslint/no-explicit-any */
import { rpc, unwrap, unwrapMaybe } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { UUID } from '@/types';
import type {
  BatchCoachRow,
  Coach,
  CoachBatchAssignment,
  CoachWithBatches,
  UpdateCoachProfileInput,
} from './coachesTypes';

/**
 * `coaches` (bio/specialization/certifications/experience) and `batch_coaches`
 * (head coach + assistants per batch) already exist in the database -- both
 * were provisioned by a migration, wired up with RPCs and RLS, and never
 * queried by the frontend until now. `coaches` rows are auto-created by the
 * `ensure_person_row` trigger whenever a member's role becomes `coach`, so
 * every active coach in `academy_members` should have one; the merge below
 * is defensive against a coach whose row hasn't landed yet rather than the
 * normal case.
 *
 * `academy_members` is the base list (not `coaches`) so a coach still shows
 * up, name and all, even in that edge case -- just without a profile to show.
 */
async function fetchActiveCoachMembers(
  academyId: UUID,
): Promise<Array<{ id: UUID; userId: UUID; fullName: string | null; email: string }>> {
  const rows = await unwrap<any[]>(
    supabase
      .from('academy_members')
      .select('id, user_id, profiles!academy_members_user_id_fkey(full_name, email)')
      .eq('academy_id', academyId)
      .eq('role', 'coach')
      .eq('status', 'active')
      .returns<any[]>(),
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    fullName: row.profiles?.full_name ?? null,
    email: row.profiles?.email ?? '',
  }));
}

async function fetchCoachProfiles(academyId: UUID): Promise<Map<UUID, any>> {
  const rows = await unwrap<any[]>(
    supabase
      .from('coaches')
      .select(
        'id, user_id, bio, specialization, certifications, experience_years, is_active, profiles!coaches_user_id_fkey(full_name, email, avatar_url)',
      )
      .eq('academy_id', academyId)
      .returns<any[]>(),
  );
  return new Map(rows.map((row) => [row.user_id as UUID, row]));
}

function toCoach(
  member: { id: UUID; userId: UUID; fullName: string | null; email: string },
  profileRow: any | undefined,
): Coach {
  return {
    // Never fall back to `member.id` here -- that's an `academy_members.id`,
    // a different id space than `coaches.id`, and every caller of `coachId`
    // (profile links, batch-assignment RPCs) treats it as the latter.
    coachId: profileRow?.id ?? null,
    academyMemberId: member.id,
    userId: member.userId,
    fullName: profileRow?.profiles?.full_name ?? member.fullName,
    email: profileRow?.profiles?.email ?? member.email,
    avatarUrl: profileRow?.profiles?.avatar_url ?? null,
    bio: profileRow?.bio ?? null,
    specialization: profileRow?.specialization ?? [],
    certifications: profileRow?.certifications ?? [],
    experienceYears: profileRow?.experience_years ?? null,
    isActive: profileRow?.is_active ?? true,
  };
}

export async function fetchCoaches(academyId: UUID): Promise<Coach[]> {
  const [members, profiles] = await Promise.all([
    fetchActiveCoachMembers(academyId),
    fetchCoachProfiles(academyId),
  ]);

  return members
    .map((member) => toCoach(member, profiles.get(member.userId)))
    .sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
}

/**
 * One coach's full profile plus every batch they're assigned to.
 * `coachId` is a `coaches.id` -- for a coach viewing their own profile, resolve
 * it via `fetchMyCoachId` first (their id in the `coaches` table isn't
 * something the UI has any other reason to know ahead of time).
 */
export async function fetchCoach(academyId: UUID, coachId: UUID): Promise<CoachWithBatches> {
  const profileRow = await unwrap<any>(
    supabase
      .from('coaches')
      .select(
        'id, user_id, bio, specialization, certifications, experience_years, is_active, profiles!coaches_user_id_fkey(full_name, email, avatar_url)',
      )
      .eq('id', coachId)
      // Scopes this to the caller's active academy -- without it, a coach
      // record from a *different* academy the caller also belongs to (the
      // `coaches` RLS policy allows reading any academy they're a member of)
      // could be loaded here regardless of which academy is active in the UI.
      .eq('academy_id', academyId)
      .single()
      .returns<any>(),
  );

  const member = await unwrapMaybe<any>(
    supabase
      .from('academy_members')
      .select('id')
      .eq('academy_id', academyId)
      .eq('user_id', profileRow.user_id)
      .eq('role', 'coach')
      .maybeSingle()
      .returns<any>(),
  );

  const assignmentRows = await unwrap<any[]>(
    supabase
      .from('batch_coaches')
      .select('is_primary, batches(id, name)')
      .eq('coach_id', coachId)
      .returns<any[]>(),
  );

  const batches: CoachBatchAssignment[] = assignmentRows
    .filter((row) => row.batches)
    .map((row) => ({
      batchId: row.batches.id,
      batchName: row.batches.name,
      isPrimary: row.is_primary,
    }));

  return {
    coachId: profileRow.id,
    academyMemberId: member?.id ?? null,
    userId: profileRow.user_id,
    fullName: profileRow.profiles?.full_name ?? null,
    email: profileRow.profiles?.email ?? '',
    avatarUrl: profileRow.profiles?.avatar_url ?? null,
    bio: profileRow.bio ?? null,
    specialization: profileRow.specialization ?? [],
    certifications: profileRow.certifications ?? [],
    experienceYears: profileRow.experience_years ?? null,
    isActive: profileRow.is_active ?? true,
    batches,
  };
}

/** The current user's own `coaches.id` in this academy, or null if they have none. */
export async function fetchMyCoachId(academyId: UUID, userId: UUID): Promise<UUID | null> {
  const row = await unwrapMaybe<any>(
    supabase
      .from('coaches')
      .select('id')
      .eq('academy_id', academyId)
      .eq('user_id', userId)
      .maybeSingle()
      .returns<any>(),
  );
  return row?.id ?? null;
}

export async function updateCoachProfile(
  academyId: UUID,
  coachId: UUID,
  input: UpdateCoachProfileInput,
): Promise<CoachWithBatches> {
  await unwrap(
    supabase
      .from('coaches')
      .update({
        bio: input.bio && input.bio.trim() !== '' ? input.bio.trim() : null,
        specialization: input.specialization,
        certifications: input.certifications,
        experience_years: input.experienceYears,
      })
      .eq('id', coachId)
      .select('id')
      .single(),
  );
  return fetchCoach(academyId, coachId);
}

export async function fetchBatchCoaches(batchId: UUID): Promise<BatchCoachRow[]> {
  const assignmentRows = await unwrap<any[]>(
    supabase
      .from('batch_coaches')
      .select(
        'academy_id, coach_id, is_primary, coaches!batch_coaches_coach_id_fkey(id, user_id, profiles!coaches_user_id_fkey(full_name, email, avatar_url))',
      )
      .eq('batch_id', batchId)
      .returns<any[]>(),
  );
  if (assignmentRows.length === 0) return [];

  // `batch_coaches` has no reference to `academy_members` -- resolve each
  // coach's membership id the same defensive way `fetchCoaches` does. Scoped
  // to `academy_id` (every `batch_coaches` row for one batch shares the same
  // academy) so a user with a `coach` membership in more than one academy
  // can't have the wrong academy's `academy_members.id` attached here.
  const academyId = assignmentRows[0].academy_id;
  const userIds = assignmentRows.map((row) => row.coaches?.user_id).filter(Boolean);
  const members =
    userIds.length === 0
      ? []
      : await unwrap<any[]>(
          supabase
            .from('academy_members')
            .select('id, user_id')
            .eq('academy_id', academyId)
            .in('user_id', userIds)
            .eq('role', 'coach')
            .returns<any[]>(),
        );
  const memberByUser = new Map(members.map((m) => [m.user_id, m.id]));

  return assignmentRows
    .filter((row) => row.coaches)
    .map((row) => ({
      coachId: row.coaches.id,
      academyMemberId: memberByUser.get(row.coaches.user_id) ?? null,
      fullName: row.coaches.profiles?.full_name ?? null,
      email: row.coaches.profiles?.email ?? '',
      avatarUrl: row.coaches.profiles?.avatar_url ?? null,
      isPrimary: row.is_primary,
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

/**
 * Keeps `batches.coach_id` (what every other screen -- dashboards, the batch
 * list, the batch edit form's "Assigned coach" field, session creation --
 * still reads) pointed at the current head coach. There's no database
 * trigger doing this; the two representations only agree if every write path
 * that changes the head coach updates both, which is what this and
 * `removeCoachFromBatch` below do.
 */
async function syncBatchHeadCoach(batchId: UUID, academyMemberId: UUID | null): Promise<void> {
  await unwrap(
    supabase.from('batches').update({ coach_id: academyMemberId }).eq('id', batchId).select('id'),
  );
}

export async function setHeadCoach(
  batchId: UUID,
  coach: { coachId: UUID; academyMemberId: UUID | null },
): Promise<void> {
  await rpc<void>('assign_coach_to_batch', {
    p_batch: batchId,
    p_coach: coach.coachId,
    p_is_primary: true,
  });
  await syncBatchHeadCoach(batchId, coach.academyMemberId);
}

export async function addAssistantCoach(batchId: UUID, coachId: UUID): Promise<void> {
  await rpc<void>('assign_coach_to_batch', {
    p_batch: batchId,
    p_coach: coachId,
    p_is_primary: false,
  });
}

/**
 * `wasHeadCoach` tells this whether to also clear `batches.coach_id` -- pass
 * `true` when the coach being removed is the one `fetchBatchCoaches` marked
 * `isPrimary`. Assistant removals leave the head coach untouched.
 */
export async function removeCoachFromBatch(
  batchId: UUID,
  coachId: UUID,
  wasHeadCoach: boolean,
): Promise<void> {
  await rpc<void>('remove_coach_from_batch', { p_batch: batchId, p_coach: coachId });
  if (wasHeadCoach) await syncBatchHeadCoach(batchId, null);
}
