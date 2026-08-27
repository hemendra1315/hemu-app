/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrap, unwrapVoid } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { AcademyMember, UUID } from '@/types';
import type { Batch, BatchPlayer, CreateBatchInput, UpdateBatchInput } from './batchesTypes';

// `batches.coach_id` references `academy_members(id)` via `batches_coach_id_fkey`.
// `academy_members` references `profiles` twice (`user_id`, `invited_by`) so the
// inner `profiles` embed must use `academy_members_user_id_fkey` explicitly.
const BATCH_COLUMNS = `id, academy_id, name, age_group, description, training_days, training_time, coach_id, created_at, updated_at, coach:academy_members!batches_coach_id_fkey(id, role, status, profiles!academy_members_user_id_fkey(full_name, email, avatar_url))`;

/**
 * `batches.training_days` is a comma-separated string per migration 0005, and
 * the `Batch` type promises `string | null`. Reality disagrees in two ways:
 * the demo-data seeder inserts `ARRAY['Mon','Wed','Fri']`, and a database whose
 * column is `text[]` hands PostgREST a real JS array. Either way, consumers
 * calling `.split(',')` — the Batch detail page and its edit form — throw
 * `trainingDays.split is not a function` and take the whole screen down.
 *
 * Normalising here, at the single mapping boundary, means every consumer gets
 * the string the type advertises whichever shape the column actually holds.
 */
export function normalizeTrainingDays(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const join = (parts: string[]) => {
    const cleaned = parts.map((part) => part.replace(/^"|"$/g, '').trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned.join(', ') : null;
  };

  if (Array.isArray(value)) return join(value.map((part) => String(part)));

  const text = String(value).trim();
  // A text[] coerced into a text column stores the literal `{Mon,Wed,Fri}`.
  if (text.startsWith('{') && text.endsWith('}')) return join(text.slice(1, -1).split(','));

  return text === '' ? null : text;
}

/**
 * `training_days` is a real Postgres `text[]` column, but the create/edit
 * forms build it as a comma-joined string (e.g. `"Mon, Wed, Fri"`) for
 * display. Sending that string straight to PostgREST fails with
 * `malformed array literal` — the column needs an actual array. This
 * converts the display string back into the array the write path needs.
 */
function trainingDaysToArray(value: string | null | undefined): string[] | null {
  if (!value) return null;
  const days = value
    .split(',')
    .map((day) => day.trim())
    .filter(Boolean);
  return days.length > 0 ? days : null;
}

function toBatch(row: any): Batch {
  return {
    id: row.id,
    academyId: row.academy_id,
    name: row.name,
    ageGroup: row.age_group,
    description: row.description,
    trainingDays: normalizeTrainingDays(row.training_days),
    trainingTime: row.training_time,
    coachId: row.coach_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    coach: {
      id: row.coach?.id ?? '',
      fullName: row.coach?.profiles?.full_name ?? null,
      email: row.coach?.profiles?.email ?? (row.coach_id ? '' : 'Unassigned'),
      avatarUrl: row.coach?.profiles?.avatar_url ?? null,
    },
    playerCount: row.batch_members?.[0]?.count ?? 0,
  };
}

function toBatchPlayer(row: any): BatchPlayer {
  return {
    id: row.id,
    batchId: row.batch_id,
    academyMemberId: row.academy_member_id,
    joinedAt: row.joined_at,
    fullName: row.academy_members?.profiles?.full_name ?? null,
    email: row.academy_members?.profiles?.email ?? '',
    avatarUrl: row.academy_members?.profiles?.avatar_url ?? null,
    role: row.academy_members?.role,
    status: row.academy_members?.status,
  };
}

export async function fetchAcademyBatches(academyId: UUID): Promise<Batch[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('batches')
      .select(`${BATCH_COLUMNS}, batch_members(count)`)
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false }),
  );

  return rows.map((row) => toBatch(row));
}

export async function fetchBatchPlayers(batchId: UUID): Promise<BatchPlayer[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('batch_members')
      .select(
        'id, batch_id, academy_member_id, joined_at, academy_members!batch_members_academy_member_id_fkey(id, role, status, profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url))',
      )
      .eq('batch_id', batchId)
      .order('joined_at', { ascending: true }),
  );

  return rows.map(toBatchPlayer);
}

