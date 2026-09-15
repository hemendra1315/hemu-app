import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw, AlertCircle, CheckCircle2, ArrowLeft, Check, X } from 'lucide-react';

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
    const map = new Map<string, AttendanceStatus>();
    if (attendanceQuery.data) {
      for (const record of attendanceQuery.data) {
        map.set(record.playerId, record.status as AttendanceStatus);
      }
    }
    for (const [playerId, item] of queuedByPlayer.entries()) {
      map.set(playerId, item.status as AttendanceStatus);
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
        description: 'Attendance queued locally. Will sync when online.',
        variant: 'info',
      });
      return;
    }

    try {
      await markAttendance.mutateAsync({ sessionId, playerId, status });
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
        description: 'Queued locally in IndexedDB. Will sync when online.',
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

  const totalPlayers = batchPlayersQuery.data?.length ?? 0;

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    if (batchPlayersQuery.data) {
      for (const p of batchPlayersQuery.data) {
        const status = attendanceByPlayer.get(p.academyMemberId);
        if (status === 'present') {
          present++;
        } else if (status === 'absent') {
          absent++;
        }
      }
    }
    return { present, absent, total: totalPlayers };
  }, [batchPlayersQuery.data, attendanceByPlayer, totalPlayers]);

  if (!academyId || !sessionId) {
    return (
      <EmptyState title="No session selected" description="Select a session to mark attendance." />
    );
  }

  const isLoading =
    sessionQuery.isLoading ||
    (Boolean(session?.batchId) && batchPlayersQuery.isLoading) ||
    attendanceQuery.isLoading;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 pb-24 md:pb-6">
        <div className="bg-surface-muted/50 border-border-subtle h-20 rounded-xl border" />
        <div className="bg-surface border-border-subtle h-16 rounded-xl border" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-surface border-border-subtle h-14 rounded-xl border" />
          ))}
        </div>
      </div>
    );
  }

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
    <div className="flex flex-col space-y-4 pb-28 md:pb-6">
      {/* 1. Header & Context */}
      <div className="border-border-subtle/40 flex flex-col gap-2 border-b pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/sessions')}
              className="border-border-subtle bg-surface text-fg-muted hover:text-fg hover:bg-surface-muted flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
              aria-label="Back to sessions"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="font-heading text-fg text-xl font-extrabold tracking-tight uppercase md:text-2xl">
                Mark Attendance
              </h1>
              {session && (
                <p className="text-fg-muted font-sans text-xs">
                  {session.title} {session.batch?.name ? `• ${session.batch.name}` : ''}
                </p>
              )}
            </div>
          </div>

          {canManage && totalPlayers > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleMarkAllPresent()}
              isLoading={markAllPresent.isPending}
              className="border-border-subtle bg-surface text-fg hover:bg-surface-muted h-9 min-h-[36px] rounded-lg text-xs font-bold"
            >
              <Check className="text-success mr-1.5 h-3.5 w-3.5" />
              All Present
            </Button>
          )}
        </div>

        {session && (
          <div className="text-fg-muted flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="border-border-subtle/50 bg-surface-container-low rounded border px-2 py-0.5">
              {formatDate(session.sessionDate)}
            </span>
            <span className="border-border-subtle/50 bg-surface-container-low rounded border px-2 py-0.5">
              {formatTime(session.startAt)} – {formatTime(session.endAt)}
            </span>
            <span className="border-primary/20 bg-primary-pale text-primary rounded border px-2 py-0.5 font-bold">
              {totalPlayers} SQUAD MEMBERS
            </span>
          </div>
        )}
      </div>

      {/* Offline Queue Session Banner */}
      {queuedItems.length > 0 && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-900 sm:flex-row sm:items-center dark:text-amber-200">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/20 p-2 text-amber-600 dark:text-amber-300">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            </div>
            <div>
              <p className="font-heading text-xs font-bold uppercase">
                {queuedItems.length === 1
                  ? '1 update queued offline'
                  : `${queuedItems.length} updates queued offline`}
              </p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                IndexedDB queue active. Automatically syncs when online.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void triggerSync()}
            isLoading={isSyncing}
            className="h-8 border-amber-500/30 text-xs font-semibold hover:bg-amber-500/20"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Sync Now
          </Button>
        </div>
      )}

      {/* 2. Scorecard Telemetry Strip (3 Columns: Present, Absent, Total) */}
      <div className="divide-border-subtle border-border-subtle bg-surface grid grid-cols-3 divide-x overflow-hidden rounded-xl border shadow-2xs">
        <div className="flex flex-col items-center justify-center p-3">
          <span className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
            Present
          </span>
          <span className="text-success mt-0.5 font-mono text-xl font-extrabold">
            {counts.present}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center p-3">
          <span className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
            Absent
          </span>
          <span className="text-error mt-0.5 font-mono text-xl font-extrabold">
            {counts.absent}
          </span>
        </div>
        <div className="bg-surface-container-low/40 flex flex-col items-center justify-center p-3">
          <span className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
            Roster Size
          </span>
          <span className="text-fg mt-0.5 font-mono text-xl font-extrabold">{counts.total}</span>
        </div>
      </div>

      {/* 3. Player Attendance List */}
      {totalPlayers === 0 ? (
        <EmptyState
          title="No players assigned"
          description="There are no active players assigned to this batch."
        />
      ) : (
        <div className="divide-border-subtle/50 border-border-subtle bg-surface divide-y overflow-hidden rounded-xl border shadow-2xs">
          {batchPlayersQuery.data?.map((player) => {
            const currentStatus = attendanceByPlayer.get(player.academyMemberId) ?? null;
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

            const isPresent = currentStatus === 'present';
            const isAbsent = currentStatus === 'absent';

            return (
              <div
                key={player.id}
                className="hover:bg-surface-muted/20 flex items-center justify-between gap-3 p-3.5 transition-colors"
              >
                {/* Player Initials + Name */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={`font-heading flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                      isPresent
                        ? 'border-success/40 bg-success-pale text-success'
                        : isAbsent
                          ? 'border-error/40 bg-error-pale text-error'
                          : 'border-border-subtle bg-surface-muted text-fg-muted'
                    }`}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-fg truncate font-sans text-sm font-bold">
                        {player.fullName || player.email}
                      </span>
                      {queuedItem && (
                        <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-500 uppercase">
                          Queued
                        </span>
                      )}
                    </div>
                    <span className="text-fg-muted block truncate font-sans text-xs">
                      {player.email}
                    </span>
                  </div>
                </div>

                {/* 2-State High-Speed Action Buttons (Present vs Absent) */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isPlayerSaving || !canManage}
                    onClick={async () => {
                      if (isPresent || isPlayerSaving) return;
                      await handleMark(player.academyMemberId, 'present');
                    }}
                    aria-label={`Mark ${player.fullName || 'player'} present`}
                    className={`flex h-10 min-w-[76px] items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-all ${
                      isPresent
                        ? 'border-success bg-success text-white shadow-xs'
                        : 'border-border-subtle bg-surface text-fg-muted hover:border-success/40 hover:bg-success-pale/30 hover:text-success'
                    }`}
                  >
                    {isPlayerSaving && markAttendance.variables?.status === 'present' ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Present</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isPlayerSaving || !canManage}
                    onClick={async () => {
                      if (isAbsent || isPlayerSaving) return;
                      await handleMark(player.academyMemberId, 'absent');
                    }}
                    aria-label={`Mark ${player.fullName || 'player'} absent`}
                    className={`flex h-10 min-w-[76px] items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-all ${
                      isAbsent
                        ? 'border-error bg-error text-white shadow-xs'
                        : 'border-border-subtle bg-surface text-fg-muted hover:border-error/40 hover:bg-error-pale/30 hover:text-error'
                    }`}
                  >
                    {isPlayerSaving && markAttendance.variables?.status === 'absent' ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <>
                        <X className="h-3.5 w-3.5" />
                        <span>Absent</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Sticky Status Footer */}
      <div className="border-border-subtle bg-surface/95 sticky bottom-0 z-30 -mx-4 -mb-4 flex items-center justify-between gap-3 border-t px-4 py-3 shadow-lg backdrop-blur-xs">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isSaving ? (
            <span className="text-fg-muted flex items-center gap-1.5 font-sans text-xs font-bold">
              <span className="border-primary h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
              Saving changes...
            </span>
          ) : hasSaveError ? (
            <span className="text-error flex min-w-0 items-center gap-1.5 truncate font-sans text-xs font-bold">
              <AlertCircle className="text-error h-4 w-4 shrink-0" />
              Sync failed
            </span>
          ) : (
            <span className="text-success flex items-center gap-1.5 font-sans text-xs font-bold">
              <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
              Attendance Saved
            </span>
          )}
        </div>
        <Button
          variant="primary"
          onClick={() => navigate('/sessions')}
          className="h-10 min-h-[40px] rounded-lg px-5 text-xs font-bold text-white"
        >
          Done
        </Button>
      </div>
    </div>
  );
}
