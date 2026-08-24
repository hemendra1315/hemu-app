import { Link, useNavigate } from 'react-router-dom';
import { Layers, ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';

import { Card, CardBody, CardHeader, Button, Badge } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { formatDate, dayjs } from '@/lib/utils/date';
import { useActiveAcademy } from '@/features/academies';
import { useAuth } from '@/features/auth';
import { useCoachDashboardAnalytics } from '../hooks/useDashboardAnalytics';
import { ActivityFeed } from '../components/ActivityFeed';
import { SuperAdminAcademyActions } from '@/features/admin';
import type { ActivityItem } from '../components/ActivityFeed';

export default function CoachDashboardPage() {
  const navigate = useNavigate();
  const { academyId } = useActiveAcademy();
  const { profile } = useAuth();

  const analyticsQuery = useCoachDashboardAnalytics(academyId, profile?.id ?? null);
  const analytics = analyticsQuery.data;

  if (analyticsQuery.isPending) {
    return <p className="text-fg-muted py-8 text-center text-sm">Loading dashboard...</p>;
  }

  if (analyticsQuery.isError || !analytics) {
    return (
      <ErrorState error={analyticsQuery.error} onRetry={() => void analyticsQuery.refetch()} />
    );
  }

  const todaySessions = analytics.todaySessions ?? [];
  const topBatches = analytics.assignedBatches?.slice(0, 3) ?? [];

  const activities: ActivityItem[] =
    analytics.recentMatches?.slice(0, 3).map((m) => ({
      id: m.id,
      type: 'match_completed',
      message: `Match record: ${m.matchName}${m.opponentName ? ` vs ${m.opponentName}` : ''}`,
      timestamp: formatDate(m.matchDate),
      href: `/matches/${m.id}`,
    })) ?? [];

  const totalAssignedPlayers =
    analytics.assignedBatches?.reduce((acc, b) => acc + (b.playerCount || 0), 0) ?? 0;

  const hasFixtures = todaySessions.length > 0;
  const todayStr = dayjs().format('ddd, DD MMM YYYY').toUpperCase();

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* 1. Floodlit Turf + Scorebook App Bar */}
      <div className="border-border-subtle/40 flex flex-col gap-1 border-b pb-4">
        <h1 className="font-heading text-fg text-2xl font-extrabold tracking-tight uppercase md:text-3xl">
          Coach Dashboard
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold tracking-tight transition-colors ${
              hasFixtures
                ? 'bg-saffron-pale text-saffron border-saffron/20'
                : 'bg-surface-muted/80 text-fg-muted border-border-subtle/50'
            }`}
          >
            {hasFixtures && (
              <span className="bg-saffron h-1.5 w-1.5 animate-pulse rounded-full" aria-hidden />
            )}
            {todayStr}
          </span>
          {hasFixtures && (
            <span className="bg-saffron-pale text-saffron border-saffron/20 inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold tracking-tight uppercase">
              Fixture Slated
            </span>
          )}
        </div>
      </div>

      <SuperAdminAcademyActions />

      {/* 2. Today's Overview (Grid of stat cards) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
          <span className="text-fg-muted font-heading truncate text-xs font-bold tracking-wider uppercase">
            Sessions Today
          </span>
          <div className="mt-2.5">
            <p className="text-fg font-mono text-2xl font-bold">{todaySessions.length}</p>
            <p className="text-fg-muted font-heading mt-0.5 truncate text-[11px] font-medium">
              {todaySessions.reduce((acc, s) => acc + (s.playerCount || 0), 0)} expected
            </p>
          </div>
        </div>

        <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
          <span className="text-fg-muted font-heading truncate text-xs font-bold tracking-wider uppercase">
            Coached Players
          </span>
          <div className="mt-2.5">
            <p className="text-fg font-mono text-2xl font-bold">{totalAssignedPlayers}</p>
            <p className="text-fg-muted font-heading mt-0.5 truncate text-[11px] font-medium">
              Squad Roster
            </p>
          </div>
        </div>

        <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
          <span className="text-fg-muted font-heading truncate text-xs font-bold tracking-wider uppercase">
            My Batches
          </span>
          <div className="mt-2.5">
            <p className="text-fg font-mono text-2xl font-bold">
              {analytics.assignedBatches?.length ?? 0}
            </p>
            <p className="text-fg-muted font-heading mt-0.5 truncate text-[11px] font-medium">
              Active Squads
            </p>
          </div>
        </div>
      </div>

      {/* 3. Actions */}
      <div className="flex gap-2.5 sm:gap-3">
        <Button
          variant="primary"
          className="bg-primary text-primary-fg min-h-[44px] flex-1 rounded-[10px] font-semibold hover:opacity-90"
          onClick={() => navigate('/sessions')}
        >
          Take Attendance
        </Button>
        <Button
          variant="secondary"
          className="bg-surface text-fg border-border-subtle hover:bg-surface-muted/50 min-h-[44px] flex-1 rounded-[10px] border font-semibold"
          onClick={() => navigate('/sessions')}
        >
          View Sessions
        </Button>
      </div>

      {/* 4. Today's Sessions List (Scorebook-Ruled) */}
      <Card className="border-border-subtle bg-surface min-w-0 rounded-xl border shadow-2xs">
        <CardHeader
          title={
            <span className="font-heading text-fg-muted text-sm font-bold tracking-wider uppercase">
              Today's Schedule
            </span>
          }
          action={
            <Link
              to="/sessions"
              className="text-primary flex shrink-0 items-center gap-1 font-sans text-xs font-bold hover:underline"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <CardBody className="min-w-0 px-4 py-2 pt-0">
          {todaySessions.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-fg-muted font-sans text-xs font-medium">
                No sessions scheduled for today.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/sessions/new')}
                className="text-primary mt-2 font-sans text-xs"
              >
                Schedule Session ?
              </Button>
            </div>
          ) : (
            <div className="divide-border-subtle/60 min-w-0 divide-y">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="flex min-h-[44px] items-center justify-between gap-3 py-3.5"
                >
                  {/* Session Time (IBM Plex Mono) */}
                  <div className="text-fg w-24 shrink-0 font-mono text-xs font-bold">
                    {session.startAt || 'TBD'}
                    {session.endAt && (
                      <span className="text-fg-muted font-normal"> - {session.endAt}</span>
                    )}
                  </div>

                  {/* Batch & Title (IBM Plex Sans) */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-fg truncate font-sans text-sm font-bold">
                        {session.batchName || 'No Batch'}
                      </p>
                      {session.attendanceMarked ? (
                        <Badge
                          tone="success"
                          className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold tracking-tight uppercase"
                        >
                          Marked
                        </Badge>
                      ) : (
                        <Badge
                          tone="neutral"
                          className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold tracking-tight uppercase"
                        >
                          Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-fg-muted mt-0.5 truncate font-sans text-xs">
                      {session.title} &middot; {session.playerCount || 0} players expected
                    </p>
                  </div>

                  {/* CTA Button */}
                  <Button
                    variant={session.attendanceMarked ? 'secondary' : 'primary'}
                    onClick={() => navigate(`/sessions/${session.id}/attendance`)}
                    className="h-11 min-h-[44px] shrink-0 px-3.5 text-xs font-bold"
                  >
                    {session.attendanceMarked ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> View
                      </span>
                    ) : (
                      'Mark'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 5. My Batches (Compact List Rows) */}
      <Card className="border-border-subtle bg-surface min-w-0 shadow-2xs">
        <CardHeader
          title={
            <div className="flex min-w-0 items-center gap-2">
              <Layers className="text-warning h-4 w-4 shrink-0" />
              <span className="truncate">My Batches</span>
            </div>
          }
          action={
            <Link
              to="/batches"
              className="text-primary flex shrink-0 items-center gap-1 text-xs font-bold hover:underline"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <CardBody className="min-w-0 p-3 pt-0">
          {topBatches.length === 0 ? (
            <p className="text-fg-muted py-6 text-center text-xs">No batches assigned yet.</p>
          ) : (
            <div className="min-w-0 space-y-2">
              {topBatches.map((batch) => (
                <Link
                  key={batch.id}
                  to={`/batches/${batch.id}`}
                  className="border-border-subtle hover:border-primary/50 bg-surface flex min-h-[52px] min-w-0 items-center justify-between gap-3 rounded-xl border p-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="text-fg truncate text-sm font-bold">{batch.name}</p>
                      <Badge tone="brand" className="shrink-0 px-1.5 py-0.5 text-[10px]">
                        {batch.ageGroup}
                      </Badge>
                    </div>
                    <p className="text-fg-muted mt-0.5 truncate text-xs">
                      {batch.trainingDays || 'Flexible schedule'} � {batch.trainingTime || 'TBD'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-fg-muted text-xs font-semibold">
                      {batch.playerCount} players
                    </span>
                    <ChevronRight className="text-fg-muted/60 h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 6. Recent Activity (Latest 2-3 items) */}
      <ActivityFeed title="Recent Activity" activities={activities} />
    </div>
  );
}
