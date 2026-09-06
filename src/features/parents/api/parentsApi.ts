/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrap } from '@/lib/api';
import { logger } from '@/lib/logger';
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

  const links = await unwrap<any[]>(
    supabase
      .from('parent_player_links')
      .select('id, relationship_type, player_user_id')
      .eq('academy_id', academyId)
      .eq('status', 'active')
      .returns<any[]>(),
  );

  if (links.length === 0) return [];

  // parent_player_links has no foreign key to academy_members (it links to
  // profiles), so the two can't be embedded in one PostgREST select. Resolve
  // each linked player's academy_members row separately instead.
  const memberRows = await unwrap<any[]>(
    supabase
      .from('academy_members')
      .select('id, user_id')
      .eq('academy_id', academyId)
      .in(
        'user_id',
        links.map((row) => row.player_user_id),
      )
      .returns<any[]>(),
  );
  const memberIdByUserId = new Map(memberRows.map((m) => [m.user_id, m.id]));

  // Each child's profile used to be fetched with its own try/catch that
  // logged the error and just continued — a parent with 3 linked children
  // whose 2nd child's profile fetch failed (a transient network blip, a
  // permission error) silently ended up with only 2 children on screen,
  // with nothing to say one was missing. That's indistinguishable from
  // actually having 2 children, which is exactly the kind of silent data
  // loss the round-12 fix (bug #42) was meant to rule out — it only ever
  // covered the top-level query failing outright, not one child's profile
  // fetch failing inside the loop. Logging and rethrowing means a failed
  // profile fetch now fails the whole query, which the dashboard already
  // renders as a visible error state rather than a quietly-incomplete list.
  const entries = links
    .map((row) => ({ row, memberId: memberIdByUserId.get(row.player_user_id) }))
    .filter((entry): entry is { row: (typeof links)[number]; memberId: string } =>
      Boolean(entry.memberId),
    );

  return Promise.all(
    entries.map(async ({ row, memberId }) => {
      try {
        const profile = await fetchPlayerProfile(academyId, memberId);
        return {
          linkId: row.id,
          relationshipType: row.relationship_type,
          player: profile,
        };
      } catch (err) {
        logger.error('linked_child_profile_fetch_failed', { error: err });
        throw err;
      }
    }),
  );
}

export async function fetchPlayerParents(
  academyId: UUID,
  playerUserId: UUID,
): Promise<ParentPlayerLink[]> {
  // Previously selected nothing but the relationship type and a date —
  // the "Linked Parents" list on FamilyTab showed cards like "Father —
  // Linked: Jan 1" with no name, email, or phone anywhere. A staff member
  // revoking access had no way to tell which actual person they were
  // about to cut off, especially with more than one parent of the same
  // relationship type (two "guardian" links, a remarried family with two
  // "father"/"mother" entries, etc). parent_player_links.parent_user_id
  // has a real FK to profiles, so this can be embedded directly.
  return unwrap(
    supabase
      .from('parent_player_links')
      .select(
        'id, parent_user_id, player_user_id, academy_id, relationship_type, status, created_at, updated_at, parent:profiles!parent_player_links_parent_user_id_fkey(full_name, email, phone)',
      )
      .eq('academy_id', academyId)
      .eq('player_user_id', playerUserId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .returns<any[]>(),
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
      parentName: row.parent?.full_name ?? null,
      parentEmail: row.parent?.email ?? null,
      parentPhone: row.parent?.phone ?? null,
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
