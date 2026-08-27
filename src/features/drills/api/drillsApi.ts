/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrap, unwrapVoid } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { UUID } from '@/types';
import type {
  CreateDrillAssignmentInput,
  CreateDrillInput,
  Drill,
  DrillAssignment,
  UpdateDrillAssignmentInput,
  UpdateDrillInput,
} from './drillsTypes';

const DRILL_COLUMNS = `
  id,
  academy_id,
  name,
  category,
  description,
  duration_minutes,
  difficulty,
  created_by,
  created_at,
  updated_at
`;

// `drill_assignments.player_id` references `academy_members(id)` via
// `drill_assignments_player_id_fkey`. `drill_assignments` also reaches
// `academy_members` indirectly through `batch_id → batches.coach_id`, so the
// embed must use the explicit FK hint. Within `academy_members`, `profiles`
// has two FKs (`user_id`, `invited_by`) so the `profiles` embed must use
// `academy_members_user_id_fkey` explicitly.
// `drill_assignments` also has two direct FKs to `profiles` (`created_by`,
// and a vestigial unused `assigned_by`), so the `creator` embed below must
// use the explicit `drill_assignments_created_by_fkey` hint. It is a left
// join (no `!inner`) so RLS-blocked or legacy-null creators degrade to
// `null` gracefully rather than hiding the whole assignment.
const ASSIGNMENT_COLUMNS = `
  id,
  academy_id,
  drill_id,
  player_id,
  batch_id,
  status,
  assigned_at,
  due_date,
  created_by,
  updated_at,
  drill:drills(id, name, category, description, duration_minutes, difficulty),
  batch:batches(id, name),
  player:academy_members!drill_assignments_player_id_fkey(id, user_id, profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url)),
  creator:profiles!drill_assignments_created_by_fkey(full_name, email)
`;

function toDrill(row: any): Drill {
  return {
    id: row.id,
    academyId: row.academy_id,
    name: row.name,
    category: row.category,
    description: row.description,
    durationMinutes: row.duration_minutes,
    difficulty: row.difficulty,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDrillAssignment(row: any): DrillAssignment {
  return {
    id: row.id,
    academyId: row.academy_id,
    drillId: row.drill_id,
    drill: {
      id: row.drill?.id,
      name: row.drill?.name ?? '',
      category: row.drill?.category,
      description: row.drill?.description ?? null,
      durationMinutes: row.drill?.duration_minutes ?? null,
      difficulty: row.drill?.difficulty,
    },
    playerId: row.player_id,
    playerName: row.player?.profiles?.full_name ?? row.player?.profiles?.email ?? null,
    batchId: row.batch_id,
    batchName: row.batch?.name ?? null,
    status: row.status,
    assignedBy: row.creator?.full_name ?? row.creator?.email ?? null,
    assignedAt: row.assigned_at,
    dueDate: row.due_date,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

export async function fetchAcademyDrills(academyId: UUID): Promise<Drill[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('drills')
      .select(DRILL_COLUMNS)
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false }),
  );
  return rows.map(toDrill);
}

export async function createDrill(input: CreateDrillInput): Promise<Drill> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const row = await unwrap<any>(
    (supabase as any)
      .from('drills')
      .insert({
        academy_id: input.academyId,
        name: input.name,
        category: input.category,
        description: input.description,
        duration_minutes: input.durationMinutes,
        difficulty: input.difficulty,
        created_by: user?.id ?? null,
      })
      .select(DRILL_COLUMNS)
      .single(),
  );
  return toDrill(row);
}

export async function updateDrill(drillId: UUID, input: UpdateDrillInput): Promise<Drill> {
  const row = await unwrap<any>(
    (supabase as any)
      .from('drills')
      .update({
        name: input.name,
        category: input.category,
        description: input.description,
        duration_minutes: input.durationMinutes,
        difficulty: input.difficulty,
      })
      .eq('id', drillId)
      .select(DRILL_COLUMNS)
      .single(),
  );
  return toDrill(row);
}

export async function deleteDrill(drillId: UUID): Promise<void> {
  await unwrapVoid((supabase as any).from('drills').delete().eq('id', drillId));
}

export async function fetchDrillAssignments(academyId: UUID): Promise<DrillAssignment[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('drill_assignments')
      .select(ASSIGNMENT_COLUMNS)
      .eq('academy_id', academyId)
      .order('assigned_at', { ascending: false }),
  );
  return rows.map(toDrillAssignment);
}

export async function fetchPlayerDrillAssignments(
  playerId: UUID,
  academyId: UUID,
): Promise<DrillAssignment[]> {
  const rows = await unwrap<any[]>(
    (supabase as any)
      .from('drill_assignments')
      .select(ASSIGNMENT_COLUMNS)
      .eq('academy_id', academyId)
      .eq('player_id', playerId)
      .order('assigned_at', { ascending: false }),
  );
  return rows.map(toDrillAssignment);
}

export async function assignDrill(input: CreateDrillAssignmentInput): Promise<DrillAssignment> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const row = await unwrap<any>(
    (supabase as any)
      .from('drill_assignments')
      .insert({
        academy_id: input.academyId,
        drill_id: input.drillId,
        player_id: input.playerId,
        batch_id: input.batchId,
        due_date: input.dueDate,
        status: input.status ?? 'assigned',
        assigned_at: new Date().toISOString(),
        created_by: user?.id ?? null,
      })
      .select(ASSIGNMENT_COLUMNS)
      .single(),
  );
  return toDrillAssignment(row);
}

export async function updateDrillAssignment(
  assignmentId: UUID,
  input: UpdateDrillAssignmentInput,
): Promise<DrillAssignment> {
  const row = await unwrap<any>(
    (supabase as any)
      .from('drill_assignments')
      .update({
        status: input.status,
        due_date: input.dueDate,
      })
      .eq('id', assignmentId)
      .select(ASSIGNMENT_COLUMNS)
      .single(),
  );
  return toDrillAssignment(row);
}

export async function deleteDrillAssignment(assignmentId: UUID): Promise<void> {
  await unwrapVoid((supabase as any).from('drill_assignments').delete().eq('id', assignmentId));
}
