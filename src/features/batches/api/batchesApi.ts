/* eslint-disable @typescript-eslint/no-explicit-any */
import { toApiError, unwrap, unwrapVoid } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { AcademyMember, UUID } from '@/types';
import type { Batch, BatchPlayer, CreateBatchInput, UpdateBatchInput } from './batchesTypes';

// `batches.coach_id` references `academy_members(id)` via `batches_coach_id_fkey`.
// `academy_members` references `profiles` twice (`user_id`, `invited_by`) so the
// inner `profiles` embed must use `academy_members_user_id_fkey` explicitly.
const BATCH_COLUMNS = `id, academy_id, name, age_group, description, training_days, training_time, coach_id, created_at, updated_at, coach:academy_members!batches_coach_id_fkey(id, role, status, profiles!academy_members_user_id_fkey(full_name, email, avatar_url))`;

function toBatch(row: any): Batch {
  return {
    id: row.id,
    academyId: row.academy_id,
    name: row.name,
    ageGroup: row.age_group,
    description: row.description,
    trainingDays: parseDaysFromDb(row.training_days),
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
  const member = Array.isArray(row.academy_members)
    ? row.academy_members[0]
    : (row.academy_members ?? {});
  const profile = Array.isArray(member?.profiles) ? member.profiles[0] : (member?.profiles ?? {});

  return {
    id: row.id,
    batchId: row.batch_id,
    academyMemberId: row.academy_member_id,
    joinedAt: row.joined_at,
    fullName: profile?.full_name || null,
    email: profile?.email || '',
    avatarUrl: profile?.avatar_url || null,
    role: member?.role ?? null,
    status: member?.status ?? null,
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
  // 1. Try direct join first
  try {
    const { data, error } = await (supabase as any)
      .from('batch_members')
      .select(
        `
        id,
        batch_id,
        academy_member_id,
        joined_at,
        academy_members (
          id,
          role,
          status,
          profiles!academy_members_user_id_fkey (full_name, email, avatar_url)
        )
      `,
      )
      .eq('batch_id', batchId)
      .order('joined_at', { ascending: true });

    if (!error && Array.isArray(data)) {
      return data.map(toBatchPlayer);
    }
  } catch {
    // Fall back to resilient two-step fetch below
  }

  // 2. Fallback: 2-step fetch to avoid any PostgREST nested embed schema cache failure
  const batchMemberRows = await unwrap<any[]>(
    (supabase as any)
      .from('batch_members')
      .select('id, batch_id, academy_member_id, joined_at')
      .eq('batch_id', batchId)
      .order('joined_at', { ascending: true }),
  );

  if (!batchMemberRows || batchMemberRows.length === 0) {
    return [];
  }

  const memberIds = batchMemberRows.map((r) => r.academy_member_id).filter(Boolean);
  if (memberIds.length === 0) {
    return [];
  }

  const memberMap = new Map<string, any>();
  try {
    const members = await unwrap<any[]>(
      (supabase as any)
        .from('academy_members')
        .select(
          'id, role, status, profiles!academy_members_user_id_fkey(full_name, email, avatar_url)',
        )
        .in('id', memberIds),
    );
    for (const m of members) {
      memberMap.set(m.id, m);
    }
  } catch {
    try {
      const members = await unwrap<any[]>(
        (supabase as any)
          .from('academy_members')
          .select('id, user_id, role, status')
          .in('id', memberIds),
      );
      for (const m of members) {
        memberMap.set(m.id, m);
      }
    } catch {
      // Return bare batch members
    }
  }

  return batchMemberRows.map((row) => {
    const member = memberMap.get(row.academy_member_id);
    const profile = Array.isArray(member?.profiles)
      ? member.profiles[0]
      : (member?.profiles ?? null);

    return {
      id: row.id,
      batchId: row.batch_id,
      academyMemberId: row.academy_member_id,
      joinedAt: row.joined_at,
      fullName: profile?.full_name || null,
      email: profile?.email || '',
      avatarUrl: profile?.avatar_url || null,
      role: member?.role || null,
      status: member?.status || null,
    };
  });
}

function formatDaysForDb(days: string | null | undefined, asArray: boolean): any {
  if (!days || days.trim() === '') return asArray ? [] : null;
  if (asArray) {
    return days
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
  }
  return days.trim();
}

function parseDaysFromDb(raw: any): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return raw.join(', ');
  }
  return String(raw);
}