export async function createBatch(input: CreateBatchInput): Promise<Batch> {
  const payload = {
    academy_id: input.academyId,
    name: input.name,
    age_group: input.ageGroup,
    description: input.description && input.description.trim() !== '' ? input.description : null,
    training_days: trainingDaysToArray(input.trainingDays),
    training_time:
      input.trainingTime && input.trainingTime.trim() !== '' ? input.trainingTime : null,
    coach_id: input.coachId && input.coachId.trim() !== '' ? input.coachId : null,
  };

  const insertedRow = await unwrap<any>(
    (supabase as any)
      .from('batches')
      .insert(payload)
      .select(
        'id, academy_id, name, age_group, description, training_days, training_time, coach_id, created_at, updated_at',
      )
      .single(),
  );

  let coachObj = {
    id: null,
    fullName: null,
    email: 'Unassigned',
    avatarUrl: null,
  };

  if (insertedRow.coach_id) {
    const { data: coachRow } = await (supabase as any)
      .from('academy_members')
      .select(
        'id, role, status, profiles!academy_members_user_id_fkey(full_name, email, avatar_url)',
      )
      .eq('id', insertedRow.coach_id)
      .maybeSingle();

    if (coachRow) {
      coachObj = {
        id: coachRow.id,
        fullName: coachRow.profiles?.full_name ?? null,
        email: coachRow.profiles?.email ?? '',
        avatarUrl: coachRow.profiles?.avatar_url ?? null,
      };
    }
  }

  return {
    id: insertedRow.id,
    academyId: insertedRow.academy_id,
    name: insertedRow.name,
    ageGroup: insertedRow.age_group,
    description: insertedRow.description ?? null,
    trainingDays: normalizeTrainingDays(insertedRow.training_days),
    trainingTime: insertedRow.training_time ?? null,
    coachId: insertedRow.coach_id ?? null,
    createdAt: insertedRow.created_at,
    updatedAt: insertedRow.updated_at,
    coach: coachObj,
    playerCount: 0,
  };
}

export async function updateBatch(batchId: UUID, input: UpdateBatchInput): Promise<Batch> {
  const payload = {
    name: input.name,
    age_group: input.ageGroup,
    description: input.description && input.description.trim() !== '' ? input.description : null,
    training_days: trainingDaysToArray(input.trainingDays),
    training_time:
      input.trainingTime && input.trainingTime.trim() !== '' ? input.trainingTime : null,
    coach_id: input.coachId && input.coachId.trim() !== '' ? input.coachId : null,
  };

  const updatedRow = await unwrap<any>(
    (supabase as any)
      .from('batches')
      .update(payload)
      .eq('id', batchId)
      .select(
        'id, academy_id, name, age_group, description, training_days, training_time, coach_id, created_at, updated_at',
      )
      .single(),
  );

  let coachObj = {
    id: null,
    fullName: null,
    email: 'Unassigned',
    avatarUrl: null,
  };

  if (updatedRow.coach_id) {
    const { data: coachRow } = await (supabase as any)
      .from('academy_members')
      .select(
        'id, role, status, profiles!academy_members_user_id_fkey(full_name, email, avatar_url)',
      )
      .eq('id', updatedRow.coach_id)
      .maybeSingle();

    if (coachRow) {
      coachObj = {
        id: coachRow.id,
        fullName: coachRow.profiles?.full_name ?? null,
        email: coachRow.profiles?.email ?? '',
        avatarUrl: coachRow.profiles?.avatar_url ?? null,
      };
    }
  }

  return {
    id: updatedRow.id,
    academyId: updatedRow.academy_id,
    name: updatedRow.name,
    ageGroup: updatedRow.age_group,
    description: updatedRow.description ?? null,
    trainingDays: normalizeTrainingDays(updatedRow.training_days),
    trainingTime: updatedRow.training_time ?? null,
    coachId: updatedRow.coach_id ?? null,
    createdAt: updatedRow.created_at,
    updatedAt: updatedRow.updated_at,
    coach: coachObj,
    playerCount: 0,
  };
}

export async function deleteBatch(batchId: UUID): Promise<void> {
  await unwrapVoid((supabase as any).from('batches').delete().eq('id', batchId));
}

export async function fetchBatchAvailablePlayers(academyId: UUID): Promise<AcademyMember[]> {
  const rows = await unwrap<any[]>(
    supabase
      .from('academy_members')
      .select(
        'id, academy_id, user_id, role, status, joined_at, profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)',
      )
      .eq('academy_id', academyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  );
  return rows.map((row) => ({
    id: row.id,
    academyId: row.academy_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    fullName: row.profiles?.full_name ?? null,
    email: row.profiles?.email ?? '',
    avatarUrl: row.profiles?.avatar_url ?? null,
    phone: null,
  }));
}

export async function addPlayerToBatch(batchId: UUID, academyMemberId: UUID): Promise<void> {
  await unwrap(
    (supabase as any)
      .from('batch_members')
      .insert({ batch_id: batchId, academy_member_id: academyMemberId })
      .select('id')
      .single(),
  );
}

export async function removePlayerFromBatch(batchMemberId: UUID): Promise<void> {
  await unwrapVoid((supabase as any).from('batch_members').delete().eq('id', batchMemberId));
}
