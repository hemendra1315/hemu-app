import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { MobilePageHeader } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { useLinkedChildren } from '@/features/parents/hooks/useParents';
import {
  usePlayerDashboardAnalytics,
  useOwnerDashboardAnalytics,
} from '@/features/dashboard/hooks/useDashboardAnalytics';
import { useAcademyRecords } from '@/features/matches/hooks/useMatches';
import type { AcademyRecord } from '@/features/matches/api/matchesTypes';
// Deliberately the players-feature version (single player, scoped by
// academyId + playerId) -- there's a same-named `usePlayerMilestones` in
// the matches feature that's academy-wide instead. Don't swap this import.
import { usePlayerMilestones } from '@/features/players/hooks/usePlayers';
import type { PlayerMilestone } from '@/features/players/api/playersTypes';
import { SimpleBarChart } from '@/components/charts/SimpleBarChart';
import { useTestModeStore } from '@/stores';
import { supabase } from '@/lib/supabase/client';
import { isUUID } from '@/lib/validators';
import { formatDate } from '@/lib/utils/date';
import {
  MILESTONE_LABELS,
  RECORD_LABELS,
  type MilestoneType,
  type RecordType,
} from '@/types/enums';
import type { UUID } from '@/types';

/** Badges for career milestones this player has actually hit -- the data's
 * been tracked (`player_milestones`) since the match-wizard's milestone
 * detection was built, but nothing ever surfaced it to the player/parent
 * who'd actually want to see it. Read-only: milestones are auto-detected
 * server-side (`detect_player_milestones`), never entered by hand. */
function MilestonesCard({ milestones }: { milestones: PlayerMilestone[] }) {
  return (
    <Card>
      <CardHeader title="Milestones" description="Career milestones achieved." />
      <CardBody>
        {milestones.length === 0 ? (
          <p className="text-fg-muted">No milestones yet — keep playing!</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {milestones.map((m) => (
              <Badge key={m.id} tone="brand" className="text-xs font-semibold">
                {MILESTONE_LABELS[m.milestoneType as MilestoneType] ??
                  m.milestoneType.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function formatRecordValue(record: AcademyRecord): string {
  if (record.valueText) return record.valueText;
  if (record.valueNumeric != null) return String(record.valueNumeric);
  return '-';
}

/** Academy-wide records (highest score, biggest win, etc.) -- tracked in
 * `academy_records` and recomputed by `refresh_academy_records`, but never
 * shown to anyone before this. `highlightPlayerId` puts a "You" badge on
 * any record the viewer (or the parent's selected child) actually holds. */
function AcademyRecordsCard({
  records,
  highlightPlayerId,
}: {
  records: AcademyRecord[];
  highlightPlayerId?: UUID | null;
}) {
  return (
    <Card>
      <CardHeader title="Team Records" description="Academy records, all-time." />
      <CardBody>
        {records.length === 0 ? (
          <p className="text-fg-muted">No records yet.</p>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div
                key={r.id}
                className="border-border-subtle flex items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="min-w-0">
                  <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                    {RECORD_LABELS[r.recordType as RecordType] ?? r.recordType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-fg truncate text-sm font-semibold">
                    {r.player?.fullName ?? r.player?.email ?? 'Team'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-fg text-base font-bold">{formatRecordValue(r)}</span>
                  {highlightPlayerId && r.playerId === highlightPlayerId && (
                    <Badge tone="success">You</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** Everything a single player's stats look like -- shared by the player's
 * own view and the parent's view of a selected child, so the two can never
 * silently drift apart. */
function PlayerStatsView({
  academyId,
  playerId,
  records,
}: {
  academyId: UUID;
  playerId: UUID | null;
  records: AcademyRecord[];
}) {
  const analyticsQuery = usePlayerDashboardAnalytics(academyId, playerId);
  const milestonesQuery = usePlayerMilestones(academyId, playerId);

  if (analyticsQuery.isPending) {
    return <p className="text-fg-muted p-4">Loading stats…</p>;
  }
  if (analyticsQuery.isError || !analyticsQuery.data) {
    return (
      <ErrorState error={analyticsQuery.error} onRetry={() => void analyticsQuery.refetch()} />
    );
  }

  const analytics = analyticsQuery.data;
  const stats = analytics.stats;

  return (
    <div className="space-y-6">
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

      <MilestonesCard milestones={milestonesQuery.data ?? []} />

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

      <AcademyRecordsCard records={records} highlightPlayerId={playerId} />
    </div>
  );
}

export default function StatsPage() {
  const { academyId, membership } = useActiveAcademy();
  const testModeRole = useTestModeStore((s) => s.activeRole);

  const role = testModeRole
    ? testModeRole === 'student'
      ? 'player'
      : testModeRole
    : (membership?.role ?? 'player');

  const isPlayer = role === 'player';
  const isParent = role === 'parent';
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

  // Parents don't have a single "own" player -- they pick from whichever
  // children are linked to their account, same pattern as ParentDashboardPage.
  const linkedChildrenQuery = useLinkedChildren(isParent ? (academyId ?? undefined) : undefined);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const children = linkedChildrenQuery.data ?? [];
  const activeChild = children.find((c) => c.player.id === selectedChildId) ?? children[0];
  const childPlayerId = activeChild?.player.id ?? null;

  const ownerAnalyticsQuery = useOwnerDashboardAnalytics(isOwnerOrCoach ? academyId : null);
  const recordsQuery = useAcademyRecords(academyId);

  if (!academyId) return null;

  if (isPlayer) {
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
        <PlayerStatsView
          academyId={academyId}
          playerId={playerId}
          records={recordsQuery.data ?? []}
        />
      </div>
    );
  }

  // Parents previously fell through to the owner/coach branch below and saw
  // academy-wide stats -- wrong data, and the owner-only query stayed
  // disabled for them so the page just spun on "Loading academy
  // statistics..." forever. Parents now get their linked child's own stats,
  // same as a player would see for themselves.
  if (isParent) {
    return (
      <div className="space-y-6 pb-24 md:pb-6">
        <div className="md:hidden">
          <MobilePageHeader
            title="Stats & Performance"
            subtitle="Your child's cricket statistics"
          />
        </div>
        <div className="hidden md:block">
          <h1 className="text-fg text-2xl font-bold tracking-tight">Stats & Performance</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Your child's batting, bowling, and match stats.
          </p>
        </div>

        {linkedChildrenQuery.isPending ? (
          <p className="text-fg-muted p-4">Loading…</p>
        ) : linkedChildrenQuery.isError ? (
          <ErrorState
            error={linkedChildrenQuery.error}
            onRetry={() => void linkedChildrenQuery.refetch()}
          />
        ) : children.length === 0 ? (
          <Card>
            <CardBody className="p-6 text-center">
              <p className="text-fg-muted">
                No child linked yet. Link a child from your dashboard to see their stats here.
              </p>
            </CardBody>
          </Card>
        ) : (
          <>
            {children.length > 1 && (
              <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                {children.map((child) => (
                  <button
                    key={child.player.id}
                    type="button"
                    onClick={() => setSelectedChildId(child.player.id)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      activeChild?.player.id === child.player.id
                        ? 'bg-primary text-primary-fg'
                        : 'bg-surface hover:bg-surface-muted border'
                    }`}
                  >
                    {child.player.fullName?.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}
            <PlayerStatsView
              academyId={academyId}
              playerId={childPlayerId}
              records={recordsQuery.data ?? []}
            />
          </>
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

      <AcademyRecordsCard records={recordsQuery.data ?? []} />
    </div>
  );
}
