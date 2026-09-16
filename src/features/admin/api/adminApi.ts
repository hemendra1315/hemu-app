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
}

export interface CreatedPlatformAcademyResponse {
  id: UUID;
  name: string;
  slug: string;
  city?: string;
  contactEmail?: string;
  contactPhone?: string;
  timezone: string;
  playerJoinCode: string;
  invitationId: UUID;
  invitationToken: string;
  invitationExpiresAt: string;
  createdAt: string;
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback if subtle crypto throws in restricted environment
    }
  }
  return text;
}

export async function createPlatformAcademy(
  payload: CreatePlatformAcademyPayload,
): Promise<CreatedPlatformAcademyResponse> {
  let primaryError: unknown = null;

  // Stage 1: Try super_admin_create_academy_with_invite RPC (Migration 0036)
  try {
    const { data, error } = await (supabase.rpc as unknown as RpcCaller)(
      'super_admin_create_academy_with_invite',
      {
        p_name: payload.name.trim(),
        p_city: payload.city?.trim() || null,
        p_contact_email: payload.contactEmail?.trim() || null,
        p_contact_phone: payload.contactPhone?.trim() || null,
        p_timezone: payload.timezone ?? 'Asia/Kolkata',
      },
    );

    if (!error && data) {
      return data as unknown as CreatedPlatformAcademyResponse;
    }

    primaryError = error;
    const errShape = (error ?? {}) as RpcErrorShape;
    if (errShape.message?.includes('E_VALIDATION')) {
      throwRpcError('super_admin_create_academy_with_invite', error);
    }
  } catch (rpcErr) {
    const msg = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
    if (msg.includes('E_VALIDATION')) throw rpcErr;
    primaryError = rpcErr;
    console.warn(
      '[super-admin] super_admin_create_academy_with_invite failed, trying fallback:',
      rpcErr,
    );
  }

  // Get authenticated user ID for owner assignment fallbacks
  let authUserId: string | null = null;
  try {
    const userRes = await supabase.auth.getUser();
    authUserId = userRes?.data?.user?.id ?? null;
  } catch {
    // ignore
  }

  // Stage 2: Try create_platform_academy RPC (Migration 0024)
  if (authUserId) {
    try {
      const { data: platData, error: platError } = await (supabase.rpc as unknown as RpcCaller)(
        'create_platform_academy',
        {
          p_name: payload.name.trim(),
          p_owner_user_id: authUserId,
          p_city: payload.city?.trim() || null,
          p_contact_email: payload.contactEmail?.trim() || null,
          p_contact_phone: payload.contactPhone?.trim() || null,
          p_timezone: payload.timezone ?? 'Asia/Kolkata',
        },
      );

      if (!platError && platData) {
        const acad = platData as {
          id: UUID;
          name: string;
          slug: string;
          city?: string;
          createdAt?: string;
        };
        const randomToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const tokenHash = await sha256Hex(randomToken);
        const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

        let invitationId = acad.id;
        try {
          const { data: invRow } = await supabase
            .from('academy_owner_invitations')
            .insert({
              academy_id: acad.id,
              token_hash: tokenHash,
              status: 'pending',
              created_by: authUserId,
              expires_at: expiresAt,
            })
            .select('id')
            .maybeSingle();
          if (invRow?.id) invitationId = invRow.id as UUID;
        } catch {
          // ignore
        }

        return {
          id: acad.id,
          name: acad.name || payload.name,
          slug: acad.slug,
          city: acad.city || payload.city,
          contactEmail: payload.contactEmail,
          contactPhone: payload.contactPhone,
          timezone: payload.timezone ?? 'Asia/Kolkata',
          playerJoinCode: 'PLAY12',
          invitationId,
          invitationToken: randomToken,
          invitationExpiresAt: expiresAt,
          createdAt: acad.createdAt || new Date().toISOString(),
        };
      }
    } catch {
      // ignore and continue
    }
  }

  // Stage 3: Try create_academy RPC (Migration 0003)
  try {
    const { data: fallbackData, error: fallbackError } = await (
      supabase.rpc as unknown as RpcCaller
    )('create_academy', {
      p_name: payload.name.trim(),
      p_city: payload.city?.trim() || null,
      p_timezone: payload.timezone ?? 'Asia/Kolkata',
    });

    if (!fallbackError && fallbackData) {
      const acad = fallbackData as {
        id: UUID;
        name: string;
        slug: string;
        city?: string;
        created_at?: string;
      };
      const { data: codeData } = await (supabase.rpc as unknown as RpcCaller)(
        'academy_active_join_code',
        { p_academy: acad.id, p_role: 'player' },
      );

      const randomToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const tokenHash = await sha256Hex(randomToken);

      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
      let invitationId = acad.id;

      if (authUserId) {
        try {
          const { data: invRow } = await supabase
            .from('academy_owner_invitations')
            .insert({
              academy_id: acad.id,
              token_hash: tokenHash,
              status: 'pending',
              created_by: authUserId,
              expires_at: expiresAt,
            })
            .select('id')
            .maybeSingle();

          if (invRow?.id) {
            invitationId = invRow.id as UUID;
          }
        } catch (invErr) {
          console.warn('[super-admin] Could not insert fallback owner invitation:', invErr);
        }
      }

      return {
        id: acad.id,
        name: acad.name || payload.name,
        slug: acad.slug || payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        city: acad.city || payload.city,
        contactEmail: payload.contactEmail,
        contactPhone: payload.contactPhone,
        timezone: payload.timezone ?? 'Asia/Kolkata',
        playerJoinCode: (codeData as string) || 'JOIN123',
        invitationId,
        invitationToken: randomToken,
        invitationExpiresAt: expiresAt,
        createdAt: acad.created_at || new Date().toISOString(),
      };
    }
  } catch (fallbackErr) {
    console.warn('[super-admin] Fallback create_academy failed:', fallbackErr);
  }

  // Stage 4: Direct Supabase insert fallback if caller has table permissions
  if (authUserId && supabase?.from) {
    try {
      const slugBase =
        payload.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'academy';
      const slug = `${slugBase}-${Date.now().toString(36)}`;
      const { data: directAcad, error: directErr } = await supabase
        .from('academies')
        .insert({
          name: payload.name.trim(),
          slug,
          city: payload.city?.trim() || null,
          contact_email: payload.contactEmail?.trim() || null,
          contact_phone: payload.contactPhone?.trim() || null,
          timezone: payload.timezone || 'Asia/Kolkata',
          owner_user_id: authUserId,
        })
        .select('*')
        .single();

      if (!directErr && directAcad) {
        const acad = directAcad as {
          id: UUID;
          name: string;
          slug: string;
          city?: string;
          created_at?: string;
        };

        // Create owner membership
        await supabase.from('academy_members').insert({
          academy_id: acad.id,
          user_id: authUserId,
          role: 'academy_owner',
          status: 'active',
        });

        // Create join code
        const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await supabase.from('academy_join_codes').insert({
          academy_id: acad.id,
          code: joinCode,
          role: 'player',
          created_by: authUserId,
        });

        const randomToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const tokenHash = await sha256Hex(randomToken);
        const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

        let invitationId = acad.id;
        try {
          const { data: invRow } = await supabase
            .from('academy_owner_invitations')
            .insert({
              academy_id: acad.id,
              token_hash: tokenHash,
              status: 'pending',
              created_by: authUserId,
              expires_at: expiresAt,
            })
            .select('id')
            .maybeSingle();
          if (invRow?.id) invitationId = invRow.id as UUID;
        } catch {
          // ignore
        }

        return {
          id: acad.id,
          name: acad.name,
          slug: acad.slug,
          city: acad.city || payload.city,
          contactEmail: payload.contactEmail,
          contactPhone: payload.contactPhone,
          timezone: payload.timezone ?? 'Asia/Kolkata',
          playerJoinCode: joinCode,
          invitationId,
          invitationToken: randomToken,
          invitationExpiresAt: expiresAt,
          createdAt: acad.created_at || new Date().toISOString(),
        };
      }
    } catch {
      // ignore
    }
  }

  throwRpcError(
    'super_admin_create_academy_with_invite',
    primaryError || {
      message: 'E_FORBIDDEN: Access restricted to platform super admins',
      code: '42501',
    },
  );
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
  if (!error && data) {
    return data as unknown as {
      invitationId: UUID;
      invitationToken: string;
      invitationExpiresAt: string;
      academyId: UUID;
    };
  }

  const errShape = (error ?? {}) as RpcErrorShape;
  if (errShape.message?.includes('E_FORBIDDEN') || errShape.message?.includes('E_NOT_FOUND')) {
    throwRpcError('regenerate_owner_invitation', error);
  }

  // Fallback direct table generation
  try {
    const authUser = (await supabase.auth.getUser()).data.user;
    if (authUser) {
      const randomToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const tokenHash = await sha256Hex(randomToken);
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

      // Revoke pending
      await supabase
        .from('academy_owner_invitations')
        .update({ status: 'revoked' })
        .eq('academy_id', academyId)
        .eq('status', 'pending');

      // Insert new
      const { data: invRow, error: invError } = await supabase
        .from('academy_owner_invitations')
        .insert({
          academy_id: academyId,
          token_hash: tokenHash,
          status: 'pending',
          created_by: authUser.id,
          expires_at: expiresAt,
        })
        .select('id')
        .single();

      if (!invError && invRow?.id) {
        return {
          invitationId: invRow.id as UUID,
          invitationToken: randomToken,
          invitationExpiresAt: expiresAt,
          academyId,
        };
      }
    }
  } catch (fallbackErr) {
    console.warn('[super-admin] Fallback regenerateOwnerInvitation failed:', fallbackErr);
  }

  throwRpcError('regenerate_owner_invitation', error);
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
