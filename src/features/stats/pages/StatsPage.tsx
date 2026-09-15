import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Target,
  Zap,
  TrendingUp,
  Flame,
  Activity,
  Users,
  Layers,
  Award,
  ChevronRight,
  UserCheck,
  Shield,
} from 'lucide-react';

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
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      );
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
      <div className="space-y-6 pb-24 md:pb-8">
        <div className="md:hidden">
          <MobilePageHeader
            title="Stats & Telemetry"
            subtitle="Personal Cricket Performance"
            showBack={false}
          />
        </div>

        <div className="hidden md:flex md:items-center md:justify-between">
          <div>
            <h1 className="text-fg flex items-center gap-2.5 text-2xl font-black tracking-tight">
              <Activity className="text-primary h-6 w-6" />
              Personal Stats & Telemetry
            </h1>
            <p className="text-fg-muted mt-1 text-sm font-medium">
              Career batting, bowling, strike rates, and recent match performance.
            </p>
          </div>
        </div>

        {/* 6-Metric Stat Grid */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="border-border-subtle bg-surface hover:border-primary/40 group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  Matches
                </span>
                <Target className="text-primary/70 group-hover:text-primary h-4 w-4 transition-colors" />
              </div>
              <p className="text-fg mt-2 font-mono text-2xl font-black tracking-tight">
                {stats.matchesPlayed}
              </p>
              <p className="text-fg-subtle mt-1 text-[11px] font-medium">Caps recorded</p>
            </div>

            <div className="border-border-subtle bg-surface hover:border-primary/40 group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  Runs
                </span>
                <Zap className="text-primary/70 group-hover:text-primary h-4 w-4 transition-colors" />
              </div>
              <p className="text-primary mt-2 font-mono text-2xl font-black tracking-tight">
                {stats.battingRuns}
              </p>
              <p className="text-fg-subtle mt-1 text-[11px] font-medium">Total scored</p>
            </div>

            <div className="border-border-subtle bg-surface hover:border-primary/40 group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  Wickets
                </span>
                <Shield className="text-primary/70 group-hover:text-primary h-4 w-4 transition-colors" />
              </div>
              <p className="text-primary mt-2 font-mono text-2xl font-black tracking-tight">
                {stats.bowlingWickets}
              </p>
              <p className="text-fg-subtle mt-1 text-[11px] font-medium">Dismissals</p>
            </div>

            <div className="border-border-subtle bg-surface hover:border-primary/40 group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  Batting Avg
                </span>
                <TrendingUp className="text-primary/70 group-hover:text-primary h-4 w-4 transition-colors" />
              </div>
              <p className="text-fg mt-2 font-mono text-2xl font-black tracking-tight">
                {stats.battingAverage}
              </p>
              <p className="text-fg-subtle mt-1 text-[11px] font-medium">Per dismissal</p>
            </div>

            <div className="border-border-subtle bg-surface hover:border-primary/40 group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  Strike Rate
                </span>
                <Flame className="text-primary/70 group-hover:text-primary h-4 w-4 transition-colors" />
              </div>
              <p className="text-fg mt-2 font-mono text-2xl font-black tracking-tight">
                {stats.strikeRate}
              </p>
              <p className="text-fg-subtle mt-1 text-[11px] font-medium">Runs / 100b</p>
            </div>

            <div className="border-border-subtle bg-surface hover:border-primary/40 group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  Economy
                </span>
                <Activity className="text-primary/70 group-hover:text-primary h-4 w-4 transition-colors" />
              </div>
              <p className="text-fg mt-2 font-mono text-2xl font-black tracking-tight">
                {stats.economy}
              </p>
              <p className="text-fg-subtle mt-1 text-[11px] font-medium">Runs / over</p>
            </div>
          </div>
        )}

        {/* Performance Trends Chart */}
        {analytics.runsTrend && analytics.runsTrend.length > 0 && (
          <div className="border-border-subtle bg-surface rounded-2xl border p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-primary h-5 w-5" />
                <h2 className="text-fg text-base font-bold">Batting Form & Runs Trend</h2>
              </div>
              <span className="text-fg-muted text-xs font-medium">Last 10 Matches</span>
            </div>
            <SimpleBarChart
              data={analytics.runsTrend.map((m) => ({
                label: m.matchDate
                  ? new Date(m.matchDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '',
                value: m.runs,
              }))}
              height={220}
            />
          </div>
        )}

        {/* Recent Matches Telemetry */}
        <Card className="border-border-subtle bg-surface rounded-2xl border">
          <CardHeader
            title="Match Statistics"
            description="Recent performance summary and match telemetry"
          />
          <CardBody className="p-4 sm:p-5">
            {!analytics.recentMatches || analytics.recentMatches.length === 0 ? (
              <div className="py-8 text-center">
                <Target className="text-fg-muted mx-auto mb-2 h-8 w-8 opacity-40" />
                <p className="text-fg-muted text-sm">No match scorecard records found yet.</p>
              </div>
            ) : (
              <div className="divide-border-subtle divide-y">
                {analytics.recentMatches.map((match) => (
                  <Link
                    key={match.id}
                    to={`/matches/${match.id}`}
                    className="hover:bg-surface-muted/50 group flex flex-wrap items-center justify-between gap-3 py-3.5 transition-colors first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-fg group-hover:text-primary truncate text-sm font-bold transition-colors">
                          {match.matchName}
                        </p>
                        {match.result && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                              match.result === 'won'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : match.result === 'lost'
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {match.result}
                          </span>
                        )}
                      </div>
                      <p className="text-fg-muted mt-0.5 text-xs">
                        {new Date(match.matchDate).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        • vs {match.opponentName}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {match.batting && (
                        <span className="bg-primary/10 text-primary border-primary/20 rounded-lg border px-2.5 py-1 font-mono text-xs font-bold">
                          {match.batting.runs} runs ({match.batting.balls}b)
                        </span>
                      )}
                      {match.bowling && (
                        <span className="bg-surface-muted text-fg border-border-subtle rounded-lg border px-2.5 py-1 font-mono text-xs font-bold">
                          {match.bowling.wickets} / {match.bowling.runsConceded}
                        </span>
                      )}
                      <ChevronRight className="text-fg-muted group-hover:text-primary h-4 w-4 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  // Owner / Coach view
  if (ownerAnalyticsQuery.isPending) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
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
    <div className="space-y-6 pb-24 md:pb-8">
      <div className="md:hidden">
        <MobilePageHeader
          title="Academy Telemetry"
          subtitle="Stats, Records & Squad Leaders"
          showBack={false}
        />
      </div>

      <div className="hidden md:flex md:items-center md:justify-between">
        <div>
          <h1 className="text-fg flex items-center gap-2.5 text-2xl font-black tracking-tight">
            <Trophy className="text-primary h-6 w-6" />
            Academy Analytics & Stats
          </h1>
          <p className="text-fg-muted mt-1 text-sm font-medium">
            Academy-wide cricket metrics, squad leaderboards, and performance tracking.
          </p>
        </div>
      </div>

      {/* 4-Stat Strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <div className="border-border-subtle bg-surface hover:border-primary/40 group rounded-2xl border p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-fg-muted text-[10px] font-bold tracking-wider uppercase">
              Total Matches
            </span>
            <Target className="text-primary/70 group-hover:text-primary h-4 w-4 transition-colors" />
          </div>
          <p className="text-fg mt-2 font-mono text-2xl font-black">
            {ownerData.totalMatches ?? 0}
          </p>
          <p className="text-fg-subtle mt-1 text-xs">Fixtures recorded</p>
        </div>

        <div className="border-border-subtle bg-surface hover:border-primary/40 group rounded-2xl border p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-fg-muted text-[10px] font-bold tracking-wider uppercase">
              Active Players
            </span>
            <Users className="text-primary/70 group-hover:text-primary h-4 w-4 transition-colors" />
          </div>
          <p className="text-primary mt-2 font-mono text-2xl font-black">
            {ownerData.totalPlayers ?? 0}
          </p>
          <p className="text-fg-subtle mt-1 text-xs">Enrolled athletes</p>
        </div>

        <div className="border-border-subtle bg-surface hover:border-primary/40 group rounded-2xl border p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-fg-muted text-[10px] font-bold tracking-wider uppercase">
              Batches
            </span>
            <Layers className="text-primary/70 group-hover:text-primary h-4 w-4 transition-colors" />
          </div>
          <p className="text-fg mt-2 font-mono text-2xl font-black">
            {ownerData.totalBatches ?? 0}
          </p>
          <p className="text-fg-subtle mt-1 text-xs">Active squads</p>
        </div>

        <div className="border-border-subtle bg-surface hover:border-primary/40 group rounded-2xl border p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-fg-muted text-[10px] font-bold tracking-wider uppercase">
              Coaches
            </span>
            <UserCheck className="text-primary/70 group-hover:text-primary h-4 w-4 transition-colors" />
          </div>
          <p className="text-fg mt-2 font-mono text-2xl font-black">
            {ownerData.totalCoaches ?? 0}
          </p>
          <p className="text-fg-subtle mt-1 text-xs">Coaching staff</p>
        </div>
      </div>

      {/* Leaderboards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Run Scorers */}
        <div className="border-border-subtle bg-surface rounded-2xl border p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="text-primary h-5 w-5" />
              <h2 className="text-fg text-base font-bold">Top Run Scorers</h2>
            </div>
            <span className="text-fg-muted text-xs font-medium">Leading Batters</span>
          </div>

          {topBatters.length === 0 ? (
            <div className="py-8 text-center">
              <Zap className="text-fg-muted mx-auto mb-2 h-7 w-7 opacity-40" />
              <p className="text-fg-muted text-sm">No batting statistics recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topBatters.map((player, idx) => (
                <Link
                  key={player.id}
                  to={`/members/${player.id}`}
                  className="border-border-subtle hover:border-primary/40 bg-surface-muted/30 hover:bg-surface-muted group flex items-center justify-between rounded-xl border p-3 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${
                        idx === 0
                          ? 'bg-primary text-black'
                          : idx === 1
                            ? 'bg-white/20 text-white'
                            : idx === 2
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-surface-muted text-fg-muted'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-fg group-hover:text-primary text-sm font-bold transition-colors">
                        {player.name}
                      </p>
                      <p className="text-fg-muted text-xs">Avg: {player.average}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-primary font-mono text-base font-black">
                      {player.runs} <span className="text-fg-muted text-xs font-normal">runs</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top Wicket Takers */}
        <div className="border-border-subtle bg-surface rounded-2xl border p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="text-primary h-5 w-5" />
              <h2 className="text-fg text-base font-bold">Top Wicket Takers</h2>
            </div>
            <span className="text-fg-muted text-xs font-medium">Leading Bowlers</span>
          </div>

          {topBowlers.length === 0 ? (
            <div className="py-8 text-center">
              <Shield className="text-fg-muted mx-auto mb-2 h-7 w-7 opacity-40" />
              <p className="text-fg-muted text-sm">No bowling statistics recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topBowlers.map((player, idx) => (
                <Link
                  key={player.id}
                  to={`/members/${player.id}`}
                  className="border-border-subtle hover:border-primary/40 bg-surface-muted/30 hover:bg-surface-muted group flex items-center justify-between rounded-xl border p-3 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${
                        idx === 0
                          ? 'bg-primary text-black'
                          : idx === 1
                            ? 'bg-white/20 text-white'
                            : idx === 2
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-surface-muted text-fg-muted'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-fg group-hover:text-primary text-sm font-bold transition-colors">
                        {player.name}
                      </p>
                      <p className="text-fg-muted text-xs">Econ: {player.economy}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-primary font-mono text-base font-black">
                      {player.wickets}{' '}
                      <span className="text-fg-muted text-xs font-normal">wkts</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
