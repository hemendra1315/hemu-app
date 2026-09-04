/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrap, unwrapVoid } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { UUID } from '@/types';
import type {
  BatchAttendanceSession,
  AttendanceRecord,
  PlayerAttendanceRecord,
  AttendanceStatus,
} from './attendanceTypes';
import type { AttendanceMark } from './attendanceInsights';

export async function fetchSessionAttendance(sessionId: UUID): Promise<AttendanceRecord[]> {
  const rows = await unwrap<any[]>(
    supabase
      .from('attendance')
      .select('id, academy_id, session_id, player_id, status, marked_by, created_at, updated_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .returns<any[]>(),
  );

  return rows.map((row) => ({
    id: row.id,
    academyId: row.academy_id,
    sessionId: row.session_id,
    playerId: row.player_id,
    status: row.status,
    markedBy: row.marked_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function markAllPresent(
  sessionId: UUID,
  playerIds: UUID[],
  academyId: UUID,
): Promise<void> {
  if (playerIds.length === 0) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await unwrapVoid(
    supabase
      .from('attendance')
      .upsert(
        playerIds.map((playerId) => ({
          academy_id: academyId,
          session_id: sessionId,
          player_id: playerId,
          status: 'present' as AttendanceStatus,
          marked_by: user?.id ?? null,
        })),
        { onConflict: 'session_id,player_id' },
      )
      .select('id'),
  );
}

export async function markAttendance(
  sessionId: UUID,
  playerId: UUID,
  status: AttendanceStatus,
  academyId: UUID,
): Promise<AttendanceRecord> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const row = await unwrap<any>(
    supabase
      .from('attendance')
      .upsert(
        {
          academy_id: academyId,
          session_id: sessionId,
          player_id: playerId,
          status,
          marked_by: user?.id ?? null,
        },
        { onConflict: 'session_id,player_id' },
      )
      .select('id, academy_id, session_id, player_id, status, marked_by, created_at, updated_at')
      .single()
      .returns<any>(),
  );

  return {
    id: row.id,
    academyId: row.academy_id,
    sessionId: row.session_id,
    playerId: row.player_id,
    status: row.status,
    markedBy: row.marked_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Remove a player's mark for a session, putting them back to unmarked.
 *
 * A coach tapping the wrong name previously had no way back: the two buttons
 * set present or absent and re-tapping the current one was explicitly ignored,
 * so a mis-tap became a permanent record that quietly skewed that player's rate.
 * Deleting the row rather than adding a third status keeps "not marked" and
 * "marked absent" distinct — the attendance rate counts only sessions a player
 * was actually marked for, so an accidental row is not the same as no row.
 */
export async function clearAttendance(sessionId: UUID, playerId: UUID): Promise<void> {
  await unwrapVoid(
    supabase.from('attendance').delete().eq('session_id', sessionId).eq('player_id', playerId),
  );
}

export async function fetchPlayerAttendance(playerId: UUID): Promise<PlayerAttendanceRecord[]> {
  const rows = await unwrap<any[]>(
    supabase
      .from('attendance')
      .select(
        `id, academy_id, session_id, player_id, status, marked_by, created_at, updated_at, session:training_sessions(id, title, session_date, start_at, end_at, status)`,
      )
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .returns<any[]>(),
  );

  return rows.map((row) => ({
    id: row.id,
    academyId: row.academy_id,
    sessionId: row.session_id,
    playerId: row.player_id,
    status: row.status,
    markedBy: row.marked_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    session: {
      id: row.session.id,
      title: row.session.title,
      sessionDate: row.session.session_date,
      startAt: row.session.start_at,
      endAt: row.session.end_at,
      status: row.session.status,
    },
  }));
}

export async function fetchBatchAttendance(batchId: UUID): Promise<BatchAttendanceSession[]> {
  const rows = await unwrap<any[]>(
    supabase
      .from('training_sessions')
      .select(
        'id, title, session_date, start_at, end_at, status, attendance!left(id, player_id, status)',
      )
      .eq('batch_id', batchId)
      .order('session_date', { ascending: false })
      .returns<any[]>(),
  );

  return rows.map((row) => ({
    sessionId: row.id,
    title: row.title,
    sessionDate: row.session_date,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    attendance: (row.attendance ?? []).map((record: any) => ({
      id: record.id,
      playerId: record.player_id,
      status: record.status,
    })),
  }));
}

/**
 * Every attendance mark in a date range, flattened with its session.
 *
 * `training_sessions!inner` is load-bearing: without `!inner`, PostgREST
 * applies the `session_date` filters to the embedded rows only and returns
 * every parent row regardless of date — which is exactly what the owner
 * dashboard's "last 6 months" query does, and why its percentage has always
 * been computed over all time while claiming to be a window.
 */
export async function fetchAttendanceMarks(
  academyId: UUID,
  from: string,
  to: string,
): Promise<AttendanceMark[]> {
  const rows = await unwrap<any[]>(
    supabase
      .from('attendance')
      .select('player_id, status, training_sessions!inner(id, session_date, batch_id)')
      .eq('academy_id', academyId)
      .gte('training_sessions.session_date', from)
      .lte('training_sessions.session_date', to)
      .returns<any[]>(),
  );

  return rows.map((row) => ({
    playerId: row.player_id,
    status: row.status,
    sessionId: row.training_sessions.id,
    sessionDate: row.training_sessions.session_date,
    batchId: row.training_sessions.batch_id ?? null,
  }));
}
