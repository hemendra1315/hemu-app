import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';

import { Button, Input, Select, Textarea } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { useCan } from '@/lib/rbac';
import { useUiStore } from '@/stores';
import { useDrills, useUpdateDrill, useDeleteDrill } from '../hooks/useDrills';
import type { CreateDrillInput } from '../api/drillsTypes';
import type { UUID } from '@/types';

export default function DrillDetailPage() {
  const { drillId } = useParams();
  const { academyId } = useActiveAcademy();
  const navigate = useNavigate();
  const canManage = useCan('drills:manage');
  const drillsQuery = useDrills(academyId);
  const updateDrill = useUpdateDrill(academyId as string);
  const deleteDrill = useDeleteDrill(academyId as UUID);
  const pushToast = useUiStore((state) => state.pushToast);

  const drill = drillsQuery.data?.find((item) => item.id === drillId) ?? null;

  const defaultValues: CreateDrillInput = {
    academyId: academyId as string,
    name: drill?.name ?? '',
    category: drill?.category ?? 'batting',
    description: drill?.description ?? null,
    durationMinutes: drill?.durationMinutes ?? null,
    difficulty: drill?.difficulty ?? 'beginner',
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<CreateDrillInput>({ defaultValues });

  const handleSave = handleSubmit(async (values) => {
    if (!drill || !academyId || !canManage) return;
    try {
      await updateDrill.mutateAsync({ drillId: drill.id, input: values });
      pushToast({ title: 'Drill updated', variant: 'success' });
      navigate('/drills');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update drill';
      pushToast({ title: 'Update Failed', description: msg, variant: 'error' });
    }
  });

  const handleDelete = async () => {
    if (!drill || !academyId || !canManage) return;
    if (!window.confirm(`Are you sure you want to delete "${drill.name}"?`)) return;
    try {
      await deleteDrill.mutateAsync({ drillId: drill.id });
      pushToast({ title: 'Drill deleted', variant: 'success' });
      navigate('/drills');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete drill';
      pushToast({ title: 'Delete Failed', description: msg, variant: 'error' });
    }
  };

  if (!academyId || !drillId) {
    return (
      <EmptyState
        title="No drill selected"
        description="Select a drill from the drills list to view its details."
      />
    );
  }

  return (
    <div className="flex flex-col space-y-4 pb-24 md:pb-6">
      {/* 1. Header with Back navigation */}
      <div className="border-border-subtle/40 flex items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/drills')}
            className="border-border-subtle bg-surface text-fg-muted hover:text-fg hover:bg-surface-muted flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
            aria-label="Back to drills"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-heading text-fg text-lg font-extrabold tracking-tight uppercase md:text-xl">
              {drill?.name ?? 'Edit Drill'}
            </h1>
            {drill && (
              <p className="text-fg-muted font-sans text-xs capitalize">
                {drill.category} • {drill.difficulty}
              </p>
            )}
          </div>
        </div>

        {canManage && drill && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleDelete()}
            className="text-error hover:bg-error-pale h-8.5 min-h-[34px] rounded-lg px-3 text-xs font-bold"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>

      {drillsQuery.isPending ? (
        <div className="border-border-subtle bg-surface h-64 animate-pulse rounded-xl border" />
      ) : drillsQuery.isError ? (
        <ErrorState error={drillsQuery.error} onRetry={() => void drillsQuery.refetch()} />
      ) : !drill ? (
        <EmptyState
          title="Drill not found"
          description="This drill does not exist or you do not have access."
        />
      ) : (
        <div className="border-border-subtle bg-surface rounded-xl border p-4 shadow-2xs">
          <form onSubmit={handleSave} noValidate>
            <div className="border-border-subtle/50 mb-4 border-b pb-3">
              <h2 className="font-heading text-fg text-base font-extrabold tracking-tight uppercase">
                Drill Specifications
              </h2>
              <p className="text-fg-muted font-sans text-xs">
                Update parameters and practice instructions
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Drill Title
                  </label>
                  <Input
                    defaultValue={drill.name}
                    {...register('name', { required: 'Title is required' })}
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
                    defaultValue={drill.category}
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
                    defaultValue={drill.durationMinutes ?? ''}
                    {...register('durationMinutes', { valueAsNumber: true })}
                    type="number"
                    min={1}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Difficulty
                  </label>
                  <Select
                    defaultValue={drill.difficulty}
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
                  Description & Execution Notes
                </label>
                <Textarea
                  defaultValue={drill.description ?? ''}
                  {...register('description')}
                  rows={4}
                  className="border-border-subtle bg-surface-container-low rounded-lg text-xs"
                />
              </div>
            </div>

            {canManage && (
              <div className="border-border-subtle/40 mt-4 flex items-center justify-end gap-2.5 border-t pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/drills')}
                  className="h-9 min-h-[36px] rounded-lg px-4 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={updateDrill.isPending}
                  disabled={!isDirty}
                  className="h-9 min-h-[36px] rounded-lg px-5 text-xs font-bold"
                >
                  Save Changes
                </Button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
