import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Users } from 'lucide-react';

import { ErrorState, EmptyState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { useBatchAttendance } from '../hooks/useAttendance';
import { formatDate, formatTime } from '@/lib/utils/date';

export default function BatchAttendancePage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
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
    <div className="flex flex-col space-y-4 pb-24 md:pb-6">
      {/* 1. Header with Back Navigation */}
      <div className="border-border-subtle/40 flex items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate(-1)}
            className="border-border-subtle bg-surface text-fg-muted hover:text-fg hover:bg-surface-muted flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-heading text-fg text-lg font-extrabold tracking-tight uppercase md:text-xl">
              Squad Attendance History
            </h1>
            <p className="text-fg-muted font-sans text-xs">
              Historical session records & present logs for this squad
            </p>
          </div>
        </div>
      </div>

      {/* 2. Sessions Attendance Log */}
      {attendanceQuery.isPending ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-border-subtle bg-surface h-20 animate-pulse rounded-xl border"
            />
          ))}
        </div>
      ) : attendanceQuery.isError ? (
        <ErrorState error={attendanceQuery.error} onRetry={() => void attendanceQuery.refetch()} />
      ) : !attendanceQuery.data || attendanceQuery.data.length === 0 ? (
        <EmptyState
          title="No attendance records"
          description="No sessions have been marked for this squad yet."
        />
      ) : (
        <div className="divide-border-subtle/50 border-border-subtle bg-surface divide-y overflow-hidden rounded-xl border shadow-2xs">
          {attendanceQuery.data.map((session) => (
            <div
              key={session.sessionId}
              onClick={() => navigate(`/sessions/${session.sessionId}/attendance`)}
              className="hover:bg-surface-muted/30 group flex cursor-pointer flex-col justify-between gap-3 p-4 transition-colors sm:flex-row sm:items-center"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/sessions/${session.sessionId}/attendance`);
                }
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="font-heading text-fg group-hover:text-primary text-sm font-bold tracking-tight uppercase transition-colors">
                  {session.title}
                </p>
                <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                  <span className="flex items-center gap-1">
                    <Calendar className="text-primary h-3 w-3" />
                    {formatDate(session.sessionDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="text-fg-muted h-3 w-3" />
                    {formatTime(session.startAt)} – {formatTime(session.endAt)}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="border-primary/20 bg-primary-pale text-primary inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold">
                  <Users className="h-3 w-3" />
                  {session.attendance.length} Records
                </span>
                <span className="text-fg-muted group-hover:text-primary text-xs font-semibold transition-all group-hover:translate-x-0.5">
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
