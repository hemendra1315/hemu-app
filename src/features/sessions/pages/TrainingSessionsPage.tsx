import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import 'react-datepicker/dist/react-datepicker.css';
import { Link } from 'react-router-dom';
import { Plus, User } from 'lucide-react';

import { TimeRangePicker } from '@/components/form';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { MobileEmptyState } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { useAcademyMembers } from '@/features/members';
import { useCan } from '@/lib/rbac';
import { useUiStore } from '@/stores';
import type { UUID } from '@/types';
import type { CreateTrainingSessionInput } from '../api/sessionsTypes';
import { useBatches } from '@/features/batches';
import { useCreateTrainingSession, useTrainingSessions } from '../hooks/useSessions';
import { formatDate, formatTime, isTimeRangeValid } from '@/lib/utils/date';

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
      console.error('Create session failed:', error);
      pushToast({ title: 'Failed to create session', variant: 'error' });
    }
  });

  const [sessionFilter, setSessionFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>(
    'all',
  );

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredSessions = useMemo(() => {
    if (!sessionsQuery.data) return [];
    if (sessionFilter === 'today') {
      return sessionsQuery.data.filter((s) => s.sessionDate === todayStr);
    }
    if (sessionFilter === 'upcoming') {
      return sessionsQuery.data.filter((s) => s.status === 'scheduled');
    }
    if (sessionFilter === 'completed') {
      return sessionsQuery.data.filter((s) => s.status === 'completed');
    }
    return sessionsQuery.data;
  }, [sessionsQuery.data, sessionFilter, todayStr]);

  if (!academyId) return null;

  return (
    <div className="flex flex-col space-y-4 pb-24 md:pb-6">
      {/* 1. Header with Title & New Session Trigger */}
      <div className="border-border-subtle/40 flex flex-col gap-3 border-b pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-fg text-xl font-extrabold tracking-tight uppercase md:text-2xl">
              Training Sessions
            </h1>
            <p className="text-fg-muted font-sans text-xs">
              Drill blocks, net practice & squad training sessions
            </p>
          </div>
          {canManage && (
            <Button
              variant={showForm ? 'secondary' : 'primary'}
              onClick={() => setShowForm((prev) => !prev)}
              className="h-9 min-h-[36px] rounded-lg px-3.5 text-xs font-bold"
            >
              {showForm ? (
                'Cancel'
              ) : (
                <>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  New Session
                </>
              )}
            </Button>
          )}
        </div>

        {/* Filter Pills Bar */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {[
            { id: 'all', label: 'All Sessions' },
            { id: 'today', label: 'Today' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'completed', label: 'Completed' },
          ].map((chip) => {
            const isActive = sessionFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() =>
                  setSessionFilter(chip.id as 'all' | 'today' | 'upcoming' | 'completed')
                }
                className={`flex h-8 shrink-0 items-center justify-center rounded-full border px-3 text-xs font-bold transition-all ${
                  isActive
                    ? 'border-primary bg-primary font-extrabold text-black shadow-2xs'
                    : 'border-border-subtle bg-surface text-fg-muted hover:border-border hover:bg-surface-muted/50'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible Create Session Drawer / Panel */}
      {showForm && canManage && (
        <div className="border-border-subtle bg-surface animate-fadeIn rounded-xl border p-4 shadow-2xs">
          <form onSubmit={handleCreate} noValidate>
            <div className="border-border-subtle/50 mb-4 border-b pb-3">
              <h2 className="font-heading text-fg text-base font-extrabold tracking-tight uppercase">
                Schedule Training Session
              </h2>
              <p className="text-fg-muted font-sans text-xs">
                Create a practice or nets session for a squad
              </p>
            </div>
            <div className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Batch / Squad
                  </label>
                  <Select
                    {...register('batchId', { required: 'Batch is required' })}
                    hasError={Boolean(errors.batchId)}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  >
                    <option value="">Select squad</option>
                    {batchesQuery.data?.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name} ({batch.ageGroup})
                      </option>
                    ))}
                  </Select>
                  {errors.batchId && (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.batchId.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Lead Coach
                  </label>
                  <Select
                    {...register('coachId', { required: 'Coach is required' })}
                    hasError={Boolean(errors.coachId)}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  >
                    <option value="">Select coach</option>
                    {coaches.map((coach) => (
                      <option key={coach.id} value={coach.id}>
                        {coach.fullName ?? coach.email}
                      </option>
                    ))}
                  </Select>
                  {errors.coachId && (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.coachId.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Session Title
                  </label>
                  <Input
                    {...register('title', { required: 'Title is required' })}
                    placeholder="e.g. Batting Nets & Spin Defense"
                    hasError={Boolean(errors.title)}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  />
                  {errors.title && (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.title.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Focus Area
                  </label>
                  <Input
                    {...register('focusArea')}
                    placeholder="e.g. Backfoot Drive & Catching"
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Session Date
                  </label>
                  <Input
                    {...register('sessionDate', { required: 'Date is required' })}
                    type="date"
                    hasError={Boolean(errors.sessionDate)}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg font-mono text-xs"
                  />
                  {errors.sessionDate && (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.sessionDate.message}
                    </p>
                  )}
                </div>
                <TimeRangePicker
                  label="Session Time"
                  startTime={startTime}
                  endTime={endTime}
                  onStartTimeChange={setStartTime}
                  onEndTimeChange={setEndTime}
                />
              </div>

              <div>
                <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                  Training Notes
                </label>
                <Textarea
                  {...register('notes')}
                  rows={3}
                  placeholder="Equipment required, drill sequencing, or focus remarks..."
                  className="border-border-subtle bg-surface-container-low rounded-lg text-xs"
                />
              </div>
            </div>
            <div className="border-border-subtle/40 mt-4 flex items-center justify-end gap-2.5 border-t pt-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm(false)}
                className="h-9 min-h-[36px] rounded-lg px-4 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={createSession.isPending}
                disabled={!isDirty}
                className="h-9 min-h-[36px] rounded-lg px-5 text-xs font-bold"
              >
                Create Session
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Sessions List */}
      <div className="min-w-0">
        {sessionsQuery.isPending ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="border-border-subtle bg-surface h-24 animate-pulse rounded-xl border"
              />
            ))}
          </div>
        ) : sessionsQuery.isError ? (
          <ErrorState error={sessionsQuery.error} onRetry={() => void sessionsQuery.refetch()} />
        ) : filteredSessions.length === 0 ? (
          <MobileEmptyState
            title="No sessions found"
            description="No training sessions match your selected filter."
            action={
              canManage
                ? { label: 'Schedule Session', onClick: () => setShowForm(true) }
                : undefined
            }
          />
        ) : (
          <div className="divide-border-subtle/50 border-border-subtle bg-surface divide-y overflow-hidden rounded-xl border shadow-2xs">
            {filteredSessions.map((session) => {
              const isToday = session.sessionDate === todayStr;

              return (
                <div
                  key={session.id}
                  className={`flex flex-col justify-between gap-3.5 p-3.5 transition-colors sm:flex-row sm:items-center ${
                    isToday ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-surface-muted/20'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {/* Time block */}
                    <div className="border-border-subtle/70 bg-surface-container-low flex shrink-0 flex-col items-start rounded-lg border px-2.5 py-1.5 font-mono">
                      <span className="text-fg text-[11px] font-bold">
                        {formatTime(session.startAt)}
                      </span>
                      <span className="text-fg-muted text-[10px]">
                        {formatDate(session.sessionDate)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/sessions/${session.id}`}
                          className="font-heading text-fg hover:text-primary truncate text-sm font-bold tracking-tight uppercase transition-colors"
                        >
                          {session.title}
                        </Link>
                        {isToday && (
                          <span className="border-primary/30 bg-primary-pale py-0.2 text-primary shrink-0 rounded-full border px-1.5 text-[9px] font-bold uppercase">
                            Today
                          </span>
                        )}
                      </div>

                      <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-xs">
                        {session.batch?.name && (
                          <span className="border-border-subtle/60 bg-surface-container-low text-fg-muted rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold">
                            {session.batch.name}
                          </span>
                        )}
                        {session.coach?.fullName && (
                          <span className="flex items-center gap-1">
                            <User className="text-fg-muted h-3 w-3" />
                            {session.coach.fullName}
                          </span>
                        )}
                        {session.focusArea && (
                          <span className="text-fg-muted truncate">• {session.focusArea}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-2.5 sm:justify-end">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 font-sans text-[10px] font-bold uppercase ${
                        session.status === 'completed'
                          ? 'border-success/30 bg-success-pale text-success'
                          : session.status === 'cancelled'
                            ? 'border-error/30 bg-error-pale text-error'
                            : 'border-saffron/30 bg-saffron-pale text-saffron'
                      }`}
                    >
                      {session.status}
                    </span>

                    {canManage ? (
                      <Link
                        to={`/sessions/${session.id}/attendance`}
                        className="bg-primary flex h-8.5 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-bold text-black shadow-2xs transition hover:opacity-90"
                      >
                        Attendance
                      </Link>
                    ) : (
                      <Link
                        to={`/sessions/${session.id}`}
                        className="border-border-subtle bg-surface text-fg-muted hover:bg-surface-muted hover:text-fg flex h-8.5 shrink-0 items-center justify-center rounded-lg border px-3 text-xs font-bold transition"
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
