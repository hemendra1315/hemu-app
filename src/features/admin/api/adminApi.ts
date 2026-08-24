import { supabase } from '@/lib/supabase/client';
import type { UUID } from '@/types';

export interface PlatformAnalytics {
  totalAcademies: number;
  activeAcademies: number;
  totalUsers: number;
  totalPlayers: number;
  totalCoaches: number;
  totalOwners: number;
  totalMatches: number;
  totalSessions: number;
}

export interface PlatformAcademy {
  id: UUID;
  name: string;
  slug: string;
  logoUrl?: string | null;
  city: string | null;
  timezone: string;
  feeMode: string;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  playerCount: number;
  coachCount: number;
  memberCount: number;
  batchCount: number;
  matchCount: number;
}

export interface PlatformUserMembership {
  academyId: UUID;
  academyName: string;
  role: string;
  status: string;
}

export interface PlatformUser {
  id: UUID;
  fullName: string | null;
  email: string;
  isSuperAdmin: boolean;
  createdAt: string;
  memberships: PlatformUserMembership[];
}

export interface PlatformAcademyDetails {
  academy: {
    id: UUID;
    name: string;
    slug: string;
    city: string | null;
    timezone: string;
    feeMode: string;
    createdAt: string;
    ownerName: string;
    ownerEmail: string;
  };
  members: Array<{
    id: UUID;
    userId: UUID;
    role: string;
    status: string;
    name: string;
    email: string;
  }>;
  batches: Array<{
    id: UUID;
    name: string;
    description: string | null;
  }>;
  matches: Array<{
    id: UUID;
    matchName: string;
    matchDate: string;
    opponentName: string | null;
    result: string | null;
    teamScore: string | null;
  }>;
}

type RpcCaller = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

/**
 * Development/ops logging helper for Super Admin RPC failures.
 *
 * Logs the full Supabase error (message/details/hint/code) to the console so the
 * actual database/RPC failure is never masked, while the error surfaced to the UI
 * keeps a safe message. Verbose details/hint are carried on the Error object but
 * are NOT rendered in production UI toasts/modals.
 */
type RpcErrorShape = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

function throwRpcError(rpcName: string, error: unknown): never {
  const e = (error ?? {}) as RpcErrorShape;
  console.error(`[super-admin] ${rpcName} failed`, {
    message: e.message,
    details: e.details,
    hint: e.hint,
    code: e.code,
    raw: error,
  });
  const err = new Error(e.message ?? 'Request failed');
  Object.assign(err, { details: e.details, hint: e.hint, code: e.code, rpcName });
  throw err;
}

export async function fetchPlatformAnalytics(): Promise<PlatformAnalytics> {
  const { data, error } = await (supabase.rpc as unknown as RpcCaller)('get_platform_analytics');
  if (error) throw error;
  return data as unknown as PlatformAnalytics;
}

export async function fetchPlatformAcademies(): Promise<PlatformAcademy[]> {
  const { data, error } = await (supabase.rpc as unknown as RpcCaller)('get_platform_academies');
  if (error) throw error;
  return (data ?? []) as unknown as PlatformAcademy[];
}

export async function fetchPlatformUsers(): Promise<PlatformUser[]> {
  const { data, error } = await (supabase.rpc as unknown as RpcCaller)('get_platform_users');
  if (error) throw error;
  return (data ?? []) as unknown as PlatformUser[];
}

export async function fetchPlatformAcademyDetails(
  academyId: UUID,
): Promise<PlatformAcademyDetails> {
  const { data, error } = await (supabase.rpc as unknown as RpcCaller)(
    'get_platform_academy_details',
    {
      p_academy_id: academyId,
    },
  );
  if (error) throw error;
  return data as unknown as PlatformAcademyDetails;
}

export interface CreatePlatformAcademyPayload {
  name: string;
  city?: string;
  contactEmail?: string;
  contactPhone?: string;
  timezone?: string;
  feeMode?: 'player_pays' | 'academy_pays';
}

export interface CreatedPlatformAcademyResponse {
  id: UUID;
  name: string;
  slug: string;
  city?: string;
  contactEmail?: string;
  contactPhone?: string;
  timezone: string;
  feeMode: string;
  playerJoinCode: string;
  invitationId: UUID;
  invitationToken: string;
  invitationExpiresAt: string;
  createdAt: string;
}

export async function createPlatformAcademy(
  payload: CreatePlatformAcademyPayload,
): Promise<CreatedPlatformAcademyResponse> {
  const { data, error } = await (supabase.rpc as unknown as RpcCaller)(
    'super_admin_create_academy_with_invite',
    {
      p_name: payload.name,
      p_city: payload.city ?? null,
      p_contact_email: payload.contactEmail ?? null,
      p_contact_phone: payload.contactPhone ?? null,
      p_timezone: payload.timezone ?? 'Asia/Kolkata',
      p_fee_mode: payload.feeMode ?? 'player_pays',
    },
  );
  if (error) throwRpcError('super_admin_create_academy_with_invite', error);
  return data as unknown as CreatedPlatformAcademyResponse;
}

export async function regenerateOwnerInvitation(academyId: UUID): Promise<{
  invitationId: UUID;
  invitationToken: string;
  invitationExpiresAt: string;
  academyId: UUID;
}> {
  const { data, error } = await (supabase.rpc as unknown as RpcCaller)(
    'regenerate_owner_invitation',
    {
      p_academy_id: academyId,
    },
  );
  if (error) throwRpcError('regenerate_owner_invitation', error);
  return data as unknown as {
    invitationId: UUID;
    invitationToken: string;
    invitationExpiresAt: string;
    academyId: UUID;
  };
}

export async function revokeOwnerInvitation(invitationId: UUID): Promise<void> {
  const { error } = await (supabase.rpc as unknown as RpcCaller)('revoke_owner_invitation', {
    p_invitation_id: invitationId,
  });
  if (error) throwRpcError('revoke_owner_invitation', error);
}

export async function deletePlatformAcademy(academyId: UUID): Promise<void> {
  const { error } = await (supabase.rpc as unknown as RpcCaller)('delete_platform_academy', {
    p_academy_id: academyId,
  });
  if (error) throw error;
}

export interface SuperAdminAddMemberPayload {
  academyId: UUID;
  fullName: string;
  role: 'player' | 'coach';
  email?: string;
  phone?: string;
  batchId?: string;
}

export async function superAdminAddMember(payload: SuperAdminAddMemberPayload): Promise<{
  id: UUID;
  academyId: UUID;
  userId: UUID;
  role: string;
  fullName: string;
  email: string;
}> {
  const { data, error } = await (supabase.rpc as unknown as RpcCaller)('super_admin_add_member', {
    p_academy_id: payload.academyId,
    p_full_name: payload.fullName,
    p_role: payload.role,
    p_email: payload.email ?? null,
    p_phone: payload.phone ?? null,
    p_batch_id: payload.batchId ?? null,
  });
  if (error) throwRpcError('super_admin_add_member', error);
  return data as unknown as {
    id: UUID;
    academyId: UUID;
    userId: UUID;
    role: string;
    fullName: string;
    email: string;
  };
}

export async function superAdminSeedAcademyDemoData(academyId: UUID): Promise<unknown> {
  const { data, error } = await (supabase.rpc as unknown as RpcCaller)(
    'super_admin_seed_academy_demo_data',
    {
      p_academy_id: academyId,
    },
  );
  if (error) throwRpcError('super_admin_seed_academy_demo_data', error);
  return data;
}
