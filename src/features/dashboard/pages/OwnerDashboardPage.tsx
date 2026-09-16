import { useState } from 'react';
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
  QrCode,
} from 'lucide-react';

import { Avatar, Card, CardBody, CardHeader, Button, Badge } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { useOwnerDashboardAnalytics } from '../hooks/useDashboardAnalytics';
import { KpiCard } from '../components/KpiCard';
import { ActivityFeed } from '../components/ActivityFeed';
import { JoinCodeCard } from '@/features/academies';
import { SuperAdminAcademyActions } from '@/features/admin';
import { StudentMonthlyFeeModal, STUDENT_MONTHLY_FEE_AMOUNT } from '@/features/billing';
import { useAuth } from '@/features/auth';
import type { ActivityItem } from '../components/ActivityFeed';
import { useCan } from '@/lib/rbac';

export default function OwnerDashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const { academyId, membership } = useActiveAcademy();
  const analyticsQuery = useOwnerDashboardAnalytics(academyId);

  const canManagePlayers = useCan('players:manage');
  const canManageSessions = useCan('sessions:manage');
  const canManageMatches = useCan('matches:manage');
  const canReadOwnBilling = useCan('billing:read_own');

  const analytics = analyticsQuery.data;

  if (analyticsQuery.isPending) {
    return (
      <div className="flex min-h-[300px] items-center justify-center p-6 text-center">
        <p className="text-fg-muted text-sm font-medium">Loading dashboard...</p>
      </div>
    );
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
  const expectedPlayersCount = todaySessions.reduce((acc, s) => acc + (s.playerCount || 0), 0);

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* 1. Header with Academy Branding */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <Avatar
            name={membership?.academyName}
            src={membership?.logoUrl}
            shape="rounded"
            className="border-border-subtle/80 h-12 w-12 shrink-0 border text-base shadow-xs sm:h-14 sm:w-14 sm:text-lg"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-fg truncate text-xl font-extrabold tracking-tight md:text-2xl">
              {membership?.academyName ?? 'Academy Dashboard'}
            </h1>
            <p className="text-fg-muted truncate text-xs font-semibold tracking-wide">
              {membership?.city ? `${membership.city} · ` : ''}Academy Operations & Performance
            </p>
          </div>
        </div>
      </div>

      <SuperAdminAcademyActions />

      {/* Student Monthly App Pass (₹200 FamPay QR) Notice */}
      {canReadOwnBilling && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 shadow-2xs">
            <div className="text-fg flex min-w-0 items-center gap-2.5 text-xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 font-black text-white shadow-2xs">
                <QrCode className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-fg truncate font-bold">
                  Student Monthly App Pass:{' '}
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    ₹{STUDENT_MONTHLY_FEE_AMOUNT}/mo
                  </span>
                </p>
                <p className="text-fg-muted truncate text-[11px]">
                  Owners & Coaches free lifetime. Students pay ₹{STUDENT_MONTHLY_FEE_AMOUNT}{' '}
                  directly to app via FamPay QR.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-8 shrink-0 gap-1.5 border-emerald-500/30 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
              onClick={() => setIsFeeModalOpen(true)}
            >
              <QrCode className="h-3.5 w-3.5" /> Preview FamPay QR
            </Button>
          </div>

          <StudentMonthlyFeeModal
            open={isFeeModalOpen}
            onClose={() => setIsFeeModalOpen(false)}
            studentId={profile?.id || 'demo_student'}
            studentName={profile?.fullName || 'Student Player'}
            studentEmail={profile?.email || 'player@cam.app'}
            academyId={(academyId || 'academy_1') as string}
            academyName={membership?.academyName || 'Cricket Academy'}
          />
        </>
      )}

      {/* 2. Today's Overview (KPIs) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <KpiCard
          title="Today's Sessions"
          value={todaySessions.length}
          icon={<CalendarDays className="text-primary h-4 w-4" />}
        />
        <KpiCard
          title="Players Expected"
          value={expectedPlayersCount}
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
            className="hover:bg-surface-muted/80 border-border-subtle bg-surface hover:border-primary/40 h-auto min-h-[76px] flex-col justify-center gap-2 rounded-xl border p-3 text-xs font-bold shadow-2xs transition-all active:scale-[0.98] sm:p-4"
            onClick={() => navigate('/members')}
          >
            <div className="bg-primary/10 rounded-full p-2.5">
              <UserPlus className="text-primary h-5 w-5" />
            </div>
            <span>Add Player</span>
          </Button>
        ) : null}
        {canManageSessions ? (
          <Button
            variant="secondary"
            className="hover:bg-surface-muted/80 border-border-subtle bg-surface hover:border-primary/40 h-auto min-h-[76px] flex-col justify-center gap-2 rounded-xl border p-3 text-xs font-bold shadow-2xs transition-all active:scale-[0.98] sm:p-4"
            onClick={() => navigate('/sessions/new')}
          >
            <div className="bg-info/10 rounded-full p-2.5">
              <Plus className="text-info h-5 w-5" />
            </div>
            <span>Create Session</span>
          </Button>
        ) : null}
        <Button
          variant="secondary"
          className="hover:bg-surface-muted/80 border-border-subtle bg-surface hover:border-primary/40 h-auto min-h-[76px] flex-col justify-center gap-2 rounded-xl border p-3 text-xs font-bold shadow-2xs transition-all active:scale-[0.98] sm:p-4"
          onClick={() => navigate('/sessions')}
        >
          <div className="bg-success/10 rounded-full p-2.5">
            <CalendarCheck className="text-success h-5 w-5" />
          </div>
          <span>Mark Attendance</span>
        </Button>
        {canManageMatches ? (
          <Button
            variant="secondary"
            className="hover:bg-surface-muted/80 border-border-subtle bg-surface hover:border-primary/40 h-auto min-h-[76px] flex-col justify-center gap-2 rounded-xl border p-3 text-xs font-bold shadow-2xs transition-all active:scale-[0.98] sm:p-4"
            onClick={() => navigate('/matches/new')}
          >
            <div className="rounded-full bg-amber-500/10 p-2.5">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
            <span>Add Match</span>
          </Button>
        ) : null}
      </div>

      {/* 4. Today's Sessions List */}
      <Card className="border-border-subtle bg-surface shadow-2xs">
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <Clock className="text-primary h-4 w-4 shrink-0" />
              <span>Today's Sessions</span>
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
              {canManageSessions && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/sessions/new')}
                  className="text-primary mt-2 text-xs font-bold"
                >
                  Create Session &rarr;
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="border-border-subtle hover:border-primary/40 bg-surface flex min-w-0 flex-col gap-3 rounded-xl border p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="text-fg truncate text-sm font-bold">{session.title}</p>
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
                    <div className="text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="flex items-center gap-1 truncate font-medium">
                        <Clock className="text-fg-muted/80 h-3.5 w-3.5 shrink-0" />
                        {session.startAt || 'TBD'} {session.endAt ? `- ${session.endAt}` : ''}
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
                    className="h-10 min-h-[40px] w-full shrink-0 px-4 text-xs font-bold sm:w-auto"
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
