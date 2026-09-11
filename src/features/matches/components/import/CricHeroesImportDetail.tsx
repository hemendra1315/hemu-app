import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Select } from '@/components/ui';
import { queryKeys } from '@/lib/query/keys';
import type { UUID } from '@/types';
import type { AcademyMember } from '@/types';
import {
  useMatch,
  useMatchBatting,
  useMatchBowling,
  useMatchFielding,
  useMatchLineups,
  useSaveMatchResult,
} from '../../hooks/useMatches';
import { refreshPlayerStatistics } from '../../api/matchesApi';
import type { CricHeroesImportRecord } from '../../api/cricheroesImportsApi';
import { recordCricHeroesImport } from '../../api/cricheroesImportsApi';
import { saveCricHeroesPlayerMappings } from '../../api/cricheroesMappingsApi';
import type { MappedPlayer } from '../../import/cricheroesPdfTypes';
import {
  applyMappingFix,
  type MappingFix,
  type MappingIdentity,
} from '../../import/applyMappingFix';
import { mappingStatusBadge } from '../../import/mappingStatusBadge';
import { useUiStore } from '@/stores';

function identityOf(p: MappedPlayer): MappingIdentity {
  return {
    academyMemberId: p.isGuest ? null : p.academyMemberId,
    isGuest: p.isGuest,
    guestName: p.isGuest ? p.cricheroesName : null,
  };
}

/**
 * The expanded contents of one past import on the review screen: every
 * player mapping decision made at import time, editable, plus a Save that
 * carries the fix through to the match's actual scorecard rows (and
 * remembers it for future imports of the same name).
 *
 * Deliberately its own component, mounted only while its match is expanded
 * — that is what lets the data hooks below (useMatch, useMatchLineups, ...)
 * stay unconditional: each only exists at all once there is a real matchId
 * to fetch for, rather than being called-then-disabled inside a list item.
 */
