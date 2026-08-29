import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarCheck, TrendingUp, UserCheck, Users } from 'lucide-react';

import { ErrorState } from '@/components/feedback';
import { Button, Card, CardBody, CardHeader } from '@/components/ui';
import { MobilePageHeader, MobileStatCard } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { useCan } from '@/lib/rbac';
import { useBatches } from '@/features/batches';
import { useAcademyMembers } from '@/features/members';
import { useAttendanceInsights } from '../hooks/useAttendance';
import { recentMonths, type PlayerAttendanceStat } from '../api/attendanceInsights';

function rateLabel(rate: number | null): string {
  return rate === null ? '—' : `${rate}%`;
}

/** Green above 80, amber 60–80, red below — the same thresholds as `isAtRisk`. */
function rateTone(rate: number | null): string {
  if (rate === null) return 'text-fg-muted';
  if (rate >= 80) return 'text-success';
  if (rate >= 60) return 'text-warning';
  return 'text-danger';
}

function RateBar({ rate }: { rate: number | null }) {
  return (
    <div className="bg-surface-muted h-1.5 w-full overflow-hidden rounded-full" aria-hidden>
      <div
        className={
          rate === null
            ? 'bg-fg-muted h-full'
            : rate >= 80
              ? 'bg-success h-full'
              : rate >= 60
                ? 'bg-warning h-full'
                : 'bg-danger h-full'
        }
        style={{ width: `${rate ?? 0}%` }}
      />
    </div>
  );
}

function AbsenceNote({ player }: { player: PlayerAttendanceStat }) {
  if (player.currentAbsenceStreak >= 2) {
    return (
      <span className="text-danger">
        Missed the last {player.currentAbsenceStreak} sessions
        {player.lastPresentDate ? ` · last seen ${player.lastPresentDate}` : ' · never attended'}
      </span>
    );
  }
  return (
    <span className="text-warning">
      {player.present} of {player.sessionsRecorded} attended
    </span>
  );
}

