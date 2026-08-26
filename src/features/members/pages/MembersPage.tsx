import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Search, UserCheck, X } from 'lucide-react';

import { ErrorState } from '@/components/feedback';
import {
  Avatar,
  Badge,
  Button,
  Modal,
  Select,
  SkeletonText,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { JoinCodeCard, useActiveAcademy } from '@/features/academies';

import { useBatches } from '@/features/batches';
import { useCan } from '@/lib/rbac';

import { useUiStore } from '@/stores';
import type { AcademyMember, PendingJoinRequest, UUID } from '@/types';
import { JOINABLE_ROLES, ROLE_LABELS, type JoinableRole, type MemberStatus } from '@/types/enums';

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

  const canManage = useCan('members:manage');
  const canApproveRequests = useCan('players:approve');

  const requestsQuery = usePendingJoinRequests(academyId);
  const batchesQuery = useBatches(academyId);

  // Fetch ALL members, let client side do the filtering for instantaneous UX
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
    <div className="min-w-0 space-y-5 pb-24 md:pb-8">
      {/* 1. App Bar Header */}
      <div className="border-border-subtle/50 flex items-center justify-between gap-4 border-b pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-fg text-lg font-extrabold tracking-wider uppercase sm:text-xl">
              Players
            </h1>
            <span className="bg-turf-pale border-primary/20 text-primary rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold">
              {filteredMembers.length} FOUND
            </span>
          </div>
          <p className="text-fg-muted mt-0.5 font-sans text-xs">
            Manage academy players, batches, and profiles
          </p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            className="min-h-[44px] shrink-0 rounded-[10px] px-4 text-xs font-bold shadow-2xs"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add People
          </Button>
        )}
      </div>

      {hasRequests && canApproveRequests && (
        <div className="border-saffron/30 bg-saffron-pale/20 rounded-xl border p-4 shadow-2xs">
          <div className="border-saffron/20 mb-3 flex items-center gap-2 border-b pb-2">
            <UserCheck className="text-saffron h-4 w-4" />
            <span className="text-saffron font-heading text-xs font-bold tracking-wider uppercase">
              Pending Join Requests
            </span>
          </div>
          <div className="divide-saffron/15 divide-y">
            {requestsQuery.data?.map((req) => (
              <div
                key={req.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={req.fullName ?? req.email} src={req.avatarUrl} size="sm" />
                  <div>
                    <p className="text-fg text-sm font-bold">{req.fullName ?? req.email}</p>
                    <p className="text-fg-muted text-xs">
                      Requested to join as {ROLE_LABELS[req.requestedRole]}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-[40px] rounded-lg px-3 text-xs font-semibold"
                    onClick={() => rejectRequest.mutate({ requestId: req.id })}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="min-h-[40px] rounded-lg px-4 text-xs font-bold"
                    onClick={() => handleApproveClick(req)}
                  >
                    Review & Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvingRequest && (
        <Modal
          open={!!approvingRequest}
          onClose={() => setApprovingRequest(null)}
          title="Approve Join Request"
        >
          <div className="space-y-4 p-1">
            <p className="text-fg-muted text-sm">
              Assign <strong>{approvingRequest.fullName ?? approvingRequest.email}</strong> to
              batches? (Optional)
            </p>
            <div className="space-y-2">
              {batchesQuery.data?.map((batch) => (
                <label
                  key={batch.id}
                  className="border-border-subtle hover:border-primary/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="text-primary focus:ring-primary h-4 w-4 rounded border-gray-300"
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
                    <p className="text-fg text-sm font-bold">{batch.name}</p>
                    <p className="text-fg-muted text-xs">{batch.ageGroup}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4">
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

      {/* SEARCH & FILTERS */}
      <div className="bg-surface border-border-subtle flex min-w-0 flex-col gap-3 rounded-xl border p-3 shadow-2xs sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="text-fg-muted absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search players..."
            className="border-border-subtle bg-surface placeholder:text-fg-muted/60 focus:border-primary focus:ring-primary/20 h-11 min-h-[44px] w-full rounded-[10px] border py-2 pr-4 pl-10 font-sans text-xs transition-all outline-none focus:ring-2"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-fg-muted hover:text-fg absolute top-1/2 right-3.5 -translate-y-1/2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="hide-scrollbar flex shrink-0 items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <Select
            className="border-border-subtle h-11 min-h-[44px] min-w-[120px] rounded-[10px] font-sans text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MemberStatus | 'all')}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="left">Inactive</option>
          </Select>

          <Select
            className="border-border-subtle h-11 min-h-[44px] min-w-[140px] rounded-[10px] font-sans text-xs"
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
            className="border-border-subtle h-11 min-h-[44px] min-w-[110px] rounded-[10px] font-sans text-xs"
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
        </div>
      </div>

      <div className="border-border-subtle bg-surface min-w-0 overflow-hidden rounded-xl border shadow-2xs">
        {query.isPending ? (
          <div className="p-6">
            <div className="space-y-4">
              <SkeletonText lines={2} />
              <SkeletonText lines={2} />
              <SkeletonText lines={2} />
            </div>
          </div>
        ) : query.isError ? (
          <div className="p-6">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : (
          <div className="min-w-0 p-0">
            {filteredMembers.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-fg-muted font-sans font-medium">
                  No players found matching your filters.
                </p>
              </div>
            ) : (
              <MemberTable members={filteredMembers} academyId={academyId} canManage={canManage} />
            )}
          </div>
        )}
      </div>

      {/* ADD PEOPLE MODAL */}
      {isAddModalOpen && (
        <Modal open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add People">
          <div className="space-y-5 p-1">
            {JOINABLE_ROLES.map((role) => (
              <div key={role} className="space-y-2">
                <p className="text-fg-muted font-sans text-sm">
                  {role === 'coach'
                    ? "Share this code with a coach. When they sign up or enter it in the app, they'll get a coach join request for you to approve."
                    : 'Share this Join Code with your players. When they sign up or enter this code in the app, they will be automatically assigned to this academy.'}
                </p>
                <JoinCodeCard academyId={academyId} role={role} />
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Button
                variant="secondary"
                className="h-11 min-h-[44px] rounded-[10px] px-4 text-xs font-bold"
                onClick={() => setIsAddModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MemberTable({
  members,
  academyId,
  canManage,
}: {
  members: AcademyMember[];
  academyId: string;
  canManage: boolean;
}) {
  const { changeRole } = useUpdateMember(academyId);
  const pushToast = useUiStore((state) => state.pushToast);

  return (
    <>
      <div className="divide-border-subtle/50 flex min-w-0 flex-col divide-y md:hidden">
        {members.map((member) => {
          const isActive = member.status === 'active';
          const isPending = member.status === 'pending';
          const isMuted = !isActive && !isPending;
          return (
            <Link
              key={member.id}
              to={`/members/${member.id}`}
              className={`flex min-h-[64px] min-w-0 items-center justify-between p-4 transition-colors ${
                isActive
                  ? 'bg-turf-pale hover:bg-turf-pale/80'
                  : 'bg-surface hover:bg-surface-muted/50'
              } ${isMuted ? 'opacity-80' : 'opacity-100'}`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar
                  name={member.fullName ?? member.email}
                  src={member.avatarUrl}
                  size="md"
                  className="border-border-subtle/30 shrink-0 rounded-full border"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-fg truncate font-sans text-sm font-bold">
                    {member.fullName ?? member.email}
                  </p>
                  <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <Badge
                      tone={STATUS_TONES[member.status]}
                      className="px-1.5 py-0 font-mono text-[10px] font-bold uppercase"
                    >
                      {member.status}
                    </Badge>
                    {member.batches && member.batches.length > 0 && member.batches[0] && (
                      <span className="text-primary max-w-[120px] truncate font-sans text-[11px] font-bold">
                        {member.batches[0].name}
                        {member.batches.length > 1 && ` +${member.batches.length - 1}`}
                      </span>
                    )}
                    <span className="text-fg-muted font-mono text-[10px]">
                      {ROLE_LABELS[member.role].toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="text-fg-muted/40 ml-2 h-5 w-5 shrink-0" />
            </Link>
          );
        })}
      </div>

      <div className="hidden min-w-0 overflow-x-auto md:block">
        <Table>
          <THead>
            <TR>
              <TH className="font-heading text-fg-muted py-3 text-[10px] font-bold tracking-wider uppercase">
                Player
              </TH>
              <TH className="font-heading text-fg-muted py-3 text-[10px] font-bold tracking-wider uppercase">
                Batch
              </TH>
              <TH className="font-heading text-fg-muted py-3 text-[10px] font-bold tracking-wider uppercase">
                Role
              </TH>
              <TH className="font-heading text-fg-muted py-3 text-[10px] font-bold tracking-wider uppercase">
                Status
              </TH>
              <TH className="py-3"></TH>
            </TR>
          </THead>
          <TBody>
            {members.map((member) => {
              const isActive = member.status === 'active';
              return (
                <TR
                  key={member.id}
                  className={`group border-border-subtle/30 border-b transition-colors ${isActive ? 'bg-turf-pale/30 hover:bg-turf-pale/50' : 'hover:bg-surface-muted/30'}`}
                >
                  <TD className="min-w-[200px] py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={member.fullName ?? member.email}
                        src={member.avatarUrl}
                        size="sm"
                        className="border-border-subtle/30 rounded-full border"
                      />
                      <div className="min-w-0">
                        <Link
                          to={`/members/${member.id}`}
                          className="text-fg hover:text-primary truncate font-sans text-sm font-bold hover:underline"
                        >
                          {member.fullName ?? member.email}
                        </Link>
                        <p className="text-fg-muted truncate font-sans text-[11px]">
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </TD>
                  <TD className="py-3.5">
                    {member.batches && member.batches.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {member.batches.map((b) => (
                          <span key={b.id} className="text-primary font-sans text-xs font-bold">
                            {b.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-fg-muted font-mono text-xs">—</span>
                    )}
                  </TD>
                  <TD className="py-3.5">
                    {canManage && member.role !== 'academy_owner' ? (
                      <Select
                        aria-label={`Role for ${member.email}`}
                        className="border-border-subtle h-9 w-32 rounded-lg py-1 font-sans text-xs"
                        value={member.role}
                        disabled={changeRole.isPending}
                        onChange={(event) =>
                          changeRole.mutate(
                            { membershipId: member.id, role: event.target.value as JoinableRole },
                            {
                              onSuccess: () =>
                                pushToast({ title: 'Role updated', variant: 'success' }),
                            },
                          )
                        }
                      >
                        {JOINABLE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span className="font-sans text-xs font-bold">
                        {ROLE_LABELS[member.role]}
                      </span>
                    )}
                  </TD>
                  <TD className="py-3.5">
                    <Badge
                      tone={STATUS_TONES[member.status]}
                      className="font-mono text-[10px] font-bold uppercase"
                    >
                      {member.status}
                    </Badge>
                  </TD>
                  <TD className="py-3.5 pr-4 text-right">
                    <Link
                      to={`/members/${member.id}`}
                      className="text-primary hover:bg-turf-pale inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-bold opacity-0 transition-colors group-hover:opacity-100"
                    >
                      View Profile <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </>
  );
}
