import { useParams } from 'react-router-dom';

import { Card, CardBody } from '@/components/ui';
import { ErrorState, EmptyState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { useBatchAttendance } from '../hooks/useAttendance';
import { formatDate, formatTime } from '@/lib/utils/date';

export default function BatchAttendancePage() {
  const { batchId } = useParams();
  const { academyId } = useActiveAcademy();
  const attendanceQuery = useBatchAttendance(batchId ?? null, academyId);

  if (!batchId || !academyId) {
    return (
      <EmptyState
        title="No batch selected"
        description="Select a batch from the batches list to view its attendance."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-fg text-xl font-semibold">Batch attendance</h1>
          <p className="text-fg-muted">View attendance history for this batch.</p>
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
              description="This batch has no attendance records."
            />
          ) : (
            <div className="space-y-3">
              {attendanceQuery.data.map((session) => (
                <div
                  key={session.sessionId}
                  className="border-border-subtle rounded-2xl border p-4"
                >
                  <p className="text-fg text-sm font-semibold">{session.title}</p>
                  <p className="text-fg-muted text-sm">
                    {formatDate(session.sessionDate)} · {formatTime(session.startAt)} -{' '}
                    {formatTime(session.endAt)}
                  </p>
                  <p className="text-fg text-sm">{session.attendance.length} attendance records</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
