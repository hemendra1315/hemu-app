import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Plus, Trophy, Trash2, ArrowRight } from 'lucide-react';

import { Button, Input, Select } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { MobileEmptyState } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { useCan } from '@/lib/rbac';
import { useUiStore } from '@/stores';
import { useAcademyMatches, useCreateMatch, useDeleteMatch } from '../hooks/useMatches';
import { useBatches } from '@/features/batches';
import { formatDate } from '@/lib/utils/date';
import type { MatchFormat, MatchType } from '@/types/enums';

type MatchFormValues = {
  matchName: string;
  matchDate: string;
  opponentName: string;
  tournament: string;
  matchType: MatchType;
  format: MatchFormat;
  overs: string;
  batchId: string;
};

const DEFAULT_MATCH_FORM: MatchFormValues = {
  matchName: '',
  matchDate: '',
  opponentName: '',
  tournament: '',
  matchType: 'friendly',
  format: 't20',
  overs: '',
  batchId: '',
};

const MATCH_FORMATS = [
  { value: 't20', label: 'T20' },
  { value: 'odi', label: 'ODI (50 Over)' },
  { value: 'test', label: 'Multi-Day / Test' },
  { value: 't10', label: 'T10' },
  { value: 'custom', label: 'Custom' },
];

const MATCH_TYPES = [
  { value: 'practice', label: 'Practice Match' },
  { value: 'friendly', label: 'Friendly Match' },
  { value: 'league', label: 'League / Division' },
  { value: 'tournament', label: 'Tournament' },
];

