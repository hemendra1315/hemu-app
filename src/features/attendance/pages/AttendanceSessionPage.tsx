import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Check,
  X,
  CheckCheck,
} from 'lucide-react';

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

  // Ground Mode: Inverted Attendance Logic
  // Any player without an explicit saved/queued status defaults to 'present'
  const attendanceByPlayer = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    if (batchPlayersQuery.data) {
      for (const p of batchPlayersQuery.data) {
        // Ground Mode Default: Present
        map.set(p.academyMemberId, 'present');
      }
    }
    if (attendanceQuery.data) {
      for (const record of attendanceQuery.data) {
        map.set(record.playerId, record.status as AttendanceStatus);
      }
    }
    for (const [playerId, item] of queuedByPlayer.entries()) {
      map.set(playerId, item.status as AttendanceStatus);
    }
    return map;
  }, [batchPlayersQuery.data, attendanceQuery.data, queuedByPlayer]);

  const handleMark = async (playerId: string, status: AttendanceStatus) => {
    if (!academyId || !sessionId) return;

    // Haptic feedback for tactile ground confirmation
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      await queueAttendance(playerId, status);
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
          title: 'Saved offline',
          description: 'Network interrupted. Queued locally to sync.',
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

  const handleTogglePlayer = async (playerId: string) => {
    if (!canManage) return;
    const currentStatus = attendanceByPlayer.get(playerId) ?? 'present';
    const nextStatus: AttendanceStatus = currentStatus === 'absent' ? 'present' : 'absent';
    await handleMark(playerId, nextStatus);
  };

  const handleMarkAllPresent = async () => {
    if (!academyId || !sessionId || !batchPlayersQuery.data?.length) return;
    const playerIds = batchPlayersQuery.data.map((player) => player.academyMemberId);

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 50, 30]);
    }

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      await queueAllPresent(playerIds);
      pushToast({
        title: 'All marked present offline',
        description: 'Queued locally in IndexedDB.',
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
          title: 'All marked present offline',
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
        if (status === 'absent') {
          absent++;
        } else {
          present++;
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
      <div className="animate-pulse space-y-4 pb-28 md:pb-6">
        <div className="bg-surface-muted/50 border-border-subtle h-20 rounded-2xl border" />
        <div className="bg-surface border-border-subtle h-16 rounded-2xl border" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-surface border-border-subtle h-16 rounded-2xl border" />
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
    <div className="flex flex-col space-y-3.5 pb-32 md:pb-8">
      {/* 1. Outdoor High-Contrast Header */}
      <div className="border-border-subtle/80 flex flex-col gap-2.5 border-b pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/sessions')}
              className="border-border-subtle bg-surface text-fg hover:bg-surface-muted active:bg-surface-muted/80 flex h-11 w-11 items-center justify-center rounded-xl border font-bold shadow-xs transition-colors"
              aria-label="Back to sessions"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-fg font-heading text-xl font-black tracking-tight uppercase sm:text-2xl">
                  Ground Roll Call
                </h1>
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-black text-emerald-700 uppercase dark:text-emerald-300">
                  Ground Mode
                </span>
              </div>
              {session && (
                <p className="text-fg-muted font-sans text-xs font-semibold">
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
              className="h-10 min-h-[40px] shrink-0 rounded-xl border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-300"
            >
              <CheckCheck className="mr-1.5 h-4 w-4 text-emerald-600" />
              All Present
            </Button>
          )}
        </div>

        {/* High-Contrast Ground Instruction Banner */}
        <div className="flex items-center justify-between rounded-xl bg-slate-900 px-3.5 py-2.5 text-white dark:bg-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span>Default: All Present. Tap ONLY who is absent.</span>
          </div>
          <span className="font-mono text-[11px] font-extrabold text-slate-300">
            {counts.present}/{counts.total} Present
          </span>
        </div>

        {session && (
          <div className="text-fg-muted flex flex-wrap items-center gap-2 font-mono text-xs font-bold">
            <span className="border-border-subtle bg-surface-container-low rounded-lg border px-2.5 py-1">
              {formatDate(session.sessionDate)}
            </span>
            <span className="border-border-subtle bg-surface-container-low rounded-lg border px-2.5 py-1">
              {formatTime(session.startAt)} – {formatTime(session.endAt)}
            </span>
          </div>
        )}
      </div>

      {/* Offline Queue Notification Banner */}
      {queuedItems.length > 0 && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/15 p-3.5 text-amber-950 sm:flex-row sm:items-center dark:text-amber-100">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/25 p-2 text-amber-600 dark:text-amber-300">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />
            </div>
            <div>
              <p className="font-heading text-xs font-black tracking-wide uppercase">
                {queuedItems.length === 1
                  ? '1 Roll Call Update Queued Offline'
                  : `${queuedItems.length} Roll Call Updates Queued Offline`}
              </p>
              <p className="text-[11px] font-semibold text-amber-900/90 dark:text-amber-200/90">
                Ground records safe in offline storage. Auto-syncs on reconnect.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void triggerSync()}
            isLoading={isSyncing}
            className="h-9 border-amber-500/40 text-xs font-bold hover:bg-amber-500/20"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Sync Now
          </Button>
        </div>
      )}

      {/* 2. Live Ground Scorecard Telemetry Strip */}
      <div className="divide-border-subtle border-border-subtle bg-surface grid grid-cols-3 divide-x overflow-hidden rounded-2xl border shadow-xs">
        <div className="flex flex-col items-center justify-center bg-emerald-500/5 p-3">
          <span className="font-heading text-[11px] font-extrabold tracking-wider text-emerald-800 uppercase dark:text-emerald-300">
            Present
          </span>
          <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {counts.present}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center bg-rose-500/5 p-3">
          <span className="font-heading text-[11px] font-extrabold tracking-wider text-rose-800 uppercase dark:text-rose-300">
            Absent
          </span>
          <span className="font-mono text-2xl font-black text-rose-600 dark:text-rose-400">
            {counts.absent}
          </span>
        </div>
        <div className="bg-surface-container-low/60 flex flex-col items-center justify-center p-3">
          <span className="font-heading text-fg-muted text-[11px] font-extrabold tracking-wider uppercase">
            Total Squad
          </span>
          <span className="text-fg font-mono text-2xl font-black">{counts.total}</span>
        </div>
      </div>

      {/* 3. 56px Full-Row Tappable Ground Mode Roster */}
      {totalPlayers === 0 ? (
        <EmptyState
          title="No players assigned"
          description="There are no active players assigned to this batch."
        />
      ) : (
        <div className="divide-border-subtle/80 border-border-subtle bg-surface divide-y overflow-hidden rounded-2xl border shadow-xs">
          {batchPlayersQuery.data?.map((player) => {
            const currentStatus = attendanceByPlayer.get(player.academyMemberId) ?? 'present';
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

            const isPresent = currentStatus !== 'absent';
            const isAbsent = currentStatus === 'absent';

            return (
              <div
                key={player.id}
                role="button"
                tabIndex={0}
                onClick={() => void handleTogglePlayer(player.academyMemberId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void handleTogglePlayer(player.academyMemberId);
                  }
                }}
                aria-label={`${player.fullName || 'player'}: currently marked ${
                  isPresent ? 'present' : 'absent'
                }. Tap to toggle.`}
                className={`group flex min-h-[58px] cursor-pointer items-center justify-between gap-3 p-3.5 transition-all select-none active:scale-[0.99] ${
                  isAbsent
                    ? 'bg-rose-500/10 hover:bg-rose-500/15 dark:bg-rose-950/30'
                    : 'hover:bg-emerald-500/5'
                }`}
              >
                {/* Player Identity Block */}
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                  <div
                    className={`font-heading flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xs font-black transition-colors ${
                      isPresent
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                        : 'border-rose-500/50 bg-rose-500/20 text-rose-800 dark:text-rose-200'
                    }`}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`truncate font-sans text-sm font-extrabold ${
                          isAbsent ? 'text-rose-900 line-through dark:text-rose-200' : 'text-fg'
                        }`}
                      >
                        {player.fullName || player.email}
                      </span>
                      {queuedItem && (
                        <span className="py-0.2 inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/20 px-1.5 font-mono text-[9px] font-black text-amber-800 uppercase dark:text-amber-200">
                          Queued
                        </span>
                      )}
                    </div>
                    <span className="text-fg-muted block truncate font-sans text-xs font-medium">
                      {player.email}
                    </span>
                  </div>
                </div>

                {/* 56px Touch Target Status Badge */}
                <div className="flex shrink-0 items-center">
                  {isPlayerSaving ? (
                    <div className="flex h-11 min-w-[100px] items-center justify-center rounded-xl border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-transparent dark:border-slate-300" />
                    </div>
                  ) : isPresent ? (
                    <div className="flex h-11 min-w-[100px] items-center justify-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 px-3 text-xs font-black tracking-wide text-white uppercase shadow-xs">
                      <Check className="h-4 w-4 stroke-[3]" />
                      <span>Present</span>
                    </div>
                  ) : (
                    <div className="flex h-11 min-w-[100px] items-center justify-center gap-1.5 rounded-xl border border-rose-600 bg-rose-600 px-3 text-xs font-black tracking-wide text-white uppercase shadow-xs">
                      <X className="h-4 w-4 stroke-[3]" />
                      <span>Absent</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Sticky Bottom Action Bar (Thumb-Zone Optimized) */}
      <div className="border-border-subtle bg-surface/98 fixed right-0 bottom-0 left-0 z-40 flex items-center justify-between gap-3 border-t px-4 py-3 shadow-2xl backdrop-blur-md">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {isSaving ? (
            <span className="text-fg-muted flex items-center gap-1.5 font-sans text-xs font-bold">
              <span className="border-primary h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent" />
              Saving Ground State...
            </span>
          ) : hasSaveError ? (
            <span className="flex min-w-0 items-center gap-1.5 truncate font-sans text-xs font-bold text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Sync Interrupted
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="leading-tight">
                <span className="text-fg block text-xs font-black">
                  {counts.present} Present · {counts.absent} Absent
                </span>
                <span className="text-fg-muted block text-[11px] font-medium">
                  {queuedItems.length > 0 ? 'Saved locally' : 'Live synced'}
                </span>
              </div>
            </div>
          )}
        </div>

        <Button
          variant="primary"
          onClick={() => navigate('/sessions')}
          className="h-12 min-h-[48px] rounded-xl bg-emerald-600 px-6 text-sm font-black text-white shadow-md hover:bg-emerald-700 active:scale-95"
        >
          Confirm Attendance
        </Button>
      </div>
    </div>
  );
}
