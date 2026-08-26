import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useNavigate, useParams } from 'react-router-dom';

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
import { EmptyState, ErrorState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { useAcademyMembers } from '@/features/members';
import { errorMessage } from '@/lib/api/errors';
import { useCan } from '@/lib/rbac';
import { isUUID } from '@/lib/validators';
import { useUiStore } from '@/stores';
import type { Batch } from '../api/batchesTypes';
import { AddBatchPlayersModal } from '../components/AddBatchPlayersModal';
import {
  useBatchAvailablePlayers,
  useBatchMemberships,
  useBatchPlayers,
  useBatches,
  useUpdateBatch,
} from '../hooks/useBatches';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type BatchFormValues = {
  name: string;
  ageGroup: string;
  description: string;
  trainingDays: string;
  trainingTime: string;
  coachId: string;
};

export default function BatchDetailPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { academyId } = useActiveAcademy();
  const canManage = useCan('batches:manage');
  const batchesQuery = useBatches(academyId);
  const batchPlayersQuery = useBatchPlayers(batchId ?? null, academyId);
  const availablePlayersQuery = useBatchAvailablePlayers(academyId);
  const membersQuery = useAcademyMembers(academyId, { status: 'active' });
  const { addPlayer, removePlayer } = useBatchMemberships(batchId as string, academyId as string);
  const updateBatch = useUpdateBatch(academyId as string);
  const pushToast = useUiStore((state) => state.pushToast);

  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddPlayersModal, setShowAddPlayersModal] = useState(false);
  const [playerToRemove, setPlayerToRemove] = useState<{ id: string; name: string } | null>(null);

  const batch = batchesQuery.data?.find((item) => item.id === batchId);
  const coach = membersQuery.data?.find((member) => member.id === batch?.coachId);
  const frequencyDays = batch?.trainingDays ? batch.trainingDays.split(',').length : 0;

  const unassignedPlayers = useMemo(() => {
    if (!availablePlayersQuery.data || !batchPlayersQuery.data) return [];
    const assignedIds = new Set(batchPlayersQuery.data.map((player) => player.academyMemberId));
    return availablePlayersQuery.data.filter((member) => !assignedIds.has(member.id));
  }, [availablePlayersQuery.data, batchPlayersQuery.data]);

  const handleAddPlayersBulk = async (memberIds: string[]) => {
    let successCount = 0;
    for (const id of memberIds) {
      try {
        await addPlayer.mutateAsync({ academyMemberId: id });
        successCount++;
      } catch {
        // ignore individual duplicate error
      }
    }
    pushToast({
      title: `${successCount} player${successCount === 1 ? '' : 's'} assigned to batch`,
      variant: 'success',
    });
    void batchPlayersQuery.refetch();
  };

  const handleConfirmRemovePlayer = async () => {
    if (!playerToRemove) return;
    await removePlayer.mutateAsync({ batchMemberId: playerToRemove.id });
    pushToast({ title: `${playerToRemove.name} removed from batch`, variant: 'success' });
    setPlayerToRemove(null);
    void batchPlayersQuery.refetch();
  };

  if (!academyId || !batchId || !isUUID(batchId)) {
    return (
      <EmptyState
        title={!batchId || !academyId ? 'No batch selected' : 'Invalid batch link'}
        description={
          !batchId || !academyId
            ? 'Select a batch from the batches list to view its details.'
            : 'The batch link you followed is not valid. Please return to the batches list.'
        }
      />
    );
  }

  return (
    <div className="space-y-4 pb-12 sm:pb-6">
      {/* 1. App Bar Header */}
      <div className="border-border-subtle/40 flex flex-col gap-2 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigate('/batches')}
              aria-label="Back to batches"
              className="text-fg hover:bg-surface-muted/60 h-auto px-2 py-1 font-semibold"
            >
              &larr; Back
            </Button>
            <h1 className="font-heading text-fg truncate text-2xl font-extrabold tracking-tight uppercase md:text-3xl">
              {batch?.name ?? 'Batch Detail'}
            </h1>
          </div>
          {canManage && batch && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEditForm((open) => !open)}
              className="h-11 min-h-[44px] rounded-[10px] px-3.5 text-xs font-bold"
            >
              {showEditForm ? 'Cancel Edit' : 'Edit Batch'}
            </Button>
          )}
        </div>
        {batch && (
          <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-sans text-xs">
            <span className="bg-surface-muted/60 border-border-subtle/40 text-fg rounded border px-2 py-0.5 font-mono text-[11px] font-bold">
              {batch.ageGroup}
            </span>
            <span className="bg-surface-muted/60 border-border-subtle/40 rounded border px-2 py-0.5 font-mono text-[11px]">
              {batch.trainingDays || 'Flexible schedule'}
            </span>
            {batch.trainingTime && (
              <span className="bg-surface-muted/60 border-border-subtle/40 rounded border px-2 py-0.5 font-mono text-[11px]">
                {batch.trainingTime}
              </span>
            )}
            {coach && (
              <span className="bg-surface-muted text-fg inline-flex items-center rounded px-2 py-0.5 font-semibold">
                Coach: {coach.fullName ?? coach.email}
              </span>
            )}
          </div>
        )}
      </div>

      {!batch ? (
        <EmptyState
          title="Batch not found"
          description="This batch does not exist or you do not have access."
        />
      ) : (
        <div className="space-y-4">
          {/* 2. Stat Strip (3 Columns Scorecard) */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
              <span className="text-fg-muted font-heading truncate text-[10px] font-bold tracking-wider uppercase">
                Active Players
              </span>
              <div className="mt-2.5">
                <p className="text-fg font-mono text-2xl font-bold">
                  {batchPlayersQuery.data?.length ?? 0}
                </p>
                <p className="text-fg-muted font-heading mt-0.5 truncate text-[11px] font-medium">
                  Enrolled Squad
                </p>
              </div>
            </div>

            <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
              <span className="text-fg-muted font-heading truncate text-[10px] font-bold tracking-wider uppercase">
                Weekly Schedule
              </span>
              <div className="mt-2.5">
                <p className="text-fg font-mono text-2xl font-bold">
                  {frequencyDays > 0 ? `${frequencyDays}x` : 'Flex'}
                </p>
                <p className="text-fg-muted font-heading mt-0.5 truncate text-[11px] font-medium">
                  Sessions / Week
                </p>
              </div>
            </div>

            <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
              <span className="text-fg-muted font-heading truncate text-[10px] font-bold tracking-wider uppercase">
                Age Group
              </span>
              <div className="mt-2.5">
                <p className="text-fg font-mono text-2xl font-bold">{batch.ageGroup}</p>
                <p className="text-fg-muted font-heading mt-0.5 truncate text-[11px] font-medium">
                  Squad Tier
                </p>
              </div>
            </div>
          </div>

          {showEditForm && canManage ? (
            <BatchEditForm
              batch={batch}
              coaches={
                membersQuery.data?.filter(
                  (member) => member.role === 'coach' || member.role === 'academy_owner',
                ) ?? []
              }
              updateBatch={updateBatch}
              pushToast={pushToast}
              onSuccess={() => {
                setShowEditForm(false);
                pushToast({ title: 'Batch updated', variant: 'success' });
              }}
            />
          ) : null}

          {/* 3. Assigned Players List Section */}
          <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border shadow-2xs">
            <div className="border-border-subtle/50 flex items-center justify-between gap-3 border-b p-4">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-heading text-fg text-sm font-bold tracking-wider uppercase">
                  Assigned Players
                </h3>
                <p className="text-fg-muted font-sans text-[11px] font-medium">
                  Active roster enrolled in this squad
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-surface-muted border-border-subtle text-fg-muted shrink-0 rounded border px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase">
                  {batchPlayersQuery.data?.length ?? 0} ACTIVE
                </span>
                {canManage && (
                  <Button
                    size="sm"
                    onClick={() => setShowAddPlayersModal(true)}
                    className="bg-primary min-h-[38px] rounded-[10px] px-3 text-xs font-bold text-white hover:opacity-90"
                  >
                    Add Players
                  </Button>
                )}
              </div>
            </div>
            <div className="p-0">
              {batchPlayersQuery.isPending ? (
                <p className="text-fg-muted py-8 text-center font-sans text-sm">
                  Loading assigned players…
                </p>
              ) : batchPlayersQuery.isError ? (
                <ErrorState
                  error={batchPlayersQuery.error}
                  onRetry={() => void batchPlayersQuery.refetch()}
                />
              ) : batchPlayersQuery.data?.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <p className="text-fg text-sm font-semibold">No players assigned yet</p>
                  <p className="text-fg-muted mt-1 font-sans text-xs">
                    Assign active players to organize your squad roster.
                  </p>
                  {canManage && (
                    <Button
                      onClick={() => setShowAddPlayersModal(true)}
                      className="bg-primary mt-4 h-11 min-h-[44px] rounded-[10px] px-4 text-xs font-bold text-white hover:opacity-90"
                    >
                      Add Players to Batch
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-border-subtle/60 divide-y">
                  {batchPlayersQuery.data.map((player) => {
                    const name = player.fullName ?? player.email;
                    const initials = name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <div
                        key={player.id}
                        className="hover:bg-surface-muted/20 flex min-h-[44px] items-center justify-between gap-3 p-3.5 transition-colors"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="bg-surface-muted border-border-subtle text-fg-muted font-heading flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-fg truncate text-sm font-bold">{name}</p>
                            <p className="text-fg-muted truncate font-sans text-xs">
                              {player.email}
                            </p>
                          </div>
                        </div>

                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPlayerToRemove({ id: player.id, name })}
                            aria-label={`Remove ${name}`}
                            className="text-error hover:bg-error-pale min-h-[44px] rounded-[10px] px-3 text-xs font-bold"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Searchable Multi-Select Add Players Modal */}
      {canManage && batch ? (
        <AddBatchPlayersModal
          open={showAddPlayersModal}
          onClose={() => setShowAddPlayersModal(false)}
          batchName={batch.name}
          availablePlayers={unassignedPlayers}
          onAddPlayers={handleAddPlayersBulk}
          isLoading={addPlayer.isPending}
        />
      ) : null}

      {/* Confirmation Modal for Removing Player */}
      <Modal
        open={Boolean(playerToRemove)}
        onClose={() => setPlayerToRemove(null)}
        title="Remove Player from Batch"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setPlayerToRemove(null)}
              className="h-12 min-h-[48px] w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={removePlayer.isPending}
              onClick={() => void handleConfirmRemovePlayer()}
              className="h-12 min-h-[48px] w-full sm:w-auto"
            >
              Remove Player
            </Button>
          </div>
        }
      >
        <p className="text-fg text-sm">
          Are you sure you want to remove{' '}
          <strong className="text-fg font-bold">{playerToRemove?.name}</strong> from{' '}
          <strong className="text-fg font-bold">{batch?.name}</strong>?
        </p>
      </Modal>
    </div>
  );
}

function BatchEditForm({
  batch,
  coaches,
  updateBatch,
  pushToast,
  onSuccess,
}: {
  batch: Batch;
  coaches: Array<{ id: string; fullName: string | null; email: string }>;
  updateBatch: ReturnType<typeof useUpdateBatch>;
  pushToast: (toast: {
    title: string;
    description?: string;
    variant: 'info' | 'success' | 'warning' | 'error';
  }) => string;
  onSuccess: () => void;
}) {
  const initialDays = (batch.trainingDays ?? '')
    .split(',')
    .map((day: string) => day.trim())
    .filter((day: string) => DAYS.includes(day));

  const parseTime = (time: string): Date | null => {
    const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match || !match[3]) return null;
    const hours = (Number(match[1]) % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    const minutes = Number(match[2]);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const [startTimeText = '', endTimeText = ''] = (batch.trainingTime ?? '')
    .split('-')
    .map((part: string) => part.trim());

  const [selectedDays, setSelectedDays] = useState<string[]>(initialDays);
  const [startTime, setStartTime] = useState<Date | null>(parseTime(startTimeText));
  const [endTime, setEndTime] = useState<Date | null>(parseTime(endTimeText));

  const formatTimeStr = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<BatchFormValues>({
    defaultValues: {
      name: batch.name,
      ageGroup: batch.ageGroup,
      description: batch.description ?? '',
      trainingDays: batch.trainingDays ?? '',
      trainingTime: batch.trainingTime ?? '',
      coachId: batch.coachId ?? '',
    },
  });

  const toggleDay = (day: string) => {
    const updated = selectedDays.includes(day)
      ? selectedDays.filter((item) => item !== day)
      : [...selectedDays, day];
    setSelectedDays(updated);
    setValue('trainingDays', updated.join(', '), { shouldDirty: true });
  };

  const handleStartTimeChange = (date: Date | null) => {
    setStartTime(date);
    const newTimeStr = `${formatTimeStr(date)} - ${formatTimeStr(endTime)}`;
    setValue('trainingTime', newTimeStr, { shouldDirty: true });
  };

  const handleEndTimeChange = (date: Date | null) => {
    setEndTime(date);
    const newTimeStr = `${formatTimeStr(startTime)} - ${formatTimeStr(date)}`;
    setValue('trainingTime', newTimeStr, { shouldDirty: true });
  };

  const handleSubmitEdit = handleSubmit(async (value) => {
    const formattedDays = selectedDays.join(', ');
    const formattedTime =
      startTime && endTime ? `${formatTimeStr(startTime)} - ${formatTimeStr(endTime)}` : '';
    try {
      await updateBatch.mutateAsync({
        batchId: batch.id,
        input: {
          name: value.name,
          ageGroup: value.ageGroup,
          description: value.description || null,
          trainingDays: formattedDays || null,
          trainingTime: formattedTime || null,
          coachId: value.coachId || null,
        },
      });
      onSuccess();
    } catch (error) {
      pushToast({
        title: 'Failed to update batch',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  });

  return (
    <Card>
      <form onSubmit={handleSubmitEdit} noValidate>
        <CardHeader title="Edit Batch" description="Update details for this training batch." />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-fg block text-sm font-medium">Batch name</label>
              <Input
                className="h-12 min-h-[44px]"
                {...register('name', {
                  required: 'Batch name is required',
                  minLength: { value: 2, message: 'Batch name must be at least 2 characters' },
                  maxLength: { value: 80, message: 'Batch name must be 80 characters or fewer' },
                })}
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
                {...register('ageGroup', {
                  required: 'Age group is required',
                  maxLength: { value: 20, message: 'Age group must be 20 characters or fewer' },
                })}
                hasError={Boolean(errors.ageGroup)}
              />
              {errors.ageGroup ? (
                <p className="text-danger mt-1 text-xs">{errors.ageGroup.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-fg block text-sm font-medium">
              Training days <span className="text-fg-muted text-xs font-normal">(Optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <Button
                  key={day}
                  type="button"
                  size="sm"
                  variant={selectedDays.includes(day) ? 'primary' : 'secondary'}
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
              Training time <span className="text-fg-muted text-xs font-normal">(Optional)</span>
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <DatePicker
                selected={startTime}
                onChange={handleStartTimeChange}
                showTimeSelect
                showTimeSelectOnly
                timeIntervals={30}
                dateFormat="h:mm aa"
                placeholderText="Start Time"
                className="bg-surface border-border-subtle text-fg h-12 min-h-[44px] w-full rounded-lg border px-3 py-2"
              />
              <DatePicker
                selected={endTime}
                onChange={handleEndTimeChange}
                showTimeSelect
                showTimeSelectOnly
                timeIntervals={30}
                dateFormat="h:mm aa"
                placeholderText="End Time"
                className="bg-surface border-border-subtle text-fg h-12 min-h-[44px] w-full rounded-lg border px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="text-fg block text-sm font-medium">
              Assigned coach <span className="text-fg-muted text-xs font-normal">(Optional)</span>
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
            <label className="text-fg block text-sm font-medium">
              Description <span className="text-fg-muted text-xs font-normal">(Optional)</span>
            </label>
            <Textarea className="min-h-[80px]" {...register('description')} />
          </div>
        </CardBody>
        <CardFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            isLoading={updateBatch.isPending}
            className="h-12 min-h-[48px] w-full font-semibold sm:w-auto"
          >
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
