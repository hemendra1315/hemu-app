/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrap } from '@/lib/api';
import { supabase } from '@/lib/supabase/client';
import type { UUID } from '@/types';
import type { MappedPlayer } from '../import/cricheroesPdfTypes';

export type CricHeroesImportRecord = {
  id: UUID;
  academyId: UUID;
  matchId: UUID;
  sourceFilename: string | null;
  playerMappings: MappedPlayer[];
  importedBy: UUID | null;
  importedAt: string;
  updatedAt: string;
};

function toImportRecord(row: any): CricHeroesImportRecord {
  return {
    id: row.id,
    academyId: row.academy_id,
    matchId: row.match_id,
    sourceFilename: row.source_filename,
    playerMappings: (row.player_mappings ?? []) as MappedPlayer[],
    importedBy: row.imported_by,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
  };
}

/** Every past CricHeroes import for an academy, newest first. */
export async function fetchCricHeroesImports(academyId: UUID): Promise<CricHeroesImportRecord[]> {
  const rows = await unwrap<any[]>(
    supabase
      .from('cricheroes_imports')
      .select('*')
      .eq('academy_id', academyId)
      .order('imported_at', { ascending: false })
      .returns<any[]>(),
  );
  return rows.map(toImportRecord);
}

/**
 * Saves the player-mapping decisions made while importing a scorecard, once
 * the match itself has an id. Called once right after a fresh import is
 * saved (see MatchWizard), and again whenever the review screen corrects a
 * mapping (see CricHeroesImportsPage) — in both cases this fully replaces
 * the stored snapshot for that match.
 */
export async function recordCricHeroesImport(input: {
  academyId: UUID;
  matchId: UUID;
  sourceFilename: string;
  playerMappings: MappedPlayer[];
}): Promise<void> {
  const { error } = await supabase.from('cricheroes_imports').upsert(
    {
      academy_id: input.academyId,
      match_id: input.matchId,
      source_filename: input.sourceFilename,
      player_mappings: input.playerMappings,
      imported_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'match_id' },
  );

  if (error) {
    throw error;
  }
}
