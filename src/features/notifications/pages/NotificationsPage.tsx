import { Check, CheckCircle2, Trash2 } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '../api/notificationsApi';

export function NotificationsPage() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotif = useDeleteNotification();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read_at) {
      markAsRead.mutate(notification.id);
    }

    const metadata = notification.metadata as { batch_id?: string };
    if (metadata?.batch_id) {
      navigate(`/batches/${metadata.batch_id}`);
    } else if (notification.notification_type === 'announcement') {
      navigate('/announcements');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-fg-muted mt-1 text-sm">Stay updated with academy announcements.</p>
        </div>

        {notifications.some((n) => !n.read_at) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="bg-surface-muted mb-4 rounded-full p-4">
            <Check className="text-fg-muted h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold">All caught up</h3>
          <p className="text-fg-muted mt-2 text-sm">You have no new notifications.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`bg-surface border-border-subtle hover:bg-surface-hover group relative cursor-pointer overflow-hidden rounded-xl border p-4 transition-colors ${
                !notif.read_at ? 'ring-primary/20 ring-1' : ''
              }`}
            >
              {!notif.read_at && (
                <div className="bg-primary absolute top-4 left-0 h-2 w-2 rounded-r-full" />
              )}

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1 pl-2">
                  <h4
                    className={`text-sm font-medium ${!notif.read_at ? 'text-fg' : 'text-fg-muted'}`}
                  >
                    {notif.title}
                  </h4>
                  <p className="text-fg-muted text-sm">{notif.message}</p>
                  <p className="text-fg-subtle text-xs">
                    {new Date(notif.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-fg-muted hover:text-danger opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotif.mutate(notif.id);
                    }}
                    disabled={deleteNotif.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
