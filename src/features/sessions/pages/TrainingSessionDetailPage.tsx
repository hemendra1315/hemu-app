import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import { Button, Input, Select, Textarea } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { useAcademyMembers } from '@/features/members';
import { useBatches } from '@/features/batches';
import { useCan } from '@/lib/rbac';
import { useUiStore } from '@/stores';
import { isUUID } from '@/lib/validators';
import type { TrainingSession } from '../api/sessionsTypes';
import {
  useDeleteTrainingSession,
  useTrainingSession,
  useUpdateTrainingSession,
} from '../hooks/useSessions';
import { formatDate, formatDateTime } from '@/lib/utils/date';

type SessionFormValues = {
  batchId: string;
  title: string;
  focusArea: string;
  sessionDate: string;
  startAt: string;
  endAt: string;
  coachId: string;
  notes: string;
};

export default function TrainingSessionDetailPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { academyId } = useActiveAcademy();
  const sessionQuery = useTrainingSession(sessionId ?? null, academyId);
  const deleteSession = useDeleteTrainingSession(academyId as string);
  const updateSession = useUpdateTrainingSession(academyId as string);
  const canManage = useCan('sessions:manage');
  const pushToast = useUiStore((state) => state.pushToast);
  const [showEditForm, setShowEditForm] = useState(false);

  const session = sessionQuery.data;

  const handleDelete = async () => {
    if (!sessionId) return;
    try {
      await deleteSession.mutateAsync({ sessionId });
      pushToast({ title: 'Session deleted', variant: 'success' });
      navigate('/sessions');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete session';
      pushToast({ title: 'Failed to delete session', description: msg, variant: 'error' });
    }
  };

  const handleStatusChange = async (status: 'completed' | 'cancelled') => {
    if (!sessionId || !session) return;
    try {
      await updateSession.mutateAsync({
        sessionId,
        input: {
          batchId: session.batchId,
          title: session.title,
          focusArea: session.focusArea,
          sessionDate: session.sessionDate,
          startAt: session.startAt,
          endAt: session.endAt,
          coachId: session.coachId,
          status,
          notes: session.notes,
        },
      });
      pushToast({
        title: status === 'completed' ? 'Session marked completed' : 'Session cancelled',
        variant: 'success',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update session status';
      pushToast({ title: 'Failed to update session status', description: msg, variant: 'error' });
    }
  };

  if (!academyId || !sessionId || !isUUID(sessionId)) {
    return (
      <EmptyState
        title={!sessionId || !academyId ? 'No session selected' : 'Invalid session link'}
        description={
          !sessionId || !academyId
            ? 'Select a session from the sessions list to view its details.'
            : 'The session link you followed is not valid. Please return to the sessions list.'
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. App Bar Header */}
      <div className="border-border-subtle/40 flex flex-col gap-2 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigate('/sessions')}
              aria-label="Back to sessions"
              className="text-fg hover:bg-surface-muted/60 h-auto px-2 py-1 font-semibold"
            >
              &larr; Back
            </Button>
            <h1 className="font-heading text-fg truncate text-2xl font-extrabold tracking-tight uppercase md:text-3xl">
              {session?.title ?? 'Session Detail'}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManage && session && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowEditForm((open) => !open)}
                className="h-11 min-h-[44px] rounded-[10px] px-3.5 text-xs font-bold"
              >
                {showEditForm ? 'Cancel Edit' : 'Edit Session'}
              </Button>
            )}
          </div>
        </div>
        {session && (
          <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-sans text-xs">
            <span className="bg-surface-muted/60 border-border-subtle/40 text-fg-muted rounded border px-2 py-0.5 font-mono text-[11px] font-bold">
              BATCH: {session.batch.name}
            </span>
            <span className="bg-surface-muted/60 border-border-subtle/40 rounded border px-2 py-0.5 font-mono text-[11px]">
              {formatDate(session.sessionDate)}
            </span>
          </div>
        )}
      </div>

      {sessionQuery.isPending ? (
        <p className="text-fg-muted py-8 text-center font-sans text-sm">Loading session…</p>
      ) : sessionQuery.isError ? (
        <ErrorState error={sessionQuery.error} onRetry={() => void sessionQuery.refetch()} />
      ) : !session ? (
        <EmptyState
          title="Session not found"
          description="This session does not exist or you do not have access."
        />
      ) : (
        <>
          {/* 2. Session Detail Scorecard */}
          <div className="border-border-subtle bg-surface divide-border-subtle/50 divide-y overflow-hidden rounded-xl border shadow-2xs">
            <div className="flex flex-col gap-1.5 p-4">
              <span className="text-fg-muted font-sans text-[10px] font-bold tracking-wider uppercase">
                Topic & Focus
              </span>
              <p className="text-fg font-heading text-lg font-bold tracking-tight uppercase">
                {session.title}
              </p>
              {session.focusArea && (
                <p className="text-fg-muted mt-0.5 font-sans text-xs">Focus: {session.focusArea}</p>
              )}
            </div>

            <div className="bg-border-subtle/50 grid grid-cols-1 gap-px sm:grid-cols-2">
              <div className="bg-surface flex flex-col gap-1 p-4">
                <span className="text-fg-muted font-sans text-[10px] font-bold tracking-wider uppercase">
                  Date & Time
                </span>
                <p className="text-fg mt-1 font-mono text-sm font-bold">
                  {formatDate(session.sessionDate)}
                </p>
                <p className="text-fg-muted mt-0.5 font-mono text-xs">
                  {formatDateTime(session.startAt)} – {formatDateTime(session.endAt)}
                </p>
              </div>

              <div className="bg-surface flex flex-col justify-center gap-1 p-4">
                <span className="text-fg-muted font-sans text-[10px] font-bold tracking-wider uppercase">
                  Assigned Coach
                </span>
                <p className="text-fg mt-1 text-sm font-semibold">
                  {session.coach.fullName ?? session.coach.email}
                </p>
                <p className="text-fg-muted mt-0.5 font-sans text-xs">{session.coach.email}</p>
              </div>
            </div>

            <div className="flex flex-col gap-1 p-4">
              <span className="text-fg-muted font-sans text-[10px] font-bold tracking-wider uppercase">
                Status
              </span>
              <div className="mt-1">
                <span
                  className={`inline-flex items-center rounded border px-2.5 py-0.5 font-sans text-[10px] font-bold uppercase ${
                    session.status === 'completed'
                      ? 'bg-success-pale text-success border-success/30'
                      : session.status === 'cancelled'
                        ? 'bg-error-pale text-error border-error/30'
                        : 'bg-saffron-pale text-saffron border-saffron/30'
                  }`}
                >
                  {session.status}
                </span>
              </div>
            </div>

            {session.notes && (
              <div className="flex flex-col gap-1 p-4">
                <span className="text-fg-muted font-sans text-[10px] font-bold tracking-wider uppercase">
                  Training Notes
                </span>
                <p className="text-fg mt-1 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                  {session.notes}
                </p>
              </div>
            )}

            {canManage && (
              <div className="bg-surface-muted/30 flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void navigate(`/sessions/${session.id}/attendance`)}
                    className="min-h-[40px] rounded-[10px] px-4 text-xs font-bold"
                  >
                    Manage Attendance
                  </Button>
                  {session.status === 'scheduled' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={updateSession.isPending}
                        onClick={() => void handleStatusChange('completed')}
                        className="min-h-[40px] rounded-[10px] px-4 text-xs font-bold"
                      >
                        Mark Completed
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        isLoading={updateSession.isPending}
                        onClick={() => void handleStatusChange('cancelled')}
                        className="text-error hover:bg-error-pale min-h-[40px] rounded-[10px] px-4 text-xs font-bold"
                      >
                        Cancel Session
                      </Button>
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this training session?')) {
                      void handleDelete();
                    }
                  }}
                  isLoading={deleteSession.isPending}
                  className="text-error hover:bg-error-pale min-h-[40px] rounded-[10px] px-4 text-xs font-bold"
                >
                  Delete Session
                </Button>
              </div>
            )}
          </div>

          {showEditForm && canManage ? (
            <SessionEditForm
              session={session}
              updateSession={updateSession}
              onSuccess={() => {
                setShowEditForm(false);
                pushToast({ title: 'Session updated', variant: 'success' });
              }}
              onCancel={() => setShowEditForm(false)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function SessionEditForm({
  session,
  updateSession,
  onSuccess,
  onCancel,
}: {
  session: TrainingSession;
  updateSession: ReturnType<typeof useUpdateTrainingSession>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { academyId } = useActiveAcademy();
  const batchesQuery = useBatches(academyId);
  const membersQuery = useAcademyMembers(academyId, { status: 'active' });

  const coaches = membersQuery.data?.filter((member) => member.role === 'coach') ?? [];

  const pushToast = useUiStore((state) => state.pushToast);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<SessionFormValues>({
    defaultValues: {
      batchId: session.batchId,
      title: session.title,
      focusArea: session.focusArea ?? '',
      sessionDate: session.sessionDate,
      startAt: session.startAt,
      endAt: session.endAt,
      coachId: session.coachId,
      notes: session.notes ?? '',
    },
  });

  const handleSubmitEdit = handleSubmit(async (values) => {
    try {
      await updateSession.mutateAsync({
        sessionId: session.id,
        input: {
          batchId: values.batchId,
          title: values.title,
          focusArea: values.focusArea || null,
          sessionDate: values.sessionDate,
          startAt: values.startAt,
          endAt: values.endAt,
          coachId: values.coachId,
          status: session.status,
          notes: values.notes || null,
        },
      });
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update session';
      pushToast({ title: 'Update Failed', description: msg, variant: 'error' });
    }
  });

  return (
    <div className="border-border-subtle bg-surface mt-4 rounded-xl border p-4 shadow-2xs">
      <form onSubmit={handleSubmitEdit} noValidate>
        <div className="border-border-subtle/50 mb-4 border-b pb-3">
          <h2 className="font-heading text-fg text-lg font-extrabold tracking-tight uppercase">
            Edit Session
          </h2>
          <p className="text-fg-muted mt-0.5 font-sans text-xs">Update the session details</p>
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
                    {batch.name}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="font-heading text-fg-muted mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
                  Start time
                </label>
                <Input
                  {...register('startAt', { required: 'Start time is required' })}
                  type="datetime-local"
                  hasError={Boolean(errors.startAt)}
                  className="border-border-subtle h-11 min-h-[44px] rounded-lg font-mono"
                />
                {errors.startAt ? (
                  <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                    {errors.startAt.message}
                  </p>
                ) : null}
              </div>
              <div>
                <label className="font-heading text-fg-muted mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
                  End time
                </label>
                <Input
                  {...register('endAt', { required: 'End time is required' })}
                  type="datetime-local"
                  hasError={Boolean(errors.endAt)}
                  className="border-border-subtle h-11 min-h-[44px] rounded-lg font-mono"
                />
                {errors.endAt ? (
                  <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                    {errors.endAt.message}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            <label className="font-heading text-fg-muted mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
              Notes
            </label>
            <Textarea {...register('notes')} rows={4} className="border-border-subtle rounded-lg" />
          </div>
        </div>
        <div className="border-border-subtle/40 mt-6 flex items-center justify-end gap-3 border-t pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="h-11 min-h-[44px] rounded-[10px] px-4 text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={updateSession.isPending}
            disabled={!isDirty}
            className="h-11 min-h-[44px] rounded-[10px] px-5 text-xs font-bold"
          >
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
