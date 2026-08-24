import { useParams } from 'react-router-dom';

import { Card, CardBody } from '@/components/ui';
import { ErrorState, EmptyState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { usePlayerAttendance } from '../hooks/useAttendance';
import { formatDate, formatTime } from '@/lib/utils/date';

export default function PlayerAttendancePage() {
  const { playerId } = useParams();
  const { academyId } = useActiveAcademy();
  const attendanceQuery = usePlayerAttendance(playerId ?? null, academyId);

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
          <p className="text-fg-muted">View attendance history for this player.</p>
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
              {attendanceQuery.data.map((record) => (
                <div key={record.id} className="border-border-subtle rounded-2xl border p-4">
                  <p className="text-fg text-sm font-semibold">{record.session.title}</p>
                  <p className="text-fg-muted text-sm">
                    {formatDate(record.session.sessionDate)} · {formatTime(record.session.startAt)}{' '}
                    - {formatTime(record.session.endAt)}
                  </p>
                  <p className="text-fg text-sm">Status: {record.status}</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
