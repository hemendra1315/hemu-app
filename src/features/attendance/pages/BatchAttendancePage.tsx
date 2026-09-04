import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarCheck, TrendingUp, Users } from 'lucide-react';

import { Button, Card, CardBody, CardHeader } from '@/components/ui';
import { ErrorState, EmptyState } from '@/components/feedback';
import { MobileStatCard } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { useBatches } from '@/features/batches';
import { useAcademyMembers } from '@/features/members';
import { useCan } from '@/lib/rbac';
import { formatDate, formatTime } from '@/lib/utils/date';
import type { UUID } from '@/types';
import { useBatchAttendance } from '../hooks/useAttendance';
import { buildAttendanceInsights, type AttendanceMark } from '../api/attendanceInsights';

function rateLabel(rate: number | null): string {
  return rate === null ? '—' : `${rate}%`;
}

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

export default function BatchAttendancePage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { academyId } = useActiveAcademy();
  const canMark = useCan('attendance:mark');

  const attendanceQuery = useBatchAttendance(batchId ?? null, academyId);
  const batchesQuery = useBatches(academyId);
  const membersQuery = useAcademyMembers(academyId, {});

  const batch = useMemo(
    () => (batchesQuery.data ?? []).find((b) => b.id === batchId) ?? null,
    [batchesQuery.data, batchId],
  );

  const playerNames = useMemo(
    () =>
      new Map(
        (membersQuery.data ?? []).map((m) => [m.id, m.fullName ?? m.email ?? 'Unknown player']),
      ),
    [membersQuery.data],
  );

  // Newest first — a coach opening this wants the last few sessions, not the
  // first ones from months ago.
  const sessions = useMemo(
    () =>
      [...(attendanceQuery.data ?? [])].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate)),
    [attendanceQuery.data],
  );

  /**
   * The same aggregation the academy-wide screen uses, fed only this batch's
   * sessions. Reusing it means the rate a player shows here is arrived at
   * exactly the same way as the one on their profile — two different sums for
   * "attendance" is how numbers start disagreeing across screens.
   */
  const insights = useMemo(() => {
    const marks: AttendanceMark[] = sessions.flatMap((session) =>
      session.attendance.map((record) => ({
        playerId: record.playerId,
        status: record.status,
        sessionId: session.sessionId,
        sessionDate: session.sessionDate,
        batchId: (batchId ?? null) as UUID | null,
      })),
    );
    const dates = sessions.map((s) => s.sessionDate).sort();
    return buildAttendanceInsights({
      marks,
      playerNames,
      batchNames: new Map(),
      from: dates[0] ?? '',
      to: dates[dates.length - 1] ?? '',
    });
  }, [sessions, playerNames, batchId]);

  if (!batchId || !academyId) {
    return (
      <EmptyState
        title="No batch selected"
        description="Select a batch from the batches list to view its attendance."
      />
    );
  }

  if (attendanceQuery.isPending) {
    return <p className="text-fg-muted">Loading attendance…</p>;
  }

  if (attendanceQuery.isError) {
    return (
      <ErrorState error={attendanceQuery.error} onRetry={() => void attendanceQuery.refetch()} />
    );
  }

  const markedSessions = sessions.filter((s) => s.attendance.length > 0).length;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-fg text-xl font-bold">{batch?.name ?? 'Batch'} attendance</h1>
          <p className="text-fg-muted text-sm">
            {markedSessions} of {sessions.length} sessions marked
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MobileStatCard
          title="Attendance"
          value={rateLabel(insights.overallRate)}
          subtext={`${insights.present} present, ${insights.absent} absent`}
          icon={<TrendingUp className="text-primary h-4 w-4" />}
        />
        <MobileStatCard
          title="Sessions"
          value={sessions.length}
          subtext={`${markedSessions} marked`}
          icon={<CalendarCheck className="text-info h-4 w-4" />}
        />
        <MobileStatCard
          title="Players"
          value={insights.playersTracked}
          subtext="Marked at least once"
          icon={<Users className="text-success h-4 w-4" />}
        />
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          description="This batch has no training sessions to take attendance for."
        />
      ) : null}

      {insights.players.length > 0 ? (
        <Card>
          <CardHeader title="By player" description="Across this batch's sessions, lowest first" />
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

      {sessions.length > 0 ? (
        <Card>
          <CardHeader title="Sessions" description="Newest first" />
          <CardBody className="p-0">
            <ul className="divide-border-subtle divide-y">
              {sessions.map((session) => {
                const present = session.attendance.filter((a) => a.status === 'present').length;
                const total = session.attendance.length;
                const rate = total === 0 ? null : Math.round((present / total) * 100);

                return (
                  <li
                    key={session.sessionId}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-fg truncate text-sm font-semibold">{session.title}</p>
                      <p className="text-fg-muted text-xs">
                        {formatDate(session.sessionDate)} · {formatTime(session.startAt)} –{' '}
                        {formatTime(session.endAt)}
                      </p>
                    </div>

                    {total === 0 ? (
                      canMark ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="shrink-0 text-xs"
                          onClick={() => navigate(`/sessions/${session.sessionId}/attendance`)}
                        >
                          Mark
                        </Button>
                      ) : (
                        <span className="text-fg-muted shrink-0 text-xs">Not marked</span>
                      )
                    ) : (
                      <div className="shrink-0 text-right">
                        <span className={`text-sm font-bold ${rateTone(rate)}`}>
                          {rateLabel(rate)}
                        </span>
                        <p className="text-fg-muted text-xs">
                          {present}/{total} present
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
