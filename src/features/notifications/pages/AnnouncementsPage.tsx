import { Megaphone, Plus, Calendar, Radio } from 'lucide-react';
import { Button } from '@/components/ui';
import { MobileEmptyState, MobilePageHeader } from '@/components/mobile';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useNavigate } from 'react-router-dom';
import { useCan } from '@/lib/rbac';
import { useActiveAcademy } from '@/features/academies/hooks/useAcademies';

export function AnnouncementsPage() {
  const { membership } = useActiveAcademy();
  const { data: announcements = [], isLoading } = useAnnouncements();
  const canManage = useCan('announcements:manage');
  const navigate = useNavigate();

  const getAudienceBadge = (audience: string) => {
    switch (audience) {
      case 'all':
        return (
          <span className="bg-primary/10 text-primary border-primary/20 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase">
            Entire Academy
          </span>
        );
      case 'coaches':
        return (
          <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-sky-400 uppercase">
            Coaches Only
          </span>
        );
      case 'players':
        return (
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-amber-400 uppercase">
            Players Only
          </span>
        );
      case 'all_parents':
        return (
          <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-indigo-400 uppercase">
            Parents Only
          </span>
        );
      case 'batch':
        return (
          <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-purple-400 uppercase">
            Specific Batch
          </span>
        );
      default:
        return (
          <span className="border-border-subtle bg-surface-muted text-fg-muted rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase">
            {audience}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      <div className="md:hidden">
        <MobilePageHeader
          title="Announcements"
          subtitle={
            membership?.academyName ? `${membership.academyName} Updates` : 'Academy Bulletins'
          }
          showBack={false}
          primaryAction={
            canManage
              ? {
                  label: 'New',
                  icon: <Plus className="h-4 w-4" />,
                  onClick: () => navigate('/announcements/new'),
                }
              : undefined
          }
        />
      </div>

      <div className="hidden md:flex md:items-center md:justify-between">
        <div>
          <h1 className="text-fg flex items-center gap-2.5 text-2xl font-black tracking-tight">
            <Radio className="text-primary h-6 w-6" />
            Academy Announcements
          </h1>
          <p className="text-fg-muted mt-1 text-sm font-medium">
            Broadcast messages, notices, and updates for {membership?.academyName || 'the academy'}.
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => navigate('/announcements/new')}
            className="bg-primary hover:bg-primary/90 font-bold text-black"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Announcement
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : announcements.length === 0 ? (
        <MobileEmptyState
          icon={<Megaphone className="h-6 w-6" />}
          title="No announcements"
          description="There are no announcements to display."
          action={
            canManage
              ? {
                  label: 'New Announcement',
                  onClick: () => navigate('/announcements/new'),
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="border-border-subtle bg-surface hover:border-primary/40 group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <h3 className="text-fg group-hover:text-primary text-base font-bold transition-colors">
                    {announcement.title}
                  </h3>
                </div>
                {getAudienceBadge(announcement.audience)}
              </div>

              <p className="text-fg/90 pl-10.5 text-sm leading-relaxed whitespace-pre-wrap">
                {announcement.message}
              </p>

              <div className="border-border-subtle mt-4 flex items-center justify-between border-t pt-3 pl-10.5 text-xs">
                <span className="text-fg-muted flex items-center gap-1.5 font-medium">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(announcement.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
