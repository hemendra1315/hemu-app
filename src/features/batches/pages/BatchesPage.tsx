import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import 'react-datepicker/dist/react-datepicker.css';
import { Link } from 'react-router-dom';

import { TimeRangePicker } from '@/components/form';
import { isTimeRangeValid } from '@/lib/utils/date';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
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
      } catch (error) {
        pushToast({
          title: 'Failed to create batch',
          description: errorMessage(error),
          variant: 'error',
        });
      }
    },
    (errors) => {
      console.error('Form errors:', errors);

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
    <div className="space-y-4 pb-24 md:pb-6">
      {/* 1. App Bar Header */}
      <div className="border-border-subtle/40 flex flex-col gap-2 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-fg text-2xl font-extrabold tracking-tight uppercase md:text-3xl">
            Batches
          </h1>
          {canManage && (
            <Button
              variant={showForm ? 'secondary' : 'primary'}
              onClick={() => setShowForm((prev) => !prev)}
              className="min-h-[44px] rounded-[10px] px-4 text-xs font-bold"
            >
              {showForm ? 'Cancel' : 'New Batch'}
            </Button>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-surface-muted border-border-subtle/50 text-fg-muted rounded border px-2 py-0.5 font-mono text-[11px] font-bold uppercase">
              {batchesQuery.data?.length ?? 0} BATCHES
            </span>
          </div>
          <div className="overflow-x-auto pb-1 sm:pb-0">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'All' },
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
        <Card>
          <form onSubmit={handleCreate} noValidate>
            <CardHeader
              title="Create Batch"
              description="Set up a new training group with schedule & coach."
            />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-fg block text-sm font-medium">Batch name</label>
                  <Input
                    className="h-12 min-h-[44px]"
                    {...register('name', { required: 'Batch name is required' })}
                    hasError={Boolean(errors.name)}
                  />
                  {errors.name ? (
                    <p className="text-danger mt-1 text-xs">{errors.name.message}</p>
                  ) : null}
                </div>
                <div>
                  <label className="text-fg block text-sm font-medium">Age group</label>
                  <Input
                    className="h-12 min-h-[44px]"
                    {...register('ageGroup', { required: 'Age group is required' })}
                    hasError={Boolean(errors.ageGroup)}
                  />
                  {errors.ageGroup ? (
                    <p className="text-danger mt-1 text-xs">{errors.ageGroup.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-fg block text-sm font-medium">
                  Training days{' '}
                  <span className="text-fg-muted text-xs font-normal">(Optional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => (
                    <Button
                      key={day}
                      type="button"
                      variant={selectedDays.includes(day) ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => toggleDay(day)}
                      className="h-11 min-h-[44px] min-w-[44px] px-3 font-semibold"
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-fg block text-sm font-medium">
                  Assign coach <span className="text-fg-muted text-xs font-normal">(Optional)</span>
                </label>
                <Select className="h-12 min-h-[44px]" {...register('coachId')}>
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
                  label="Training time (Optional)"
                  startTime={startTime}
                  endTime={endTime}
                  onStartTimeChange={setStartTime}
                  onEndTimeChange={setEndTime}
                />
              </div>

              <div>
                <label className="text-fg block text-sm font-medium">
                  Description <span className="text-fg-muted text-xs font-normal">(Optional)</span>
                </label>
                <Textarea className="min-h-[80px]" {...register('description')} />
              </div>
            </CardBody>
            <CardFooter className="flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                isLoading={createBatch.isPending}
                className="h-12 min-h-[48px] w-full font-semibold sm:w-auto"
              >
                Create Batch
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}

      {/* 2. All Batches Grid */}
      <div className="min-w-0">
        {batchesQuery.isPending ? (
          <p className="text-fg-muted py-8 text-center font-sans text-sm">Loading squads...</p>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredBatches.map((batch) => (
              <div
                key={batch.id}
                className="border-border-subtle bg-surface hover:border-border flex flex-col gap-3.5 rounded-xl border p-4 shadow-2xs transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/batches/${batch.id}`}
                      className="text-fg font-heading block truncate text-base font-extrabold tracking-tight uppercase hover:underline"
                    >
                      {batch.name}
                    </Link>
                    <span className="text-fg bg-surface-muted border-border-subtle/50 mt-1.5 inline-flex items-center rounded border px-2 py-0.5 font-sans text-[10px] font-bold tracking-wider uppercase">
                      {batch.ageGroup}
                    </span>
                  </div>

                  <div className="bg-surface-muted/80 text-fg border-border-subtle flex min-h-[30px] shrink-0 items-center justify-center rounded-full border px-3 py-1 font-mono text-xs font-bold">
                    {batch.playerCount ?? 0} PLAYERS
                  </div>
                </div>

                <div className="text-fg-muted border-border-subtle/50 grid grid-cols-1 gap-2 border-t pt-3 text-xs">
                  {batch.trainingDays ? (
                    <div className="flex flex-wrap items-center gap-1.5 font-sans">
                      <span className="text-fg text-[10px] font-bold tracking-wider uppercase">
                        Schedule:
                      </span>
                      <span className="text-fg font-mono text-xs font-medium">
                        {batch.trainingDays} {batch.trainingTime ? `• ${batch.trainingTime}` : ''}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1.5 font-sans">
                    <span className="text-fg text-[10px] font-bold tracking-wider uppercase">
                      Coach:
                    </span>
                    <span className="text-fg text-xs font-medium">
                      {batch.coach.fullName ?? batch.coach.email}
                    </span>
                  </div>
                </div>

                <div className="border-border-subtle/40 flex items-center justify-between gap-2 border-t pt-2">
                  <Link
                    to={`/batches/${batch.id}`}
                    className="text-primary inline-flex min-h-[44px] items-center font-sans text-xs font-bold hover:underline"
                  >
                    View Batch & Roster &rarr;
                  </Link>

                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBatchToDelete({ id: batch.id, name: batch.name })}
                      className="text-error hover:bg-error-pale h-10 min-h-[44px] rounded-[10px] px-3 font-bold"
                    >
                      Delete
                    </Button>
                  ) : null}
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
        title="Delete Training Batch"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setBatchToDelete(null)}
              className="h-12 min-h-[48px] w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={deleteBatch.isPending}
              onClick={() => void handleConfirmDelete()}
              className="h-12 min-h-[48px] w-full font-semibold sm:w-auto"
            >
              Confirm Delete
            </Button>
          </div>
        }
      >
        <p className="text-fg text-sm">
          Are you sure you want to delete{' '}
          <strong className="text-fg font-bold">{batchToDelete?.name}</strong>? This action will
          unassign all players from this batch.
        </p>
      </Modal>
    </div>
  );
}
