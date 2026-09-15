import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, User, CheckCircle2, XCircle, Trash2, Edit3 } from 'lucide-react';

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
    <div className="flex flex-col space-y-4 pb-24 md:pb-6">
      {/* 1. Header with Back Button and Quick Actions */}
      <div className="border-border-subtle/40 flex items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/sessions')}
            className="border-border-subtle bg-surface text-fg-muted hover:text-fg hover:bg-surface-muted flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
            aria-label="Back to sessions"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-heading text-fg text-lg font-extrabold tracking-tight uppercase md:text-xl">
              {session?.title ?? 'Session Details'}
            </h1>
            {session && (
              <p className="text-fg-muted font-sans text-xs">
                {session.batch?.name ? `${session.batch.name} • ` : ''}
                {formatDate(session.sessionDate)}
              </p>
            )}
          </div>
        </div>

        {canManage && session && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowEditForm((open) => !open)}
            className="h-8.5 min-h-[34px] rounded-lg px-3 text-xs font-bold"
          >
            <Edit3 className="mr-1.5 h-3.5 w-3.5" />
            {showEditForm ? 'Cancel Edit' : 'Edit'}
          </Button>
        )}
      </div>

      {sessionQuery.isPending ? (
        <div className="border-border-subtle bg-surface h-64 animate-pulse rounded-xl border" />
      ) : sessionQuery.isError ? (
        <ErrorState error={sessionQuery.error} onRetry={() => void sessionQuery.refetch()} />
      ) : !session ? (
        <EmptyState
          title="Session not found"
          description="This session does not exist or you do not have access."
        />
      ) : (
        <>
          {/* 2. Athletic Session Card */}
          <div className="divide-border-subtle/50 border-border-subtle bg-surface divide-y overflow-hidden rounded-xl border shadow-2xs">
            {/* Title & Status */}
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  Topic & Squad Focus
                </span>
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
              </div>
              <p className="font-heading text-fg text-lg font-extrabold tracking-tight uppercase">
                {session.title}
              </p>
              {session.focusArea && (
                <div className="text-primary flex items-center gap-1.5 font-sans text-xs">
                  <span className="font-bold">Focus:</span>
                  <span>{session.focusArea}</span>
                </div>
              )}
            </div>

            {/* Date & Time + Coach Details */}
            <div className="divide-border-subtle/50 bg-surface-container-low/30 grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="flex flex-col gap-1 p-3.5">
                <div className="text-fg-muted flex items-center gap-1.5">
                  <Calendar className="text-primary h-3.5 w-3.5" />
                  <span className="font-heading text-[10px] font-bold tracking-wider uppercase">
                    Schedule
                  </span>
                </div>
                <p className="text-fg mt-1 font-mono text-sm font-bold">
                  {formatDate(session.sessionDate)}
                </p>
                <p className="text-fg-muted font-mono text-xs">
                  {formatDateTime(session.startAt)} – {formatDateTime(session.endAt)}
                </p>
              </div>

              <div className="flex flex-col gap-1 p-3.5">
                <div className="text-fg-muted flex items-center gap-1.5">
                  <User className="text-info h-3.5 w-3.5" />
                  <span className="font-heading text-[10px] font-bold tracking-wider uppercase">
                    Assigned Coach
                  </span>
                </div>
                <p className="text-fg mt-1 font-sans text-sm font-bold">
                  {session.coach?.fullName ?? session.coach?.email}
                </p>
                <p className="text-fg-muted font-sans text-xs">{session.coach?.email}</p>
              </div>
            </div>

            {/* Notes Section */}
            {session.notes && (
              <div className="flex flex-col gap-1 p-3.5">
                <span className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  Training Notes
                </span>
                <p className="text-fg mt-0.5 font-sans text-xs leading-relaxed whitespace-pre-wrap">
                  {session.notes}
                </p>
              </div>
            )}

            {/* Actions Bar */}
            {canManage && (
              <div className="bg-surface-container-low/50 flex flex-wrap items-center justify-between gap-2.5 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/sessions/${session.id}/attendance`)}
                    className="h-9 min-h-[36px] rounded-lg px-4 text-xs font-bold text-black"
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
                        className="border-border-subtle bg-surface text-fg hover:bg-surface-muted h-9 min-h-[36px] rounded-lg px-3 text-xs font-bold"
                      >
                        <CheckCircle2 className="text-success mr-1.5 h-3.5 w-3.5" />
                        Completed
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        isLoading={updateSession.isPending}
                        onClick={() => void handleStatusChange('cancelled')}
                        className="text-error hover:bg-error-pale h-9 min-h-[36px] rounded-lg px-3 text-xs font-bold"
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this training session?')) {
                      void handleDelete();
                    }
                  }}
                  isLoading={deleteSession.isPending}
                  className="text-error hover:bg-error-pale h-9 min-h-[36px] rounded-lg px-3 text-xs font-bold"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            )}
          </div>

          {/* Edit Form Modal/Drawer */}
          {showEditForm && canManage && (
            <SessionEditForm
              session={session}
              updateSession={updateSession}
              onSuccess={() => {
                setShowEditForm(false);
                pushToast({ title: 'Session updated', variant: 'success' });
              }}
              onCancel={() => setShowEditForm(false)}
            />
          )}
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

  const coaches = membersQuery.data?.filter((m) => m.role === 'coach') ?? [];

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

  const onSubmit = handleSubmit(async (values) => {
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
      console.error('Update failed:', err);
    }
  });

  return (
    <div className="border-border-subtle bg-surface rounded-xl border p-4 shadow-2xs">
      <form onSubmit={onSubmit} noValidate>
        <div className="border-border-subtle/50 mb-4 border-b pb-3">
          <h2 className="font-heading text-fg text-base font-extrabold tracking-tight uppercase">
            Edit Session
          </h2>
        </div>
        <div className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                Squad / Batch
              </label>
              <Select
                {...register('batchId', { required: 'Batch is required' })}
                className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
              >
                {batchesQuery.data?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.ageGroup})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                Coach
              </label>
              <Select
                {...register('coachId', { required: 'Coach is required' })}
                className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
              >
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName ?? c.email}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                Title
              </label>
              <Input
                {...register('title', { required: 'Title is required' })}
                hasError={Boolean(errors.title)}
                className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                Focus Area
              </label>
              <Input
                {...register('focusArea')}
                className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
              Notes
            </label>
            <Textarea
              {...register('notes')}
              rows={3}
              className="border-border-subtle bg-surface-container-low rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="border-border-subtle/40 mt-4 flex items-center justify-end gap-2.5 border-t pt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="h-9 min-h-[36px] rounded-lg px-4 text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={updateSession.isPending}
            disabled={!isDirty}
            className="h-9 min-h-[36px] rounded-lg px-5 text-xs font-bold"
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
