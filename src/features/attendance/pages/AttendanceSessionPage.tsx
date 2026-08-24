import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui';
import { ErrorState, EmptyState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { useCan } from '@/lib/rbac';
import { useUiStore } from '@/stores';
import { useBatchPlayers } from '@/features/batches';
import { useSessionAttendance, useMarkAttendance, useMarkAllPresent } from '../hooks/useAttendance';
import { useOfflineAttendanceQueue } from '../lib/offlineAttendanceQueue';
import { useTrainingSession } from '@/features/sessions';
import type { AttendanceStatus } from '@/types/enums';
import { formatDate, formatTime } from '@/lib/utils/date';

const ATTENDANCE_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' },
];

export default function AttendanceSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { academyId } = useActiveAcademy();
  const canManage = useCan('attendance:mark');
  const sessionQuery = useTrainingSession(sessionId ?? null, academyId);
  const attendanceQuery = useSessionAttendance(sessionId ?? null, academyId);
  const markAttendance = useMarkAttendance(academyId as string);
  const markAllPresent = useMarkAllPresent(academyId as string);
  const pushToast = useUiStore((state) => state.pushToast);

  const { queuedItems, queuedByPlayer, queueAttendance, queueAllPresent, triggerSync, isSyncing } =
    useOfflineAttendanceQueue(sessionId ?? null, academyId ?? null);

  const session = sessionQuery.data;
  const batchPlayersQuery = useBatchPlayers(session?.batchId ?? null, academyId);

  const attendanceByPlayer = useMemo(() => {
    const map = new Map<string, string>();
    // First fill from server/cache data
    if (attendanceQuery.data) {
      for (const record of attendanceQuery.data) {
        map.set(record.playerId, record.status);
      }
    }
    // Then overlay queued offline items (which take precedence)
    for (const [playerId, item] of queuedByPlayer.entries()) {
      map.set(playerId, item.status);
    }
    return map;
  }, [attendanceQuery.data, queuedByPlayer]);

  const handleMark = async (playerId: string, status: AttendanceStatus) => {
    if (!academyId || !sessionId) return;

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      await queueAttendance(playerId, status);
      pushToast({
        title: 'Saved offline in queue',
        description: 'Attendance queued locally. Will sync when connectivity returns.',
        variant: 'info',
      });
      return;
    }

    try {
      await markAttendance.mutateAsync({ sessionId, playerId, status });
      pushToast({ title: 'Attendance updated', variant: 'success' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isNetworkErr =
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('NetworkError') ||
        errMsg.includes('offline');

      if (isNetworkErr) {
        await queueAttendance(playerId, status);
        pushToast({
          title: 'Saved offline (connection lost)',
          description: 'Network interrupted. Queued locally to sync automatically.',
          variant: 'info',
        });
      } else {
        pushToast({
          title: 'Failed to update attendance',
          description: errMsg,
          variant: 'error',
        });
      }
    }
  };

  const handleMarkAllPresent = async () => {
    if (!academyId || !sessionId || !batchPlayersQuery.data?.length) return;
    const playerIds = batchPlayersQuery.data.map((player) => player.academyMemberId);
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      await queueAllPresent(playerIds);
      pushToast({
        title: 'All players marked present offline',
        description: 'Queued locally in IndexedDB. Will sync when connectivity returns.',
        variant: 'info',
      });
      return;
    }

    try {
      await markAllPresent.mutateAsync({ sessionId, playerIds });
      pushToast({ title: 'All players marked present', variant: 'success' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isNetworkErr =
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('NetworkError') ||
        errMsg.includes('offline');

      if (isNetworkErr) {
        await queueAllPresent(playerIds);
        pushToast({
          title: 'All players marked present offline (connection lost)',
          description: 'Queued locally in IndexedDB.',
          variant: 'info',
        });
      } else {
        pushToast({
          title: 'Failed to update attendance',
          description: errMsg,
          variant: 'error',
        });
      }
    }
  };

  const handleRetry = () => {
    if (markAttendance.variables) {
      const { playerId, status } = markAttendance.variables;
      void handleMark(playerId, status as AttendanceStatus);
    }
  };

  const totalPlayers = batchPlayersQuery.data?.length ?? 0;

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    if (batchPlayersQuery.data) {
      for (const p of batchPlayersQuery.data) {
        const status = attendanceByPlayer.get(p.academyMemberId) ?? 'absent';
        if (status === 'present') present++;
        else if (status === 'absent') absent++;
        else if (status === 'late') late++;
        else if (status === 'excused') excused++;
      }
    }
    return { present, absent, late, excused, total: totalPlayers };
  }, [batchPlayersQuery.data, attendanceByPlayer, totalPlayers]);

  if (!academyId || !sessionId) {
    return (
      <EmptyState title="No session selected" description="Select a session to mark attendance." />
    );
  }

  // Loading state skeleton
  if (sessionQuery.isPending || batchPlayersQuery.isPending || attendanceQuery.isPending) {
    return (
      <div className="animate-pulse space-y-4 pb-24 md:pb-6">
        {/* Compact header skeleton */}
        <div className="bg-surface-muted border-border-subtle/50 h-20 rounded-xl border" />
        {/* Summary strip skeleton */}
        <div className="bg-surface border-border-subtle h-16 rounded-xl border" />
        {/* Roster list skeletons */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-surface border-border-subtle h-14 rounded-xl border" />
          ))}
        </div>
      </div>
    );
  }

  // Error States
  const error = sessionQuery.error || batchPlayersQuery.error || attendanceQuery.error;
  if (sessionQuery.isError || batchPlayersQuery.isError || attendanceQuery.isError) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void sessionQuery.refetch();
          void batchPlayersQuery.refetch();
          void attendanceQuery.refetch();
        }}
      />
    );
  }

  const isSaving = markAttendance.isPending || markAllPresent.isPending || isSyncing;
  const hasSaveError = markAttendance.isError || markAllPresent.isError;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* 1. App Bar Header */}
      <div className="border-border-subtle/40 flex flex-col gap-2.5 border-b pb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/sessions')}
            className="text-fg hover:bg-surface-muted/60 h-auto px-2 py-1 font-semibold"
          >
            &larr; Back
          </Button>
          <h1 className="font-heading text-fg text-2xl font-extrabold tracking-tight uppercase">
            Attendance
          </h1>
        </div>
        {session && (
          <div className="text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1.5 font-sans text-xs">
            <span className="text-fg font-bold">{session.title}</span>
            {session.batch?.name && (
              <span className="bg-surface-muted text-fg inline-flex items-center rounded px-2 py-0.5 font-semibold">
                {session.batch.name}
              </span>
            )}
            <span className="bg-surface-muted/60 border-border-subtle/40 rounded border px-2 py-0.5 font-mono text-[11px]">
              {formatDate(session.sessionDate)}
            </span>
            <span className="bg-surface-muted/60 border-border-subtle/40 rounded border px-2 py-0.5 font-mono text-[11px]">
              {formatTime(session.startAt)} – {formatTime(session.endAt)}
            </span>
            <span className="bg-primary-pale text-primary border-primary/20 rounded border px-2 py-0.5 font-mono text-[11px] font-bold">
              {totalPlayers} PLAYERS
            </span>
          </div>
        )}
      </div>

      {/* Offline Queue Session Banner */}
      {queuedItems.length > 0 && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 sm:flex-row sm:items-center dark:text-amber-200">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/20 p-2 text-amber-600 dark:text-amber-300">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {queuedItems.length === 1
                  ? '1 attendance update queued offline'
                  : `${queuedItems.length} attendance updates queued offline`}
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                Stored safely in IndexedDB. Syncs automatically when online.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void triggerSync()}
            isLoading={isSyncing}
            className="border-amber-500/30 text-xs font-semibold hover:bg-amber-500/20"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Sync Now
          </Button>
        </div>
      )}

      {/* 2. Summary Strip (5 columns scorecard) */}
      <div className="border-border-subtle bg-surface divide-border-subtle grid grid-cols-5 divide-x overflow-hidden rounded-xl border shadow-2xs">
        <div className="flex min-w-0 flex-col items-center justify-center px-1 py-2.5">
          <span className="text-fg-muted font-heading truncate text-[10px] font-bold tracking-wider uppercase">
            Pres
          </span>
          <span className="text-success mt-0.5 font-mono text-base font-extrabold">
            {counts.present}
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-center justify-center px-1 py-2.5">
          <span className="text-fg-muted font-heading truncate text-[10px] font-bold tracking-wider uppercase">
            Abs
          </span>
          <span className="text-error mt-0.5 font-mono text-base font-extrabold">
            {counts.absent}
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-center justify-center px-1 py-2.5">
          <span className="text-fg-muted font-heading truncate text-[10px] font-bold tracking-wider uppercase">
            Late
          </span>
          <span className="text-saffron mt-0.5 font-mono text-base font-extrabold">
            {counts.late}
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-center justify-center px-1 py-2.5">
          <span className="text-fg-muted font-heading truncate text-[10px] font-bold tracking-wider uppercase">
            Exc
          </span>
          <span className="text-fg-muted mt-0.5 font-mono text-base font-extrabold">
            {counts.excused}
          </span>
        </div>
        <div className="bg-surface-muted/30 flex min-w-0 flex-col items-center justify-center px-1 py-2.5">
          <span className="text-fg-muted font-heading truncate text-[10px] font-bold tracking-wider uppercase">
            Total
          </span>
          <span className="text-fg mt-0.5 font-mono text-base font-extrabold">{counts.total}</span>
        </div>
      </div>

      {/* 3. Operational Mark All Present Button */}
      {canManage && totalPlayers > 0 && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleMarkAllPresent()}
            isLoading={markAllPresent.isPending}
            className="border-border-subtle bg-surface text-fg hover:bg-surface-muted/50 min-h-[38px] rounded-[10px] border px-3 text-xs font-bold"
          >
            Mark All Present
          </Button>
        </div>
      )}

      {/* 4. Roster List work surface */}
      {totalPlayers === 0 ? (
        <EmptyState
          title="No players assigned"
          description="There are no players assigned to this batch."
        />
      ) : (
        <div className="border-border-subtle bg-surface divide-border-subtle/60 divide-y overflow-hidden rounded-xl border shadow-2xs">
          {batchPlayersQuery.data?.map((player) => {
            const currentStatus = attendanceByPlayer.get(player.academyMemberId) ?? 'absent';
            const queuedItem = queuedByPlayer.get(player.academyMemberId);
            const isPlayerSaving =
              markAttendance.isPending &&
              markAttendance.variables?.playerId === player.academyMemberId;

            const initials = (player.fullName || player.email || 'P')
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div
                key={player.id}
                className="hover:bg-surface-muted/20 flex min-h-[44px] flex-col gap-3 p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Player Initials + Name + Email */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="bg-surface-muted border-border-subtle text-fg-muted font-heading flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-fg truncate font-sans text-sm font-bold">
                        {player.fullName || player.email}
                      </span>
                      {queuedItem && queuedItem.statusState === 'queued' && (
                        <span className="border-saffron/20 bg-saffron-pale text-saffron inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase">
                          Queued
                        </span>
                      )}
                      {queuedItem && queuedItem.statusState === 'error' && (
                        <span className="border-error/20 bg-error-pale text-error inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase">
                          Error
                        </span>
                      )}
                    </div>
                    <span className="text-fg-muted mt-0.5 block truncate font-sans text-xs">
                      {player.email}
                    </span>
                  </div>
                </div>

                {/* Status Options Toggles (Touch targets >= 44px) */}
                <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {ATTENDANCE_OPTIONS.map((option) => {
                    const isSelected = currentStatus === option.value;

                    let btnStyle = 'text-fg-muted hover:bg-surface-muted/60';
                    if (isSelected) {
                      if (option.value === 'present') {
                        btnStyle = 'bg-success text-white border-success hover:opacity-90';
                      } else if (option.value === 'absent') {
                        btnStyle = 'bg-error text-white border-error hover:opacity-90';
                      } else if (option.value === 'late') {
                        btnStyle = 'bg-saffron text-white border-saffron hover:opacity-90';
                      } else if (option.value === 'excused') {
                        btnStyle = 'bg-fg-muted text-white border-fg-muted hover:opacity-90';
                      }
                    }

                    return (
                      <button
                        key={option.value}
                        disabled={isPlayerSaving}
                        onClick={async () => {
                          if (isSelected || isPlayerSaving) return;
                          await handleMark(player.academyMemberId, option.value);
                        }}
                        className={`border-border-subtle flex h-11 min-h-[44px] min-w-[70px] shrink-0 items-center justify-center rounded-[10px] border px-3 text-xs font-bold transition-all ${btnStyle}`}
                      >
                        {isPlayerSaving && markAttendance.variables?.status === option.value ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          option.label
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Sticky Save Area */}
      <div className="bg-surface/95 border-border-subtle/80 sticky bottom-0 z-30 -mx-4 -mb-4 flex items-center justify-between gap-3 border-t px-4 py-3.5 shadow-lg backdrop-blur-xs">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isSaving ? (
            <span className="text-fg-muted flex items-center gap-1.5 font-sans text-xs font-bold">
              <span className="border-primary h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
              Saving changes...
            </span>
          ) : hasSaveError ? (
            <span className="text-error flex min-w-0 items-center gap-1.5 truncate font-sans text-xs font-bold">
              <AlertCircle className="text-error h-4 w-4 shrink-0" />
              Save failed
            </span>
          ) : (
            <span className="text-success flex items-center gap-1.5 font-sans text-xs font-bold">
              <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
              All changes saved
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasSaveError && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRetry}
              className="border-error/20 text-error hover:bg-error-pale h-11 min-h-[44px] rounded-[10px] px-3 text-xs font-bold"
            >
              Retry
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => navigate('/sessions')}
            className="bg-primary h-11 min-h-[44px] rounded-[10px] px-4 text-xs font-bold text-white hover:opacity-90"
          >
            Save & Exit
          </Button>
        </div>
      </div>
    </div>
  );
}
