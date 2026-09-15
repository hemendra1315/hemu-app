import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Search, UserCheck, UserCog, X } from 'lucide-react';

import { ErrorState } from '@/components/feedback';
import { Avatar, Badge, Button, Modal, Select, SkeletonText } from '@/components/ui';
import { JoinCodeCard, useActiveAcademy } from '@/features/academies';
import { useBatches } from '@/features/batches';
import { useCan } from '@/lib/rbac';
import { useUiStore } from '@/stores';
import type { AcademyMember, PendingJoinRequest, UUID } from '@/types';
import { ROLE_LABELS, type JoinableRole, type MemberStatus } from '@/types/enums';
import { ChangeRoleModal } from '../components/ChangeRoleModal';
import { useAcademyMembers, usePendingJoinRequests, useUpdateMember } from '../hooks/useMembers';

const STATUS_TONES: Record<MemberStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
  rejected: 'danger',
  left: 'neutral',
};

export default function MembersPage() {
  const { academyId } = useActiveAcademy();
  const [roleFilter, setRoleFilter] = useState<'all' | JoinableRole | 'academy_owner'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all');
  const [batchFilter, setBatchFilter] = useState<'all' | UUID>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [roleChangeMember, setRoleChangeMember] = useState<AcademyMember | null>(null);

  const canManage = useCan('members:manage');
  const canApproveRequests = useCan('players:approve');

  const requestsQuery = usePendingJoinRequests(academyId);
  const batchesQuery = useBatches(academyId);

  const query = useAcademyMembers(academyId, {});
  const members = useMemo(() => query.data ?? [], [query.data]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const name = (member.fullName || '').toLowerCase();
      const email = (member.email || '').toLowerCase();
      const idStr = (member.id || '').toLowerCase();

      const matchesSearch =
        !searchQuery ||
        name.includes(searchQuery.toLowerCase()) ||
        email.includes(searchQuery.toLowerCase()) ||
        idStr.includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      const matchesBatch =
        batchFilter === 'all' || member.batches?.some((b) => b.id === batchFilter);

      return matchesSearch && matchesStatus && matchesRole && matchesBatch;
    });
  }, [members, searchQuery, statusFilter, roleFilter, batchFilter]);

  const [approvingRequest, setApprovingRequest] = useState<PendingJoinRequest | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const { approveRequest, rejectRequest } = useUpdateMember(academyId as string);
  const pushToast = useUiStore((state) => state.pushToast);

  const handleApproveClick = (request: PendingJoinRequest) => {
    const batches = batchesQuery.data ?? [];
    if (batches.length > 0) {
      setApprovingRequest(request);
      setSelectedBatchIds([]);
    } else {
      approveRequest.mutate(
        { requestId: request.id, batchIds: null },
        { onSuccess: () => pushToast({ title: 'Request approved', variant: 'success' }) },
      );
    }
  };

  const handleConfirmApprovalWithBatches = () => {
    if (!approvingRequest) return;
    approveRequest.mutate(
      {
        requestId: approvingRequest.id,
        batchIds: selectedBatchIds.length > 0 ? (selectedBatchIds as UUID[]) : null,
      },
      {
        onSuccess: () => {
          pushToast({ title: 'Request approved & batches assigned', variant: 'success' });
          setApprovingRequest(null);
          setSelectedBatchIds([]);
        },
      },
    );
  };

  if (!academyId) return null;

  const hasRequests = (requestsQuery.data?.length ?? 0) > 0;

  return (
    <div className="flex flex-col space-y-4 pb-24 md:pb-6">
      {/* 1. Header with Count & Add Player Trigger */}
      <div className="border-border-subtle/40 flex flex-col gap-3 border-b pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-fg text-xl font-extrabold tracking-tight uppercase md:text-2xl">
              Players
            </h1>
            <span className="bg-surface-container-low border-border-subtle text-fg-muted rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold">
              {filteredMembers.length} found
            </span>
          </div>
          {canManage && (
            <Button
              variant="primary"
              aria-label="Add Player"
              onClick={() => setIsAddModalOpen(true)}
              className="h-9 min-h-[36px] rounded-lg px-3.5 text-xs font-bold"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Player
            </Button>
          )}
        </div>

        {/* Search & Filters Strip */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="text-fg-muted absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search players by name, email or ID..."
              className="border-border-subtle bg-surface-container-low text-fg placeholder:text-fg-muted/60 focus:border-primary h-9 w-full rounded-lg border py-1.5 pr-8 pl-8 font-sans text-xs focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-fg-muted hover:text-fg absolute top-1/2 right-2.5 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
            <Select
              className="border-border-subtle bg-surface-container-low h-9 min-h-[36px] min-w-[110px] rounded-lg text-xs"
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as JoinableRole | 'academy_owner' | 'all')
              }
            >
              <option value="all">All Roles</option>
              <option value="player">Players</option>
              <option value="coach">Coaches</option>
              <option value="academy_owner">Owners</option>
            </Select>

            <Select
              className="border-border-subtle bg-surface-container-low h-9 min-h-[36px] min-w-[120px] rounded-lg text-xs"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value as UUID | 'all')}
            >
              <option value="all">All Batches</option>
              {batchesQuery.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>

            <Select
              className="border-border-subtle bg-surface-container-low h-9 min-h-[36px] min-w-[110px] rounded-lg text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MemberStatus | 'all')}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="left">Inactive</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Pending Join Requests Alert Card */}
      {hasRequests && canApproveRequests && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 shadow-2xs">
          <div className="mb-2.5 flex items-center gap-2 border-b border-amber-500/20 pb-2">
            <UserCheck className="h-4 w-4 text-amber-500" />
            <span className="font-heading text-xs font-bold tracking-wider text-amber-500 uppercase">
              Pending Join Requests ({requestsQuery.data?.length})
            </span>
          </div>
          <div className="divide-y divide-amber-500/15">
            {requestsQuery.data?.map((req) => (
              <div
                key={req.id}
                className="flex flex-col justify-between gap-2.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={req.fullName ?? req.email} src={req.avatarUrl} size="sm" />
                  <div>
                    <p className="text-fg font-sans text-xs font-bold">
                      {req.fullName ?? req.email}
                    </p>
                    <p className="text-fg-muted font-sans text-[11px]">
                      Requested role: {ROLE_LABELS[req.requestedRole]}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-fg-muted hover:text-error h-8 rounded-lg px-2.5 text-xs font-semibold"
                    onClick={() => rejectRequest.mutate({ requestId: req.id })}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-8 rounded-lg px-3 text-xs font-bold"
                    onClick={() => handleApproveClick(req)}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approve Request Modal */}
      {approvingRequest && (
        <Modal
          open={!!approvingRequest}
          onClose={() => setApprovingRequest(null)}
          title="Approve Join Request"
        >
          <div className="space-y-4 p-1">
            <p className="text-fg-muted font-sans text-xs">
              Assign{' '}
              <strong className="text-fg">
                {approvingRequest.fullName ?? approvingRequest.email}
              </strong>{' '}
              to squads?
            </p>
            <div className="space-y-2">
              {batchesQuery.data?.map((batch) => (
                <label
                  key={batch.id}
                  className="border-border-subtle bg-surface-container-low hover:border-primary/50 flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="border-border-subtle text-primary focus:ring-primary h-4 w-4 rounded"
                    checked={selectedBatchIds.includes(batch.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBatchIds((prev) => [...prev, batch.id]);
                      } else {
                        setSelectedBatchIds((prev) => prev.filter((id) => id !== batch.id));
                      }
                    }}
                  />
                  <div>
                    <p className="font-heading text-fg text-xs font-bold uppercase">{batch.name}</p>
                    <p className="text-fg-muted font-sans text-[10px]">{batch.ageGroup}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button variant="ghost" onClick={() => setApprovingRequest(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmApprovalWithBatches}
                isLoading={approveRequest.isPending}
              >
                Approve & Assign
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. Roster List Surface */}
      <div className="border-border-subtle bg-surface min-w-0 overflow-hidden rounded-xl border shadow-2xs">
        {query.isPending ? (
          <div className="space-y-3 p-4">
            <SkeletonText lines={2} />
            <SkeletonText lines={2} />
            <SkeletonText lines={2} />
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-fg-muted py-12 text-center font-sans text-xs">
            No players found matching your filters.
          </div>
        ) : (
          <div className="divide-border-subtle/50 divide-y">
            {filteredMembers.map((member) => {
              return (
                <Link
                  key={member.id}
                  to={`/members/${member.id}`}
                  className="group hover:bg-surface-muted/20 flex min-h-[58px] items-center justify-between p-3.5 transition-colors"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar
                      name={member.fullName ?? member.email}
                      src={member.avatarUrl}
                      size="md"
                      className="border-border-subtle/60 shrink-0 rounded-full border"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-fg group-hover:text-primary truncate font-sans text-sm font-bold transition-colors">
                          {member.fullName ?? member.email}
                        </p>
                        <span
                          className={`py-0.2 rounded-full px-1.5 font-mono text-[9px] font-bold uppercase ${
                            member.role === 'player'
                              ? 'border-primary/20 bg-primary-pale text-primary border'
                              : member.role === 'coach'
                                ? 'border-info/20 bg-info-pale text-info border'
                                : 'border-saffron/20 bg-saffron-pale text-saffron border'
                          }`}
                        >
                          {ROLE_LABELS[member.role]}
                        </span>
                      </div>

                      <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-2 font-sans text-xs">
                        <Badge
                          tone={STATUS_TONES[member.status]}
                          className="px-1.5 py-0 font-mono text-[9px] font-bold uppercase"
                        >
                          {member.status}
                        </Badge>
                        {member.batches && member.batches.length > 0 && member.batches[0] && (
                          <span className="border-border-subtle/60 bg-surface-container-low py-0.2 text-fg-muted rounded border px-1.5 font-mono text-[10px] font-bold">
                            {member.batches[0].name}
                            {member.batches.length > 1 && ` +${member.batches.length - 1}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ml-2 flex shrink-0 items-center gap-2">
                    {canManage && member.role !== 'academy_owner' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setRoleChangeMember(member);
                        }}
                        className="text-fg hover:border-primary/50 hover:text-primary h-7 min-h-[28px] rounded-lg px-2.5 text-[11px] font-bold"
                        aria-label={`Change role for ${member.fullName ?? member.email}`}
                      >
                        <UserCog className="text-primary mr-1 h-3.5 w-3.5" />
                        Role
                      </Button>
                    )}
                    <ChevronRight className="text-fg-muted group-hover:text-primary h-4 w-4 shrink-0 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Change Role Modal */}
      {roleChangeMember && (
        <ChangeRoleModal
          open={Boolean(roleChangeMember)}
          onClose={() => setRoleChangeMember(null)}
          member={roleChangeMember}
          academyId={academyId}
        />
      )}

      {/* Add Player / Join Code Modal */}
      {isAddModalOpen && (
        <Modal
          open={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Invite Squad Member"
        >
          <div className="space-y-4 p-1">
            <p className="text-fg-muted font-sans text-xs">
              Share this Join Code with your players or coaches to add them to this academy roster.
            </p>
            <JoinCodeCard academyId={academyId} />
            <div className="flex justify-end pt-2">
              <Button
                variant="secondary"
                className="h-9 min-h-[36px] rounded-lg px-4 text-xs font-bold"
                onClick={() => setIsAddModalOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
