import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';

import { ErrorState, EmptyState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { usePlayerAttendance } from '../hooks/useAttendance';
import { formatDate, formatTime } from '@/lib/utils/date';

export default function PlayerAttendancePage() {
  const { playerId } = useParams();
  const navigate = useNavigate();
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
              Player Attendance History
            </h1>
            <p className="text-fg-muted font-sans text-xs">
              Individual session attendance & check-in log
            </p>
          </div>
        </div>
      </div>

      {/* 2. Player Attendance Log */}
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
          description="This player has not been marked for any session yet."
        />
      ) : (
        <div className="divide-border-subtle/50 border-border-subtle bg-surface divide-y overflow-hidden rounded-xl border shadow-2xs">
          {attendanceQuery.data.map((record) => {
            const isPresent = record.status === 'present';
            return (
              <div
                key={record.id}
                className="hover:bg-surface-muted/20 flex flex-col justify-between gap-3 p-4 transition-colors sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-fg text-sm font-bold tracking-tight uppercase">
                    {record.session.title}
                  </p>
                  <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                    <span className="flex items-center gap-1">
                      <Calendar className="text-primary h-3 w-3" />
                      {formatDate(record.session.sessionDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="text-fg-muted h-3 w-3" />
                      {formatTime(record.session.startAt)} – {formatTime(record.session.endAt)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded border px-2.5 py-0.5 font-sans text-[10px] font-bold uppercase ${
                      isPresent
                        ? 'border-success/30 bg-success-pale text-success'
                        : 'border-error/30 bg-error-pale text-error'
                    }`}
                  >
                    {record.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
