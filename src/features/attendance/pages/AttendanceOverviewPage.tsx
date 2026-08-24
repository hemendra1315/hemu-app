import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Users, TrendingUp, Clock } from 'lucide-react';

import { ErrorState } from '@/components/feedback';
import { Button, Card, CardBody, CardHeader } from '@/components/ui';
import { SimpleBarChart } from '@/components/charts/SimpleBarChart';
import { MobilePageHeader, MobileStatCard } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { useCan } from '@/lib/rbac';
import { useOwnerDashboardAnalytics } from '@/features/dashboard/hooks/useDashboardAnalytics';
import { useBatches } from '@/features/batches';

export default function AttendanceOverviewPage() {
  const navigate = useNavigate();
  const { academyId } = useActiveAcademy();
  const canMark = useCan('attendance:mark');
  const analyticsQuery = useOwnerDashboardAnalytics(academyId);
  const batchesQuery = useBatches(academyId);

  const monthlyAttendanceData = useMemo(() => {
    const data = analyticsQuery.data;
    if (!data?.monthlyAttendance) return [];
    return data.monthlyAttendance.map((item) => ({
      label: item.label,
      value: item.value,
    }));
  }, [analyticsQuery.data]);

  if (!academyId) return null;

  if (analyticsQuery.isPending || batchesQuery.isPending) {
    return <p className="text-fg-muted">Loading attendance data…</p>;
  }

  const error = analyticsQuery.error || batchesQuery.error;
  if (
    analyticsQuery.isError ||
    !analyticsQuery.data ||
    batchesQuery.isError ||
    !batchesQuery.data
  ) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void analyticsQuery.refetch();
          void batchesQuery.refetch();
        }}
      />
    );
  }

  const analytics = analyticsQuery.data;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Mobile Page Header */}
      <div className="md:hidden">
        <MobilePageHeader
          title="Attendance Analytics"
          subtitle="Academy-wide attendance & trends"
        />
      </div>

      {/* Desktop Header */}
      <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
        <div>
          <h1 className="text-fg text-xl font-bold">Attendance Overview</h1>
          <p className="text-fg-muted text-sm">
            Review weekly & monthly attendance metrics for your academy.
          </p>
        </div>
        {canMark ? (
          <Button onClick={() => navigate('/sessions')} className="min-h-[44px]">
            <CalendarCheck className="mr-2 h-4 w-4" />
            Mark Session Attendance
          </Button>
        ) : null}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MobileStatCard
          title="Weekly Rate"
          value={`${analytics?.attendancePercentage ?? 0}%`}
          subtext="Overall present rate"
          icon={<TrendingUp className="text-primary h-4 w-4" />}
        />
        <MobileStatCard
          title="Active Batches"
          value={analytics?.totalBatches ?? batchesQuery.data?.length ?? 0}
          subtext="Enrolled groups"
          icon={<Users className="text-info h-4 w-4" />}
        />
        <MobileStatCard
          title="Sessions / Wk"
          value={analytics?.sessionsThisWeek ?? 0}
          subtext="Scheduled training"
          icon={<Clock className="text-warning h-4 w-4" />}
        />
        <MobileStatCard
          title="Total Matches"
          value={analytics?.totalMatches ?? 0}
          subtext="Completed matches"
          icon={<CalendarCheck className="text-success h-4 w-4" />}
        />
      </div>

      {/* Monthly Attendance Chart */}
      <Card>
        <CardHeader
          title="Monthly Attendance Trend"
          description="Percentage of present records over the last 6 months"
        />
        <CardBody className="p-4">
          {monthlyAttendanceData.length > 0 ? (
            <SimpleBarChart data={monthlyAttendanceData} height={220} />
          ) : (
            <p className="text-fg-muted py-8 text-center text-sm">
              No attendance trend data available yet. Mark session attendance to see statistics.
            </p>
          )}
        </CardBody>
      </Card>

      {/* Batch Breakdown */}
      <Card>
        <CardHeader title="Batch Breakdown" description="Quick links to batch attendance rosters" />
        <CardBody className="p-3 sm:p-4">
          {!batchesQuery.data || batchesQuery.data.length === 0 ? (
            <p className="text-fg-muted py-6 text-center text-sm">No batches created yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {batchesQuery.data.map((batch) => (
                <div
                  key={batch.id}
                  className="border-border-subtle bg-surface flex items-center justify-between rounded-xl border p-3.5"
                >
                  <div>
                    <p className="text-fg text-sm font-bold">{batch.name}</p>
                    <p className="text-fg-muted text-xs">
                      {batch.ageGroup} • {batch.playerCount ?? 0} Players
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/batches/${batch.id}/attendance`)}
                    className="h-10 min-h-[40px] text-xs font-semibold"
                  >
                    Roster →
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
