import { Megaphone, Plus } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useAnnouncements } from '../hooks/useAnnouncements';
import { useNavigate } from 'react-router-dom';
import { useCan } from '@/lib/rbac';
import { useActiveAcademy } from '@/features/academies/hooks/useAcademies';

export function AnnouncementsPage() {
  const { membership } = useActiveAcademy();
  const { data: announcements = [], isLoading } = useAnnouncements();
  const canManage = useCan('announcements:manage');
  const navigate = useNavigate();

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
                  {announcement.audience}
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
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
