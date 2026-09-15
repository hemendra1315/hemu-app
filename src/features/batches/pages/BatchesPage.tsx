import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import 'react-datepicker/dist/react-datepicker.css';
import { Link } from 'react-router-dom';
import { Plus, Users, Calendar, Trash2, ArrowRight } from 'lucide-react';

import { TimeRangePicker } from '@/components/form';
import { isTimeRangeValid } from '@/lib/utils/date';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { MobileEmptyState } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { useAcademyMembers } from '@/features/members';
import { useCan } from '@/lib/rbac';
import { errorMessage } from '@/lib/api/errors';
import { useUiStore } from '@/stores';
import type { CreateBatchInput } from '../api/batchesTypes';
import { useBatches, useCreateBatch, useDeleteBatch } from '../hooks/useBatches';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type BatchFormValues = Omit<CreateBatchInput, 'academyId'>;

const DEFAULT_BATCH_FORM: BatchFormValues = {
  name: '',
  ageGroup: '',
  description: '',
  trainingDays: '',
  trainingTime: '',
  coachId: '',
};

export default function BatchesPage() {
  const { academyId } = useActiveAcademy();
  const canManage = useCan('batches:manage');
  const batchesQuery = useBatches(academyId);
  const membersQuery = useAcademyMembers(academyId, { status: 'active' });
  const createBatch = useCreateBatch(academyId as string);
  const deleteBatch = useDeleteBatch(academyId as string);
  const pushToast = useUiStore((state) => state.pushToast);

  const [showForm, setShowForm] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<{ id: string; name: string } | null>(null);

  const coaches = useMemo(
    () =>
      membersQuery.data?.filter(
        (member) => member.role === 'coach' || member.role === 'academy_owner',
      ) ?? [],
    [membersQuery.data],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BatchFormValues>({ defaultValues: DEFAULT_BATCH_FORM });

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((item) => item !== day) : [...prev, day],
    );
  };

  const handleCreate = handleSubmit(
    async (value) => {
      if (!isTimeRangeValid(startTime, endTime)) {
        pushToast({
          title: 'End time must be after start time.',
          variant: 'error',
        });
        return;
      }

      const formattedTime =
        startTime && endTime
          ? `${startTime.toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })} - ${endTime.toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })}`
          : '';

      const formattedDays = selectedDays.length > 0 ? selectedDays.join(', ') : '';

      try {
        await createBatch.mutateAsync({
          academyId: academyId as string,
          name: value.name,
          ageGroup: value.ageGroup,
          description: value.description || null,
          trainingDays: formattedDays || null,
          trainingTime: formattedTime || null,
          coachId: value.coachId || null,
        });

        pushToast({
          title: 'Batch created',
          variant: 'success',
        });

        reset(DEFAULT_BATCH_FORM);
        setStartTime(null);
        setEndTime(null);
        setSelectedDays([]);
        setShowForm(false);
      } catch (error: unknown) {
        const err = error as { message?: string; details?: string };
        const msg =
          err?.message && !err.message.startsWith('E_') ? err.message : errorMessage(error);

        pushToast({
          title: 'Failed to create batch',
          description: msg,
          variant: 'error',
        });
      }
    },
    () => {
      pushToast({
        title: 'Please fill required fields',
        variant: 'error',
      });
    },
  );

  const handleConfirmDelete = async () => {
    if (!batchToDelete) return;
    await deleteBatch.mutateAsync({ batchId: batchToDelete.id });
    pushToast({ title: `${batchToDelete.name} deleted`, variant: 'success' });
    setBatchToDelete(null);
  };

  const [selectedFilter, setSelectedFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>(
    'all',
  );

  const filteredBatches = useMemo(() => {
    if (!batchesQuery.data) return [];
    if (selectedFilter === 'all') return batchesQuery.data;
    return batchesQuery.data.filter((b) => {
      const time = (b.trainingTime || '').toLowerCase();
      if (selectedFilter === 'morning')
        return (
          time.includes('am') ||
          time.includes('06:') ||
          time.includes('07:') ||
          time.includes('08:') ||
          time.includes('09:')
        );
      if (selectedFilter === 'afternoon')
        return (
          time.includes('12:') ||
          time.includes('13:') ||
          time.includes('14:') ||
          time.includes('15:') ||
          time.includes('16:')
        );
      if (selectedFilter === 'evening')
        return (
          time.includes('17:') ||
          time.includes('18:') ||
          time.includes('19:') ||
          time.includes('20:') ||
          time.includes('pm')
        );
      return true;
    });
  }, [batchesQuery.data, selectedFilter]);

  if (!academyId) return null;

  return (
    <div className="flex flex-col space-y-4 pb-24 md:pb-6">
      {/* 1. App Bar Header */}
      <div className="border-border-subtle/40 flex flex-col gap-3 border-b pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-fg text-xl font-extrabold tracking-tight uppercase md:text-2xl">
              Batches & Squads
            </h1>
            <p className="text-fg-muted font-sans text-xs">
              Training cohorts, schedules & player group assignments
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
                  New Batch
                </>
              )}
            </Button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {[
            { id: 'all', label: 'All Squads', count: batchesQuery.data?.length },
            { id: 'morning', label: 'Morning' },
            { id: 'afternoon', label: 'Afternoon' },
            { id: 'evening', label: 'Evening' },
          ].map((chip) => {
            const isActive = selectedFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() =>
                  setSelectedFilter(chip.id as 'all' | 'morning' | 'afternoon' | 'evening')
                }
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-all ${
                  isActive
                    ? 'border-primary bg-primary font-extrabold text-black shadow-2xs'
                    : 'border-border-subtle bg-surface text-fg-muted hover:border-border hover:bg-surface-muted/50'
                }`}
              >
                <span>{chip.label}</span>
                {chip.count !== undefined && (
                  <span
                    className={`py-0.2 rounded-full px-1.5 text-[10px] ${
                      isActive ? 'bg-black/20 text-black' : 'bg-surface-muted text-fg-muted'
                    }`}
                  >
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Create Batch Collapsible Panel */}
      {showForm && canManage && (
        <div className="border-border-subtle bg-surface animate-fadeIn rounded-xl border p-4 shadow-2xs">
          <form onSubmit={handleCreate} noValidate>
            <div className="border-border-subtle/50 mb-4 border-b pb-3">
              <h2 className="font-heading text-fg text-base font-extrabold tracking-tight uppercase">
                Create Training Squad
              </h2>
              <p className="text-fg-muted font-sans text-xs">
                Set up a new cohort with age group, schedule & coach
              </p>
            </div>
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Batch Name
                  </label>
                  <Input
                    placeholder="e.g. Under-16 Elite"
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                    {...register('name', { required: 'Batch name is required' })}
                    hasError={Boolean(errors.name)}
                  />
                  {errors.name && (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Age Group
                  </label>
                  <Input
                    placeholder="e.g. U-16 or Seniors"
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                    {...register('ageGroup', { required: 'Age group is required' })}
                    hasError={Boolean(errors.ageGroup)}
                  />
                  {errors.ageGroup && (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.ageGroup.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-heading text-fg-muted block text-[10px] font-bold tracking-wider uppercase">
                  Training Days
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`h-8 min-w-[38px] rounded-md border px-2.5 font-mono text-xs font-bold transition-all ${
                        selectedDays.includes(day)
                          ? 'border-primary bg-primary text-black'
                          : 'border-border-subtle bg-surface-container-low text-fg-muted hover:text-fg'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Lead Coach
                  </label>
                  <Select
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                    {...register('coachId')}
                  >
                    <option value="">Select coach (Optional)</option>
                    {coaches.map((coach) => (
                      <option key={coach.id} value={coach.id}>
                        {coach.fullName ?? coach.email}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <TimeRangePicker
                    label="Training Time"
                    startTime={startTime}
                    endTime={endTime}
                    onStartTimeChange={setStartTime}
                    onEndTimeChange={setEndTime}
                  />
                </div>
              </div>

              <div>
                <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                  Description & Focus
                </label>
                <Textarea
                  placeholder="Focus areas, skill prerequisites, or session notes..."
                  rows={2}
                  className="border-border-subtle bg-surface-container-low rounded-lg text-xs"
                  {...register('description')}
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
                isLoading={createBatch.isPending}
                className="h-9 min-h-[36px] rounded-lg px-5 text-xs font-bold"
              >
                Create Squad
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 2. All Batches Grid */}
      <div className="min-w-0">
        {batchesQuery.isPending ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="border-border-subtle bg-surface h-36 animate-pulse rounded-xl border"
              />
            ))}
          </div>
        ) : batchesQuery.isError ? (
          <ErrorState error={batchesQuery.error} onRetry={() => void batchesQuery.refetch()} />
        ) : filteredBatches.length === 0 ? (
          <MobileEmptyState
            title="No squads found"
            description="Create your first training batch to organize players."
            action={
              canManage ? { label: 'Create Batch', onClick: () => setShowForm(true) } : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredBatches.map((batch) => (
              <div
                key={batch.id}
                className="group border-border-subtle bg-surface hover:border-border flex flex-col justify-between rounded-xl border p-4 shadow-2xs transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/batches/${batch.id}`}
                        className="font-heading text-fg group-hover:text-primary block truncate text-base font-extrabold tracking-tight uppercase transition-colors"
                      >
                        {batch.name}
                      </Link>
                      <span className="border-border-subtle/70 bg-surface-container-low py-0.2 text-fg-muted mt-1 inline-flex items-center rounded border px-2 font-sans text-[10px] font-bold uppercase">
                        {batch.ageGroup}
                      </span>
                    </div>

                    <div className="border-primary/20 bg-primary-pale text-primary flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold">
                      <Users className="h-3 w-3" />
                      <span>{batch.playerCount ?? 0}</span>
                    </div>
                  </div>

                  <div className="border-border-subtle/50 text-fg-muted mt-3 space-y-1.5 border-t pt-3 text-xs">
                    {batch.trainingDays && (
                      <div className="flex items-center gap-1.5 font-sans">
                        <Calendar className="text-primary h-3.5 w-3.5 shrink-0" />
                        <span className="text-fg font-mono text-[11px]">
                          {batch.trainingDays} {batch.trainingTime ? `• ${batch.trainingTime}` : ''}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 font-sans">
                      <span className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                        Coach:
                      </span>
                      <span className="text-fg font-sans text-xs">
                        {batch.coach.fullName ?? batch.coach.email}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-border-subtle/40 mt-3.5 flex items-center justify-between border-t pt-2.5">
                  <Link
                    to={`/batches/${batch.id}`}
                    className="text-primary flex items-center gap-1 font-sans text-xs font-bold hover:underline"
                  >
                    <span>View Roster</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setBatchToDelete({ id: batch.id, name: batch.name })}
                      className="text-fg-muted hover:bg-error-pale hover:text-error flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                      aria-label="Delete batch"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Batch Confirmation Dialog */}
      <Modal
        open={Boolean(batchToDelete)}
        onClose={() => setBatchToDelete(null)}
        title="Delete Training Squad"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setBatchToDelete(null)}
              className="h-9 min-h-[36px] rounded-lg px-4 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={deleteBatch.isPending}
              onClick={() => void handleConfirmDelete()}
              className="h-9 min-h-[36px] rounded-lg px-4 text-xs font-bold"
            >
              Confirm Delete
            </Button>
          </div>
        }
      >
        <p className="text-fg font-sans text-xs">
          Are you sure you want to delete <strong className="text-fg">{batchToDelete?.name}</strong>
          ? All players in this batch will be unassigned.
        </p>
      </Modal>
    </div>
  );
}
