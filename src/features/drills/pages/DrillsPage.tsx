import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, UserCheck, Trash2, Clock } from 'lucide-react';

import { Badge, Button, Input, Select, Textarea } from '@/components/ui';
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
  const [activeTab, setActiveTab] = useState<'drills' | 'assignments'>('drills');

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
    <div className="flex flex-col space-y-4 pb-24 md:pb-6">
      {/* 1. Header with Tab Switcher */}
      <div className="border-border-subtle/40 flex flex-col gap-3 border-b pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-fg text-xl font-extrabold tracking-tight uppercase md:text-2xl">
              Drills & Practice Library
            </h1>
            <p className="text-fg-muted font-sans text-xs">
              Standardized cricket drills, routines & squad assignments
            </p>
          </div>
          {canManage && (
            <Button
              variant={showForm ? 'secondary' : 'primary'}
              onClick={() => setShowForm((open) => !open)}
              className="h-9 min-h-[36px] rounded-lg px-3.5 text-xs font-bold"
            >
              {showForm ? (
                'Cancel'
              ) : (
                <>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  New Drill
                </>
              )}
            </Button>
          )}
        </div>

        {/* Tab pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('drills')}
            className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-all ${
              activeTab === 'drills'
                ? 'border-primary bg-primary text-black shadow-2xs'
                : 'border-border-subtle bg-surface text-fg-muted hover:text-fg'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Drill Library ({drills.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-all ${
              activeTab === 'assignments'
                ? 'border-primary bg-primary text-black shadow-2xs'
                : 'border-border-subtle bg-surface text-fg-muted hover:text-fg'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Assignments ({assignments.length})</span>
          </button>
        </div>
      </div>

      {/* Create Drill Drawer / Panel */}
      {showForm && canManage && (
        <div className="border-border-subtle bg-surface animate-fadeIn rounded-xl border p-4 shadow-2xs">
          <form onSubmit={handleCreate} noValidate>
            <div className="border-border-subtle/50 mb-4 border-b pb-3">
              <h2 className="font-heading text-fg text-base font-extrabold tracking-tight uppercase">
                Create Practice Drill
              </h2>
              <p className="text-fg-muted font-sans text-xs">
                Define a routine for your coaches and players
              </p>
            </div>
            <div className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Drill Name
                  </label>
                  <Input
                    {...register('name', { required: 'Drill name is required' })}
                    placeholder="e.g. Cover Drive Repetitions"
                    hasError={Boolean(errors.name)}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  />
                  {errors.name && (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Category
                  </label>
                  <Select
                    {...register('category')}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  >
                    <option value="batting">Batting</option>
                    <option value="bowling">Bowling</option>
                    <option value="fielding">Fielding</option>
                    <option value="fitness">Fitness</option>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Duration (Minutes)
                  </label>
                  <Input
                    {...register('durationMinutes', { valueAsNumber: true })}
                    type="number"
                    min={1}
                    placeholder="e.g. 20"
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Difficulty Level
                  </label>
                  <Select
                    {...register('difficulty')}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="elite">Elite</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                  Description & Execution Instructions
                </label>
                <Textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Set cones at 5m distance, 4 sets of 10 repetitions with front foot forward..."
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
                isLoading={createDrill.isPending}
                disabled={!isDirty}
                className="h-9 min-h-[36px] rounded-lg px-5 text-xs font-bold"
              >
                Save Drill
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Drills Library */}
      {activeTab === 'drills' && (
        <div className="space-y-4">
          {/* Quick Assign Section */}
          {canManage && drills.length > 0 && (
            <div className="border-border-subtle bg-surface rounded-xl border p-4 shadow-2xs">
              <div className="border-border-subtle/50 mb-3 border-b pb-2.5">
                <h2 className="font-heading text-fg text-sm font-extrabold tracking-tight uppercase">
                  Assign Drill
                </h2>
                <p className="text-fg-muted font-sans text-xs">
                  Assign a routine to an individual player or full squad
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('player');
                      setSelectedBatchId('');
                    }}
                    className={`h-7 rounded-md border px-2.5 text-xs font-bold transition-all ${
                      targetType === 'player'
                        ? 'border-primary bg-primary-pale text-primary'
                        : 'border-border-subtle bg-surface-container-low text-fg-muted hover:text-fg'
                    }`}
                  >
                    Individual Player
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType('batch');
                      setSelectedPlayerId('');
                    }}
                    className={`h-7 rounded-md border px-2.5 text-xs font-bold transition-all ${
                      targetType === 'batch'
                        ? 'border-primary bg-primary-pale text-primary'
                        : 'border-border-subtle bg-surface-container-low text-fg-muted hover:text-fg'
                    }`}
                  >
                    Entire Squad
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                      Select Drill
                    </label>
                    <Select
                      value={selectedDrillId}
                      onChange={(e) => setSelectedDrillId(e.target.value)}
                      className="border-border-subtle bg-surface-container-low h-9 min-h-[36px] rounded-lg text-xs"
                    >
                      <option value="">Select drill</option>
                      {drills.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.category})
                        </option>
                      ))}
                    </Select>
                  </div>

                  {targetType === 'player' ? (
                    <div>
                      <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                        Select Player
                      </label>
                      <Select
                        value={selectedPlayerId}
                        onChange={(e) => setSelectedPlayerId(e.target.value)}
                        className="border-border-subtle bg-surface-container-low h-9 min-h-[36px] rounded-lg text-xs"
                      >
                        <option value="">Select player</option>
                        {activePlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.fullName ?? p.email}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                        Select Squad
                      </label>
                      <Select
                        value={selectedBatchId}
                        onChange={(e) => setSelectedBatchId(e.target.value)}
                        className="border-border-subtle bg-surface-container-low h-9 min-h-[36px] rounded-lg text-xs"
                      >
                        <option value="">Select batch</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  <div>
                    <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                      Due Date (Optional)
                    </label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="border-border-subtle bg-surface-container-low h-9 min-h-[36px] rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleAssign}
                    isLoading={assignDrill.isPending}
                    disabled={assignmentSaveDisabled}
                    className="h-9 min-h-[36px] rounded-lg px-4 text-xs font-bold"
                  >
                    Assign Now
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Drill Cards Grid */}
          {drillsQuery.isPending ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="border-border-subtle bg-surface h-32 animate-pulse rounded-xl border"
                />
              ))}
            </div>
          ) : drillsQuery.isError ? (
            <ErrorState error={drillsQuery.error} onRetry={() => void drillsQuery.refetch()} />
          ) : drills.length === 0 ? (
            <EmptyState
              title="No drills yet"
              description="Create practice drills to build your academy library."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {drills.map((drill) => {
                return (
                  <div
                    key={drill.id}
                    className="border-border-subtle bg-surface hover:border-border flex flex-col justify-between rounded-xl border p-4 shadow-2xs transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-heading text-fg text-base font-bold tracking-tight uppercase">
                          {drill.name}
                        </span>
                        <span className="border-primary/30 bg-primary-pale text-primary shrink-0 rounded-md border px-2 py-0.5 font-sans text-[10px] font-bold uppercase">
                          {drill.category}
                        </span>
                      </div>

                      <div className="text-fg-muted mt-2 flex items-center gap-3 font-mono text-[11px]">
                        <span className="capitalize">{drill.difficulty}</span>
                        {drill.durationMinutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="text-fg-muted h-3 w-3" />
                            {drill.durationMinutes} min
                          </span>
                        )}
                      </div>

                      {drill.description && (
                        <p className="text-fg-muted mt-2 line-clamp-2 font-sans text-xs">
                          {drill.description}
                        </p>
                      )}
                    </div>

                    <div className="border-border-subtle/50 mt-4 flex items-center justify-end gap-2 border-t pt-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/drills/${drill.id}`)}
                        className="h-8 min-h-[32px] rounded-lg px-3 text-xs font-bold"
                      >
                        Edit
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDeleteDrill(drill.id)}
                          className="text-error hover:bg-error-pale h-8 min-h-[32px] rounded-lg px-2 text-xs font-bold"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Assignments List */}
      {activeTab === 'assignments' && (
        <div className="space-y-3">
          {assignmentsQuery.isPending ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="border-border-subtle bg-surface h-20 animate-pulse rounded-xl border"
                />
              ))}
            </div>
          ) : assignmentsQuery.isError ? (
            <ErrorState
              error={assignmentsQuery.error}
              onRetry={() => void assignmentsQuery.refetch()}
            />
          ) : assignments.length === 0 ? (
            <EmptyState
              title="No active assignments"
              description="Assign drills to players or squads to track their training progress."
            />
          ) : (
            <div className="divide-border-subtle/50 border-border-subtle bg-surface divide-y overflow-hidden rounded-xl border shadow-2xs">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="hover:bg-surface-muted/20 flex flex-col justify-between gap-3 p-3.5 transition-colors sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-heading text-fg text-sm font-bold tracking-tight uppercase">
                        {assignment.drill.name}
                      </p>
                      <Badge tone={assignment.status === 'completed' ? 'success' : 'warning'}>
                        {assignment.status}
                      </Badge>
                    </div>
                    <p className="text-fg-muted mt-1 font-sans text-xs">
                      {assignment.playerName ? `Player: ${assignment.playerName}` : ''}
                      {assignment.playerName && assignment.batchName ? ' · ' : ''}
                      {assignment.batchName ? `Squad: ${assignment.batchName}` : ''}
                    </p>
                    <p className="text-fg-muted mt-0.5 font-mono text-[10px]">
                      Due:{' '}
                      {assignment.dueDate
                        ? new Date(assignment.dueDate).toLocaleDateString()
                        : 'Open'}
                    </p>
                  </div>

                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDeleteAssignment(assignment.id)}
                      className="text-error hover:bg-error-pale h-8 min-h-[32px] shrink-0 rounded-lg px-2 text-xs font-bold"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
