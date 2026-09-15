import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit3, UserPlus, Trash2 } from 'lucide-react';

import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { useAcademyMembers } from '@/features/members';
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
        // ignore duplicate
      }
    }
    pushToast({
      title: `${successCount} player${successCount === 1 ? '' : 's'} assigned to squad`,
      variant: 'success',
    });
    void batchPlayersQuery.refetch();
  };

  const handleConfirmRemovePlayer = async () => {
    if (!playerToRemove) return;
    await removePlayer.mutateAsync({ batchMemberId: playerToRemove.id });
    pushToast({ title: `${playerToRemove.name} removed from squad`, variant: 'success' });
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
    <div className="flex flex-col space-y-4 pb-24 md:pb-6">
      {/* 1. App Bar Header */}
      <div className="border-border-subtle/40 flex items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/batches')}
            className="border-border-subtle bg-surface text-fg-muted hover:text-fg hover:bg-surface-muted flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
            aria-label="Back to batches"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-heading text-fg text-lg font-extrabold tracking-tight uppercase md:text-xl">
              {batch?.name ?? 'Squad Details'}
            </h1>
            {batch && (
              <p className="text-fg-muted font-sans text-xs">
                {batch.ageGroup} • {batch.trainingDays || 'Flexible Schedule'}
              </p>
            )}
          </div>
        </div>

        {canManage && batch && (
          <div className="flex items-center gap-2">
            <Link
              to={`/batches/${batch.id}/attendance`}
              className="border-border-subtle bg-surface text-fg-muted hover:bg-surface-muted hover:text-fg flex h-8.5 min-h-[34px] items-center rounded-lg border px-3 text-xs font-bold transition-colors"
            >
              Attendance Logs
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEditForm((open) => !open)}
              className="h-8.5 min-h-[34px] rounded-lg px-3 text-xs font-bold"
            >
              <Edit3 className="mr-1.5 h-3.5 w-3.5" />
              {showEditForm ? 'Cancel Edit' : 'Edit Squad'}
            </Button>
          </div>
        )}
      </div>

      {!batch ? (
        <EmptyState
          title="Squad not found"
          description="This batch does not exist or you do not have access."
        />
      ) : (
        <div className="space-y-4">
          {/* 2. Stat Strip (3 Columns Scorecard) */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
              <span className="font-heading text-fg-muted truncate text-[10px] font-bold tracking-wider uppercase">
                Squad Size
              </span>
              <div className="mt-2">
                <p className="text-primary font-mono text-2xl font-bold">
                  {batchPlayersQuery.data?.length ?? 0}
                </p>
                <p className="text-fg-muted font-sans text-[11px]">Active Players</p>
              </div>
            </div>

            <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
              <span className="font-heading text-fg-muted truncate text-[10px] font-bold tracking-wider uppercase">
                Weekly Schedule
              </span>
              <div className="mt-2">
                <p className="text-fg font-mono text-2xl font-bold">
                  {frequencyDays > 0 ? `${frequencyDays}x` : 'Flex'}
                </p>
                <p className="text-fg-muted font-sans text-[11px]">Sessions / Wk</p>
              </div>
            </div>

            <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
              <span className="font-heading text-fg-muted truncate text-[10px] font-bold tracking-wider uppercase">
                Age Bracket
              </span>
              <div className="mt-2">
                <p className="font-heading text-fg text-2xl font-extrabold uppercase">
                  {batch.ageGroup}
                </p>
                <p className="text-fg-muted font-sans text-[11px]">Category</p>
              </div>
            </div>
          </div>

          {/* Edit Form Panel */}
          {showEditForm && canManage && (
            <BatchEditForm
              batch={batch}
              coaches={membersQuery.data?.filter((member) => member.role === 'coach') ?? []}
              updateBatch={updateBatch}
              onSuccess={() => {
                setShowEditForm(false);
                pushToast({ title: 'Batch updated', variant: 'success' });
              }}
            />
          )}

          {/* 3. Assigned Players List Section */}
          <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border shadow-2xs">
            <div className="border-border-subtle/50 flex items-center justify-between gap-3 border-b p-4">
              <div>
                <h3 className="font-heading text-fg text-sm font-extrabold tracking-tight uppercase">
                  Enrolled Roster
                </h3>
                <p className="text-fg-muted font-sans text-xs">
                  Players assigned to this training squad
                </p>
              </div>
              {canManage && (
                <Button
                  size="sm"
                  onClick={() => setShowAddPlayersModal(true)}
                  className="h-8.5 min-h-[34px] rounded-lg px-3 text-xs font-bold"
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Add Players
                </Button>
              )}
            </div>

            <div>
              {batchPlayersQuery.isPending ? (
                <p className="text-fg-muted py-8 text-center font-sans text-xs">
                  Loading squad roster…
                </p>
              ) : batchPlayersQuery.isError ? (
                <ErrorState
                  error={batchPlayersQuery.error}
                  onRetry={() => void batchPlayersQuery.refetch()}
                />
              ) : batchPlayersQuery.data?.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <p className="font-heading text-fg text-sm font-bold uppercase">
                    No players assigned yet
                  </p>
                  <p className="text-fg-muted mt-1 font-sans text-xs">
                    Add registered players to populate this squad roster.
                  </p>
                  {canManage && (
                    <Button
                      onClick={() => setShowAddPlayersModal(true)}
                      className="mt-3.5 h-9 min-h-[36px] rounded-lg px-4 text-xs font-bold"
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Add Players to Squad
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-border-subtle/50 divide-y">
                  {batchPlayersQuery.data.map((player) => {
                    const name = player.fullName || player.email || 'Player';
                    const initials =
                      (name || 'P')
                        .split(' ')
                        .filter(Boolean)
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase() || 'P';

                    return (
                      <div
                        key={player.id}
                        className="hover:bg-surface-muted/20 flex min-h-[50px] items-center justify-between gap-3 p-3 transition-colors"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="border-border-subtle bg-surface-container-low font-heading text-fg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/members/${player.academyMemberId}`}
                              className="text-fg hover:text-primary block truncate font-sans text-sm font-bold transition-colors"
                            >
                              {name}
                            </Link>
                            <p className="text-fg-muted truncate font-sans text-xs">
                              {player.email}
                            </p>
                          </div>
                        </div>

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setPlayerToRemove({ id: player.id, name })}
                            aria-label={`Remove ${name} from squad`}
                            className="text-fg-muted hover:bg-error-pale hover:text-error flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
      {canManage && batch && (
        <AddBatchPlayersModal
          open={showAddPlayersModal}
          onClose={() => setShowAddPlayersModal(false)}
          batchName={batch.name}
          availablePlayers={unassignedPlayers}
          onAddPlayers={handleAddPlayersBulk}
          isLoading={addPlayer.isPending}
        />
      )}

      {/* Confirmation Modal for Removing Player */}
      <Modal
        open={Boolean(playerToRemove)}
        onClose={() => setPlayerToRemove(null)}
        title="Remove Player from Squad"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setPlayerToRemove(null)}
              className="h-9 min-h-[36px] rounded-lg px-4 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={removePlayer.isPending}
              onClick={() => void handleConfirmRemovePlayer()}
              className="h-9 min-h-[36px] rounded-lg px-4 text-xs font-bold"
            >
              Remove Player
            </Button>
          </div>
        }
      >
        <p className="text-fg font-sans text-xs">
          Are you sure you want to remove{' '}
          <strong className="text-fg">{playerToRemove?.name}</strong> from{' '}
          <strong className="text-fg">{batch?.name}</strong>?
        </p>
      </Modal>
    </div>
  );
}

function BatchEditForm({
  batch,
  coaches,
  updateBatch,
  onSuccess,
}: {
  batch: Batch;
  coaches: Array<{ id: string; fullName: string | null; email: string }>;
  updateBatch: ReturnType<typeof useUpdateBatch>;
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

  const { register, handleSubmit, setValue } = useForm<BatchFormValues>({
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
  });

  return (
    <div className="border-border-subtle bg-surface rounded-xl border p-4 shadow-2xs">
      <form onSubmit={handleSubmitEdit} noValidate>
        <div className="border-border-subtle/50 mb-4 border-b pb-3">
          <h2 className="font-heading text-fg text-base font-extrabold tracking-tight uppercase">
            Edit Squad Specifications
          </h2>
        </div>
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                Squad Name
              </label>
              <Input
                className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                {...register('name', { required: 'Squad name is required' })}
              />
            </div>
            <div>
              <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                Age Group
              </label>
              <Input
                className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                {...register('ageGroup', { required: 'Age group is required' })}
              />
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
                Assigned Coach
              </label>
              <Select
                className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                {...register('coachId')}
              >
                <option value="">Select coach (Optional)</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName ?? c.email}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                Training Time Window
              </label>
              <div className="grid grid-cols-2 gap-2">
                <DatePicker
                  selected={startTime}
                  onChange={handleStartTimeChange}
                  showTimeSelect
                  showTimeSelectOnly
                  timeIntervals={30}
                  dateFormat="h:mm aa"
                  placeholderText="Start Time"
                  className="border-border-subtle bg-surface-container-low text-fg h-10 min-h-[40px] w-full rounded-lg border px-3 font-mono text-xs"
                />
                <DatePicker
                  selected={endTime}
                  onChange={handleEndTimeChange}
                  showTimeSelect
                  showTimeSelectOnly
                  timeIntervals={30}
                  dateFormat="h:mm aa"
                  placeholderText="End Time"
                  className="border-border-subtle bg-surface-container-low text-fg h-10 min-h-[40px] w-full rounded-lg border px-3 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
              Description
            </label>
            <Textarea
              rows={2}
              className="border-border-subtle bg-surface-container-low rounded-lg text-xs"
              {...register('description')}
            />
          </div>
        </div>

        <div className="border-border-subtle/40 mt-4 flex items-center justify-end gap-2.5 border-t pt-3">
          <Button
            type="submit"
            variant="primary"
            isLoading={updateBatch.isPending}
            className="h-9 min-h-[36px] rounded-lg px-5 text-xs font-bold"
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