export function CricHeroesImportDetail({
  academyId,
  importRecord,
  academyMembers,
}: {
  academyId: UUID;
  importRecord: CricHeroesImportRecord;
  academyMembers: AcademyMember[];
}) {
  const matchId = importRecord.matchId;
  const pushToast = useUiStore((s) => s.pushToast);
  const queryClient = useQueryClient();

  const matchQuery = useMatch(matchId, academyId);
  const lineupsQuery = useMatchLineups(matchId);
  const battingQuery = useMatchBatting(matchId);
  const bowlingQuery = useMatchBowling(matchId);
  const fieldingQuery = useMatchFielding(matchId);
  const saveMutation = useSaveMatchResult(academyId);

  const [mappings, setMappings] = useState<MappedPlayer[]>(importRecord.playerMappings);
  const [isSaving, setIsSaving] = useState(false);

  const isLoading =
    matchQuery.isPending ||
    lineupsQuery.isPending ||
    battingQuery.isPending ||
    bowlingQuery.isPending ||
    fieldingQuery.isPending;

  function handleReassign(idx: number, memberId: string) {
    setMappings((prev) => {
      const next = [...prev];
      const current = next[idx];
      if (!current) return prev;
      if (!memberId) {
        next[idx] = {
          ...current,
          academyMemberId: null,
          academyMemberName: null,
          isGuest: true,
          status: 'manual_matched',
        };
        return next;
      }
      const found = academyMembers.find((m) => m.id === memberId);
      next[idx] = {
        ...current,
        academyMemberId: memberId as UUID,
        academyMemberName: found?.fullName ?? found?.email ?? null,
        isGuest: false,
        status: 'manual_matched',
      };
      return next;
    });
  }

  const hasChanges = mappings.some((p, idx) => {
    const original = importRecord.playerMappings[idx];
    if (!original) return false;
    return original.isGuest !== p.isGuest || original.academyMemberId !== p.academyMemberId;
  });

  async function handleSave() {
    if (!matchQuery.data) return;
    setIsSaving(true);
    try {
      const fixes: MappingFix[] = mappings
        .map((p, idx) => {
          const original = importRecord.playerMappings[idx];
          if (!original) return null;
          if (original.isGuest === p.isGuest && original.academyMemberId === p.academyMemberId) {
            return null;
          }
          return { from: identityOf(original), to: identityOf(p) };
        })
        .filter((f): f is MappingFix => f !== null);

      // Awards and partnerships are deliberately left out of this payload —
      // save_match_result only touches those tables when they're present and
      // non-empty, so omitting them leaves whatever is already saved alone.
      // A CricHeroes import never sets either (buildImportWizardState doesn't
      // produce them), so there is normally nothing there to go stale; if a
      // match ever gets awards added by hand later and then one of *those*
      // players is the one being corrected here, the award would need fixing
      // separately on the match's own page.
      const match = matchQuery.data;
      await saveMutation.mutateAsync({
        match: {
          id: match.id,
          matchName: match.matchName,
          matchDate: match.matchDate,
          venue: match.venue,
          opponentName: match.opponentName,
          tournament: match.tournament,
          matchType: match.matchType,
          format: match.format,
          overs: match.overs,
          teamScore: match.teamScore,
          wicketsLost: match.wicketsLost,
          oversPlayed: match.oversPlayed,
          result: match.result,
          winningMargin: match.winningMargin,
          batchId: match.batchId,
          cricheroesSourceUrl: match.cricheroesSourceUrl,
        },
        lineups: applyMappingFix(lineupsQuery.data ?? [], fixes).map((l) => ({
          academyMemberId: l.academyMemberId,
          battingOrder: l.battingOrder ?? 0,
          isCaptain: l.isCaptain,
          isViceCaptain: l.isViceCaptain,
          isWicketkeeper: l.isWicketkeeper,
          isGuest: l.isGuest ?? false,
          guestName: l.guestName ?? null,
        })),
        batting: applyMappingFix(battingQuery.data ?? [], fixes).map((b) => ({
          academyMemberId: b.academyMemberId,
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          isOut: b.isOut,
          dismissalType: b.dismissalType,
          battingOrder: b.battingOrder,
          isGuest: b.isGuest ?? false,
          guestName: b.guestName ?? null,
        })),
        bowling: applyMappingFix(bowlingQuery.data ?? [], fixes).map((b) => ({
          academyMemberId: b.academyMemberId,
          overs: b.overs,
          maidens: b.maidens,
          runsConceded: b.runsConceded,
          wickets: b.wickets,
          wides: b.wides,
          noBalls: b.noBalls,
          isGuest: b.isGuest ?? false,
          guestName: b.guestName ?? null,
        })),
        fielding: applyMappingFix(fieldingQuery.data ?? [], fixes).map((f) => ({
          academyMemberId: f.academyMemberId,
          catches: f.catches,
          runOuts: f.runOuts,
          stumpings: f.stumpings,
          isGuest: f.isGuest ?? false,
          guestName: f.guestName ?? null,
        })),
      });

      // save_match_result only refreshes stats for players who still appear
      // in this match's rows afterward — exactly right for a normal save,
      // but a fix that moves a player OUT of this match (their runs handed
      // to someone else) leaves the old player's own stats stale otherwise:
      // nothing else would ever tell them to recompute.
      const vacatedMemberIds = Array.from(
        new Set(
          fixes
            .filter((f) => !f.from.isGuest && f.from.academyMemberId)
            .map((f) => f.from.academyMemberId as UUID),
        ),
      );
      for (const memberId of vacatedMemberIds) {
        try {
          await refreshPlayerStatistics(academyId, memberId);
        } catch {
          // Non-blocking — the scorecard fix itself already saved successfully;
          // worst case this player's stats catch up next time anything else
          // triggers a refresh for them.
        }
      }

      // Remember the fix in two places: the per-match snapshot this screen
      // reads from, and the academy-wide name memory that future imports
      // consult — otherwise the very next scorecard with this name on it
      // would repeat the same mistake.
      await recordCricHeroesImport({
        academyId,
        matchId,
        sourceFilename: importRecord.sourceFilename ?? '',
        playerMappings: mappings,
      });
      try {
        await saveCricHeroesPlayerMappings(
          academyId,
          mappings.map((m) => ({
            cricheroesPlayerId: m.cricheroesPlayerId ?? null,
            cricheroesName: m.cricheroesName,
            academyMemberId: m.isGuest ? null : m.academyMemberId,
            isGuest: m.isGuest,
            confidenceScore: m.confidenceScore,
          })),
        );
      } catch {
        // Non-blocking, same as the import modal's own mapping-memory save.
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.academy.all });
      pushToast({ title: 'Import corrected', variant: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save the fix';
      pushToast({ title: 'Could not save the fix', description: msg, variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-fg-muted p-4 text-sm">Loading this match's scorecard…</p>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="border-border-subtle overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-subtle border-border-subtle border-b">
            <tr>
              <th className="px-4 py-3 font-semibold">CricHeroes Player</th>
              <th className="px-4 py-3 font-semibold">Academy Player</th>
              <th className="px-4 py-3 font-semibold">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-border-subtle divide-y">
            {mappings.map((player, idx) => {
              const badge = mappingStatusBadge(player);
              return (
                <tr key={player.cricheroesName + idx} className="hover:bg-surface-muted/50">
                  <td className="text-fg px-4 py-3 font-medium">{player.cricheroesName}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={player.academyMemberId ?? ''}
                      onChange={(e) => handleReassign(idx, e.target.value)}
                      className="w-full max-w-xs"
                    >
                      <option value="">-- Guest Player (Not in Academy) --</option>
                      {academyMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName ?? m.email}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-fg-muted text-xs">
          {hasChanges
            ? 'Fixing a player here updates this match’s scorecard and stats, and is remembered for future imports.'
            : 'Reassign a player above to fix a wrong match or guest call from this import.'}
        </p>
        <Button
          size="sm"
          onClick={() => void handleSave()}
          disabled={!hasChanges}
          isLoading={isSaving}
        >
          Save fix
        </Button>
      </div>
    </div>
  );
}
