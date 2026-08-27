import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Card, CardBody, CardHeader } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { MobilePageHeader } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import {
  usePlayerDashboardAnalytics,
  useOwnerDashboardAnalytics,
} from '@/features/dashboard/hooks/useDashboardAnalytics';
import { SimpleBarChart } from '@/components/charts/SimpleBarChart';
import { useTestModeStore } from '@/stores';
import { supabase } from '@/lib/supabase/client';
import { isUUID } from '@/lib/validators';
import { formatDate } from '@/lib/utils/date';

export default function StatsPage() {
  const { academyId, membership } = useActiveAcademy();
  const testModeRole = useTestModeStore((s) => s.activeRole);

  const role = testModeRole
    ? testModeRole === 'student'
      ? 'player'
      : testModeRole
    : (membership?.role ?? 'player');

  const isPlayer = role === 'player';
  const isOwnerOrCoach = role === 'academy_owner' || role === 'coach';

  // Query an active player ID if in Player mode
  const activePlayerQuery = useQuery({
    queryKey: ['active-academy-player-stats', academyId],
    enabled: Boolean(academyId) && isPlayer && membership?.role !== 'player',
    queryFn: async () => {
      const { data } = await supabase
        .from('academy_members')
        .select('id')
        .eq('academy_id', academyId as string)
        .eq('role', 'player')
        .eq('status', 'active')
        .limit(1);
      return data?.[0]?.id ?? null;
    },
  });

  const resolvedPlayerId =
    (membership?.role === 'player' ? membership?.id : null) ??
    (activePlayerQuery.data && isUUID(activePlayerQuery.data) ? activePlayerQuery.data : null);

  const playerId = resolvedPlayerId && isUUID(resolvedPlayerId) ? resolvedPlayerId : null;

  const playerAnalyticsQuery = usePlayerDashboardAnalytics(academyId, isPlayer ? playerId : null);
  const ownerAnalyticsQuery = useOwnerDashboardAnalytics(isOwnerOrCoach ? academyId : null);

  if (!academyId) return null;

  if (isPlayer) {
    if (playerAnalyticsQuery.isPending) {
      return <p className="text-fg-muted p-4">Loading stats…</p>;
    }
    if (playerAnalyticsQuery.isError || !playerAnalyticsQuery.data) {
      return (
        <ErrorState
          error={playerAnalyticsQuery.error}
          onRetry={() => void playerAnalyticsQuery.refetch()}
        />
      );
    }

    const analytics = playerAnalyticsQuery.data;
    const stats = analytics.stats;

    return (
      <div className="space-y-6 pb-24 md:pb-6">
        <div className="md:hidden">
          <MobilePageHeader title="Stats & Performance" subtitle="Personal Cricket Statistics" />
        </div>

        <div className="hidden md:block">
          <h1 className="text-fg text-2xl font-bold tracking-tight">Stats & Performance</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Your personal batting, bowling, and match statistics.
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Card>
              <CardBody className="p-4">
                <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                  Matches
                </p>
                <p className="text-fg mt-1 text-2xl font-bold">{stats.matchesPlayed}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">Runs</p>
                <p className="text-fg mt-1 text-2xl font-bold">{stats.battingRuns}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                  Wickets
                </p>
                <p className="text-fg mt-1 text-2xl font-bold">{stats.bowlingWickets}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                  Batting Avg
                </p>
                <p className="text-fg mt-1 text-2xl font-bold">{stats.battingAverage}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                  Strike Rate
                </p>
                <p className="text-fg mt-1 text-2xl font-bold">{stats.strikeRate}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="p-4">
                <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                  Economy
                </p>
                <p className="text-fg mt-1 text-2xl font-bold">{stats.economy}</p>
              </CardBody>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader title="Match Statistics" description="Recent performance summary" />
          <CardBody className="p-4">
            {analytics.recentMatches?.length === 0 ? (
              <p className="text-fg-muted">No matches played yet.</p>
            ) : (
              <div className="space-y-3">
                {analytics.recentMatches?.map((match) => (
                  <Link
                    key={match.id}
                    to={`/matches/${match.id}`}
                    className="border-border-subtle hover:border-primary/40 flex flex-wrap items-center justify-between rounded-xl border p-3 transition"
                  >
                    <div>
                      <p className="text-fg font-medium">{match.matchName}</p>
                      <p className="text-fg-muted text-xs">
                        {formatDate(match.matchDate)} • {match.opponentName}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {match.batting && (
                        <span className="bg-surface-muted rounded-full px-2.5 py-1 text-xs font-medium">
                          {match.batting.runs} runs ({match.batting.balls}b)
                        </span>
                      )}
                      {match.bowling && (
                        <span className="bg-surface-muted rounded-full px-2.5 py-1 text-xs font-medium">
                          {match.bowling.wickets}/{match.bowling.runsConceded}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {analytics.runsTrend?.length > 0 && (
          <Card>
            <CardHeader title="Performance Trends" />
            <CardBody className="p-4">
              <SimpleBarChart
                data={analytics.runsTrend.map((m) => ({
                  label: m.matchDate ? formatDate(m.matchDate) : '',
                  value: m.runs,
                }))}
                height={200}
              />
            </CardBody>
          </Card>
        )}
      </div>
    );
  }

  // Owner / Coach view
  if (ownerAnalyticsQuery.isPending) {
    return <p className="text-fg-muted p-4">Loading academy statistics…</p>;
  }

  if (ownerAnalyticsQuery.isError || !ownerAnalyticsQuery.data) {
    return (
      <ErrorState
        error={ownerAnalyticsQuery.error}
        onRetry={() => void ownerAnalyticsQuery.refetch()}
      />
    );
  }

  const ownerData = ownerAnalyticsQuery.data;
  const topBatters = ownerData.topBatters ?? [];
  const topBowlers = ownerData.topBowlers ?? [];

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="md:hidden">
        <MobilePageHeader title="Stats & Performance" subtitle="Academy Analytics & Leaders" />
      </div>

      <div className="hidden md:block">
        <h1 className="text-fg text-2xl font-bold tracking-tight">Stats & Performance</h1>
        <p className="text-fg-muted mt-1 text-sm">
          Academy-wide cricket statistics, top run scorers, and match performance.
        </p>
      </div>

      {/* Match Statistics Summary */}
      <Card>
        <CardHeader title="Match Statistics" description="Overall team and fixture summary" />
        <CardBody className="p-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            <div className="border-border-subtle bg-surface-muted/40 rounded-xl border p-3">
              <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                Total Matches
              </p>
              <p className="text-fg mt-1 text-2xl font-bold">{ownerData.totalMatches ?? 0}</p>
            </div>
            <div className="border-border-subtle bg-surface-muted/40 rounded-xl border p-3">
              <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                Active Players
              </p>
              <p className="text-fg mt-1 text-2xl font-bold">{ownerData.totalPlayers ?? 0}</p>
            </div>
            <div className="border-border-subtle bg-surface-muted/40 rounded-xl border p-3">
              <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                Batches
              </p>
              <p className="text-fg mt-1 text-2xl font-bold">{ownerData.totalBatches ?? 0}</p>
            </div>
            <div className="border-border-subtle bg-surface-muted/40 rounded-xl border p-3">
              <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                Coaches
              </p>
              <p className="text-fg mt-1 text-2xl font-bold">{ownerData.totalCoaches ?? 0}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Top Performers Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top Run Scorers" description="Leading batters by total runs scored" />
          <CardBody className="p-4">
            {topBatters.length === 0 ? (
              <p className="text-fg-muted">No batting statistics available yet.</p>
            ) : (
              <div className="space-y-3">
                {topBatters.map((player, idx) => (
                  <div
                    key={player.id}
                    className="border-border-subtle flex items-center justify-between rounded-xl border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="text-fg text-sm font-semibold">{player.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-fg text-base font-bold">{player.runs} runs</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top Wicket Takers" description="Leading bowlers by wickets taken" />
          <CardBody className="p-4">
            {topBowlers.length === 0 ? (
              <p className="text-fg-muted">No bowling statistics available yet.</p>
            ) : (
              <div className="space-y-3">
                {topBowlers.map((player, idx) => (
                  <div
                    key={player.id}
                    className="border-border-subtle flex items-center justify-between rounded-xl border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="text-fg text-sm font-semibold">{player.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-fg text-base font-bold">{player.wickets} wickets</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
