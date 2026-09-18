import { unwrap } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import { isUUID } from '@/lib/validators';
import type { UUID } from '@/types';
import type {
  LinkedChild,
  ParentLinkingCode,
  ParentPlayerLink,
  ParentRelationshipType,
} from './parentsTypes';
import { fetchPlayerProfile } from '@/features/players/api/playersApi';

export async function fetchLinkedChildren(academyId: UUID): Promise<LinkedChild[]> {
  if (!isUUID(academyId)) return [];

  // `parent_player_links` has no foreign key to `academy_members` (it links via
  // profiles.id, not academy_members.id), so a PostgREST embed like
  // `academy_members!inner(id)` cannot resolve a relationship and always fails
  // with a 400 "Could not find a relationship" error. This does the join in two
  // plain queries instead, which the existing `academy_members_select_parents`
  // RLS policy already supports.
  const links = await unwrap<{ id: string; relationship_type: string; player_user_id: string }[]>(
    supabase
      .from('parent_player_links')
      .select('id, relationship_type, player_user_id')
      .eq('academy_id', academyId)
      .eq('status', 'active'),
  );

  if (links.length === 0) return [];

  const playerUserIds = [...new Set(links.map((link) => link.player_user_id))];

  const members = await unwrap<{ id: string; user_id: string }[]>(
    supabase
      .from('academy_members')
      .select('id, user_id')
      .eq('academy_id', academyId)
      .in('user_id', playerUserIds),
  );
  const memberIdByUserId = new Map(members.map((member) => [member.user_id, member.id]));

  const children: LinkedChild[] = [];
  for (const link of links) {
    const memberId = memberIdByUserId.get(link.player_user_id);
    if (!memberId) continue;
    try {
      const profile = await fetchPlayerProfile(academyId, memberId);
      children.push({
        linkId: link.id,
        relationshipType: link.relationship_type as ParentRelationshipType,
        player: profile,
      });
    } catch (err) {
      console.error('Failed to fetch player profile for child link', err);
    }
  }
  return children;
}

export async function fetchPlayerParents(
  academyId: UUID,
  playerUserId: UUID,
): Promise<ParentPlayerLink[]> {
  return unwrap(
    supabase
      .from('parent_player_links')
      .select(
        'id, parent_user_id, player_user_id, academy_id, relationship_type, status, created_at, updated_at',
      )
      .eq('academy_id', academyId)
      .eq('player_user_id', playerUserId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      parentUserId: row.parent_user_id,
      playerUserId: row.player_user_id,
      academyId: row.academy_id,
      relationshipType: row.relationship_type as ParentRelationshipType,
      status: row.status as 'active' | 'revoked',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  );
}

export async function fetchPlayerLinkingCodes(
  academyId: UUID,
  playerUserId: UUID,
): Promise<ParentLinkingCode[]> {
  return unwrap(
    supabase
      .from('parent_linking_codes')
      .select(
        'id, academy_id, player_user_id, code, relationship_type, expires_at, is_active, created_by, created_at',
      )
      .eq('academy_id', academyId)
      .eq('player_user_id', playerUserId)
      .order('created_at', { ascending: false }),
  ).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      academyId: row.academy_id,
      playerUserId: row.player_user_id,
      code: row.code,
      relationshipType: row.relationship_type as ParentRelationshipType,
      expiresAt: row.expires_at,
      isActive: row.is_active,
      createdBy: row.created_by,
      createdAt: row.created_at,
    })),
  );
}

export async function generateLinkingCode(
  academyId: UUID,
  playerUserId: UUID,
  relationshipType: ParentRelationshipType,
): Promise<string> {
  const { data, error } = await supabase.rpc('generate_parent_linking_code', {
    p_academy_id: academyId,
    p_player_user_id: playerUserId,
    p_relationship_type: relationshipType,
  });

  if (error) throw error;
  return data as string;
}

export async function redeemLinkingCode(code: string): Promise<UUID> {
  const { data, error } = await supabase.rpc('redeem_parent_linking_code', {
    p_code: code,
  });

  if (error) throw error;
  return data as UUID;
}

export async function revokeLinkingCode(codeId: UUID): Promise<void> {
  const { error } = await supabase
    .from('parent_linking_codes')
    .update({ is_active: false })
    .eq('id', codeId);
  if (error) throw error;
}

export async function revokeParentLink(linkId: UUID): Promise<void> {
  const { error } = await supabase
    .from('parent_player_links')
    .update({ status: 'revoked' })
    .eq('id', linkId);
  if (error) throw error;
}
