import { useState } from 'react';
import { ChevronDown, ChevronUp, Megaphone, Plus, Trash2, Users } from 'lucide-react';
import { Button, Card, Modal } from '@/components/ui';
import {
  useAnnouncements,
  useAnnouncementTargets,
  useDeleteAnnouncement,
} from '../hooks/useAnnouncements';
import type { Announcement, AudienceType } from '../api/announcementsApi';
import { useNavigate } from 'react-router-dom';
import { useCan } from '@/lib/rbac';
import { useActiveAcademy } from '@/features/academies/hooks/useAcademies';
import { useBatches } from '@/features/batches/hooks/useBatches';
import { useAcademyMembers } from '@/features/members';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores';

// The badge previously showed the raw enum value (e.g. "all_parents",
// "batch") verbatim -- readable to a developer, not to a coach.
const AUDIENCE_LABELS: Record<AudienceType, string> = {
  all: 'Everyone',
  coaches: 'Coaches',
  players: 'Players',
  batch: 'One Batch',
  all_parents: 'All Parents',
  custom: 'Selected People',
};

// Only these two audiences have a specific, look-up-able set of recipients
// worth showing -- everything else already says who it went to in the badge
// itself ("Everyone", "Coaches", "Players", "All Parents").
const RESOLVABLE_AUDIENCES: AudienceType[] = ['batch', 'custom'];

/**
 * "Who was this actually sent to" for one announcement. The API call
 * (`announcementsApi.getTargets`) existed since the custom-audience picker
 * was built, but nothing in the UI ever called it -- staff had no way to
 * confirm who a "Selected People" or "One Batch" announcement reached short
 * of checking Supabase directly. Fetched lazily, only once expanded.
 */
function AnnouncementRecipients({
  announcement,
  batchNamesById,
  memberLabelsById,
}: {
  announcement: Announcement;
  batchNamesById: Map<string, string>;
  memberLabelsById: Map<string, string>;
}) {
  // A legacy "one batch" announcement stores its target directly on the row
  // (`batch_id`) rather than in `announcement_targets` -- no fetch needed,
  // so the hook below is disabled for that case rather than skipped, to
  // keep this an unconditional hook call every render.
  const targetsQuery = useAnnouncementTargets(
    announcement.audience === 'custom' ? announcement.id : null,
  );

  if (announcement.audience === 'batch') {
    const name = announcement.batch_id ? batchNamesById.get(announcement.batch_id) : null;
    return (
      <p className="text-fg-muted text-sm">
        Sent to{' '}
        <span className="text-fg font-medium">{name ?? 'a batch that no longer exists'}</span>.
      </p>
    );
  }

  if (targetsQuery.isPending) {
    return <p className="text-fg-muted text-sm">Loading recipients…</p>;
  }
  if (targetsQuery.isError) {
    return <p className="text-danger text-sm">Couldn't load recipients.</p>;
  }

  const targets = targetsQuery.data ?? [];
  if (targets.length === 0) {
    return <p className="text-fg-muted text-sm">No recipients recorded for this announcement.</p>;
  }

  const batchTargets = targets.filter((t) => t.batch_id);
  const memberTargets = targets.filter((t) => t.academy_member_id);

  return (
    <div className="space-y-2 text-sm">
      {batchTargets.length > 0 && (
        <p>
          <span className="text-fg-muted">Batches: </span>
          <span className="text-fg">
            {batchTargets
              .map((t) => (t.batch_id ? (batchNamesById.get(t.batch_id) ?? 'Unknown batch') : ''))
              .join(', ')}
          </span>
        </p>
      )}
      {memberTargets.length > 0 && (
        <p>
          <span className="text-fg-muted">People: </span>
          <span className="text-fg">
            {memberTargets
              .map((t) =>
                t.academy_member_id
                  ? (memberLabelsById.get(t.academy_member_id) ?? 'Unknown member')
                  : '',
              )
              .join(', ')}
          </span>
        </p>
      )}
    </div>
  );
}

export function AnnouncementsPage() {
  const { membership, academyId } = useActiveAcademy();
  // Bounded like the parent dashboard's announcements list (round 21) and
  // the notifications list/bell (this round) -- this screen doesn't need
  // the academy's entire announcement history to render.
  const { data: announcements = [], isLoading } = useAnnouncements(50);
  const canManage = useCan('announcements:manage');
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const deleteAnnouncement = useDeleteAnnouncement();
  const pushToast = useUiStore((s) => s.pushToast);
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Only staff can see the full recipient list (RLS narrows `getTargets` to
  // "rows about yourself" for anyone else), and only staff has a reason to
  // check who an announcement reached -- so the recipients toggle itself is
  // staff-only, same gate as "New Announcement".
  const { data: batches = [] } = useBatches(canManage ? (academyId ?? null) : null);
  const { data: members = [] } = useAcademyMembers(canManage ? (academyId ?? null) : null, {
    status: 'active',
  });
  const batchNamesById = new Map(batches.map((b) => [b.id, b.name]));
  const memberLabelsById = new Map(members.map((m) => [m.id, m.fullName ?? m.email]));

  // The delete API call existed but nothing in the UI ever called it. The
  // database only allows an owner to delete any announcement, or a coach to
  // delete one they created themselves -- mirror that here so the button
  // only appears where the delete would actually succeed.
  const canDelete = (announcement: Announcement) =>
    canManage && (membership?.role === 'academy_owner' || announcement.created_by === userId);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteAnnouncement.mutateAsync(pendingDelete.id);
      pushToast({ title: 'Announcement deleted', variant: 'success' });
    } catch {
      pushToast({ title: 'Failed to delete announcement', variant: 'error' });
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-fg-muted mt-1 text-sm">{membership?.academyName} news and updates.</p>
        </div>

        {canManage && (
          <Button onClick={() => navigate('/announcements/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Announcement
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="bg-surface-muted mb-4 rounded-full p-4">
            <Megaphone className="text-fg-muted h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold">No announcements</h3>
          <p className="text-fg-muted mt-2 text-sm">There are no announcements to display.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id} className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">{announcement.title}</h3>
                <span className="bg-surface-muted text-fg-subtle rounded px-2 py-1 text-xs font-medium tracking-wider uppercase">
                  {AUDIENCE_LABELS[announcement.audience]}
                </span>
              </div>
              <p className="text-fg text-sm leading-relaxed whitespace-pre-wrap">
                {announcement.message}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-fg-subtle">
                  {new Date(announcement.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                <div className="flex items-center gap-1">
                  {canManage && RESOLVABLE_AUDIENCES.includes(announcement.audience) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-fg-muted hover:text-fg"
                      onClick={() =>
                        setExpandedId(expandedId === announcement.id ? null : announcement.id)
                      }
                    >
                      <Users className="mr-1.5 h-4 w-4" />
                      Sent to
                      {expandedId === announcement.id ? (
                        <ChevronUp className="ml-1 h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="ml-1 h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  {canDelete(announcement) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-fg-muted hover:text-danger"
                      onClick={() => setPendingDelete(announcement)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {expandedId === announcement.id && (
                <div className="border-border-subtle mt-3 border-t pt-3">
                  <AnnouncementRecipients
                    announcement={announcement}
                    batchNamesById={batchNamesById}
                    memberLabelsById={memberLabelsById}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete this announcement?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteAnnouncement.isPending}
              onClick={() => void handleConfirmDelete()}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-fg-muted text-sm">
          {pendingDelete?.title ? `"${pendingDelete.title}"` : 'This announcement'} will be removed
          for everyone it was sent to. This can't be undone.
        </p>
      </Modal>
    </div>
  );
}