export default function MatchesPage() {
  const { academyId } = useActiveAcademy();
  const canManage = useCan('matches:manage');
  const navigate = useNavigate();

  const matchesQuery = useAcademyMatches(academyId);
  const batchesQuery = useBatches(academyId);
  const createMatch = useCreateMatch(academyId as string);
  const deleteMatch = useDeleteMatch(academyId as string);

  const pushToast = useUiStore((state) => state.pushToast);
  const [showForm, setShowForm] = useState(false);
  const [matchFilter, setMatchFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<MatchFormValues>({
    defaultValues: DEFAULT_MATCH_FORM,
  });

  const handleCreate = handleSubmit(async (value) => {
    try {
      await createMatch.mutateAsync({
        academyId: academyId as string,
        matchName: value.matchName,
        matchDate: value.matchDate,
        opponentName: value.opponentName || null,
        tournament: value.tournament || null,
        matchType: value.matchType,
        format: value.format,
        overs: value.overs ? parseFloat(value.overs) : null,
        batchId: value.batchId || null,
      });

      pushToast({
        title: 'Match fixture created',
        variant: 'success',
      });

      reset(DEFAULT_MATCH_FORM);
      setShowForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create match';
      pushToast({ title: 'Failed to create match', description: msg, variant: 'error' });
    }
  });

  const handleDelete = async (matchId: string) => {
    if (!window.confirm('Are you sure you want to delete this match?')) return;
    try {
      await deleteMatch.mutateAsync({ matchId });
      pushToast({ title: 'Match deleted', variant: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete match';
      pushToast({ title: 'Failed to delete match', description: msg, variant: 'error' });
    }
  };

  const filteredMatches = useMemo(() => {
    if (!matchesQuery.data) return [];
    if (matchFilter === 'upcoming') {
      return matchesQuery.data.filter((m) => m.status === 'created' || m.status === 'in_progress');
    }
    if (matchFilter === 'completed') {
      return matchesQuery.data.filter((m) => m.status === 'completed');
    }
    return matchesQuery.data;
  }, [matchesQuery.data, matchFilter]);

  if (!academyId) return null;

  return (
    <div className="flex flex-col space-y-4 pb-24 md:pb-6">
      {/* 1. Header with Actions & Filter Strip */}
      <div className="border-border-subtle/40 flex flex-col gap-3 border-b pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-fg text-xl font-extrabold tracking-tight uppercase md:text-2xl">
              Match Center
            </h1>
            <p className="text-fg-muted font-sans text-xs">
              Fixtures, competitive scorecards & CricHeroes records
            </p>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => navigate('/matches/new')}
                className="h-9 min-h-[36px] rounded-lg px-3.5 text-xs font-bold"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Match
              </Button>
            </div>
          )}
        </div>

        {/* Filter Pills */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {[
            { id: 'all', label: 'All Fixtures', count: matchesQuery.data?.length },
            { id: 'upcoming', label: 'Upcoming / Live' },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => {
            const isActive = matchFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMatchFilter(tab.id as 'all' | 'upcoming' | 'completed')}
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-all ${
                  isActive
                    ? 'border-primary bg-primary font-extrabold text-black shadow-2xs'
                    : 'border-border-subtle bg-surface text-fg-muted hover:border-border hover:bg-surface-muted/50'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`py-0.2 rounded-full px-1.5 text-[10px] ${
                      isActive ? 'bg-black/20 text-black' : 'bg-surface-muted text-fg-muted'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Add Fixture Form Drawer */}
      {showForm && canManage && (
        <div className="border-border-subtle bg-surface animate-fadeIn rounded-xl border p-4 shadow-2xs">
          <form onSubmit={handleCreate} noValidate>
            <div className="border-border-subtle/50 mb-4 border-b pb-3">
              <h2 className="font-heading text-fg text-base font-extrabold tracking-tight uppercase">
                Quick Add Fixture
              </h2>
              <p className="text-fg-muted font-sans text-xs">
                Schedule a fixture or manually enter match details
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Match Title
                  </label>
                  <Input
                    {...register('matchName', { required: 'Match title is required' })}
                    placeholder="e.g. Academy A vs St. John's XI"
                    hasError={Boolean(errors.matchName)}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  />
                  {errors.matchName && (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.matchName.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Opponent Team
                  </label>
                  <Input
                    {...register('opponentName')}
                    placeholder="e.g. City Lions CC"
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Match Date
                  </label>
                  <Input
                    type="date"
                    {...register('matchDate', { required: 'Date is required' })}
                    hasError={Boolean(errors.matchDate)}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg font-mono text-xs"
                  />
                  {errors.matchDate && (
                    <p className="text-error mt-1 font-sans text-[11px] font-semibold">
                      {errors.matchDate.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Tournament / Cup
                  </label>
                  <Input
                    {...register('tournament')}
                    placeholder="e.g. Under-16 State Trophy"
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Match Type
                  </label>
                  <Select
                    {...register('matchType')}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  >
                    {MATCH_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Format
                  </label>
                  <Select
                    {...register('format')}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  >
                    {MATCH_FORMATS.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                    Squad / Batch
                  </label>
                  <Select
                    {...register('batchId')}
                    className="border-border-subtle bg-surface-container-low h-10 min-h-[40px] rounded-lg text-xs"
                  >
                    <option value="">All Squads (Open)</option>
                    {batchesQuery.data?.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name}
                      </option>
                    ))}
                  </Select>
                </div>
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
                isLoading={createMatch.isPending}
                disabled={!isDirty}
                className="h-9 min-h-[36px] rounded-lg px-5 text-xs font-bold"
              >
                Create Fixture
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Matches List Grid */}
      <div className="min-w-0">
        {matchesQuery.isPending ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="border-border-subtle bg-surface h-28 animate-pulse rounded-xl border"
              />
            ))}
          </div>
        ) : matchesQuery.isError ? (
          <ErrorState error={matchesQuery.error} onRetry={() => void matchesQuery.refetch()} />
        ) : filteredMatches.length === 0 ? (
          <MobileEmptyState
            title="No matches found"
            description="No matches match the selected criteria."
            action={
              canManage
                ? { label: 'Create New Match', onClick: () => navigate('/matches/new') }
                : undefined
            }
          />
        ) : (
          <div className="divide-border-subtle/50 border-border-subtle bg-surface divide-y overflow-hidden rounded-xl border shadow-2xs">
            {filteredMatches.map((match) => {
              const isLive = match.status === 'in_progress';
              const isCompleted = match.status === 'completed';

              return (
                <div
                  key={match.id}
                  onClick={() => navigate(`/matches/${match.id}`)}
                  className="group hover:bg-surface-muted/20 flex cursor-pointer flex-col justify-between gap-3 p-4 transition-colors sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    {/* Format Badge */}
                    <div className="border-border-subtle bg-surface-container-low font-heading flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border">
                      <Trophy className="text-primary h-4 w-4" />
                      <span className="text-fg-muted text-[9px] font-extrabold uppercase">
                        {match.format?.toUpperCase()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-heading text-fg group-hover:text-primary truncate text-sm font-bold tracking-tight uppercase transition-colors">
                          {match.matchName}
                        </p>
                        {isLive && (
                          <span className="border-primary/30 bg-primary-pale py-0.2 text-primary flex items-center gap-1 rounded-full border px-2 font-mono text-[9px] font-extrabold uppercase">
                            <span className="bg-primary h-1.5 w-1.5 animate-pulse rounded-full" />
                            Live
                          </span>
                        )}
                      </div>

                      <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-xs">
                        <span className="text-fg-muted font-mono text-[11px]">
                          {formatDate(match.matchDate)}
                        </span>
                        {match.opponentName && (
                          <span className="text-fg-muted">vs {match.opponentName}</span>
                        )}
                        {match.tournament && (
                          <span className="text-fg-muted truncate">• {match.tournament}</span>
                        )}
                      </div>

                      {match.teamScore && (
                        <div className="text-primary mt-1.5 font-mono text-xs font-bold">
                          Score: {match.teamScore} {match.overs ? `(${match.overs} ov)` : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-2.5 sm:justify-end">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 font-sans text-[10px] font-bold uppercase ${
                        isCompleted
                          ? 'border-success/30 bg-success-pale text-success'
                          : isLive
                            ? 'border-primary/30 bg-primary-pale text-primary'
                            : 'border-border-subtle bg-surface-container-low text-fg-muted'
                      }`}
                    >
                      {match.status}
                    </span>

                    {canManage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(match.id);
                        }}
                        className="text-fg-muted hover:bg-error-pale hover:text-error flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                        aria-label="Delete match"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <div className="border-border-subtle bg-surface text-fg-muted group-hover:border-primary/40 group-hover:text-primary flex h-8 w-8 items-center justify-center rounded-lg border transition-colors">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
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
