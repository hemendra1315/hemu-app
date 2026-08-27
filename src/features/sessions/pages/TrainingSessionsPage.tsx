import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import 'react-datepicker/dist/react-datepicker.css';
import { Link } from 'react-router-dom';

import { TimeRangePicker } from '@/components/form';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { MobileEmptyState } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { useAcademyMembers } from '@/features/members';
import { logger } from '@/lib/logger';
import { useCan } from '@/lib/rbac';
import { useUiStore } from '@/stores';
import type { UUID } from '@/types';
import type { CreateTrainingSessionInput } from '../api/sessionsTypes';
import { useBatches } from '@/features/batches';
import { useCreateTrainingSession, useTrainingSessions } from '../hooks/useSessions';
import { formatDate, formatTime, isTimeRangeValid, isToday } from '@/lib/utils/date';

type FormValues = Omit<CreateTrainingSessionInput, 'academyId' | 'startAt' | 'endAt'>;

const DEFAULT_FORM_VALUES: FormValues = {
  batchId: '',
  title: '',
  focusArea: null,
  sessionDate: '',
  coachId: '',
  status: 'scheduled',
  notes: null,
};

function toIsoTimestamp(sessionDate: string, time: Date): string {
  const date = new Date(`${sessionDate}T00:00:00`);
  date.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return date.toISOString();
}

