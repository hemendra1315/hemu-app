import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button, Card, CardBody, CardFooter, CardHeader, Input, Select } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { MobilePageHeader, MobileFilterChips, MobileEmptyState } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { useCan } from '@/lib/rbac';
import { useUiStore } from '@/stores';
import { useAcademyMatches, useCreateMatch, useDeleteMatch } from '../hooks/useMatches';
import { useBatches } from '@/features/batches';
import { formatDate } from '@/lib/utils/date';
import { useNavigate } from 'react-router-dom';
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
  { value: 'odi', label: 'ODI' },
  { value: 'test', label: 'Test' },
  { value: 't10', label: 'T10' },
  { value: 'custom', label: 'Custom' },
];

const MATCH_TYPES = [
  { value: 'practice', label: 'Practice' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'league', label: 'League' },
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
        title: 'Match created',
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
    try {
      await deleteMatch.mutateAsync({ matchId });
      pushToast({ title: 'Match deleted', variant: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete match';
      pushToast({ title: 'Failed to delete match', description: msg, variant: 'error' });
    }
  };

  const [matchFilter, setMatchFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

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
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Mobile Header */}
      <div className="md:hidden">
        <MobilePageHeader
          title="Matches"
          count={matchesQuery.data?.length}
          subtitle="Fixtures, results & scorecards"
          primaryAction={
            canManage
              ? {
                  label: 'Add',
                  onClick: () => navigate('/matches/new'),
                }
              : undefined
          }
        />
        <div className="mb-3 px-4">
          <MobileFilterChips
            options={[
              { id: 'all', label: 'All', count: matchesQuery.data?.length },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'completed', label: 'Completed' },
            ]}
            activeId={matchFilter}
            onChange={setMatchFilter}
          />
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
        <div>
          <h1 className="text-fg text-xl font-semibold">Matches</h1>
          <p className="text-fg-muted">Create and manage match scorecards and fixtures.</p>
        </div>

        {canManage ? (
          <Button onClick={() => setShowForm((open) => !open)}>
            {showForm ? 'Hide form' : 'New match'}
          </Button>
        ) : null}
      </div>

      {showForm && canManage ? (
        <Card>
          <form onSubmit={handleCreate} noValidate>
            <CardHeader
              title="Create match"
              description="Add a new fixture or completed scorecard."
            />

            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-fg block text-sm font-medium">Match name</label>
                  <Input
                    {...register('matchName', { required: 'Match name is required' })}
                    hasError={Boolean(errors.matchName)}
                  />
                  {errors.matchName ? (
                    <p className="text-danger text-xs">{errors.matchName.message}</p>
                  ) : null}
                </div>

                <div>
                  <label className="text-fg block text-sm font-medium">Opponent name</label>
                  <Input {...register('opponentName')} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-fg block text-sm font-medium">Match date</label>
                  <Input
                    type="date"
                    {...register('matchDate', { required: 'Match date is required' })}
                    hasError={Boolean(errors.matchDate)}
                  />
                  {errors.matchDate ? (
                    <p className="text-danger text-xs">{errors.matchDate.message}</p>
                  ) : null}
                </div>

                <div>
                  <label className="text-fg block text-sm font-medium">Tournament / Series</label>
                  <Input {...register('tournament')} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-fg block text-sm font-medium">Type</label>
                  <Select {...register('matchType')}>
                    {MATCH_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-fg block text-sm font-medium">Format</label>
                  <Select {...register('format')}>
                    {MATCH_FORMATS.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-fg block text-sm font-medium">Overs</label>
                  <Input type="number" step="0.1" {...register('overs')} />
                </div>

                <div>
                  <label className="text-fg block text-sm font-medium">Batch</label>
                  <Select {...register('batchId')}>
                    <option value="">No batch (optional)</option>
                    {batchesQuery.data?.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardBody>

            <CardFooter>
              <Button type="submit" isLoading={createMatch.isPending} disabled={!isDirty}>
                Create match
              </Button>
            </CardFooter>
          </form>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="All matches"
          description="See every match in this academy."
          className="hidden md:block"
        />

        <CardBody className="p-4">
          {matchesQuery.isPending ? (
            <p className="text-fg-muted">Loading matches…</p>
          ) : matchesQuery.isError ? (
            <ErrorState error={matchesQuery.error} onRetry={() => void matchesQuery.refetch()} />
          ) : filteredMatches.length === 0 ? (
            <MobileEmptyState
              title="No matches"
              description="No matches found for your selected filter."
              action={
                canManage
                  ? { label: 'Add Match', onClick: () => navigate('/matches/new') }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredMatches.map((match) => (
                <div
                  key={match.id}
                  onClick={() => navigate(`/matches/${match.id}`)}
                  className="border-border-subtle hover:border-primary/40 bg-surface block cursor-pointer rounded-2xl border p-4 shadow-2xs transition active:scale-[0.99]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-fg text-base font-semibold hover:underline">
                        {match.matchName}
                      </p>
                      <p className="text-fg-muted mt-0.5 text-xs">
                        {formatDate(match.matchDate)}
                        {match.opponentName ? ` · vs ${match.opponentName}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="bg-surface-muted text-fg-muted rounded-full px-2.5 py-0.5 text-xs font-medium uppercase">
                        {match.format}
                      </span>
                      <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase">
                        {match.status}
                      </span>
                    </div>
                  </div>

                  {canManage ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={deleteMatch.isPending}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleDelete(match.id);
                        }}
                        className="text-danger hover:bg-danger/10"
                      >
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
