import { rpc, unwrap } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { AcademyMember, PendingJoinRequest, UUID } from '@/types';
import type { AppRole, JoinableRole, JoinStatus, MemberStatus } from '@/types/enums';

type MemberRow = {
  id: string;
  academy_id: string;
  user_id: string;
  role: AppRole;
  status: MemberStatus;
  joined_at: string | null;
  profiles: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    phone: string | null;
  } | null;
  batch_members?: { batches: { id: string; name: string } | null }[] | null;
};

type PendingJoinRequestRow = {
  id: string;
  academy_id: string;
  user_id: string;
  requested_role: AppRole;
  status: JoinStatus;
  message: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
};

/**
 * The FK is named explicitly because `academy_members` references `profiles`
 * twice (`user_id` and `invited_by`), which makes a bare embed ambiguous.
 */
const MEMBER_COLUMNS =
  'id, academy_id, user_id, role, status, joined_at, profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url, phone), batch_members(batches(id, name))';

function toMember(row: MemberRow): AcademyMember {
  return {
    id: row.id,
    academyId: row.academy_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    fullName: row.profiles?.full_name ?? null,
    email: row.profiles?.email ?? '',
    avatarUrl: row.profiles?.avatar_url ?? null,
    phone: row.profiles?.phone ?? null,
    batches: row.batch_members
      ? row.batch_members
          .map((bm) => bm.batches)
          .filter((b): b is { id: string; name: string } => b !== null)
      : [],
  };
}

function toPendingJoinRequest(row: PendingJoinRequestRow): PendingJoinRequest {
  return {
    id: row.id,
    academyId: row.academy_id,
    userId: row.user_id,
    requestedRole: row.requested_role,
    status: row.status,
    message: row.message,
    createdAt: row.created_at,
    fullName: row.profiles?.full_name ?? null,
    email: row.profiles?.email ?? '',
    avatarUrl: row.profiles?.avatar_url ?? null,
  };
}

export async function fetchPendingJoinRequests(academyId: UUID): Promise<PendingJoinRequest[]> {
  const rows = await unwrap<PendingJoinRequestRow[]>(
    supabase
      .from('join_requests')
      .select(
        'id, academy_id, user_id, requested_role, status, message, created_at, profiles!join_requests_user_id_fkey(full_name, email, avatar_url)',
      )
      .eq('academy_id', academyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  );
  return rows.map(toPendingJoinRequest);
}

/**
 * Academy roster. RLS restricts this to staff of `academyId`, so a filter on
 * academy_id is a query optimisation, not the isolation boundary.
 */
export async function fetchAcademyMembers(
  academyId: UUID,
  filters: { role?: AppRole; status?: MemberStatus } = {},
): Promise<AcademyMember[]> {
  let query = supabase.from('academy_members').select(MEMBER_COLUMNS).eq('academy_id', academyId);
  if (filters.role) query = query.eq('role', filters.role);
  if (filters.status) query = query.eq('status', filters.status);

  const rows = await unwrap<MemberRow[]>(query.order('created_at', { ascending: true }));
  return rows.map(toMember);
}

export async function fetchAcademyMember(memberId: UUID): Promise<AcademyMember> {
  const row = await unwrap<MemberRow>(
    supabase.from('academy_members').select(MEMBER_COLUMNS).eq('id', memberId).single(),
  );
  return toMember(row);
}

export async function approveJoinRequest(requestId: UUID, batchIds?: UUID[] | null): Promise<void> {
  await rpc<void>('approve_join_request', {
    p_request_id: requestId,
    p_batch_ids: batchIds ?? null,
  });
}

export async function rejectJoinRequest(requestId: UUID): Promise<void> {
  await rpc<void>('reject_join_request', { p_request_id: requestId, p_reason: null });
}

export async function updateMemberRole(membershipId: UUID, role: JoinableRole): Promise<void> {
  await unwrap(
    supabase.from('academy_members').update({ role }).eq('id', membershipId).select('id').single(),
  );
}

export async function updateMemberStatus(
  membershipId: UUID,
  status: Extract<MemberStatus, 'active' | 'suspended' | 'left'>,
): Promise<void> {
  await unwrap(
    supabase
      .from('academy_members')
      .update({
        status,
        ...(status === 'left' ? { left_at: new Date().toISOString() } : { left_at: null }),
      })
      .eq('id', membershipId)
      .select('id')
      .single(),
  );
}