export default function TrainingSessionsPage() {
  const { academyId } = useActiveAcademy();
  const canManage = useCan('sessions:manage');
  const sessionsQuery = useTrainingSessions(academyId);
  const batchesQuery = useBatches(academyId);
  const membersQuery = useAcademyMembers(academyId, { status: 'active' });
  const createSession = useCreateTrainingSession(academyId as UUID);
  const pushToast = useUiStore((state) => state.pushToast);
  const [showForm, setShowForm] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);

  const coaches = useMemo(
    () => membersQuery.data?.filter((member) => member.role === 'coach') ?? [],
    [membersQuery.data],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ defaultValues: DEFAULT_FORM_VALUES });

  const handleCreate = handleSubmit(async (values) => {
    if (!academyId) return;

    if (!startTime || !endTime) {
      pushToast({
        title: 'Select training time',
        variant: 'error',
      });
      return;
    }

    if (!isTimeRangeValid(startTime, endTime)) {
      pushToast({
        title: 'End time must be after start time.',
        variant: 'error',
      });
      return;
    }

    try {
      await createSession.mutateAsync({
        academyId,
        batchId: values.batchId,
        title: values.title,
        focusArea: values.focusArea,
        sessionDate: values.sessionDate,
        startAt: toIsoTimestamp(values.sessionDate, startTime),
        endAt: toIsoTimestamp(values.sessionDate, endTime),
        coachId: values.coachId,
        status: values.status,
        notes: values.notes,
      });
      pushToast({ title: 'Session created', variant: 'success' });
      reset(DEFAULT_FORM_VALUES);
      setStartTime(null);
      setEndTime(null);
      setShowForm(false);
    } catch (error) {
      logger.error('create_session_failed', { error });
      pushToast({ title: 'Failed to create session', variant: 'error' });
    }
  });

  const [sessionFilter, setSessionFilter] = useState<'today' | 'upcoming' | 'completed' | 'all'>(
    'all',
  );

  const filteredSessions = useMemo(() => {
    if (!sessionsQuery.data) return [];
    if (sessionFilter === 'today') {
      return sessionsQuery.data.filter((s) => isToday(s.sessionDate));
    }
    if (sessionFilter === 'upcoming') {
      return sessionsQuery.data.filter((s) => s.status === 'scheduled');
    }
    if (sessionFilter === 'completed') {
      return sessionsQuery.data.filter((s) => s.status === 'completed');
    }
    return sessionsQuery.data;
  }, [sessionsQuery.data, sessionFilter]);

  if (!academyId) return null;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* 1. App Bar Header */}
      <div className="border-border-subtle/40 flex flex-col gap-2 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-fg text-2xl font-extrabold tracking-tight uppercase md:text-3xl">
            Sessions
          </h1>
          {canManage && (
            <Button
              variant={showForm ? 'secondary' : 'primary'}
              onClick={() => setShowForm((prev) => !prev)}
              className="min-h-[44px] rounded-[10px] px-4 text-xs font-bold"
            >
              {showForm ? 'Cancel' : 'New Session'}
            </Button>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-surface-muted border-border-subtle/50 text-fg-muted rounded border px-2 py-0.5 font-mono text-[11px] font-bold uppercase">
              {sessionsQuery.data?.length ?? 0} SESSIONS
            </span>
            <span className="text-fg-muted font-mono text-[10px] font-bold tracking-wider uppercase">
              {new Date().toLocaleDateString([], {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: '2-digit',
              })}
            </span>
          </div>
          <div className="overflow-x-auto pb-1 sm:pb-0">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'today', label: 'Today' },
                { id: 'upcoming', label: 'Upcoming' },
                { id: 'completed', label: 'Completed' },
              ].map((chip) => {
                const isActive = sessionFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() =>
                      setSessionFilter(chip.id as 'today' | 'upcoming' | 'completed' | 'all')
                    }
                    className={`h-8 min-h-[32px] rounded-full border px-3 text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-primary border-primary text-white shadow-2xs'
                        : 'bg-surface text-fg-muted border-border-subtle hover:bg-surface-muted/50'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showForm && canManage ? (
        <div className="border-border-subtle bg-surface rounded-xl border p-4 shadow-2xs">
          <form onSubmit={handleCreate} noValidate>
            <div className="border-border-subtle/50 mb-4 border-b pb-3">
              <h2 className="font-heading text-fg text-lg font-extrabold tracking-tight uppercase">
                Create Session
              </h2>
              <p className="text-fg-muted mt-0.5 font-sans text-xs">
                Schedule a practice or training session for a batch
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
                    Batch
                  </label>
                  <Select
                    {...register('batchId', { required: 'Batch is required' })}
                    hasError={Boolean(errors.batchId)}
                    className="border-border-subtle h-11 min-h-[44px] rounded-lg"
                  >
                    <option value="">Select batch</option>
                    {batchesQuery.data?.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name} ({batch.ageGroup})
                      </option>
                    ))}
                  </Select>
                  {errors.batchId ? (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.batchId.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="font-heading text-fg-muted mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
                    Coach
                  </label>
                  <Select
                    {...register('coachId', { required: 'Coach is required' })}
                    hasError={Boolean(errors.coachId)}
                    className="border-border-subtle h-11 min-h-[44px] rounded-lg"
                  >
                    <option value="">Select coach</option>
                    {coaches.map((coach) => (
                      <option key={coach.id} value={coach.id}>
                        {coach.fullName ?? coach.email}
                      </option>
                    ))}
                  </Select>
                  {errors.coachId ? (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.coachId.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
                    Title
                  </label>
                  <Input
                    {...register('title', { required: 'Title is required' })}
                    hasError={Boolean(errors.title)}
                    className="border-border-subtle h-11 min-h-[44px] rounded-lg"
                  />
                  {errors.title ? (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.title.message}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="font-heading text-fg-muted mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
                    Focus area
                  </label>
                  <Input
                    {...register('focusArea')}
                    className="border-border-subtle h-11 min-h-[44px] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
                    Session date
                  </label>
                  <Input
                    {...register('sessionDate', { required: 'Session date is required' })}
                    type="date"
                    hasError={Boolean(errors.sessionDate)}
                    className="border-border-subtle h-11 min-h-[44px] rounded-lg font-mono"
                  />
                  {errors.sessionDate ? (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.sessionDate.message}
                    </p>
                  ) : null}
                </div>
                <TimeRangePicker
                  label="Session time"
                  startTime={startTime}
                  endTime={endTime}
                  onStartTimeChange={setStartTime}
                  onEndTimeChange={setEndTime}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
                    Status
                  </label>
                  <Select
                    {...register('status')}
                    className="border-border-subtle h-11 min-h-[44px] rounded-lg"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="font-heading text-fg-muted mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
                  Notes
                </label>
                <Textarea
                  {...register('notes')}
                  rows={4}
                  className="border-border-subtle rounded-lg"
                />
              </div>
            </div>
            <div className="border-border-subtle/40 mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
                className="h-11 min-h-[44px] rounded-[10px] px-4 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={createSession.isPending}
                disabled={!isDirty}
                className="h-11 min-h-[44px] rounded-[10px] px-5 text-xs font-bold"
              >
                Create Session
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* 2. Sessions List */}
      <div className="min-w-0">
        {sessionsQuery.isPending ? (
          <p className="text-fg-muted py-8 text-center font-sans text-sm">Loading sessions…</p>
        ) : sessionsQuery.isError ? (
          <ErrorState error={sessionsQuery.error} onRetry={() => void sessionsQuery.refetch()} />
        ) : filteredSessions.length === 0 ? (
          <MobileEmptyState
            title="No sessions"
            description="No training sessions match your selected filter."
            action={
              canManage ? { label: 'Create Session', onClick: () => setShowForm(true) } : undefined
            }
          />
        ) : (
          <div className="border-border-subtle bg-surface divide-border-subtle/50 divide-y overflow-hidden rounded-xl border shadow-2xs">
            {filteredSessions.map((session) => {
              const isSessionToday = isToday(session.sessionDate);
              const isPast = session.status === 'completed' || session.status === 'cancelled';
              const rowBg = isSessionToday
                ? 'bg-saffron-pale hover:bg-saffron-pale/80'
                : isPast
                  ? 'opacity-85 hover:bg-surface-muted/20'
                  : 'hover:bg-surface-muted/10';

              return (
                <div
                  key={session.id}
                  className={`flex flex-col justify-between gap-4 p-4 transition-colors sm:flex-row sm:items-center ${rowBg}`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div className="flex shrink-0 flex-col items-start gap-1 pt-0.5">
                      <span className="text-fg font-mono text-xs font-bold tracking-wider uppercase">
                        {formatTime(session.startAt)} - {formatTime(session.endAt)}
                      </span>
                      <span className="text-fg-muted font-mono text-[10px] uppercase">
                        {formatDate(session.sessionDate)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/sessions/${session.id}`}
                        className="text-fg font-heading block truncate text-sm font-bold tracking-tight uppercase hover:underline"
                      >
                        {session.title}
                      </Link>
                      <div className="text-fg-muted mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-xs">
                        {session.batch?.name && (
                          <span className="bg-surface-muted border-border-subtle/50 text-fg-muted rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold">
                            BATCH: {session.batch.name}
                          </span>
                        )}
                        {session.coach?.fullName && <span>• Coach: {session.coach.fullName}</span>}
                        {session.focusArea && (
                          <span className="truncate">• Focus: {session.focusArea}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 font-sans text-[10px] font-bold uppercase ${
                        session.status === 'completed'
                          ? 'bg-success-pale text-success border-success/30'
                          : session.status === 'cancelled'
                            ? 'bg-error-pale text-error border-error/30'
                            : 'bg-saffron-pale text-saffron border-saffron/30'
                      }`}
                    >
                      {session.status}
                    </span>

                    {canManage ? (
                      <Link
                        to={`/sessions/${session.id}/attendance`}
                        className="bg-primary flex min-h-[38px] shrink-0 items-center justify-center rounded-[10px] px-3.5 text-xs font-bold text-white shadow-2xs transition hover:opacity-90"
                      >
                        Attendance
                      </Link>
                    ) : (
                      <Link
                        to={`/sessions/${session.id}`}
                        className="bg-surface border-border-subtle hover:bg-surface-muted text-fg-muted flex min-h-[38px] shrink-0 items-center justify-center rounded-[10px] border px-3.5 text-xs font-bold transition"
                      >
                        View
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
