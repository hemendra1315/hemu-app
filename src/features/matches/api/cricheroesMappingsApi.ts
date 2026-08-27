/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrap } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { UUID } from '@/types';

export type SavedPlayerMapping = {
  id: UUID;
  academyId: UUID;
  cricheroesPlayerId: string | null;
  cricheroesName: string;
  academyMemberId: UUID | null;
  isGuest: boolean;
  confidenceScore: number;
  createdAt: string;
  updatedAt: string;
};

export async function fetchCricHeroesPlayerMappings(
  academyId: UUID,
): Promise<SavedPlayerMapping[]> {
  const rows = await unwrap<any[]>(
    supabase
      .from('cricheroes_player_mappings')
      .select('*')
      .eq('academy_id', academyId)
      .returns<any[]>(),
  );

  return rows.map((r) => ({
    id: r.id,
    academyId: r.academy_id,
    cricheroesPlayerId: r.cricheroes_player_id,
    cricheroesName: r.cricheroes_name,
    academyMemberId: r.academy_member_id,
    isGuest: r.is_guest,
    confidenceScore: r.confidence_score,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function saveCricHeroesPlayerMappings(
  academyId: UUID,
  mappings: Array<{
    cricheroesPlayerId?: string | null;
    cricheroesName: string;
    academyMemberId: UUID | null;
    isGuest: boolean;
    confidenceScore?: number;
  }>,
): Promise<void> {
  if (mappings.length === 0) return;

  const payload = mappings.map((m) => ({
    cricheroes_player_id: m.cricheroesPlayerId ?? null,
    cricheroes_name: m.cricheroesName,
    academy_member_id: m.isGuest ? null : m.academyMemberId,
    is_guest: m.isGuest,
    confidence_score: m.confidenceScore ?? 100,
  }));

  const { error } = await supabase.rpc('upsert_cricheroes_player_mappings', {
    p_academy_id: academyId,
    p_mappings: payload,
  });

  if (error) {
    throw error;
  }
}
