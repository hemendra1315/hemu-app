import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { Card, CardBody } from '@/components/ui';
import { ErrorState, EmptyState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { usePlayerAttendance } from '../hooks/useAttendance';
import { formatDate, formatTime } from '@/lib/utils/date';

export default function PlayerAttendancePage() {
  // The route is `/members/:memberId/attendance`. This read `playerId`, which
  // is never defined for that route, so the page rendered "No player selected"
  // every single time — and nothing linked to it, so nobody ever saw that.
  const { memberId: playerId } = useParams();
  const { academyId } = useActiveAcademy();
  const attendanceQuery = usePlayerAttendance(playerId ?? null, academyId);

  // Sessions are listed newest first. `fetchPlayerAttendance` orders by
  // `created_at` — the moment a coach tapped the button — which is not the
  // order the sessions happened in if attendance was marked late.
  const records = useMemo(
    () =>
      [...(attendanceQuery.data ?? [])].sort((a, b) =>
        b.session.sessionDate.localeCompare(a.session.sessionDate),
      ),
    [attendanceQuery.data],
  );

  const summary = useMemo(() => {
    const total = records.length;
    const present = records.filter((r) => r.status === 'present').length;
    return { total, present, rate: total === 0 ? 0 : Math.round((present / total) * 100) };
  }, [records]);

  if (!playerId || !academyId) {
    return (
      <EmptyState
        title="No player selected"
        description="Select a player from the members list to view their attendance."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-fg text-xl font-semibold">Player attendance</h1>
          <p className="text-fg-muted">
            {summary.total > 0
              ? `${summary.rate}% · present at ${summary.present} of ${summary.total} sessions`
              : 'View attendance history for this player.'}
          </p>
        </div>
      </div>

      <Card>
        <CardBody>
          {attendanceQuery.isPending ? (
            <p className="text-fg-muted">Loading attendance…</p>
          ) : attendanceQuery.isError ? (
            <ErrorState
              error={attendanceQuery.error}
              onRetry={() => void attendanceQuery.refetch()}
            />
          ) : attendanceQuery.data?.length === 0 ? (
            <EmptyState
              title="No attendance yet"
              description="This player has not been marked for any session."
            />
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <div key={record.id} className="border-border-subtle rounded-2xl border p-4">
                  <p className="text-fg text-sm font-semibold">{record.session.title}</p>
                  <p className="text-fg-muted text-sm">
                    {formatDate(record.session.sessionDate)} · {formatTime(record.session.startAt)}{' '}
                    - {formatTime(record.session.endAt)}
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      record.status === 'present' ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {record.status === 'present' ? 'Present' : 'Absent'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
