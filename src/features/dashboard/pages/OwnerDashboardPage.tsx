import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  CalendarCheck,
  ArrowRight,
  Plus,
  UserPlus,
  Clock,
  CheckCircle2,
  QrCode,
  IndianRupee,
  AlertTriangle,
  UserX,
  UsersRound,
  Send,
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
  const canReadOwnBilling = useCan('billing:read_own');

  const analytics = analyticsQuery.data;

  if (analyticsQuery.isPending) {
    return (
      <div className="flex min-h-[300px] items-center justify-center p-6 text-center">
        <p className="text-fg-muted text-sm font-medium">Loading action dashboard...</p>
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
  const missingAttendanceSessions = todaySessions.filter((s) => !s.attendanceMarked);
  const overdueCount = analytics.overdueCount ?? 0;
  const overdueAmount = analytics.overdueAmount ?? 0;
  const unassignedCount = analytics.unassignedPlayersCount ?? 0;
  const absentTodayCount = analytics.absentTodayCount ?? 0;
  const todayCollections = analytics.todayCollections ?? 0;

  const hasActionRequired =
    overdueCount > 0 || missingAttendanceSessions.length > 0 || unassignedCount > 0;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
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
              {membership?.city ? `${membership.city} · ` : ''}Owner Action & Operations Hub
            </p>
          </div>
        </div>
      </div>

      <SuperAdminAcademyActions />

      {/* 2. TOP ACTION KPI CARDS */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
        {/* Today's Collections */}
        <KpiCard
          title="Today's Collections"
          value={`₹${todayCollections.toLocaleString('en-IN')}`}
          icon={<IndianRupee className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          description="Cash & UPI received today"
        />

        {/* Pending / Overdue Fees */}
        <KpiCard
          title="Overdue Fees"
          value={`₹${overdueAmount.toLocaleString('en-IN')}`}
          icon={<AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
          description={overdueCount === 1 ? '1 student unpaid' : `${overdueCount} students unpaid`}
        />

        {/* Students Absent Today */}
        <KpiCard
          title="Absent Today"
          value={absentTodayCount}
          icon={<UserX className="h-4 w-4 text-rose-500" />}
          description="Recorded ground absences"
        />

        {/* Unassigned Players */}
        <KpiCard
          title="Unassigned"
          value={unassignedCount}
          icon={<UsersRound className="h-4 w-4 text-amber-500" />}
          description="Players with no batch"
        />

        {/* Active Batches */}
        <KpiCard
          title="Active Batches"
          value={analytics.totalBatches}
          icon={<Layers className="text-primary h-4 w-4" />}
          description={`${analytics.totalPlayers} total players`}
        />
      </div>

      {/* 3. ACTION REQUIRED SECTION */}
      {hasActionRequired && (
        <Card className="border-amber-500/40 bg-amber-500/5 shadow-xs">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="font-heading text-xs font-black tracking-wider text-amber-900 uppercase dark:text-amber-200">
                  Action Required Today
                </span>
              </div>
            }
          />
          <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="space-y-2.5">
              {/* Overdue Invoices Action Item */}
              {overdueCount > 0 && (
                <div className="flex flex-col justify-between gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-rose-500/20 p-2 text-rose-700 dark:text-rose-300">
                      <IndianRupee className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-rose-950 dark:text-rose-100">
                        {overdueCount} {overdueCount === 1 ? 'student has' : 'students have'} unpaid
                        fees (₹{overdueAmount.toLocaleString('en-IN')} overdue)
                      </p>
                      <p className="text-[11px] font-medium text-rose-800/80 dark:text-rose-300/80">
                        Send instant WhatsApp reminders with pre-filled UPI payment links.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => navigate('/billing/recovery')}
                    className="h-9 shrink-0 bg-rose-600 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-95"
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Recover Fees
                  </Button>
                </div>
              )}

              {/* Missing Attendance Action Item */}
              {missingAttendanceSessions.length > 0 && (
                <div className="flex flex-col justify-between gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-amber-500/20 p-2 text-amber-700 dark:text-amber-300">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-amber-950 dark:text-amber-100">
                        {missingAttendanceSessions.length}{' '}
                        {missingAttendanceSessions.length === 1 ? 'session' : 'sessions'} missing
                        ground attendance today
                      </p>
                      <p className="text-[11px] font-medium text-amber-800/80 dark:text-amber-300/80">
                        {missingAttendanceSessions.map((s) => s.title).join(', ')}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      navigate(`/sessions/${missingAttendanceSessions[0]?.id}/attendance`)
                    }
                    className="h-9 shrink-0 border-amber-500/40 text-xs font-bold text-amber-900 hover:bg-amber-500/20 active:scale-95 dark:text-amber-100"
                  >
                    <CalendarCheck className="mr-1.5 h-3.5 w-3.5" />
                    Open Roll Call
                  </Button>
                </div>
              )}

              {/* Unassigned Players Action Item */}
              {unassignedCount > 0 && (
                <div className="flex flex-col justify-between gap-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-blue-500/20 p-2 text-blue-700 dark:text-blue-300">
                      <UsersRound className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-blue-950 dark:text-blue-100">
                        {unassignedCount} {unassignedCount === 1 ? 'player is' : 'players are'} not
                        assigned to any training batch
                      </p>
                      <p className="text-[11px] font-medium text-blue-800/80 dark:text-blue-300/80">
                        Assign squads so coaches can record ground attendance.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate('/members')}
                    className="h-9 shrink-0 border-blue-500/40 text-xs font-bold text-blue-900 hover:bg-blue-500/20 active:scale-95 dark:text-blue-100"
                  >
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Assign Batches
                  </Button>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

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

      {/* 4. Quick Actions */}
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
        <Button
          variant="secondary"
          className="hover:bg-surface-muted/80 border-border-subtle bg-surface hover:border-primary/40 h-auto min-h-[76px] flex-col justify-center gap-2 rounded-xl border p-3 text-xs font-bold shadow-2xs transition-all active:scale-[0.98] sm:p-4"
          onClick={() => navigate('/billing/recovery')}
        >
          <div className="rounded-full bg-emerald-500/10 p-2.5">
            <IndianRupee className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span>Fee Recovery</span>
        </Button>
      </div>

      {/* 5. Today's Sessions List */}
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
                        <Badge tone="warning" className="shrink-0 text-[10px] font-bold uppercase">
                          Roll Call Pending
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
                          👤 {session.coach.fullName}
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

      {/* 6. Player Join Code Card */}
      {academyId ? <JoinCodeCard academyId={academyId} /> : null}

      {/* 7. Recent Activity Feed */}
      <ActivityFeed title="Recent Activity" activities={activities} />
    </div>
  );
}