export async function createBatch(input: CreateBatchInput): Promise<Batch> {
  const cleanName = input.name.trim();
  const cleanAgeGroup = input.ageGroup.trim();
  const cleanDesc =
    input.description && input.description.trim() !== '' ? input.description.trim() : null;
  const cleanDays =
    input.trainingDays && input.trainingDays.trim() !== '' ? input.trainingDays.trim() : null;
  const cleanTime =
    input.trainingTime && input.trainingTime.trim() !== '' ? input.trainingTime.trim() : null;
  let cleanCoachId = input.coachId && input.coachId.trim() !== '' ? input.coachId.trim() : null;

  const tryInsert = async (daysVal: any, coachIdVal: any, timeVal: any) => {
    const payload: Record<string, any> = {
      academy_id: input.academyId,
      name: cleanName,
      age_group: cleanAgeGroup,
      description: cleanDesc,
      training_days: daysVal,
      training_time: timeVal,
      coach_id: coachIdVal,
    };

    return await (supabase as any)
      .from('batches')
      .insert(payload)
      .select(
        'id, academy_id, name, age_group, description, training_days, training_time, coach_id, created_at, updated_at',
      )
      .single();
  };

  let insertedRow: any = null;
  let res = await tryInsert(cleanDays, cleanCoachId, cleanTime);

  if (res.error) {
    const errCode = res.error.code;
    const errMsg = String(res.error.message || '').toLowerCase();
    const isArrayError =
      errCode === '22P02' ||
      errMsg.includes('array') ||
      errMsg.includes('malformed') ||
      errMsg.includes('dimension');

    if (isArrayError) {
      // Retry with array format for training_days
      const daysArr = formatDaysForDb(cleanDays, true);
      res = await tryInsert(daysArr, cleanCoachId, cleanTime);
    }
  }

  if (!res.error && res.data) {
    insertedRow = res.data;
  } else if (res.error) {
    const isNotNullError =
      res.error.code === '23502' ||
      (typeof res.error.message === 'string' &&
        res.error.message.toLowerCase().includes('not-null'));

    if (isNotNullError) {
      if (!cleanCoachId) {
        const { data: fallbackStaff } = await (supabase as any)
          .from('academy_members')
          .select('id')
          .eq('academy_id', input.academyId)
          .in('role', ['academy_owner', 'coach'])
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (fallbackStaff?.id) {
          cleanCoachId = fallbackStaff.id;
        }
      }

      // Try fallback with string then array if needed
      let fallbackRes = await tryInsert(
        cleanDays ?? 'Flexible',
        cleanCoachId,
        cleanTime ?? 'Flexible',
      );

      if (
        fallbackRes.error &&
        (fallbackRes.error.code === '22P02' ||
          String(fallbackRes.error.message || '')
            .toLowerCase()
            .includes('array'))
      ) {
        fallbackRes = await tryInsert(
          formatDaysForDb(cleanDays, true),
          cleanCoachId,
          cleanTime ?? 'Flexible',
        );
      }

      if (fallbackRes.error) {
        throw toApiError(fallbackRes.error);
      }
      insertedRow = fallbackRes.data;
    } else {
      throw toApiError(res.error);
    }
  }

  let coachObj = {
    id: null,
    fullName: null,
    email: 'Unassigned',
    avatarUrl: null,
  };

  if (insertedRow?.coach_id) {
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
    trainingDays: parseDaysFromDb(insertedRow.training_days),
    trainingTime: insertedRow.training_time ?? null,
    coachId: insertedRow.coach_id ?? null,
    createdAt: insertedRow.created_at,
    updatedAt: insertedRow.updated_at,
    coach: coachObj,
    playerCount: 0,
  };
}

