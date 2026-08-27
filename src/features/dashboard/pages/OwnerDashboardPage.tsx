import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Layers,
  CalendarCheck,
  CalendarDays,
  Trophy,
  ArrowRight,
  Plus,
  UserPlus,
  Clock,
  CheckCircle2,
} from 'lucide-react';

import { Avatar, Card, CardBody, CardHeader, Button, Badge } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { useOwnerDashboardAnalytics } from '../hooks/useDashboardAnalytics';
import { KpiCard } from '../components/KpiCard';
import { ActivityFeed } from '../components/ActivityFeed';
import { JoinCodeCard } from '@/features/academies';
import { SuperAdminAcademyActions } from '@/features/admin';
import type { ActivityItem } from '../components/ActivityFeed';
import { useCan } from '@/lib/rbac';
import { formatTime } from '@/lib/utils/date';

export default function OwnerDashboardPage() {
  const navigate = useNavigate();
  const { academyId, membership } = useActiveAcademy();
  const analyticsQuery = useOwnerDashboardAnalytics(academyId);

  const canManagePlayers = useCan('players:manage');
  const canManageSessions = useCan('sessions:manage');
  const canManageMatches = useCan('matches:manage');

  const analytics = analyticsQuery.data;

  if (analyticsQuery.isPending) {
    return <p className="text-fg-muted py-8 text-center text-sm">Loading dashboard...</p>;
  }

  if (analyticsQuery.isError || !analytics) {
    return (
      <ErrorState error={analyticsQuery.error} onRetry={() => void analyticsQuery.refetch()} />
    );
  }

  const activities: ActivityItem[] =
    analytics.activities?.map((a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      timestamp: a.timestamp,
    })) ?? [];

  const todaySessions = analytics.todaySessions ?? [];

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* 1. Header with Academy Branding */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar
            name={membership?.academyName}
            src={membership?.logoUrl}
            shape="rounded"
            className="h-10 w-10 shrink-0 text-base sm:h-12 sm:w-12 sm:text-lg"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-fg truncate text-xl font-bold tracking-tight md:text-2xl">
              {membership?.academyName ?? 'Academy Dashboard'}
            </h1>
            <p className="text-fg-muted truncate text-xs font-medium">
              {membership?.city ? `${membership.city} • ` : ''}Academy Operations & Performance
            </p>
          </div>
        </div>
      </div>

      <SuperAdminAcademyActions />

      {/* 2. Today's Overview (KPIs) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <KpiCard
          title="Today's Sessions"
          value={todaySessions.length}
          icon={<CalendarDays className="text-primary h-4 w-4" />}
        />
        <KpiCard
          title="Players Expected"
          value={todaySessions.reduce((acc, s) => acc + (s.playerCount || 0), 0)}
          icon={<Users className="text-info h-4 w-4" />}
        />
        <KpiCard
          title="Active Batches"
          value={analytics.totalBatches}
          icon={<Layers className="text-warning h-4 w-4" />}
        />
        <KpiCard
          title="Total Players"
          value={analytics.totalPlayers}
          icon={<UserCheck className="text-success h-4 w-4" />}
        />
      </div>

      {/* 3. Quick Actions */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {canManagePlayers ? (
          <Button
            variant="secondary"
            className="hover:bg-surface-muted h-auto flex-col gap-2 p-3 text-xs font-semibold sm:p-4"
            onClick={() => navigate('/members')}
          >
            <div className="bg-primary/10 rounded-full p-2">
              <UserPlus className="text-primary h-5 w-5" />
            </div>
            Add Player
          </Button>
        ) : null}
        {canManageSessions ? (
          <Button
            variant="secondary"
            className="hover:bg-surface-muted h-auto flex-col gap-2 p-3 text-xs font-semibold sm:p-4"
            onClick={() => navigate('/sessions/new')}
          >
            <div className="bg-info/10 rounded-full p-2">
              <Plus className="text-info h-5 w-5" />
            </div>
            Create Session
          </Button>
        ) : null}
        <Button
          variant="secondary"
          className="hover:bg-surface-muted h-auto flex-col gap-2 p-3 text-xs font-semibold sm:p-4"
          onClick={() => navigate('/sessions')}
        >
          <div className="bg-success/10 rounded-full p-2">
            <CalendarCheck className="text-success h-5 w-5" />
          </div>
          Mark Attendance
        </Button>
        {canManageMatches ? (
          <Button
            variant="secondary"
            className="hover:bg-surface-muted h-auto flex-col gap-2 p-3 text-xs font-semibold sm:p-4"
            onClick={() => navigate('/matches/new')}
          >
            <div className="rounded-full bg-amber-500/10 p-2">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
            Add Match
          </Button>
        ) : null}
      </div>

      {/* 4. Today's Sessions List */}
      <Card className="border-border-subtle bg-surface min-w-0 shadow-2xs">
        <CardHeader
          title={
            <div className="flex min-w-0 items-center gap-2">
              <Clock className="text-info h-4 w-4 shrink-0" />
              <span className="truncate">Today's Sessions</span>
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
        <CardBody className="min-w-0 p-3 pt-0">
          {todaySessions.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-fg-muted text-xs font-medium">No sessions scheduled for today.</p>
              {canManageSessions && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/sessions/new')}
                  className="text-primary mt-2 text-xs"
                >
                  Create Session ?
                </Button>
              )}
            </div>
          ) : (
            <div className="min-w-0 space-y-2">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="border-border-subtle hover:border-primary/50 bg-surface flex min-w-0 flex-col gap-3 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="text-fg truncate text-sm font-bold">{session.title}</p>
                      {session.attendanceMarked ? (
                        <Badge tone="success" className="shrink-0 text-[10px] uppercase">
                          Marked
                        </Badge>
                      ) : (
                        <Badge tone="neutral" className="shrink-0 text-[10px] uppercase">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <div className="text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="flex items-center gap-1 truncate font-medium">
                        <Clock className="text-fg-muted/80 h-3.5 w-3.5 shrink-0" />
                        {session.startAt ? formatTime(session.startAt) : 'TBD'}
                        {session.endAt ? ` - ${formatTime(session.endAt)}` : ''}
                      </span>
                      {session.batchName && (
                        <span className="flex items-center gap-1 truncate font-medium">
                          <Layers className="text-fg-muted/80 h-3.5 w-3.5 shrink-0" />
                          {session.batchName} ({session.playerCount} players)
                        </span>
                      )}
                      {session.coach?.fullName && (
                        <span className="flex items-center gap-1 truncate font-medium">
                          <UserCheck className="text-fg-muted/80 h-3.5 w-3.5 shrink-0" />
                          {session.coach.fullName}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant={session.attendanceMarked ? 'secondary' : 'primary'}
                    onClick={() => navigate(`/sessions/${session.id}/attendance`)}
                    className="h-9 w-full shrink-0 px-3.5 text-xs font-bold sm:w-auto"
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

      {/* 5. Player Join Code Card */}
      {academyId ? <JoinCodeCard academyId={academyId} /> : null}

      {/* 6. Recent Activity Feed */}
      <ActivityFeed title="Recent Activity" activities={activities} />
    </div>
  );
}
