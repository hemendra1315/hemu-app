import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, UserPlus, X } from 'lucide-react';

import { Avatar, Badge, Button, Card, CardBody, CardHeader, Select } from '@/components/ui';
import { useBatchCoachAssignments, useBatchCoaches, useCoaches } from '@/features/coaches';
import type { Coach } from '@/features/coaches';
import { errorMessage } from '@/lib/api/errors';
import { useUiStore } from '@/stores';
import type { UUID } from '@/types';
import type { Batch } from '../api/batchesTypes';

/**
 * Head coach and assistant coaches for one batch. The head coach shown here
 * always comes from `batch.coach` -- the same `academy_members`-derived
 * field the batch header and every other screen already reads from
 * `batches.coach_id` -- rather than from `batch_coaches.is_primary`, so this
 * card stays correct even for a batch whose head coach was set the old way,
 * via the "Assigned coach" field in Edit Batch, before this card existed.
 * `batch_coaches` here is only ever the assistants and the promote/remove
 * actions; promoting an assistant writes back to `batches.coach_id` too
 * (see `coachesApi.setHeadCoach`), which is what keeps the two in sync going
 * forward.
 */
export function BatchCoachesCard({
  academyId,
  batch,
  canManage,
}: {
  academyId: UUID;
  batch: Batch;
  canManage: boolean;
}) {
  const assignmentsQuery = useBatchCoaches(batch.id);
  const allCoachesQuery = useCoaches(academyId);
  const { setPrimary, addAssistant, remove } = useBatchCoachAssignments(academyId, batch.id);
  const pushToast = useUiStore((state) => state.pushToast);
  const [selectedCoachId, setSelectedCoachId] = useState('');

  // A row only gets excluded (as "that's the head coach, not an assistant")
  // when its `academyMemberId` actually matches `batch.coachId` -- both
  // being `null` must never count as a match, or every coach whose
  // membership id hasn't resolved would be silently treated as the head
  // coach on a batch that has none.
  const assistants = useMemo(
    () =>
      (assignmentsQuery.data ?? []).filter(
        (row) => row.academyMemberId === null || row.academyMemberId !== batch.coachId,
      ),
    [assignmentsQuery.data, batch.coachId],
  );

  // `batch.coach.id` is an `academy_members.id` (that's what `batches.coach_id`
  // references) -- not a `coaches.id`, so it can't be used directly to link to
  // `/coaches/:coachId`. Resolve the matching `coaches.id` from the full list.
  const headCoachRecord = useMemo(
    () =>
      batch.coachId
        ? (allCoachesQuery.data ?? []).find((coach) => coach.academyMemberId === batch.coachId)
        : undefined,
    [allCoachesQuery.data, batch.coachId],
  );

  // Tracked by `coachId` (never `academyMemberId`, which can be `null` for
  // more than one coach at once) so "already assigned" can't collide across
  // unrelated coaches.
  const assignableCoaches = useMemo(() => {
    const alreadyAssignedCoachIds = new Set(
      [headCoachRecord?.coachId, ...assistants.map((row) => row.coachId)].filter(
        (id): id is UUID => id !== null && id !== undefined,
      ),
    );
    return (allCoachesQuery.data ?? []).filter(
      (coach): coach is Coach & { coachId: UUID } =>
        coach.coachId !== null && !alreadyAssignedCoachIds.has(coach.coachId),
    );
  }, [allCoachesQuery.data, assistants, headCoachRecord]);

  const handleAddAssistant = async () => {
    if (!selectedCoachId) return;
    try {
      await addAssistant.mutateAsync(selectedCoachId as UUID);
      pushToast({ title: 'Assistant coach added', variant: 'success' });
      setSelectedCoachId('');
    } catch (error) {
      pushToast({
        title: 'Could not add coach',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  };

  const handlePromote = async (coachId: UUID, academyMemberId: UUID | null) => {
    try {
      await setPrimary.mutateAsync({ coachId, academyMemberId });
      pushToast({ title: 'Head coach updated', variant: 'success' });
    } catch (error) {
      pushToast({
        title: 'Could not update head coach',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  };

  const handleRemove = async (coachId: UUID) => {
    try {
      await remove.mutateAsync({ coachId, wasHeadCoach: false });
      pushToast({ title: 'Coach removed from batch', variant: 'success' });
    } catch (error) {
      pushToast({
        title: 'Could not remove coach',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  };

  return (
    <Card>
      <CardHeader
        title="Coaching Team"
        description="Head coach and any assistants for this batch."
      />
      <CardBody className="space-y-4">
        <div>
          <p className="text-fg-muted mb-1.5 text-xs font-semibold tracking-wide uppercase">
            Head coach
          </p>
          {batch.coachId ? (
            headCoachRecord?.coachId ? (
              <Link
                to={`/coaches/${headCoachRecord.coachId}`}
                className="border-border-subtle hover:bg-surface-muted/50 flex items-center gap-3 rounded-lg border p-2.5"
              >
                <Avatar
                  name={batch.coach.fullName ?? batch.coach.email}
                  src={batch.coach.avatarUrl ?? undefined}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-fg truncate text-sm font-semibold">
                    {batch.coach.fullName ?? batch.coach.email}
                  </p>
                </div>
                <Badge tone="brand">Head Coach</Badge>
              </Link>
            ) : (
              // No linkable coach profile -- most often because the head
              // coach here is the academy owner (owners run batches too, and
              // the classic "Assigned coach" field allows it) rather than
              // someone with the `coach` role; rarely, a `coach`-role head
              // coach whose own `coaches` row hasn't been created yet.
              // Either way, show the name without a broken link.
              <div className="border-border-subtle flex items-center gap-3 rounded-lg border p-2.5">
                <Avatar
                  name={batch.coach.fullName ?? batch.coach.email}
                  src={batch.coach.avatarUrl ?? undefined}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-fg truncate text-sm font-semibold">
                    {batch.coach.fullName ?? batch.coach.email}
                  </p>
                </div>
                <Badge tone="brand">Head Coach</Badge>
              </div>
            )
          ) : (
            <p className="text-fg-muted text-sm italic">
              No head coach assigned yet — set one via "Edit Batch" above.
            </p>
          )}
        </div>

        <div>
          <p className="text-fg-muted mb-1.5 text-xs font-semibold tracking-wide uppercase">
            Assistant coaches
          </p>
          {assistants.length === 0 ? (
            <p className="text-fg-muted text-sm italic">No assistant coaches added yet.</p>
          ) : (
            <ul className="divide-border-subtle divide-y">
              {assistants.map((row) => (
                <li key={row.coachId} className="flex items-center gap-3 py-2">
                  <Avatar
                    name={row.fullName ?? row.email}
                    src={row.avatarUrl ?? undefined}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-fg truncate text-sm font-medium">
                      {row.fullName ?? row.email}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handlePromote(row.coachId, row.academyMemberId)}
                        isLoading={setPrimary.isPending}
                        className="text-xs"
                      >
                        <Star className="mr-1 h-3.5 w-3.5" />
                        Make head coach
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRemove(row.coachId)}
                        isLoading={remove.isPending}
                        aria-label={`Remove ${row.fullName ?? row.email}`}
                        className="text-danger text-xs"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {canManage ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={selectedCoachId}
              onChange={(event) => setSelectedCoachId(event.target.value)}
              className="min-h-[44px] flex-1"
            >
              <option value="">Add an assistant coach…</option>
              {assignableCoaches.map((coach) => (
                <option key={coach.coachId} value={coach.coachId}>
                  {coach.fullName ?? coach.email}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              disabled={!selectedCoachId}
              isLoading={addAssistant.isPending}
              onClick={() => void handleAddAssistant()}
              className="min-h-[44px]"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
