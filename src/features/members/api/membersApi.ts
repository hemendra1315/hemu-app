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

/**
 * Row shape of the `academy_join_requests` RPC — note the flat columns: the
 * function does the join to `profiles` itself, under SECURITY DEFINER.
 */
type PendingJoinRequestRow = {
  request_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  requested_role: AppRole;
  status: JoinStatus;
  message: string | null;
  created_at: string;
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

function toPendingJoinRequest(academyId: UUID, row: PendingJoinRequestRow): PendingJoinRequest {
  return {
    id: row.request_id,
    academyId,
    userId: row.user_id,
    requestedRole: row.requested_role,
    status: row.status,
    message: row.message,
    createdAt: row.created_at,
    fullName: row.full_name,
    email: row.email ?? '',
    avatarUrl: row.avatar_url,
  };
}

/**
 * Pending join requests, with the requester's name and email.
 *
 * This used to read `join_requests` directly and embed
 * `profiles!join_requests_user_id_fkey`. That embed always came back null: the
 * `profiles_select` policy only lets staff read a profile once that person has
 * an `academy_members` row in an academy they are staff of, and someone who has
 * merely *asked* to join has no membership row yet. So every request rendered
 * with a blank name, a blank email and an empty avatar, and the owner was asked
 * to approve anonymous rows — silently, because a blocked embed is null rather
 * than an error.
 *
 * `academy_join_requests` is a SECURITY DEFINER function written for exactly
 * this, returning the name and email already joined. It existed in the database
 * the whole time and nothing called it. It checks `is_owner(p_academy)` itself,
 * so the authorization is stricter than the table read it replaces, not looser.
 */
export async function fetchPendingJoinRequests(academyId: UUID): Promise<PendingJoinRequest[]> {
  const rows = await rpc<PendingJoinRequestRow[]>('academy_join_requests', {
    p_academy: academyId,
    p_status: 'pending',
  });
  return (rows ?? []).map((row) => toPendingJoinRequest(academyId, row));
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
