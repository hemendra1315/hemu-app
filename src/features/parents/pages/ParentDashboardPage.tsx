import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Users,
  QrCode,
  Calendar,
  TrendingUp,
  Bell,
  MapPin,
  Clock,
  UserMinus,
} from 'lucide-react';
import { Card, CardBody, CardHeader, Button, Badge } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { useLinkedChildren, useRevokeParentLink } from '../hooks/useParents';
import { useActiveAcademy } from '@/features/academies/hooks/useAcademies';
import { useTrainingSessions } from '@/features/sessions/hooks/useSessions';
import { usePlayerAttendance } from '@/features/attendance/hooks/useAttendance';
import { useAcademyMatches } from '@/features/matches/hooks/useMatches';
import { usePlayerStatisticsById } from '@/features/matches/hooks/useMatches';
import { useAnnouncements } from '@/features/notifications/hooks/useAnnouncements';
import { format, isAfter } from 'date-fns';

export default function ParentDashboardPage() {
  const { academyId, membership } = useActiveAcademy();
  const { data: children = [], isLoading } = useLinkedChildren(academyId || undefined);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const activeChild = children.find((c) => c.player.id === selectedChildId) || children[0];

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* 1. Header with Link Child CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-fg truncate text-xl font-extrabold tracking-tight md:text-2xl">
            Parent Dashboard
          </h1>
          <p className="text-fg-muted truncate text-xs font-semibold tracking-wide">
            {membership?.academyName ?? 'Academy'} · Child Progress
          </p>
        </div>
        <Link
          to="/parent/link-player"
          className="hover:bg-surface-muted/80 border-border-subtle bg-surface text-fg inline-flex h-10 min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-bold shadow-2xs transition-all active:scale-[0.98]"
        >
          <Plus className="text-primary h-4 w-4" />
          <span>Link Child</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex min-h-[300px] items-center justify-center p-6 text-center">
          <p className="text-fg-muted text-sm font-medium">Loading parent dashboard...</p>
        </div>
      ) : children.length === 0 ? (
        <Card className="border-border-subtle bg-surface shadow-2xs">
          <CardBody className="flex flex-col items-center justify-center p-8 text-center sm:p-12">
            <div className="bg-primary/10 mb-4 rounded-2xl p-4">
              <Users className="text-primary h-8 w-8" />
            </div>
            <h3 className="text-fg text-lg font-extrabold tracking-tight">No children linked</h3>
            <p className="text-fg-muted mt-2 max-w-sm text-xs font-medium">
              Link your child's profile using the 8-character linking code provided by their coach
              to track attendance, schedules, and matches.
            </p>
            <Link
              to="/parent/link-player"
              className="bg-primary text-primary-fg mt-6 inline-flex h-11 min-h-[44px] items-center justify-center rounded-xl px-5 text-xs font-bold shadow-xs transition-all active:scale-[0.98]"
            >
              Link a Child
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Child Switcher Chips (if > 1 child) */}
          {children.length > 1 && (
            <div className="no-scrollbar flex space-x-2 overflow-x-auto pb-1">
              {children.map((child) => {
                const isSelected = activeChild?.player.id === child.player.id;
                return (
                  <button
                    key={child.player.id}
                    onClick={() => setSelectedChildId(child.player.id)}
                    className={`flex min-h-[40px] shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'bg-primary text-primary-fg shadow-2xs'
                        : 'border-border-subtle bg-surface text-fg hover:bg-surface-muted/60 border'
                    }`}
                  >
                    {child.player.avatarUrl ? (
                      <img
                        src={child.player.avatarUrl}
                        alt=""
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="bg-surface-muted text-fg-muted flex h-5 w-5 items-center justify-center rounded-full text-[10px]">
                        {child.player.fullName?.charAt(0) || '?'}
                      </div>
                    )}
                    <span>{child.player.fullName}</span>
                  </button>
                );
              })}
            </div>
          )}

          {activeChild && <ChildDashboard child={activeChild} academyId={academyId!} />}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChildDashboard({ child, academyId }: { child: any; academyId: string }) {
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const revokeLinkMutation = useRevokeParentLink();

  const sessionsQuery = useTrainingSessions(academyId);
  const matchesQuery = useAcademyMatches(academyId);
  const statsQuery = usePlayerStatisticsById(academyId, child.player.id);
  const attendanceQuery = usePlayerAttendance(child.player.id, academyId);
  const announcementsQuery = useAnnouncements();

  if (
    statsQuery.isPending ||
    attendanceQuery.isPending ||
    sessionsQuery.isPending ||
    matchesQuery.isPending ||
    announcementsQuery.isPending
  ) {
    return (
      <div className="flex min-h-[250px] items-center justify-center p-6 text-center">
        <p className="text-fg-muted text-sm font-medium">Loading child details...</p>
      </div>
    );
  }

  const firstError =
    statsQuery.error ||
    attendanceQuery.error ||
    sessionsQuery.error ||
    matchesQuery.error ||
    announcementsQuery.error;

  if (
    statsQuery.isError ||
    attendanceQuery.isError ||
    sessionsQuery.isError ||
    matchesQuery.isError ||
    announcementsQuery.isError
  ) {
    return (
      <ErrorState
        error={firstError}
        onRetry={() => {
          void statsQuery.refetch();
          void attendanceQuery.refetch();
          void sessionsQuery.refetch();
          void matchesQuery.refetch();
          void announcementsQuery.refetch();
        }}
      />
    );
  }

  const sessions = sessionsQuery.data;
  const matches = matchesQuery.data;
  const stats = statsQuery.data;
  const attendance = attendanceQuery.data;
  const announcements = announcementsQuery.data;

  const now = new Date();

  // Next session (batch-matched or academy-wide, future)
  const upcomingSessions = sessions
    .filter(
      (s) =>
        (s.batchId === child.player.batchId || !s.batchId) && isAfter(new Date(s.startAt), now),
    )
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const nextSession = upcomingSessions[0];

  // Upcoming matches (future)
  const upcomingMatches = matches
    .filter(
      (m) =>
        (m.batchId === child.player.batchId || !m.batchId) &&
        m.matchDate &&
        isAfter(new Date(m.matchDate), now),
    )
    .sort((a, b) => new Date(a.matchDate!).getTime() - new Date(b.matchDate!).getTime())
    .slice(0, 2);

  const attendancePercentage =
    attendance.length > 0
      ? Math.round(
          (attendance.filter((a) => a.status === 'present').length / attendance.length) * 100,
        )
      : 0;

  const handleUnlink = () => {
    if (child.id) {
      revokeLinkMutation.mutate(child.id, {
        onSuccess: () => {
          setShowUnlinkConfirm(false);
        },
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Hero Card */}
      <Card className="border-border-subtle bg-surface shadow-2xs">
        <CardBody className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            {child.player.avatarUrl ? (
              <img
                src={child.player.avatarUrl}
                alt=""
                className="border-border-subtle/80 h-14 w-14 shrink-0 rounded-2xl border object-cover shadow-2xs"
              />
            ) : (
              <div className="bg-primary/10 text-primary border-primary/20 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-xl font-bold shadow-2xs">
                {child.player.fullName?.charAt(0) || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-fg truncate text-lg font-extrabold tracking-tight">
                {child.player.fullName}
              </h2>
              <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold">
                {child.player.batchName && (
                  <Badge tone="brand" className="shrink-0 px-2 py-0.5 text-[10px]">
                    {child.player.batchName}
                  </Badge>
                )}
                <span className="capitalize">· {child.relationshipType}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to={`/parent/child/${child.player.id}`}
              className="hover:bg-surface-muted/80 border-border-subtle bg-surface text-fg inline-flex h-9 min-h-[36px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold shadow-2xs transition-all active:scale-[0.98]"
            >
              <QrCode className="text-primary h-3.5 w-3.5" />
              <span>Card</span>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUnlinkConfirm(true)}
              className="text-danger hover:bg-danger/10 h-9 min-h-[36px] px-2.5 text-xs font-bold"
              title="Unlink Child"
            >
              <UserMinus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Unlink Confirmation */}
      {showUnlinkConfirm && (
        <div className="border-danger/30 bg-danger/5 flex items-center justify-between gap-3 rounded-xl border p-3.5 text-xs">
          <p className="text-fg font-medium">
            Are you sure you want to unlink{' '}
            <span className="font-bold">{child.player.fullName}</span>?
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 min-h-[32px] text-xs font-bold"
              onClick={() => setShowUnlinkConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              className="h-8 min-h-[32px] text-xs font-bold"
              isLoading={revokeLinkMutation.isPending}
              onClick={handleUnlink}
            >
              Unlink
            </Button>
          </div>
        </div>
      )}

      {/* 2. Core Stats (Attendance & Matches) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
          <span className="text-fg-muted truncate text-[11px] font-bold tracking-wider uppercase">
            Attendance
          </span>
          <div className="mt-2">
            <p className="text-primary font-mono text-2xl font-extrabold tracking-tight">
              {attendancePercentage}%
            </p>
            <p className="text-fg-muted mt-0.5 truncate text-[11px] font-medium">
              {attendance.length} total sessions
            </p>
          </div>
        </div>

        <div className="border-border-subtle bg-surface flex flex-col justify-between rounded-xl border p-3.5 shadow-2xs">
          <span className="text-fg-muted truncate text-[11px] font-bold tracking-wider uppercase">
            Matches Played
          </span>
          <div className="mt-2">
            <p className="text-fg font-mono text-2xl font-extrabold tracking-tight">
              {stats?.matchesPlayed || 0}
            </p>
            <p className="text-fg-muted mt-0.5 truncate text-[11px] font-medium">Career matches</p>
          </div>
        </div>
      </div>

      {/* 3. Next Session */}
      {nextSession && (
        <Card className="border-border-subtle bg-surface shadow-2xs">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <Calendar className="text-primary h-4 w-4 shrink-0" />
                <span>Next Session</span>
              </div>
            }
          />
          <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="border-primary/40 bg-surface border-l-primary flex flex-col gap-2 rounded-xl border border-l-4 p-3.5">
              <p className="text-fg text-sm font-bold">{nextSession.title}</p>
              <div className="text-fg-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(nextSession.startAt), 'EEEE, MMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="h-3.5 w-3.5" />
                  {format(new Date(nextSession.startAt), 'h:mm a')} -{' '}
                  {format(new Date(nextSession.endAt), 'h:mm a')}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 4. Upcoming Matches */}
      {upcomingMatches.length > 0 && (
        <Card className="border-border-subtle bg-surface shadow-2xs">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <TrendingUp className="text-primary h-4 w-4 shrink-0" />
                <span>Upcoming Matches</span>
              </div>
            }
          />
          <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="space-y-2.5">
              {upcomingMatches.map((match) => (
                <div
                  key={match.id}
                  className="border-border-subtle bg-surface flex min-h-[50px] items-center justify-between gap-3 rounded-xl border p-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-fg truncate text-sm font-bold">
                      vs {match.opponentName || 'TBD'}
                    </p>
                    <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium">
                      {match.matchDate && (
                        <span>{format(new Date(match.matchDate), 'MMM d, h:mm a')}</span>
                      )}
                      {match.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {match.venue}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* 5. Recent Announcements */}
      {announcements.length > 0 && (
        <Card className="border-border-subtle bg-surface shadow-2xs">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <Bell className="text-primary h-4 w-4 shrink-0" />
                <span>Recent Announcements</span>
              </div>
            }
          />
          <CardBody className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="space-y-2.5">
              {announcements.slice(0, 3).map((ann) => (
                <div
                  key={ann.id}
                  className="border-border-subtle bg-surface rounded-xl border p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-fg truncate text-sm font-bold">{ann.title}</p>
                    <span className="text-fg-muted shrink-0 text-[11px] font-medium">
                      {format(new Date(ann.created_at), 'MMM d')}
                    </span>
                  </div>
                  <p className="text-fg-muted mt-1 line-clamp-2 text-xs leading-relaxed font-medium">
                    {ann.message}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
