import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { useAcademyMembers } from '@/features/members';
import { useCan } from '@/lib/rbac';
import { useUiStore } from '@/stores';
import type { UUID } from '@/types';
import type { CreateDrillInput } from '../api/drillsTypes';
import {
  useAssignDrill,
  useCreateDrill,
  useDeleteDrill,
  useDeleteDrillAssignment,
  useDrillAssignments,
  useDrills,
} from '../hooks/useDrills';
import { useBatches } from '@/features/batches';

const DEFAULT_FORM_VALUES: CreateDrillInput = {
  academyId: '',
  name: '',
  category: 'batting',
  description: null,
  durationMinutes: null,
  difficulty: 'beginner',
};

export default function DrillsPage() {
  const navigate = useNavigate();
  const { academyId } = useActiveAcademy();
  const canManage = useCan('drills:manage');
  const drillsQuery = useDrills(academyId);
  const createDrill = useCreateDrill(academyId as UUID);
  const deleteDrill = useDeleteDrill(academyId as UUID);
  const pushToast = useUiStore((state) => state.pushToast);
  const [showForm, setShowForm] = useState(false);

  const drills = drillsQuery.data ?? [];
  const assignmentsQuery = useDrillAssignments(academyId);
  const playersQuery = useAcademyMembers(academyId, { role: 'player', status: 'active' });
  const batchesQuery = useBatches(academyId);
  const assignDrill = useAssignDrill(academyId as string);
  const deleteAssignment = useDeleteDrillAssignment(academyId as string);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CreateDrillInput>({ defaultValues: DEFAULT_FORM_VALUES });

  const [selectedDrillId, setSelectedDrillId] = useState('');
  const [targetType, setTargetType] = useState<'player' | 'batch'>('player');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const activePlayers = playersQuery.data ?? [];
  const batches = batchesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];

  const assignmentSaveDisabled =
    !selectedDrillId || (targetType === 'player' ? !selectedPlayerId : !selectedBatchId);

  const handleCreate = handleSubmit(async (values) => {
    if (!academyId || !canManage) return;
    try {
      await createDrill.mutateAsync({ ...values, academyId });
      pushToast({ title: 'Drill created', variant: 'success' });
      reset(DEFAULT_FORM_VALUES);
      setShowForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create drill';
      pushToast({ title: 'Create Failed', description: msg, variant: 'error' });
    }
  });

  const handleAssign = async () => {
    if (!academyId || !selectedDrillId || assignmentSaveDisabled) return;
    try {
      await assignDrill.mutateAsync({
        academyId,
        drillId: selectedDrillId,
        playerId: targetType === 'player' ? selectedPlayerId : null,
        batchId: targetType === 'batch' ? selectedBatchId : null,
        dueDate: dueDate || null,
      });
      pushToast({ title: 'Drill assigned', variant: 'success' });
      setSelectedDrillId('');
      setSelectedPlayerId('');
      setSelectedBatchId('');
      setDueDate('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign drill';
      pushToast({ title: 'Assign Failed', description: msg, variant: 'error' });
    }
  };

  const handleDeleteAssignment = async (assignmentId: UUID) => {
    try {
      await deleteAssignment.mutateAsync({ assignmentId });
      pushToast({ title: 'Assignment removed', variant: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove assignment';
      pushToast({ title: 'Remove Failed', description: msg, variant: 'error' });
    }
  };

  const handleDeleteDrill = async (drillId: UUID) => {
    try {
      await deleteDrill.mutateAsync({ drillId });
      pushToast({ title: 'Drill deleted', variant: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete drill';
      pushToast({ title: 'Delete Failed', description: msg, variant: 'error' });
    }
  };

  if (!academyId) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-fg text-xl font-semibold">Drills</h1>
          <p className="text-fg-muted">Create and manage drills for your academy.</p>
        </div>
        {canManage ? (
          <Button onClick={() => setShowForm((open) => !open)}>
            {showForm ? 'Cancel' : 'New drill'}
          </Button>
        ) : null}
      </div>

      {showForm && canManage ? (
        <Card>
          <form onSubmit={handleCreate} noValidate>
            <CardHeader title="Create drill" description="Define a drill for your players." />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-fg block text-sm font-medium">Title</label>
                  <Input
                    {...register('name', { required: 'Title is required' })}
                    hasError={Boolean(errors.name)}
                  />
                  {errors.name ? (
                    <p className="text-danger text-xs">{errors.name.message}</p>
                  ) : null}
                </div>
                <div>
                  <label className="text-fg block text-sm font-medium">Category</label>
                  <Select {...register('category')}>
                    <option value="batting">Batting</option>
                    <option value="bowling">Bowling</option>
                    <option value="fielding">Fielding</option>
                    <option value="fitness">Fitness</option>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-fg block text-sm font-medium">Duration (minutes)</label>
                  <Input
                    {...register('durationMinutes', { valueAsNumber: true })}
                    type="number"
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-fg block text-sm font-medium">Difficulty</label>
                  <Select {...register('difficulty')}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="elite">Elite</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-fg block text-sm font-medium">Description</label>
                <Textarea {...register('description')} rows={4} />
              </div>
            </CardBody>
            <CardFooter>
              <Button type="submit" isLoading={createDrill.isPending} disabled={!isDirty}>
                Save drill
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader title="Assign drills" description="Assign drills to a player or batch." />
          <CardBody className="space-y-4">
            <div>
              <label className="text-fg mb-1 block text-sm font-medium">Assign to</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={targetType === 'player' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setTargetType('player');
                    setSelectedBatchId('');
                  }}
                >
                  Individual Player
                </Button>
                <Button
                  type="button"
                  variant={targetType === 'batch' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setTargetType('batch');
                    setSelectedPlayerId('');
                  }}
                >
                  Entire Batch
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-fg block text-sm font-medium">Drill</label>
                <Select
                  value={selectedDrillId}
                  onChange={(event) => setSelectedDrillId(event.target.value)}
                >
                  <option value="">Select drill</option>
                  {drills.map((drill) => (
                    <option key={drill.id} value={drill.id}>
                      {drill.name}
                    </option>
                  ))}
                </Select>
              </div>
              {targetType === 'player' ? (
                <div>
                  <label className="text-fg block text-sm font-medium">Player</label>
                  <Select
                    value={selectedPlayerId}
                    onChange={(event) => setSelectedPlayerId(event.target.value)}
                  >
                    <option value="">Select player</option>
                    {activePlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.fullName ?? player.email}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <div>
                  <label className="text-fg block text-sm font-medium">Batch</label>
                  <Select
                    value={selectedBatchId}
                    onChange={(event) => setSelectedBatchId(event.target.value)}
                  >
                    <option value="">Select batch</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-fg block text-sm font-medium">Due date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleAssign}
                  isLoading={assignDrill.isPending}
                  disabled={assignmentSaveDisabled}
                >
                  Assign drill
                </Button>
              </div>
            </div>
            <p className="text-fg-muted text-sm">
              Select a drill and assign to either an individual player or an entire batch.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Training assignments"
          description="Track the drill assignments for this academy."
        />
        <CardBody>
          {assignmentsQuery.isPending ? (
            <p className="text-fg-muted">Loading assignments…</p>
          ) : assignmentsQuery.isError ? (
            <ErrorState
              error={assignmentsQuery.error}
              onRetry={() => void assignmentsQuery.refetch()}
            />
          ) : assignments.length === 0 ? (
            <EmptyState
              title="No assignments yet"
              description="Assign drills to players or batches to help them train."
            />
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="border-border-subtle rounded-2xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-fg text-lg font-semibold">{assignment.drill.name}</p>
                      <p className="text-fg-muted text-sm">
                        {assignment.playerName ? `Player: ${assignment.playerName}` : ''}
                        {assignment.playerName && assignment.batchName ? ' · ' : ''}
                        {assignment.batchName ? `Batch: ${assignment.batchName}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={assignment.status === 'completed' ? 'success' : 'warning'}>
                        {assignment.status}
                      </Badge>
                      {canManage ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void handleDeleteAssignment(assignment.id)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-fg-muted mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    <p>Assigned {new Date(assignment.assignedAt).toLocaleDateString()}</p>
                    <p>
                      Due{' '}
                      {assignment.dueDate
                        ? new Date(assignment.dueDate).toLocaleDateString()
                        : 'No due date'}
                    </p>
                    <p>Created by {assignment.assignedBy ?? 'Coach'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="All drills" description="Your drill library for the academy." />
        <CardBody>
          {drillsQuery.isPending ? (
            <p className="text-fg-muted">Loading drills…</p>
          ) : drillsQuery.isError ? (
            <ErrorState error={drillsQuery.error} onRetry={() => void drillsQuery.refetch()} />
          ) : drills.length === 0 ? (
            <EmptyState title="No drills yet" description="Create a drill to get started." />
          ) : (
            <div className="space-y-3">
              {drills.map((drill) => (
                <div key={drill.id} className="border-border-subtle rounded-2xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-fg text-lg font-semibold">{drill.name}</p>
                      <p className="text-fg-muted text-sm">
                        {drill.category} · {drill.difficulty}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void navigate(`/drills/${drill.id}`)}
                      >
                        View
                      </Button>
                      {canManage ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void handleDeleteDrill(drill.id)}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-fg-muted mt-3 text-sm">
                    {drill.description ?? 'No description provided.'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
