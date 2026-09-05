import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Button, Card, CardBody, CardHeader, Badge, Avatar } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { SuperAdminAcademyActions } from '@/features/admin';
import { useSetMyDrillAssignmentStatus } from '@/features/drills/hooks/useDrills';
import { usePlayerDashboardAnalytics } from '../hooks/useDashboardAnalytics';
import { SimpleBarChart, SimpleLineChart } from '@/components/charts/SimpleBarChart';
import { SessionRow } from '../components/SessionRow';
import { useTestModeStore } from '@/stores';
import { supabase } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils/date';
import { isUUID } from '@/lib/validators';

/** Turns the `YYYY-MM` keys produced by the attendance summary into "Mar 26". */
function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return month;
  return new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, {
    month: 'short',
    year: '2-digit',
  });
}

export default function PlayerDashboardPage() {
  const { academyId, membership } = useActiveAcademy();
  const testModeRole = useTestModeStore((s) => s.activeRole);

  const isPlayer = membership?.role === 'player' || testModeRole === 'student';

  // Query an active player ID if in Test Mode as student and membership is not a player
  const activePlayerQuery = useQuery({
    queryKey: ['active-academy-player', academyId],
    enabled: Boolean(academyId) && testModeRole === 'student' && membership?.role !== 'player',
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

  const analyticsQuery = usePlayerDashboardAnalytics(academyId, isPlayer ? playerId : null);
  const setDrillStatus = useSetMyDrillAssignmentStatus(
    (academyId ?? '') as string,
    (playerId ?? '') as string,
  );

  if (!isPlayer) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">My dashboard</h1>
          <p className="text-fg-muted text-sm">{membership?.academyName ?? 'Academy'}</p>
        </div>
        <EmptyState
          title="Player Dashboard Reserved for Players"
          description="You are currently signed in as an Academy Owner or Coach. Switch to a registered player account to access player statistics and personal training performance."
        />
      </div>
    );
  }

  if (analyticsQuery.isPending) {
    return <p className="text-fg-muted">Loading dashboard…</p>;
  }

  const analytics = analyticsQuery.data;

  if (analyticsQuery.isError || !analytics) {
    return (
      <ErrorState error={analyticsQuery.error} onRetry={() => void analyticsQuery.refetch()} />
    );
  }

  const stats = analytics.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar
            name={membership?.academyName}
            src={membership?.logoUrl}
            shape="rounded"
            className="h-10 w-10 shrink-0 text-base sm:h-12 sm:w-12 sm:text-lg"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-fg truncate text-2xl font-bold tracking-tight md:text-3xl">
              My Cricket Dashboard
            </h1>
            <p className="text-fg-muted truncate text-xs font-medium md:text-sm">
              {membership?.academyName ?? 'Academy'}
            </p>
          </div>
        </div>
      </div>

      <SuperAdminAcademyActions />

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-7">
          <Card>
            <CardBody className="p-3.5 md:p-4">
              <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                Matches
              </p>
              <p className="text-fg mt-1 text-xl font-bold tracking-tight md:text-2xl">
                {stats.matchesPlayed}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-3.5 md:p-4">
              <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">Runs</p>
              <p className="text-fg mt-1 text-xl font-bold tracking-tight md:text-2xl">
                {stats.battingRuns}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-3.5 md:p-4">
              <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                Wickets
              </p>
              <p className="text-fg mt-1 text-xl font-bold tracking-tight md:text-2xl">
                {stats.bowlingWickets}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-3.5 md:p-4">
              <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                Batting Avg
              </p>
              <p className="text-fg mt-1 text-xl font-bold tracking-tight md:text-2xl">
                {stats.battingAverage}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-3.5 md:p-4">
              <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                Strike Rate
              </p>
              <p className="text-fg mt-1 text-xl font-bold tracking-tight md:text-2xl">
                {stats.strikeRate}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-3.5 md:p-4">
              <p className="text-fg-muted text-[11px] font-bold tracking-wider uppercase">
                Economy
              </p>
              <p className="text-fg mt-1 text-xl font-bold tracking-tight md:text-2xl">
                {stats.economy}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-3">
              <p className="text-fg-muted text-xs tracking-wide uppercase">Attendance %</p>
              <p className="text-fg text-lg font-semibold">{stats?.attendancePercentage ?? 0}%</p>
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader title="Upcoming Training" description="Your next scheduled sessions" />
        <CardBody>
          {analytics.upcomingSessions?.length === 0 ? (
            <p className="text-fg-muted">No upcoming sessions.</p>
          ) : (
            <div className="space-y-3">
              {analytics.upcomingSessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Recent Form" description="Last 5 matches" />
        <CardBody>
          {analytics.recentMatches?.length === 0 ? (
            <p className="text-fg-muted">No matches played yet.</p>
          ) : (
            <div className="space-y-3">
              {analytics.recentMatches.map((match) => (
                <Link
                  key={match.id}
                  to={`/matches/${match.id}`}
                  className="border-border-subtle hover:border-primary/40 flex flex-wrap items-center justify-between rounded-xl border p-3 transition"
                >
                  <div>
                    <p className="text-fg font-medium">{match.matchName}</p>
                    <p className="text-fg-muted text-sm">
                      {formatDate(match.matchDate)} • {match.opponentName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {match.batting && (
                      <span className="bg-surface-muted rounded-full px-2 py-1 text-xs">
                        {match.batting.runs} ({match.batting.balls})
                      </span>
                    )}
                    {match.bowling && (
                      <span className="bg-surface-muted rounded-full px-2 py-1 text-xs">
                        {match.bowling.wickets}/{match.bowling.runsConceded}
                      </span>
                    )}
                    {match.awards?.playerOfMatch && <Badge tone="success">POM</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Assigned Drills" description="Pending and completed" />
          <CardBody>
            {analytics.pendingAssignments?.length === 0 &&
            analytics.completedAssignments?.length === 0 ? (
              <p className="text-fg-muted">No drills assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {analytics.pendingAssignments?.length > 0 && (
                  <div>
                    <p className="text-fg-muted mb-2 text-sm font-medium">Pending</p>
                    {analytics.pendingAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="border-border-subtle flex items-start justify-between gap-3 rounded-xl border p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-fg font-medium">{assignment.drill.name}</p>
                          <p className="text-fg-muted text-sm">{assignment.drill.category}</p>
                          {assignment.dueDate && (
                            <p className="text-fg-muted text-xs">
                              Due: {formatDate(assignment.dueDate)}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="shrink-0"
                          isLoading={
                            setDrillStatus.isPending &&
                            setDrillStatus.variables?.assignmentId === assignment.id
                          }
                          onClick={() =>
                            setDrillStatus.mutate({
                              assignmentId: assignment.id,
                              status: 'completed',
                            })
                          }
                        >
                          Mark done
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {analytics.completedAssignments?.length > 0 && (
                  <div>
                    <p className="text-fg-muted mb-2 text-sm font-medium">Completed</p>
                    {analytics.completedAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="border-border-subtle rounded-xl border p-3"
                      >
                        <p className="text-fg font-medium">{assignment.drill.name}</p>
                        <p className="text-fg-muted text-sm">{assignment.drill.category}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Awards" description="Recent achievements" />
          <CardBody>
            {analytics.recentAwards?.length === 0 ? (
              <p className="text-fg-muted">No awards yet.</p>
            ) : (
              <div className="space-y-3">
                {analytics.recentAwards.map((award) => (
                  <Link
                    key={award.id}
                    to={`/matches/${award.matchId}`}
                    className="border-border-subtle hover:border-primary/40 flex items-center justify-between rounded-xl border p-3 transition"
                  >
                    <div>
                      <p className="text-fg font-medium">{award.matchName}</p>
                      <p className="text-fg-muted text-sm">
                        {award.matchDate ? formatDate(award.matchDate) : ''}
                      </p>
                    </div>
                    <Badge tone="success">Award</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {analytics.careerHighlights?.length > 0 && (
        <Card>
          <CardHeader title="Career Highlights" />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {analytics.careerHighlights.map((highlight, index: number) => (
                <Badge key={index} tone="brand">
                  {highlight.label}
                </Badge>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {analytics.runsTrend?.length > 0 && (
        <Card>
          <CardHeader title="Performance Trends" />
          <CardBody>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="text-fg-muted mb-2 text-sm font-medium">Runs Trend</h4>
                <SimpleBarChart
                  data={analytics.runsTrend.map((m) => ({
                    label: m.matchDate ? formatDate(m.matchDate) : '',
                    value: m.runs,
                  }))}
                  height={200}
                />
              </div>
              {/* Optional-chained: the query cache is persisted to IndexedDB for
                  24h, so a returning user can rehydrate a payload saved before
                  `attendanceTrend` existed. */}
              {analytics.attendanceTrend?.length ? (
                <div>
                  <h4 className="text-fg-muted mb-2 text-sm font-medium">Attendance Trend</h4>
                  <SimpleLineChart
                    data={analytics.attendanceTrend.map((m) => ({
                      label: formatMonthLabel(m.month),
                      value: m.percentage,
                    }))}
                    height={200}
                  />
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
