import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  User,
  AlertCircle,
  CalendarCheck,
  Clock,
  Users,
} from 'lucide-react';

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
    return (
      <div className="flex min-h-[300px] items-center justify-center p-6 text-center">
        <p className="text-fg-muted text-sm font-medium">Loading coach dashboard...</p>
      </div>
    );
  }

  if (analyticsQuery.isError || !analytics) {
    return (
      <ErrorState error={analyticsQuery.error} onRetry={() => void analyticsQuery.refetch()} />
    );
  }

  const todaySessions = analytics.todaySessions ?? [];
  const topBatches = analytics.assignedBatches?.slice(0, 3) ?? [];
  const playersNeedingAttention = analytics.playersNeedingAttention ?? [];

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
      {/* 1. Header with Coach Profile Link */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-fg truncate text-xl font-extrabold tracking-tight md:text-2xl">
              Coach Dashboard
            </h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold tracking-tight ${
                hasFixtures
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border-subtle/60 bg-surface-muted/60 text-fg-muted'
              }`}
            >
              {hasFixtures && (
                <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" aria-hidden />
              )}
              {todayStr}
            </span>
            {hasFixtures && (
              <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase">
                Sessions Slated
              </span>
            )}
          </div>
        </div>

        <Link
          to="/coaches/me"
          className="hover:bg-surface-muted/80 border-border-subtle bg-surface text-fg inline-flex h-10 min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-bold shadow-2xs transition-all active:scale-[0.98]"
        >
          <User className="text-primary h-4 w-4" />
          <span>My Coach Profile</span>
        </Link>
      </div>

      <SuperAdminAcademyActions />

      {/* 2. Today's Overview (KPIs) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
          <span className="text-fg-muted truncate text-[11px] font-bold tracking-wider uppercase">
            Sessions Today
          </span>
          <div className="mt-2">
            <p className="text-fg font-mono text-2xl font-extrabold tracking-tight">
              {todaySessions.length}
            </p>
            <p className="text-fg-muted mt-0.5 truncate text-[11px] font-medium">
              {todaySessions.reduce((acc, s) => acc + (s.playerCount || 0), 0)} expected
            </p>
          </div>
        </div>

        <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
          <span className="text-fg-muted truncate text-[11px] font-bold tracking-wider uppercase">
            Coached Players
          </span>
          <div className="mt-2">
            <p className="text-fg font-mono text-2xl font-extrabold tracking-tight">
              {totalAssignedPlayers}
            </p>
            <p className="text-fg-muted mt-0.5 truncate text-[11px] font-medium">Squad Roster</p>
          </div>
        </div>

        <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
          <span className="text-fg-muted truncate text-[11px] font-bold tracking-wider uppercase">
            My Batches
          </span>
          <div className="mt-2">
            <p className="text-fg font-mono text-2xl font-extrabold tracking-tight">
              {analytics.assignedBatches?.length ?? 0}
            </p>
            <p className="text-fg-muted mt-0.5 truncate text-[11px] font-medium">Active Squads</p>
          </div>
        </div>
      </div>

      {/* 3. Primary Actions */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <Button
          variant="primary"
          className="h-11 min-h-[44px] justify-center gap-2 rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-[0.98]"
          onClick={() => navigate('/sessions')}
        >
          <CalendarCheck className="h-4 w-4" />
          <span>Take Attendance</span>
        </Button>
        <Button
          variant="secondary"
          className="hover:bg-surface-muted/80 border-border-subtle bg-surface h-11 min-h-[44px] justify-center gap-2 rounded-xl border text-xs font-bold shadow-2xs transition-all active:scale-[0.98]"
          onClick={() => navigate('/sessions')}
        >
          <Clock className="h-4 w-4" />
          <span>View Sessions</span>
        </Button>
      </div>

      {/* 4. Today's Schedule */}
      <Card className="border-border-subtle bg-surface shadow-2xs">
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <Clock className="text-primary h-4 w-4 shrink-0" />
              <span>Today's Schedule</span>
            </div>
          }
          action={
            <Link
              to="/sessions"
              className="text-primary flex shrink-0 items-center gap-1 text-xs font-bold hover:underline"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
          {todaySessions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-fg-muted text-xs font-medium">No sessions scheduled for today.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/sessions/new')}
                className="text-primary mt-2 text-xs font-bold"
              >
                Schedule Session &rarr;
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="border-border-subtle hover:border-primary/40 bg-surface flex min-h-[52px] flex-col gap-3 rounded-xl border p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="text-fg truncate text-sm font-bold">
                        {session.batchName || 'No Batch'}
                      </p>
                      {session.attendanceMarked ? (
                        <Badge tone="success" className="shrink-0 text-[10px] font-bold uppercase">
                          Marked
                        </Badge>
                      ) : (
                        <Badge tone="neutral" className="shrink-0 text-[10px] font-bold uppercase">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-fg-muted truncate text-xs">
                      {session.title} · {session.playerCount || 0} players expected
                    </p>
                    <div className="text-fg-muted flex items-center gap-1 font-mono text-xs">
                      <Clock className="h-3 w-3" />
                      <span>
                        {session.startAt || 'TBD'}
                        {session.endAt ? ` - ${session.endAt}` : ''}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant={session.attendanceMarked ? 'secondary' : 'primary'}
                    onClick={() => navigate(`/sessions/${session.id}/attendance`)}
                    className="h-10 min-h-[40px] shrink-0 px-4 text-xs font-bold sm:w-auto"
                  >
                    {session.attendanceMarked ? (
                      <>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        View Attendance
                      </>
                    ) : (
                      'Mark Attendance'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 5. Players Needing Attention */}
      {playersNeedingAttention.length > 0 && (
        <Card className="border-border-subtle bg-surface shadow-2xs">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                <span>Players Needing Attention</span>
              </div>
            }
          />
          <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="space-y-2">
              {playersNeedingAttention.map((player) => (
                <Link
                  key={player.id}
                  to={`/members/${player.id}`}
                  className="border-border-subtle hover:border-primary/40 bg-surface flex min-h-[50px] items-center justify-between gap-3 rounded-xl border p-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-fg truncate text-sm font-bold">{player.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {player.issues.map((issue, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500"
                        >
                          {issue}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-fg-muted font-mono text-xs font-semibold">
                      {player.attendanceRate}% att.
                    </span>
                    <ChevronRight className="text-fg-muted/60 h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* 6. My Batches (Top 3) */}
      <Card className="border-border-subtle bg-surface shadow-2xs">
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <Layers className="text-primary h-4 w-4 shrink-0" />
              <span>My Batches</span>
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
        <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
          {topBatches.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-fg-muted text-xs font-medium">No batches assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topBatches.map((batch) => (
                <Link
                  key={batch.id}
                  to={`/batches/${batch.id}`}
                  className="border-border-subtle hover:border-primary/40 bg-surface flex min-h-[52px] items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-fg truncate text-sm font-bold">{batch.name}</p>
                      {batch.ageGroup && (
                        <Badge tone="brand" className="shrink-0 px-1.5 py-0.5 text-[10px]">
                          {batch.ageGroup}
                        </Badge>
                      )}
                    </div>
                    <p className="text-fg-muted mt-0.5 truncate text-xs font-medium">
                      {batch.trainingDays || 'Flexible schedule'} · {batch.trainingTime || 'TBD'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-fg-muted inline-flex items-center gap-1 text-xs font-semibold">
                      <Users className="h-3.5 w-3.5" />
                      {batch.playerCount}
                    </span>
                    <ChevronRight className="text-fg-muted/60 h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 7. Recent Activity (Matches) */}
      <ActivityFeed title="Recent Activity" activities={activities} />
    </div>
  );
}
