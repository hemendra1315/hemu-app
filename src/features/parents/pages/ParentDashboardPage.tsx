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
import { Card, buttonStyles, Button, Modal } from '@/components/ui';
import { ErrorState } from '@/components/feedback';
import { useLinkedChildren, useRevokeParentLink } from '../hooks/useParents';
import { useActiveAcademy } from '@/features/academies/hooks/useAcademies';
import { usePlayerUpcomingSessions } from '@/features/players/hooks/usePlayers';
import { usePlayerAttendance } from '@/features/attendance/hooks/useAttendance';
import { useAcademyMatches } from '@/features/matches/hooks/useMatches';
import { usePlayerStatisticsById } from '@/features/matches/hooks/useMatches';
import { useAnnouncements } from '@/features/notifications/hooks/useAnnouncements';
import { format, isAfter } from 'date-fns';
import { useUiStore } from '@/stores';

export default function ParentDashboardPage() {
  const { academyId, membership } = useActiveAcademy();
  const {
    data: children = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useLinkedChildren(academyId || undefined);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const activeChild = children.find((c) => c.player.id === selectedChildId) || children[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-bold">
            {membership?.academyName?.charAt(0) || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight">Welcome</h1>
            <p className="text-fg-muted mt-0.5 truncate text-xs">{membership?.academyName}</p>
          </div>
        </div>
        <Link
          to="/parent/link-player"
          className={buttonStyles('secondary', 'sm')}
          title="Link another child"
        >
          <Plus className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">Loading dashboard...</div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : children.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="bg-surface-muted mb-4 rounded-full p-4">
            <Users className="text-fg-muted h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold">No children linked</h3>
          <p className="text-fg-muted mt-2 max-w-sm text-sm">
            Link your child's profile using a secure code from their coach to track their progress
            and schedule.
          </p>
          <Link to="/parent/link-player" className={buttonStyles('primary', 'md', 'mt-6')}>
            Link a Child
          </Link>
        </Card>
      ) : (
        <>
          {children.length > 1 && (
            <div className="scrollbar-hide flex space-x-2 overflow-x-auto pb-2">
              {children.map((child) => (
                <button
                  key={child.player.id}
                  onClick={() => setSelectedChildId(child.player.id)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeChild?.player.id === child.player.id ? 'bg-primary text-primary-fg' : 'bg-surface hover:bg-surface-muted border'}`}
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
                  {child.player.fullName?.split(' ')[0]}
                </button>
              ))}
            </div>
          )}

          {activeChild && <ChildDashboard child={activeChild} academyId={academyId!} />}
        </>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChildDashboard({ child, academyId }: { child: any; academyId: string }) {
  // A parent had no way to unlink themselves from a child — not staff,
  // just them personally deciding they no longer want that child's
  // profile linked to their account. There was no button anywhere for it,
  // and the underlying RLS policy didn't even allow a parent to update
  // their own parent_player_links row (fixed alongside this).
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const revokeLink = useRevokeParentLink();
  const pushToast = useUiStore((s) => s.pushToast);

  const handleUnlink = async () => {
    try {
      await revokeLink.mutateAsync(child.linkId);
      pushToast({ title: 'Unlinked from this child', variant: 'success' });
      setShowUnlinkConfirm(false);
    } catch {
      pushToast({ title: 'Failed to unlink', variant: 'error' });
    }
  };

  // Was useTrainingSessions(academyId) — every training session the academy
  // has ever scheduled, unbounded, fetched fresh on every dashboard visit,
  // just to filter down to "the next one" in the browser. Swapped for the
  // same bounded, batch-scoped, already-sorted query the player's own
  // profile page uses (round 19), so this only ever asks the database for
  // this child's next few sessions.
  const sessionsQuery = usePlayerUpcomingSessions(child.player.id, academyId);
  const matchesQuery = useAcademyMatches(academyId);
  const statsQuery = usePlayerStatisticsById(academyId, child.player.id);
  const attendanceQuery = usePlayerAttendance(child.player.id, academyId);
  // Was unbounded — every announcement the academy has ever posted,
  // fetched fresh on every dashboard visit, just to show the 3 most
  // recent. Only asking the database for the most recent 10 keeps this
  // bounded regardless of how long the academy's been running.
  const announcementsQuery = useAnnouncements(10);

  if (
    statsQuery.isPending ||
    attendanceQuery.isPending ||
    sessionsQuery.isPending ||
    matchesQuery.isPending ||
    announcementsQuery.isPending
  ) {
    return <p className="text-fg-muted p-4">Loading dashboard…</p>;
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

  const matches = matchesQuery.data;
  const stats = statsQuery.data;
  const attendance = attendanceQuery.data;
  const announcements = announcementsQuery.data;

  const now = new Date();

  // usePlayerUpcomingSessions already returns just this child's upcoming
  // sessions, soonest first — no client-side filter/sort needed.
  const nextSession = sessionsQuery.data?.[0];

  // Upcoming matches (ignore if Match enum statuses do not have "scheduled")
  // Instead filter by matchDate > now
  //
  // The old `m.batchId === child.player.batchId || !m.batchId` compared a
  // possibly-`undefined` player batchId against a possibly-`null` match
  // batchId with strict equality — `undefined !== null`, so for a
  // batchless child (batchId missing rather than explicitly null) the
  // first branch could never match, silently relying on the second branch
  // alone. Normalizing both sides to `null` first makes "batchless"
  // actually mean the same thing on both, whatever shape the data arrives
  // in.
  const childBatchId = child.player.batchId ?? null;
  const upcomingMatches = matches
    .filter((m) => {
      const matchBatchId = m.batchId ?? null;
      return (
        (matchBatchId === null || matchBatchId === childBatchId) &&
        m.matchDate &&
        isAfter(new Date(m.matchDate), now)
      );
    })
    .sort((a, b) => new Date(a.matchDate!).getTime() - new Date(b.matchDate!).getTime())
    .slice(0, 2);

  const attendancePercentage =
    attendance.length > 0
      ? Math.round(
          (attendance.filter((a) => a.status === 'present').length / attendance.length) * 100,
        )
      : 0;

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5 flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          {child.player.avatarUrl ? (
            <img
              src={child.player.avatarUrl}
              alt=""
              className="ring-primary/20 h-14 w-14 rounded-full object-cover shadow-sm ring-2"
            />
          ) : (
            <div className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold">
              {child.player.fullName?.charAt(0) || '?'}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold">{child.player.fullName}</h2>
            <div className="text-fg-muted mt-0.5 flex items-center gap-1.5 text-sm">
              {child.player.batchName && (
                <span className="bg-surface rounded-full border px-2 py-0.5 text-xs">
                  {child.player.batchName}
                </span>
              )}
              <span className="text-xs capitalize">• {child.relationshipType}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/parent/child/${child.player.id}`} className={buttonStyles('secondary', 'sm')}>
            <QrCode className="mr-2 h-4 w-4" /> Card
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger hover:bg-danger/10"
            onClick={() => setShowUnlinkConfirm(true)}
            title="Unlink this child from your account"
          >
            <UserMinus className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Modal
        open={showUnlinkConfirm}
        onClose={() => setShowUnlinkConfirm(false)}
        title="Unlink this child?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowUnlinkConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={revokeLink.isPending} onClick={handleUnlink}>
              Unlink
            </Button>
          </>
        }
      >
        <p className="text-fg-muted text-sm">
          You'll no longer be able to see {child.player.fullName}'s profile, schedule, or stats.
          Their coach can send you a new linking code if you want to reconnect later.
        </p>
      </Modal>

      <div className="grid grid-cols-2 gap-4">
        <Card className="flex flex-col items-center justify-center space-y-1 p-4 text-center">
          <div className="text-fg-muted text-xs font-medium tracking-wider uppercase">
            Attendance
          </div>
          <div className="text-primary text-2xl font-bold">{attendancePercentage}%</div>
          <div className="text-fg-muted text-xs">{attendance.length} total sessions</div>
        </Card>
        <Card className="flex flex-col items-center justify-center space-y-1 p-4 text-center">
          <div className="text-fg-muted text-xs font-medium tracking-wider uppercase">Matches</div>
          <div className="text-primary text-2xl font-bold">{stats?.matchesPlayed || 0}</div>
          <div className="text-fg-muted text-xs">played</div>
        </Card>
      </div>

      {nextSession && (
        <div>
          <h3 className="mb-3 flex items-center font-semibold">
            <Calendar className="text-primary mr-2 h-4 w-4" /> Next Session
          </h3>
          <Card className="border-l-primary border-l-4 p-4">
            <div className="text-lg font-medium">{nextSession.title}</div>
            <div className="text-fg-muted mt-2 flex flex-col gap-1.5 text-sm">
              <div className="flex items-center">
                <Calendar className="mr-2 h-3.5 w-3.5" />{' '}
                {format(new Date(nextSession.startAt), 'EEEE, MMM d, yyyy')}
              </div>
              <div className="flex items-center">
                <Clock className="mr-2 h-3.5 w-3.5" />{' '}
                {format(new Date(nextSession.startAt), 'h:mm a')} -{' '}
                {format(new Date(nextSession.endAt), 'h:mm a')}
              </div>
            </div>
          </Card>
        </div>
      )}

      {upcomingMatches.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center font-semibold">
            <TrendingUp className="text-primary mr-2 h-4 w-4" /> Upcoming Matches
          </h3>
          <div className="space-y-3">
            {upcomingMatches.map((match) => (
              <Card key={match.id} className="p-4">
                <div className="font-medium">{match.opponentName || 'TBD'}</div>
                <div className="text-fg-muted mt-1 flex items-center gap-3 text-sm">
                  {match.matchDate && (
                    <span>{format(new Date(match.matchDate), 'MMM d, h:mm a')}</span>
                  )}
                  {match.venue && (
                    <span className="flex items-center">
                      <MapPin className="mr-1 h-3 w-3" /> {match.venue}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {announcements.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center font-semibold">
            <Bell className="text-primary mr-2 h-4 w-4" /> Recent Announcements
          </h3>
          <div className="space-y-3">
            {announcements.slice(0, 3).map((ann) => (
              <Card key={ann.id} className="p-4">
                <div className="font-medium">{ann.title}</div>
                <div className="text-fg-muted mt-1 line-clamp-2 text-sm">{ann.message}</div>
                <div className="text-fg-muted mt-2 text-xs">
                  {format(new Date(ann.created_at), 'MMM d')}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
