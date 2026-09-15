import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Users, TrendingUp, Clock, ChevronRight } from 'lucide-react';

import { ErrorState } from '@/components/feedback';
import { Button } from '@/components/ui';
import { SimpleBarChart } from '@/components/charts/SimpleBarChart';
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

  if (analyticsQuery.isLoading || batchesQuery.isLoading) {
    return (
      <div className="animate-pulse space-y-4 pb-24 md:pb-6">
        <div className="bg-surface border-border-subtle h-14 rounded-xl border" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface border-border-subtle h-20 rounded-xl border" />
          ))}
        </div>
        <div className="bg-surface border-border-subtle h-64 rounded-xl border" />
      </div>
    );
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
    <div className="flex flex-col space-y-4 pb-24 md:pb-6">
      {/* 1. Header */}
      <div className="border-border-subtle/40 flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <h1 className="font-heading text-fg text-xl font-extrabold tracking-tight uppercase md:text-2xl">
            Attendance Analytics
          </h1>
          <p className="text-fg-muted font-sans text-xs">
            Academy-wide trends & squad participation rates
          </p>
        </div>
        {canMark && (
          <Button
            onClick={() => navigate('/sessions')}
            className="h-10 min-h-[40px] rounded-lg px-4 text-xs font-bold"
          >
            <CalendarCheck className="mr-1.5 h-4 w-4" />
            Mark Session
          </Button>
        )}
      </div>

      {/* 2. 4-Stat Telemetry Strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
              Weekly Rate
            </span>
            <TrendingUp className="text-primary h-4 w-4" />
          </div>
          <p className="text-primary mt-2 font-mono text-2xl font-extrabold">
            {analytics?.attendancePercentage ?? 0}%
          </p>
          <span className="text-fg-muted mt-1 font-sans text-[11px]">Overall present rate</span>
        </div>

        <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
              Active Batches
            </span>
            <Users className="text-info h-4 w-4" />
          </div>
          <p className="text-fg mt-2 font-mono text-2xl font-extrabold">
            {analytics?.totalBatches ?? batchesQuery.data?.length ?? 0}
          </p>
          <span className="text-fg-muted mt-1 font-sans text-[11px]">Enrolled squads</span>
        </div>

        <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
              Sessions / Wk
            </span>
            <Clock className="text-saffron h-4 w-4" />
          </div>
          <p className="text-fg mt-2 font-mono text-2xl font-extrabold">
            {analytics?.sessionsThisWeek ?? 0}
          </p>
          <span className="text-fg-muted mt-1 font-sans text-[11px]">Scheduled training</span>
        </div>

        <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
              Matches Logged
            </span>
            <CalendarCheck className="text-success h-4 w-4" />
          </div>
          <p className="text-fg mt-2 font-mono text-2xl font-extrabold">
            {analytics?.totalMatches ?? 0}
          </p>
          <span className="text-fg-muted mt-1 font-sans text-[11px]">Competitive fixtures</span>
        </div>
      </div>

      {/* 3. Monthly Attendance Chart Card */}
      <div className="border-border-subtle bg-surface rounded-xl border p-4 shadow-2xs">
        <div className="border-border-subtle/50 border-b pb-3">
          <h2 className="font-heading text-fg text-sm font-extrabold tracking-tight uppercase">
            6-Month Attendance Trend
          </h2>
          <p className="text-fg-muted font-sans text-xs">
            Present percentage recorded across all squad sessions
          </p>
        </div>
        <div className="pt-4">
          {monthlyAttendanceData.length > 0 ? (
            <SimpleBarChart data={monthlyAttendanceData} height={200} />
          ) : (
            <p className="text-fg-muted py-8 text-center font-sans text-xs">
              No historical attendance trend data available yet.
            </p>
          )}
        </div>
      </div>

      {/* 4. Batch Breakdown Section */}
      <div className="border-border-subtle bg-surface rounded-xl border p-4 shadow-2xs">
        <div className="border-border-subtle/50 border-b pb-3">
          <h2 className="font-heading text-fg text-sm font-extrabold tracking-tight uppercase">
            Batch Attendance Rosters
          </h2>
          <p className="text-fg-muted font-sans text-xs">
            Direct access to individual squad attendance logs
          </p>
        </div>
        <div className="mt-3">
          {!batchesQuery.data || batchesQuery.data.length === 0 ? (
            <p className="text-fg-muted py-6 text-center font-sans text-xs">
              No batches created yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {batchesQuery.data.map((batch) => (
                <div
                  key={batch.id}
                  onClick={() => navigate(`/batches/${batch.id}/attendance`)}
                  className="group border-border-subtle/70 bg-surface-container-low/50 hover:border-primary/40 hover:bg-surface-muted/50 flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors"
                >
                  <div>
                    <p className="font-heading text-fg group-hover:text-primary text-sm font-bold uppercase transition-colors">
                      {batch.name}
                    </p>
                    <p className="text-fg-muted font-sans text-xs">
                      {batch.ageGroup} • {batch.playerCount ?? 0} Players
                    </p>
                  </div>
                  <div className="border-border-subtle bg-surface text-fg-muted group-hover:border-primary/50 group-hover:text-primary flex h-8 w-8 items-center justify-center rounded-md border">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