export async function updateBatch(batchId: UUID, input: UpdateBatchInput): Promise<Batch> {
  const cleanName = input.name.trim();
  const cleanAgeGroup = input.ageGroup.trim();
  const cleanDesc =
    input.description && input.description.trim() !== '' ? input.description.trim() : null;
  const cleanDays =
    input.trainingDays && input.trainingDays.trim() !== '' ? input.trainingDays.trim() : null;
  const cleanTime =
    input.trainingTime && input.trainingTime.trim() !== '' ? input.trainingTime.trim() : null;
  const cleanCoachId = input.coachId && input.coachId.trim() !== '' ? input.coachId.trim() : null;

  const tryUpdate = async (daysVal: any) => {
    const payload: Record<string, any> = {
      name: cleanName,
      age_group: cleanAgeGroup,
      description: cleanDesc,
      training_days: daysVal,
      training_time: cleanTime,
      coach_id: cleanCoachId,
    };

    return await (supabase as any)
      .from('batches')
      .update(payload)
      .eq('id', batchId)
      .select(
        'id, academy_id, name, age_group, description, training_days, training_time, coach_id, created_at, updated_at',
      )
      .single();
  };

  let updatedRow: any = null;
  let res = await tryUpdate(cleanDays);

  if (res.error) {
    const errCode = res.error.code;
    const errMsg = String(res.error.message || '').toLowerCase();
    const isArrayError =
      errCode === '22P02' ||
      errMsg.includes('array') ||
      errMsg.includes('malformed') ||
      errMsg.includes('dimension');

    if (isArrayError) {
      const daysArr = formatDaysForDb(cleanDays, true);
      res = await tryUpdate(daysArr);
    }
  }

  if (!res.error && res.data) {
    updatedRow = res.data;
  } else if (res.error) {
    const isNotNullError =
      res.error.code === '23502' ||
      (typeof res.error.message === 'string' &&
        res.error.message.toLowerCase().includes('not-null'));

    if (isNotNullError) {
      let fallbackRes = await tryUpdate(cleanDays ?? 'Flexible');
      if (
        fallbackRes.error &&
        (fallbackRes.error.code === '22P02' ||
          String(fallbackRes.error.message || '')
            .toLowerCase()
            .includes('array'))
      ) {
        fallbackRes = await tryUpdate(formatDaysForDb(cleanDays, true));
      }

      if (fallbackRes.error) throw toApiError(fallbackRes.error);
      updatedRow = fallbackRes.data;
    } else {
      throw toApiError(res.error);
    }
  }

  let coachObj = {
    id: null,
    fullName: null,
    email: 'Unassigned',
    avatarUrl: null,
  };

  if (updatedRow?.coach_id) {
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
    trainingDays: parseDaysFromDb(updatedRow.training_days),
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
  try {
    const rows = await unwrap<any[]>(
      (supabase as any)
        .from('academy_members')
        .select(
          'id, academy_id, user_id, role, status, joined_at, profiles!academy_members_user_id_fkey(full_name, email, avatar_url, phone)',
        )
        .eq('academy_id', academyId)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
    );
    return rows.map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : (row.profiles ?? {});
      return {
        id: row.id,
        academyId: row.academy_id,
        userId: row.user_id,
        role: row.role,
        status: row.status,
        joinedAt: row.joined_at,
        fullName: profile?.full_name || null,
        email: profile?.email || '',
        avatarUrl: profile?.avatar_url || null,
        phone: profile?.phone || null,
      };
    });
  } catch {
    const rows = await unwrap<any[]>(
      (supabase as any)
        .from('academy_members')
        .select('id, academy_id, user_id, role, status, joined_at')
        .eq('academy_id', academyId)
        .eq('status', 'active'),
    );
    return rows.map((row) => ({
      id: row.id,
      academyId: row.academy_id,
      userId: row.user_id,
      role: row.role,
      status: row.status,
      joinedAt: row.joined_at,
      fullName: null,
      email: '',
      avatarUrl: null,
      phone: null,
    }));
  }
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
