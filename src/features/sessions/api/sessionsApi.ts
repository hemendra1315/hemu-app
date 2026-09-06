/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrap, unwrapVoid } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { UUID } from '@/types';
import type {
  CreateTrainingSessionInput,
  TrainingSession,
  UpdateTrainingSessionInput,
} from './sessionsTypes';

// `training_sessions.coach_id` references `academy_members(id)` via
// `training_sessions_coach_id_fkey`. `academy_members` references `profiles`
// twice (`user_id`, `invited_by`) so the `profiles` embed must use
// `academy_members_user_id_fkey` explicitly.
//
// Neither embed uses `!inner`. It's tempting — the coach and batch should
// always exist — but `!inner` doesn't just require the row to exist, it
// requires the CURRENT VIEWER to be able to read it under RLS. A player or
// parent reading their own session list can read the session row itself,
// but until a dedicated policy grants it, they might not be able to read
// the coach's own `academy_members`/`profiles` row — and an inner embed
// silently deletes the whole session, not just the coach's name, the
// moment that read fails. This is exactly what made every non-staff role
// see zero training sessions, ever. A left embed degrades to a null coach
// instead of hiding the session.
const SESSION_COLUMNS = `id, academy_id, batch_id, title, focus_area, session_date, start_at, end_at, coach_id, status, notes, created_at, updated_at, batch:batches(id, name), coach:academy_members!training_sessions_coach_id_fkey(id, profiles!academy_members_user_id_fkey(full_name, email, avatar_url))`;

function toTrainingSession(row: any): TrainingSession {
  return {
    id: row.id,
    academyId: row.academy_id,
    batchId: row.batch_id,
    title: row.title,
    focusArea: row.focus_area,
    sessionDate: row.session_date,
    startAt: row.start_at,
    endAt: row.end_at,
    coachId: row.coach_id,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    batch: {
      id: row.batch?.id,
      name: row.batch?.name ?? '',
    },
    coach: {
      id: row.coach?.id,
      fullName: row.coach?.profiles?.full_name ?? null,
      email: row.coach?.profiles?.email ?? '',
      avatarUrl: row.coach?.profiles?.avatar_url ?? null,
    },
  };
}

export async function fetchAcademyTrainingSessions(academyId: UUID): Promise<TrainingSession[]> {
  const rows = await unwrap<any[]>(
    supabase
      .from('training_sessions')
      .select(SESSION_COLUMNS)
      .eq('academy_id', academyId)
      .order('session_date', { ascending: false })
      .order('start_at', { ascending: false })
      .returns<any[]>(),
  );
  return rows.map(toTrainingSession);
}

export async function fetchTrainingSession(sessionId: UUID): Promise<TrainingSession> {
  const row = await unwrap<any>(
    supabase
      .from('training_sessions')
      .select(SESSION_COLUMNS)
      .eq('id', sessionId)
      .single()
      .returns<any>(),
  );
  return toTrainingSession(row);
}

export async function createTrainingSession(
  input: CreateTrainingSessionInput,
): Promise<TrainingSession> {
  const row = await unwrap<any>(
    supabase
      .from('training_sessions')
      .insert({
        academy_id: input.academyId,
        batch_id: input.batchId,
        title: input.title,
        focus_area: input.focusArea,
        session_date: input.sessionDate,
        start_at: input.startAt,
        end_at: input.endAt,
        coach_id: input.coachId,
        status: input.status,
        notes: input.notes,
      })
      .select(SESSION_COLUMNS)
      .single()
      .returns<any>(),
  );
  return toTrainingSession(row);
}

export async function updateTrainingSession(
  sessionId: UUID,
  input: UpdateTrainingSessionInput,
): Promise<TrainingSession> {
  const row = await unwrap<any>(
    supabase
      .from('training_sessions')
      .update({
        batch_id: input.batchId,
        title: input.title,
        focus_area: input.focusArea,
        session_date: input.sessionDate,
        start_at: input.startAt,
        end_at: input.endAt,
        coach_id: input.coachId,
        status: input.status,
        notes: input.notes,
      })
      .eq('id', sessionId)
      .select(SESSION_COLUMNS)
      .single()
      .returns<any>(),
  );
  return toTrainingSession(row);
}

export async function deleteTrainingSession(sessionId: UUID): Promise<void> {
  await unwrapVoid(supabase.from('training_sessions').delete().eq('id', sessionId));
}