export default function AttendanceOverviewPage() {
  const navigate = useNavigate();
  const { academyId } = useActiveAcademy();
  const canMark = useCan('attendance:mark');

  const months = useMemo(() => recentMonths(12), []);
  const [month, setMonth] = useState(() => months[0]?.value ?? '');

  const batchesQuery = useBatches(academyId);
  const membersQuery = useAcademyMembers(academyId, {});

  // Names are resolved here rather than inside the query so the aggregation
  // stays a pure function of its inputs.
  const playerNames = useMemo(
    () =>
      new Map(
        (membersQuery.data ?? []).map((m) => [m.id, m.fullName ?? m.email ?? 'Unknown player']),
      ),
    [membersQuery.data],
  );
  const batchNames = useMemo(
    () => new Map((batchesQuery.data ?? []).map((b) => [b.id, b.name])),
    [batchesQuery.data],
  );

  const attendance = useAttendanceInsights(academyId, month, playerNames, batchNames);

  if (!academyId) return null;

  if (attendance.isPending || membersQuery.isPending || batchesQuery.isPending) {
    return <p className="text-fg-muted">Loading attendance…</p>;
  }

  if (attendance.isError || !attendance.insights) {
    return <ErrorState error={attendance.error} onRetry={() => void attendance.refetch()} />;
  }

  const insights = attendance.insights;
  const monthLabel = months.find((m) => m.value === month)?.label ?? month;

  const monthPicker = (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-fg-muted">Month</span>
      <select
        value={month}
        onChange={(event) => setMonth(event.target.value)}
        className="border-border-subtle bg-surface text-fg min-h-[40px] rounded-lg border px-3 text-sm"
      >
        {months.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="md:hidden">
        <MobilePageHeader title="Attendance" subtitle={monthLabel} />
      </div>

      <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
        <div>
          <h1 className="text-fg text-xl font-bold">Attendance</h1>
          <p className="text-fg-muted text-sm">Who is turning up, and who has stopped.</p>
        </div>
        <div className="flex items-center gap-3">
          {monthPicker}
          {canMark ? (
            <Button onClick={() => navigate('/sessions')} className="min-h-[44px]">
              <CalendarCheck className="mr-2 h-4 w-4" />
              Mark attendance
            </Button>
          ) : null}
        </div>
      </div>

      <div className="md:hidden">{monthPicker}</div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MobileStatCard
          title="Attendance"
          value={rateLabel(insights.overallRate)}
          subtext={`${insights.present} present, ${insights.absent} absent`}
          icon={<TrendingUp className="text-primary h-4 w-4" />}
        />
        <MobileStatCard
          title="Sessions"
          value={insights.sessionsHeld}
          subtext="With attendance marked"
          icon={<CalendarCheck className="text-info h-4 w-4" />}
        />
        <MobileStatCard
          title="Players"
          value={insights.playersTracked}
          subtext="Marked at least once"
          icon={<Users className="text-success h-4 w-4" />}
        />
        <MobileStatCard
          title="Needs a look"
          value={insights.atRisk.length}
          subtext="Missing or below 60%"
          icon={<AlertTriangle className="text-warning h-4 w-4" />}
        />
      </div>

      {insights.totalMarks === 0 ? (
        <Card>
          <CardBody className="p-8 text-center">
            <UserCheck className="text-fg-muted mx-auto mb-3 h-8 w-8" />
            <p className="text-fg font-semibold">No attendance marked in {monthLabel}</p>
            <p className="text-fg-muted mt-1 text-sm">
              Pick another month, or mark a session to start building a record.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {insights.atRisk.length > 0 ? (
        <Card>
          <CardHeader
            title="Needs a look"
            description="Missed the last two or more sessions, or below 60% this month"
          />
          <CardBody className="p-0">
            <ul className="divide-border-subtle divide-y">
              {insights.atRisk.map((player) => (
                <li
                  key={player.playerId}
                  className="hover:bg-surface-muted/50 flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-fg truncate text-sm font-semibold">{player.fullName}</p>
                    <p className="mt-0.5 text-xs">
                      <AbsenceNote player={player} />
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0 text-xs"
                    onClick={() => navigate(`/members/${player.playerId}/attendance`)}
                  >
                    History →
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {insights.players.length > 0 ? (
        <Card>
          <CardHeader
            title="By player"
            description="Lowest attendance first — sessions each player was marked for"
          />
          <CardBody className="p-0">
            <ul className="divide-border-subtle divide-y">
              {insights.players.map((player) => (
                <li key={player.playerId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/members/${player.playerId}/attendance`)}
                      className="text-fg min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                    >
                      {player.fullName}
                    </button>
                    <span className="text-fg-muted shrink-0 text-xs">
                      {player.present}/{player.sessionsRecorded}
                    </span>
                    <span
                      className={`w-12 shrink-0 text-right text-sm font-bold ${rateTone(player.rate)}`}
                    >
                      {rateLabel(player.rate)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <RateBar rate={player.rate} />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {insights.batches.length > 0 ? (
        <Card>
          <CardHeader title="By batch" description="Attendance across each batch this month" />
          <CardBody className="p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {insights.batches.map((batch) => (
                <div
                  key={batch.batchId}
                  className="border-border-subtle bg-surface rounded-xl border p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-fg truncate text-sm font-bold">{batch.name}</p>
                      <p className="text-fg-muted text-xs">
                        {batch.sessionsRecorded} sessions · {batch.present} present, {batch.absent}{' '}
                        absent
                      </p>
                    </div>
                    <span className={`shrink-0 text-lg font-bold ${rateTone(batch.rate)}`}>
                      {rateLabel(batch.rate)}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <RateBar rate={batch.rate} />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 h-8 min-h-[32px] px-0 text-xs font-semibold"
                    onClick={() => navigate(`/batches/${batch.batchId}/attendance`)}
                  >
                    View sessions →
                  </Button>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
