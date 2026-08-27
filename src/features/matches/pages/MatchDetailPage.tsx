import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';

import { Card, CardBody, CardHeader } from '@/components/ui';
import { ErrorState, EmptyState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { isUUID } from '@/lib/validators';
import { formatDate } from '@/lib/utils/date';
import { MatchCoachNotesCard } from '../components/MatchCoachNotesCard';
import {
  useMatch,
  useMatchLineups,
  useMatchBatting,
  useMatchBowling,
  useMatchFielding,
  useMatchAwards,
} from '../hooks/useMatches';

export default function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { academyId } = useActiveAcademy();

  const matchQuery = useMatch(matchId ?? null, academyId);
  const lineupsQuery = useMatchLineups(matchId ?? null);
  const battingQuery = useMatchBatting(matchId ?? null);
  const bowlingQuery = useMatchBowling(matchId ?? null);
  const fieldingQuery = useMatchFielding(matchId ?? null);
  const awardsQuery = useMatchAwards(matchId ?? null);

  const matchTypeLabel = matchQuery.data?.matchType;
  const formatLabel = matchQuery.data?.format;

  const captain = useMemo(() => lineupsQuery.data?.find((l) => l.isCaptain), [lineupsQuery.data]);
  const viceCaptain = useMemo(
    () => lineupsQuery.data?.find((l) => l.isViceCaptain),
    [lineupsQuery.data],
  );
  const wicketkeeper = useMemo(
    () => lineupsQuery.data?.find((l) => l.isWicketkeeper),
    [lineupsQuery.data],
  );

  if (!matchId || !isUUID(matchId)) {
    return (
      <EmptyState
        title={!matchId ? 'No match selected' : 'Invalid match link'}
        description={
          !matchId
            ? 'Select a match from the matches list to view its details.'
            : 'The match link you followed is not valid. Please return to the matches list.'
        }
      />
    );
  }
  if (matchQuery.isPending) return <p className="text-fg-muted">Loading match…</p>;
  if (matchQuery.isError || !matchQuery.data)
    return <ErrorState error={matchQuery.error} onRetry={() => void matchQuery.refetch()} />;

  const match = matchQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/matches" className="text-fg-muted hover:text-fg text-sm">
          ← Back to matches
        </Link>
      </div>

      <Card>
        <CardHeader
          title={match.matchName}
          description={`${formatDate(match.matchDate)} • ${match.opponentName ?? 'No opponent'} • ${match.tournament ?? ''}`.trim()}
        />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <span className="bg-surface-muted text-fg-muted rounded-full px-3 py-1 text-xs font-medium">
              {matchTypeLabel}
            </span>
            <span className="bg-surface-muted text-fg-muted rounded-full px-3 py-1 text-xs font-medium">
              {formatLabel?.toUpperCase()}
            </span>
            <span className="bg-surface-muted text-fg-muted rounded-full px-3 py-1 text-xs font-medium">
              {match.status}
            </span>
            {match.overs ? (
              <span className="bg-surface-muted text-fg-muted rounded-full px-3 py-1 text-xs font-medium">
                {match.overs} overs
              </span>
            ) : null}
            {match.teamScore ? (
              <span className="bg-surface-muted text-fg-muted rounded-full px-3 py-1 text-xs font-medium">
                {match.teamScore}
              </span>
            ) : null}
          </div>

          {captain ? (
            <p className="text-fg-muted mt-2 text-sm">
              Captain: {captain.player.fullName ?? captain.player.email}
            </p>
          ) : null}
          {viceCaptain ? (
            <p className="text-fg-muted text-sm">
              Vice Captain: {viceCaptain.player.fullName ?? viceCaptain.player.email}
            </p>
          ) : null}
          {wicketkeeper ? (
            <p className="text-fg-muted text-sm">
              Wicketkeeper: {wicketkeeper.player.fullName ?? wicketkeeper.player.email}
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Batting" description="Batting scorecard." />
        <CardBody>
          {battingQuery.isPending ? (
            <p className="text-fg-muted">Loading batting…</p>
          ) : battingQuery.data?.length === 0 ? (
            <p className="text-fg-muted">No batting data.</p>
          ) : (
            <>
              {/* Mobile Card Representation (< md) */}
              <div className="space-y-3 md:hidden">
                {[...(battingQuery.data ?? [])]
                  .sort((a, b) => (a.battingOrder ?? 99) - (b.battingOrder ?? 99))
                  .map((b) => (
                    <div
                      key={b.id}
                      className="border-border-subtle bg-surface space-y-2 rounded-xl border p-3.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-fg truncate text-sm font-bold">
                          {b.player.fullName ?? b.player.email}
                        </span>
                        <span className="text-primary text-sm font-bold">
                          {b.runs}{' '}
                          <span className="text-fg-muted text-xs font-normal">({b.balls}b)</span>
                        </span>
                      </div>
                      <div className="border-border-subtle text-fg-muted flex items-center justify-between border-t pt-2">
                        <span>
                          4s: <strong className="text-fg font-semibold">{b.fours}</strong> · 6s:{' '}
                          <strong className="text-fg font-semibold">{b.sixes}</strong>
                        </span>
                        <span className="bg-surface-muted text-fg-muted rounded px-2 py-0.5 font-medium">
                          {b.isOut ? (b.dismissalType ?? 'Out') : 'Not out'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2">Pos</th>
                      <th className="pb-2">Player</th>
                      <th className="pb-2">R</th>
                      <th className="pb-2">B</th>
                      <th className="pb-2">4s</th>
                      <th className="pb-2">6s</th>
                      <th className="pb-2">Dismissal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...(battingQuery.data ?? [])]
                      .sort((a, b) => (a.battingOrder ?? 99) - (b.battingOrder ?? 99))
                      .map((b) => (
                        <tr key={b.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">
                            {b.battingOrder === 0 ? 'Opening' : (b.battingOrder ?? '-')}
                          </td>
                          <td className="py-2">{b.player.fullName ?? b.player.email}</td>
                          <td className="py-2">{b.runs}</td>
                          <td className="py-2">{b.balls}</td>
                          <td className="py-2">{b.fours}</td>
                          <td className="py-2">{b.sixes}</td>
                          <td className="py-2">
                            {b.isOut ? (b.dismissalType ?? 'Out') : 'Not out'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Bowling" description="Bowling scorecard." />
        <CardBody>
          {bowlingQuery.isPending ? (
            <p className="text-fg-muted">Loading bowling…</p>
          ) : bowlingQuery.data?.length === 0 ? (
            <p className="text-fg-muted">No bowling data.</p>
          ) : (
            <>
              {/* Mobile Card Representation (< md) */}
              <div className="space-y-3 md:hidden">
                {bowlingQuery.data?.map((b) => (
                  <div
                    key={b.id}
                    className="border-border-subtle bg-surface space-y-2 rounded-xl border p-3.5 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-fg truncate text-sm font-bold">
                        {b.player.fullName ?? b.player.email}
                      </span>
                      <span className="text-primary text-sm font-bold">
                        {b.wickets}/{b.runsConceded}
                      </span>
                    </div>
                    <div className="border-border-subtle text-fg-muted flex items-center justify-between border-t pt-2">
                      <span>
                        Overs: <strong className="text-fg font-semibold">{b.overs}</strong> (M:{' '}
                        {b.maidens})
                      </span>
                      <span>
                        Wides: {b.wides} · NB: {b.noBalls}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2">Player</th>
                      <th className="pb-2">Overs</th>
                      <th className="pb-2">Maidens</th>
                      <th className="pb-2">Runs</th>
                      <th className="pb-2">Wickets</th>
                      <th className="pb-2">Wides</th>
                      <th className="pb-2">No-balls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bowlingQuery.data?.map((b) => (
                      <tr key={b.id} className="border-b last:border-0">
                        <td className="py-2">{b.player.fullName ?? b.player.email}</td>
                        <td className="py-2">{b.overs}</td>
                        <td className="py-2">{b.maidens}</td>
                        <td className="py-2">{b.runsConceded}</td>
                        <td className="py-2">{b.wickets}</td>
                        <td className="py-2">{b.wides}</td>
                        <td className="py-2">{b.noBalls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Fielding" description="Fielding stats." />
        <CardBody>
          {fieldingQuery.isPending ? (
            <p className="text-fg-muted">Loading fielding…</p>
          ) : fieldingQuery.data?.length === 0 ? (
            <p className="text-fg-muted">No fielding data.</p>
          ) : (
            <>
              {/* Mobile Card Representation (< md) */}
              <div className="space-y-3 md:hidden">
                {fieldingQuery.data?.map((f) => (
                  <div
                    key={f.id}
                    className="border-border-subtle bg-surface flex items-center justify-between rounded-xl border p-3.5 text-xs shadow-2xs"
                  >
                    <span className="text-fg truncate text-sm font-bold">
                      {f.player.fullName ?? f.player.email}
                    </span>
                    <div className="text-fg-muted flex gap-2 text-xs">
                      <span>
                        Catches: <strong className="text-fg font-semibold">{f.catches}</strong>
                      </span>
                      <span>
                        Run-outs: <strong className="text-fg font-semibold">{f.runOuts}</strong>
                      </span>
                      <span>
                        Stumpings: <strong className="text-fg font-semibold">{f.stumpings}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2">Player</th>
                      <th className="pb-2">Catches</th>
                      <th className="pb-2">Run-outs</th>
                      <th className="pb-2">Stumpings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldingQuery.data?.map((f) => (
                      <tr key={f.id} className="border-b last:border-0">
                        <td className="py-2">{f.player.fullName ?? f.player.email}</td>
                        <td className="py-2">{f.catches}</td>
                        <td className="py-2">{f.runOuts}</td>
                        <td className="py-2">{f.stumpings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Awards" description="Match awards." />
        <CardBody>
          {awardsQuery.isPending ? (
            <p className="text-fg-muted">Loading awards…</p>
          ) : !awardsQuery.data ? (
            <p className="text-fg-muted">No awards recorded.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-fg-muted text-xs">Player of the Match</p>
                <p className="text-fg font-medium">
                  {awardsQuery.data.playerOfMatch?.fullName ??
                    awardsQuery.data.playerOfMatch?.email ??
                    '-'}
                </p>
              </div>
              <div>
                <p className="text-fg-muted text-xs">Best Batter</p>
                <p className="text-fg font-medium">
                  {awardsQuery.data.bestBatter?.fullName ??
                    awardsQuery.data.bestBatter?.email ??
                    '-'}
                </p>
              </div>
              <div>
                <p className="text-fg-muted text-xs">Best Bowler</p>
                <p className="text-fg font-medium">
                  {awardsQuery.data.bestBowler?.fullName ??
                    awardsQuery.data.bestBowler?.email ??
                    '-'}
                </p>
              </div>
              <div>
                <p className="text-fg-muted text-xs">Best Fielder</p>
                <p className="text-fg font-medium">
                  {awardsQuery.data.bestFielder?.fullName ??
                    awardsQuery.data.bestFielder?.email ??
                    '-'}
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {academyId && (
        <MatchCoachNotesCard
          matchId={matchId}
          academyId={academyId}
          lineups={lineupsQuery.data ?? []}
        />
      )}
    </div>
  );
}
