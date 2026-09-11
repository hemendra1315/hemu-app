import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button, Card, CardBody } from '@/components/ui';
import { useActiveAcademy } from '@/features/academies';
import { useAcademyMembers } from '@/features/members';
import { formatDate } from '@/lib/utils/date';
import { useAcademyMatches, useCricHeroesImports } from '../hooks/useMatches';
import { CricHeroesImportDetail } from '../components/import/CricHeroesImportDetail';

/**
 * Staff-only screen for looking back at every match imported from a
 * CricHeroes PDF: what the import matched each name to, how confident it
 * was, and — if something was wrong — fixing it without re-uploading the
 * scorecard. See claude/feature-cricheroes-import-review.md.
 */
export default function CricHeroesImportsPage() {
  const { academyId } = useActiveAcademy();
  const importsQuery = useCricHeroesImports(academyId);
  const matchesQuery = useAcademyMatches(academyId);
  const membersQuery = useAcademyMembers(academyId, { status: 'active' });
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  if (!academyId) return null;

  const matchesById = new Map((matchesQuery.data ?? []).map((m) => [m.id, m]));
  const imports = importsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-fg text-2xl font-bold">CricHeroes Imports</h1>
        <p className="text-fg-muted mt-1 text-sm">
          Every match imported from a CricHeroes scorecard, and how confident the import was about
          each player. Reassign anyone who was matched wrong — it fixes that match's stats and is
          remembered for the next import.
        </p>
      </div>

      {importsQuery.isPending || matchesQuery.isPending ? (
        <div className="flex justify-center p-8">Loading imports…</div>
      ) : imports.length === 0 ? (
        <Card>
          <CardBody className="p-8 text-center">
            <p className="text-fg-muted text-sm">
              No matches have been imported from a CricHeroes scorecard yet.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {imports.map((record) => {
            const match = matchesById.get(record.matchId);
            const mappings = record.playerMappings;
            const guestCount = mappings.filter((p) => p.isGuest).length;
            const needsReviewCount = mappings.filter(
              (p) => !p.isGuest && p.status === 'low_confidence',
            ).length;
            const isExpanded = expandedMatchId === record.matchId;

            return (
              <Card key={record.matchId} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-fg text-lg font-semibold">
                      {match?.matchName ?? 'Match no longer exists'}
                    </h3>
                    <p className="text-fg-muted mt-0.5 text-xs">
                      {match ? formatDate(match.matchDate) : ''}
                      {match?.opponentName ? ` · vs ${match.opponentName}` : ''}
                      {' · '}
                      {mappings.length} player{mappings.length === 1 ? '' : 's'}
                      {guestCount > 0 ? ` · ${guestCount} guest${guestCount === 1 ? '' : 's'}` : ''}
                      {needsReviewCount > 0 ? (
                        <span className="text-warning-500 font-medium">
                          {' '}
                          · {needsReviewCount} needs review
                        </span>
                      ) : null}
                    </p>
                    {record.sourceFilename ? (
                      <p className="text-fg-subtle mt-1 text-xs">
                        From {record.sourceFilename} · imported {formatDate(record.importedAt)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {match?.cricheroesSourceUrl ? (
                      <a
                        href={match.cricheroesSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                      >
                        Original scorecard <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    {match ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedMatchId(isExpanded ? null : record.matchId)}
                      >
                        {isExpanded ? 'Hide' : 'Review'}
                        {isExpanded ? (
                          <ChevronUp className="ml-1 h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="ml-1 h-3.5 w-3.5" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {isExpanded && match ? (
                  <div className="border-border-subtle mt-4 border-t">
                    <CricHeroesImportDetail
                      key={record.matchId}
                      academyId={academyId}
                      importRecord={record}
                      academyMembers={membersQuery.data ?? []}
                    />
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
