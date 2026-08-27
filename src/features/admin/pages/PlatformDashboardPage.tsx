import { useState } from 'react';
import {
  Building2,
  Calendar,
  Check,
  Copy,
  Link2,
  LogIn,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, CardHeader, Button, Input, Modal, Select, Avatar } from '@/components/ui';
import { ConfirmDialog, EmptyState, ErrorState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { formatDate } from '@/lib/utils/date';
import { useUiStore } from '@/stores';
import {
  usePlatformAnalytics,
  usePlatformAcademies,
  usePlatformUsers,
  usePlatformAcademyDetails,
  useCreatePlatformAcademy,
  useDeletePlatformAcademy,
  useRegenerateOwnerInvitation,
} from '../hooks/useAdmin';
import type { PlatformAcademy } from '../api/adminApi';
import type { UUID } from '@/types';

export default function PlatformDashboardPage() {
  const pushToast = useUiStore((state) => state.pushToast);
  const navigate = useNavigate();
  const { switchAcademy } = useActiveAcademy();

  const [activeTab, setActiveTab] = useState<'overview' | 'academies' | 'users'>('overview');
  const [academySearch, setAcademySearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 15;
  const [selectedAcademyId, setSelectedAcademyId] = useState<UUID | null>(null);

  // Create Academy Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCity, setCreateCity] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createTimezone, setCreateTimezone] = useState('Asia/Kolkata');
  const [createFeeMode, setCreateFeeMode] = useState<'player_pays' | 'academy_pays'>('player_pays');

  // Created Invite Modal state
  const [createdInviteInfo, setCreatedInviteInfo] = useState<{
    academyName: string;
    inviteToken: string;
    playerJoinCode: string;
    expiresAt: string;
  } | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  // Existing Academy Invite Management modal
  const [inviteModalAcademy, setInviteModalAcademy] = useState<PlatformAcademy | null>(null);
  const [activeInviteToken, setActiveInviteToken] = useState<string | null>(null);

  // Delete Academy Modal state
  const [academyToDelete, setAcademyToDelete] = useState<PlatformAcademy | null>(null);

  const analyticsQuery = usePlatformAnalytics();
  const academiesQuery = usePlatformAcademies();
  const usersQuery = usePlatformUsers();
  const academyDetailsQuery = usePlatformAcademyDetails(selectedAcademyId);

  const createAcademyMutation = useCreatePlatformAcademy();
  const deleteAcademyMutation = useDeletePlatformAcademy();
  const regenerateInviteMutation = useRegenerateOwnerInvitation();

  const analytics = analyticsQuery.data;
  const academies = academiesQuery.data ?? [];
  const users = usersQuery.data ?? [];

  const copyToClipboard = async (text: string, message = 'Link copied to clipboard') => {
    try {
      await navigator.clipboard.writeText(text);
      setHasCopied(true);
      pushToast({ title: message, variant: 'success' });
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      pushToast({ title: 'Failed to copy link', variant: 'error' });
    }
  };

  const handleEnterAcademy = (acad: PlatformAcademy) => {
    switchAcademy(acad.id);
    pushToast({
      title: `Entered ${acad.name}`,
      description: 'You are now inspecting this academy in Super Admin Mode.',
      variant: 'success',
    });
    navigate('/dashboard');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      pushToast({ title: 'Academy name is required', variant: 'error' });
      return;
    }

    try {
      const created = await createAcademyMutation.mutateAsync({
        name: createName.trim(),
        city: createCity.trim() || undefined,
        contactEmail: createEmail.trim() || undefined,
        contactPhone: createPhone.trim() || undefined,
        timezone: createTimezone,
        feeMode: createFeeMode,
      });

      pushToast({ title: 'Academy created successfully', variant: 'success' });
      setIsCreateModalOpen(false);
      setCreateName('');
      setCreateCity('');
      setCreateEmail('');
      setCreatePhone('');

      // Open owner invitation modal with generated link
      setCreatedInviteInfo({
        academyName: created.name,
        inviteToken: created.invitationToken,
        playerJoinCode: created.playerJoinCode,
        expiresAt: created.invitationExpiresAt,
      });
    } catch (err) {
      pushToast({
        title: 'Failed to create academy',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      });
    }
  };

  const handleRegenerateInvite = async (academyId: UUID) => {
    try {
      const res = await regenerateInviteMutation.mutateAsync(academyId);
      setActiveInviteToken(res.invitationToken);
      pushToast({ title: 'New owner invitation link generated', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Failed to regenerate invite',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!academyToDelete) return;
    try {
      await deleteAcademyMutation.mutateAsync(academyToDelete.id);
      pushToast({ title: `Deleted academy "${academyToDelete.name}"`, variant: 'success' });
      setAcademyToDelete(null);
    } catch (err) {
      pushToast({
        title: 'Failed to delete academy',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      });
    }
  };

  const filteredAcademies = academies.filter(
    (a) =>
      a.name.toLowerCase().includes(academySearch.toLowerCase()) ||
      a.ownerName.toLowerCase().includes(academySearch.toLowerCase()) ||
      a.ownerEmail.toLowerCase().includes(academySearch.toLowerCase()) ||
      (a.city && a.city.toLowerCase().includes(academySearch.toLowerCase())),
  );

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.fullName && u.fullName.toLowerCase().includes(userSearch.toLowerCase())),
  );
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const currentUserPage = Math.min(userPage, userTotalPages);
  const pagedUsers = filteredUsers.slice(
    (currentUserPage - 1) * USERS_PER_PAGE,
    currentUserPage * USERS_PER_PAGE,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-fg text-2xl font-bold tracking-tight">Super Admin Control Panel</h1>
          <p className="text-fg-muted text-sm">
            Platform-wide management for academies, registered users, and system analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Create Academy
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-border-subtle flex gap-2 border-b">
        <button
          type="button"
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'text-fg-muted hover:text-fg border-transparent'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            activeTab === 'academies'
              ? 'border-primary text-primary'
              : 'text-fg-muted hover:text-fg border-transparent'
          }`}
          onClick={() => setActiveTab('academies')}
        >
          Academies ({academies.length})
        </button>
        <button
          type="button"
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            activeTab === 'users'
              ? 'border-primary text-primary'
              : 'text-fg-muted hover:text-fg border-transparent'
          }`}
          onClick={() => setActiveTab('users')}
        >
          Users ({users.length})
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {analyticsQuery.isPending ? (
            <p className="text-fg-muted text-sm">Loading analytics…</p>
          ) : analyticsQuery.isError ? (
            <ErrorState
              error={analyticsQuery.error}
              onRetry={() => void analyticsQuery.refetch()}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Card>
                <CardBody className="flex items-center gap-4 p-4">
                  <div className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-fg-muted text-xs font-medium tracking-wider uppercase">
                      Total Academies
                    </p>
                    <p className="text-fg text-2xl font-bold">{analytics?.totalAcademies ?? 0}</p>
                    <p className="text-fg-muted text-xs">Registered platform academies</p>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-fg-muted text-xs font-medium tracking-wider uppercase">
                      Total Members
                    </p>
                    <p className="text-fg text-2xl font-bold">
                      {(analytics?.totalPlayers ?? 0) + (analytics?.totalCoaches ?? 0)}
                    </p>
                    <p className="text-fg-muted text-xs">
                      {analytics?.totalPlayers ?? 0} Players · {analytics?.totalCoaches ?? 0}{' '}
                      Coaches
                    </p>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-fg-muted text-xs font-medium tracking-wider uppercase">
                      Total Matches
                    </p>
                    <p className="text-fg text-2xl font-bold">{analytics?.totalMatches ?? 0}</p>
                    <p className="text-fg-muted text-xs">Recorded platform matches</p>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-fg-muted text-xs font-medium tracking-wider uppercase">
                      Training Sessions
                    </p>
                    <p className="text-fg text-2xl font-bold">{analytics?.totalSessions ?? 0}</p>
                    <p className="text-fg-muted text-xs">Scheduled training sessions</p>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* Quick Recent Academies Overview */}
          <Card>
            <CardHeader
              title="Recent Academies"
              description="Latest academies registered on the platform."
            />
            <CardBody>
              {academiesQuery.isPending ? (
                <p className="text-fg-muted text-sm">Loading academies…</p>
              ) : academies.length === 0 ? (
                <EmptyState
                  title="No academies created yet"
                  description="Click below to register the first academy on the platform."
                  action={
                    <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
                      + Create Academy
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-border-subtle text-fg-muted border-b text-xs tracking-wider uppercase">
                      <tr>
                        <th className="py-2">Academy</th>
                        <th className="py-2">Owner</th>
                        <th className="py-2">Members</th>
                        <th className="py-2">Matches</th>
                        <th className="py-2">Created</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border-subtle divide-y">
                      {academies.slice(0, 5).map((acad) => (
                        <tr key={acad.id} className="hover:bg-surface-subtle/50">
                          <td className="text-fg py-3 font-medium">
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                name={acad.name}
                                src={acad.logoUrl}
                                size="sm"
                                shape="rounded"
                              />
                              <div className="min-w-0">
                                <span className="truncate">{acad.name}</span>
                                {acad.city ? (
                                  <span className="text-fg-muted block text-xs font-normal">
                                    {acad.city}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="text-fg-muted py-3">{acad.ownerName}</td>
                          <td className="text-fg py-3">{acad.memberCount}</td>
                          <td className="text-fg py-3">{acad.matchCount}</td>
                          <td className="text-fg-muted py-3">{formatDate(acad.createdAt)}</td>
                          <td className="flex items-center justify-end gap-2 py-3 text-right">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleEnterAcademy(acad)}
                              className="min-h-[36px] gap-1"
                            >
                              <LogIn className="h-3.5 w-3.5" /> Enter Academy
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedAcademyId(acad.id);
                              }}
                            >
                              Details
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => setAcademyToDelete(acad)}
                              aria-label={`Delete ${acad.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* ACADEMIES TAB */}
      {activeTab === 'academies' && (
        <Card>
          <CardHeader
            title="Academy Management"
            description="Manage all registered cricket academies on the platform."
            action={
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
                  + Create Academy
                </Button>
                <div className="w-64">
                  <Input
                    placeholder="Search academy, owner, city..."
                    value={academySearch}
                    onChange={(e) => setAcademySearch(e.target.value)}
                  />
                </div>
              </div>
            }
          />
          <CardBody>
            {academiesQuery.isPending ? (
              <p className="text-fg-muted text-sm">Loading academies…</p>
            ) : academiesQuery.isError ? (
              <ErrorState
                error={academiesQuery.error}
                onRetry={() => void academiesQuery.refetch()}
              />
            ) : filteredAcademies.length === 0 ? (
              <p className="text-fg-muted text-sm">No academies found matching your search.</p>
            ) : (
              <>
                {/* Mobile Cards Layout (< md) */}
                <div className="space-y-3 md:hidden">
                  {filteredAcademies.map((acad) => (
                    <div
                      key={acad.id}
                      className="border-border-subtle bg-surface space-y-3 rounded-xl border p-4 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar name={acad.name} src={acad.logoUrl} size="md" shape="rounded" />
                          <div className="min-w-0">
                            <h3 className="text-fg truncate font-bold">{acad.name}</h3>
                            <p className="text-fg-muted text-xs">
                              /{acad.slug} {acad.city ? `· ${acad.city}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="bg-surface-muted text-fg-muted shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium">
                          {formatDate(acad.createdAt)}
                        </span>
                      </div>

                      <div className="border-border-subtle text-fg-muted grid grid-cols-2 gap-2 border-t pt-2 text-xs">
                        <div>
                          <span className="block text-[11px] font-medium uppercase">Owner</span>
                          <span className="text-fg font-semibold">{acad.ownerName}</span>
                        </div>
                        <div>
                          <span className="block text-[11px] font-medium uppercase">Members</span>
                          <span className="text-fg font-semibold">
                            {acad.memberCount} ({acad.playerCount}P / {acad.coachCount}C)
                          </span>
                        </div>
                      </div>

                      <div className="border-border-subtle flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleEnterAcademy(acad)}
                            className="min-h-[36px] gap-1"
                          >
                            <LogIn className="h-3.5 w-3.5" /> Enter
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedAcademyId(acad.id)}
                          >
                            Details
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setInviteModalAcademy(acad);
                              setActiveInviteToken(null);
                            }}
                            aria-label={`Owner invite for ${acad.name}`}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => setAcademyToDelete(acad)}
                            aria-label={`Delete ${acad.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table Layout (>= md) */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-border-subtle text-fg-muted border-b text-xs tracking-wider uppercase">
                      <tr>
                        <th className="px-2 py-3">Academy</th>
                        <th className="px-2 py-3">Owner</th>
                        <th className="px-2 py-3">Roster</th>
                        <th className="px-2 py-3">Created</th>
                        <th className="px-2 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border-subtle divide-y">
                      {filteredAcademies.map((acad) => (
                        <tr key={acad.id} className="hover:bg-surface-subtle/50">
                          <td className="text-fg px-2 py-3 font-medium">
                            <div className="flex items-center gap-2.5">
                              <Avatar
                                name={acad.name}
                                src={acad.logoUrl}
                                size="sm"
                                shape="rounded"
                              />
                              <div className="min-w-0">
                                <span className="truncate">{acad.name}</span>
                                <div className="text-fg-muted text-xs">
                                  /{acad.slug} {acad.city ? `· ${acad.city}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="text-fg">{acad.ownerName}</div>
                            <div className="text-fg-muted text-xs">{acad.ownerEmail}</div>
                          </td>
                          <td className="text-fg-muted px-2 py-3 text-xs whitespace-nowrap">
                            {acad.playerCount}P · {acad.coachCount}C · {acad.batchCount}B ·{' '}
                            {acad.matchCount}M
                          </td>
                          <td className="text-fg-muted px-2 py-3">{formatDate(acad.createdAt)}</td>
                          <td className="px-2 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleEnterAcademy(acad)}
                                className="min-h-[36px] gap-1"
                              >
                                <LogIn className="h-3.5 w-3.5" /> Enter
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setInviteModalAcademy(acad);
                                  setActiveInviteToken(null);
                                }}
                                aria-label={`Owner invite for ${acad.name}`}
                                title="Owner invite"
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedAcademyId(acad.id)}
                                aria-label={`Details for ${acad.name}`}
                                title="Details"
                              >
                                <Building2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => setAcademyToDelete(acad)}
                                aria-label={`Delete ${acad.name}`}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader
            title="User Management"
            description="Manage all registered platform profiles and system access."
            action={
              <div className="w-64">
                <Input
                  placeholder="Search user name or email..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUserPage(1);
                  }}
                />
              </div>
            }
          />
          <CardBody>
            {usersQuery.isPending ? (
              <p className="text-fg-muted text-sm">Loading users…</p>
            ) : usersQuery.isError ? (
              <ErrorState error={usersQuery.error} onRetry={() => void usersQuery.refetch()} />
            ) : filteredUsers.length === 0 ? (
              <p className="text-fg-muted text-sm">No users found matching your search.</p>
            ) : (
              <>
                <p className="text-fg-muted mb-3 text-xs">
                  Showing {pagedUsers.length === 0 ? 0 : (currentUserPage - 1) * USERS_PER_PAGE + 1}
                  –{(currentUserPage - 1) * USERS_PER_PAGE + pagedUsers.length} of{' '}
                  {filteredUsers.length} users
                </p>
                {/* Mobile Cards Layout (< md) */}
                <div className="space-y-3 md:hidden">
                  {pagedUsers.map((u) => (
                    <div
                      key={u.id}
                      className="border-border-subtle bg-surface space-y-2.5 rounded-xl border p-4 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-fg block truncate text-sm font-bold">
                            {u.fullName ?? u.email}
                          </h3>
                          <p className="text-fg-muted truncate text-xs">{u.email}</p>
                        </div>
                        {u.isSuperAdmin ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
                            <ShieldCheck className="h-3 w-3" /> Super Admin
                          </span>
                        ) : (
                          <span className="text-fg-muted shrink-0 text-xs font-medium">
                            Standard User
                          </span>
                        )}
                      </div>

                      <div className="border-border-subtle text-fg-muted border-t pt-2 text-xs">
                        <span className="mb-1 block text-[11px] font-semibold tracking-wider uppercase">
                          Academy Memberships
                        </span>
                        {u.memberships.length === 0 ? (
                          <span className="text-fg-muted text-xs">No active memberships</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {u.memberships.map((m) => (
                              <span
                                key={m.academyId}
                                className="bg-surface-muted text-fg border-border-subtle inline-flex rounded-md border px-2 py-0.5 text-xs font-medium"
                              >
                                {m.academyName} ({m.role})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="border-border-subtle text-fg-muted flex items-center justify-between border-t pt-2 text-xs">
                        <span>Joined Date</span>
                        <span className="text-fg font-medium">{formatDate(u.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table Layout (>= md) */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-border-subtle text-fg-muted border-b text-xs tracking-wider uppercase">
                      <tr>
                        <th className="px-2 py-3">User</th>
                        <th className="px-2 py-3">Role Status</th>
                        <th className="px-2 py-3">Academy Memberships</th>
                        <th className="px-2 py-3">Joined Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border-subtle divide-y">
                      {pagedUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-surface-subtle/50">
                          <td className="px-2 py-3">
                            <div className="text-fg font-medium">{u.fullName ?? u.email}</div>
                            <div className="text-fg-muted text-xs">{u.email}</div>
                          </td>
                          <td className="px-2 py-3">
                            {u.isSuperAdmin ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500">
                                <ShieldCheck className="h-3 w-3" /> Super Admin
                              </span>
                            ) : (
                              <span className="text-fg-muted text-xs">Standard User</span>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            {u.memberships.length === 0 ? (
                              <span className="text-fg-muted text-xs">No active memberships</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {u.memberships.map((m) => (
                                  <span
                                    key={m.academyId}
                                    className="bg-surface-muted text-fg border-border-subtle inline-flex rounded border px-2 py-0.5 text-xs"
                                  >
                                    {m.academyName} ({m.role})
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="text-fg-muted px-2 py-3 text-xs">
                            {formatDate(u.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {userTotalPages > 1 ? (
                  <div className="border-border-subtle mt-4 flex items-center justify-between border-t pt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={currentUserPage <= 1}
                      onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-fg-muted text-xs font-medium">
                      Page {currentUserPage} of {userTotalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={currentUserPage >= userTotalPages}
                      onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* ACADEMY DETAILS MODAL */}
      <Modal
        open={Boolean(selectedAcademyId)}
        title="Academy Details"
        onClose={() => setSelectedAcademyId(null)}
        size="lg"
      >
        {academyDetailsQuery.isPending ? (
          <p className="text-fg-muted py-4 text-center text-sm">Loading academy details…</p>
        ) : academyDetailsQuery.isError ? (
          <ErrorState
            error={academyDetailsQuery.error}
            onRetry={() => void academyDetailsQuery.refetch()}
          />
        ) : !academyDetailsQuery.data ? (
          <p className="text-fg-muted py-4 text-center text-sm">Academy details unavailable.</p>
        ) : (
          <div className="space-y-6">
            {/* Overview info */}
            <div className="border-border-subtle bg-surface-subtle grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
              <div>
                <h3 className="text-fg text-lg font-bold">
                  {academyDetailsQuery.data.academy.name}
                </h3>
                <p className="text-fg-muted text-xs">
                  Slug: /{academyDetailsQuery.data.academy.slug}
                </p>
                <p className="text-fg-muted text-xs">
                  City: {academyDetailsQuery.data.academy.city ?? 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-fg-muted text-xs">
                  Owner:{' '}
                  <span className="text-fg font-medium">
                    {academyDetailsQuery.data.academy.ownerName}
                  </span>
                </p>
                <p className="text-fg-muted text-xs">
                  Owner Email:{' '}
                  <span className="text-fg">{academyDetailsQuery.data.academy.ownerEmail}</span>
                </p>
                <p className="text-fg-muted text-xs">
                  Created: {formatDate(academyDetailsQuery.data.academy.createdAt)}
                </p>
              </div>
            </div>

            {/* Members */}
            <div>
              <h4 className="text-fg mb-2 text-sm font-semibold">
                Roster & Staff ({academyDetailsQuery.data.members.length})
              </h4>
              <div className="border-border-subtle max-h-48 overflow-y-auto rounded-xl border p-2">
                <div className="divide-border-subtle divide-y">
                  {academyDetailsQuery.data.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-1 py-2 text-xs">
                      <div>
                        <p className="text-fg font-medium">{m.name}</p>
                        <p className="text-fg-muted">{m.email}</p>
                      </div>
                      <span className="text-fg-muted bg-surface-muted rounded px-2 py-0.5 capitalize">
                        {m.role.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Batches & Matches */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="text-fg mb-2 text-sm font-semibold">
                  Batches ({academyDetailsQuery.data.batches.length})
                </h4>
                <div className="border-border-subtle max-h-36 overflow-y-auto rounded-xl border p-2">
                  {academyDetailsQuery.data.batches.length === 0 ? (
                    <p className="text-fg-muted text-xs">No batches created</p>
                  ) : (
                    academyDetailsQuery.data.batches.map((b) => (
                      <div key={b.id} className="text-fg py-1 text-xs font-medium">
                        • {b.name}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-fg mb-2 text-sm font-semibold">
                  Matches ({academyDetailsQuery.data.matches.length})
                </h4>
                <div className="border-border-subtle max-h-36 overflow-y-auto rounded-xl border p-2">
                  {academyDetailsQuery.data.matches.length === 0 ? (
                    <p className="text-fg-muted text-xs">No matches recorded</p>
                  ) : (
                    academyDetailsQuery.data.matches.map((m) => (
                      <div key={m.id} className="text-fg py-1 text-xs">
                        • {m.matchName}{' '}
                        <span className="text-fg-muted">({formatDate(m.matchDate)})</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* CREATE ACADEMY MODAL */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Academy"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} noValidate className="space-y-4">
          <p className="text-fg-muted text-xs">
            Creating an academy will automatically generate a secure{' '}
            <strong>Owner Invitation Link</strong>. You can copy and share this link directly with
            the academy owner.
          </p>

          <div>
            <label className="text-fg mb-1 block text-sm font-medium" htmlFor="create-name">
              Academy name *
            </label>
            <Input
              id="create-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Rising Stars Cricket Academy"
            />
          </div>

          <div>
            <label className="text-fg mb-1 block text-sm font-medium" htmlFor="create-city">
              City
            </label>
            <Input
              id="create-city"
              value={createCity}
              onChange={(e) => setCreateCity(e.target.value)}
              placeholder="City"
            />
          </div>

          <div>
            <label className="text-fg mb-1 block text-sm font-medium" htmlFor="create-email">
              Contact email
            </label>
            <Input
              id="create-email"
              type="email"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="admin@academy.com"
            />
          </div>

          <div>
            <label className="text-fg mb-1 block text-sm font-medium" htmlFor="create-phone">
              Contact phone
            </label>
            <Input
              id="create-phone"
              value={createPhone}
              onChange={(e) => setCreatePhone(e.target.value)}
              placeholder="9876543210"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-fg mb-1 block text-sm font-medium" htmlFor="create-timezone">
                Timezone
              </label>
              <Select
                id="create-timezone"
                value={createTimezone}
                onChange={(e) => setCreateTimezone(e.target.value)}
              >
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
                <option value="Asia/Colombo">Asia/Colombo</option>
                <option value="UTC">UTC</option>
              </Select>
            </div>

            <div>
              <label className="text-fg mb-1 block text-sm font-medium" htmlFor="create-feemode">
                Fee Mode
              </label>
              <Select
                id="create-feemode"
                value={createFeeMode}
                onChange={(e) => setCreateFeeMode(e.target.value as 'player_pays' | 'academy_pays')}
              >
                <option value="player_pays">Player Pays</option>
                <option value="academy_pays">Academy Pays</option>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createAcademyMutation.isPending}>
              Create Academy & Generate Invite
            </Button>
          </div>
        </form>
      </Modal>

      {/* POST-CREATION OWNER INVITATION MODAL */}
      {createdInviteInfo && (
        <Modal
          open={Boolean(createdInviteInfo)}
          onClose={() => setCreatedInviteInfo(null)}
          title="Academy Created Successfully!"
          size="md"
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-fg font-bold">{createdInviteInfo.academyName} is ready!</h3>
              </div>
              <p className="text-fg-muted mt-1 text-xs">
                A default player join code (
                <strong className="text-fg font-mono">{createdInviteInfo.playerJoinCode}</strong>)
                and an Owner Invitation Link have been created.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-fg block text-xs font-semibold tracking-wider uppercase">
                Owner Invitation Link (Single-Use)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/academy/invite/${createdInviteInfo.inviteToken}`}
                  className="bg-surface-subtle font-mono text-xs select-all"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      `${window.location.origin}/academy/invite/${createdInviteInfo.inviteToken}`,
                      'Owner invitation link copied!',
                    )
                  }
                  className="shrink-0 gap-1.5 font-semibold"
                >
                  {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {hasCopied ? 'Copied' : 'Copy Link'}
                </Button>
              </div>
              <p className="text-fg-muted text-[11px]">
                Send this link to the academy owner. When they open and accept the link, they will
                automatically become the verified Owner.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setCreatedInviteInfo(null)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MANAGE / REGENERATE OWNER INVITATION MODAL */}
      {inviteModalAcademy && (
        <Modal
          open={Boolean(inviteModalAcademy)}
          onClose={() => {
            setInviteModalAcademy(null);
            setActiveInviteToken(null);
          }}
          title={`Owner Invitation — ${inviteModalAcademy.name}`}
          size="md"
        >
          <div className="space-y-5">
            <p className="text-fg-muted text-xs">
              Generate a new secure single-use invitation link for the owner of{' '}
              <strong>{inviteModalAcademy.name}</strong>. Generating a new link revokes any previous
              pending links.
            </p>

            {activeInviteToken ? (
              <div className="space-y-2">
                <label className="text-fg block text-xs font-semibold tracking-wider uppercase">
                  New Owner Invitation Link
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/academy/invite/${activeInviteToken}`}
                    className="bg-surface-subtle font-mono text-xs select-all"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        `${window.location.origin}/academy/invite/${activeInviteToken}`,
                        'Owner invitation link copied!',
                      )
                    }
                    className="shrink-0 gap-1.5 font-semibold"
                  >
                    {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {hasCopied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setInviteModalAcademy(null);
                  setActiveInviteToken(null);
                }}
              >
                Close
              </Button>
              <Button
                variant="primary"
                isLoading={regenerateInviteMutation.isPending}
                onClick={() => handleRegenerateInvite(inviteModalAcademy.id)}
                className="gap-1.5 font-semibold"
              >
                <Link2 className="h-4 w-4" />
                {activeInviteToken ? 'Regenerate Again' : 'Generate Invitation Link'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE ACADEMY CONFIRMATION */}
      <ConfirmDialog
        open={academyToDelete !== null}
        title={`Delete ${academyToDelete?.name ?? 'academy'}?`}
        message="This permanently removes the academy from the platform. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        isLoading={deleteAcademyMutation.isPending}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setAcademyToDelete(null)}
      />
    </div>
  );
}
