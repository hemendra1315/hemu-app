import { CheckCircle2, Trash2, Bell, Radio, MessageSquare, Clock } from 'lucide-react';
import { Button } from '@/components/ui';
import { MobileEmptyState, MobilePageHeader } from '@/components/mobile';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
} from '../hooks/useNotifications';
import { PushNotificationPrompt } from '../components/PushNotificationPrompt';
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

  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      <div className="md:hidden">
        <MobilePageHeader
          title="Notifications"
          subtitle="Alerts & Academy Updates"
          showBack={false}
          primaryAction={
            hasUnread
              ? {
                  label: 'Read All',
                  icon: <CheckCircle2 className="h-4 w-4" />,
                  onClick: () => markAllAsRead.mutate(),
                }
              : undefined
          }
        />
      </div>

      <div className="hidden md:flex md:items-center md:justify-between">
        <div>
          <h1 className="text-fg flex items-center gap-2.5 text-2xl font-black tracking-tight">
            <Bell className="text-primary h-6 w-6" />
            Notifications & Alerts
          </h1>
          <p className="text-fg-muted mt-1 text-sm font-medium">
            Stay updated with schedule changes, match results, and academy announcements.
          </p>
        </div>

        {hasUnread && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
            className="border-border-subtle hover:border-primary text-fg font-medium"
          >
            <CheckCircle2 className="text-primary mr-1.5 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Push Notification Opt-In Banner */}
      <PushNotificationPrompt />

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <MobileEmptyState
          icon={<Bell className="h-6 w-6" />}
          title="All caught up"
          description="You have no new notifications."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const isUnread = !notif.read_at;
            const isAnnouncement = notif.notification_type === 'announcement';

            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`border-border-subtle bg-surface hover:border-primary/40 group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all duration-200 ${
                  isUnread ? 'bg-surface/90 border-primary/30 shadow-sm' : 'opacity-85'
                }`}
              >
                {isUnread && <div className="bg-primary absolute inset-y-0 left-0 w-1" />}

                <div className="flex items-start justify-between gap-3 pl-1">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isUnread ? 'bg-primary/15 text-primary' : 'bg-surface-muted text-fg-muted'
                      }`}
                    >
                      {isAnnouncement ? (
                        <Radio className="h-4 w-4" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4
                          className={`text-sm font-bold ${
                            isUnread
                              ? 'text-fg group-hover:text-primary transition-colors'
                              : 'text-fg-muted'
                          }`}
                        >
                          {notif.title}
                        </h4>
                        {isUnread && (
                          <span className="bg-primary/20 text-primary ring-primary/30 h-2 w-2 rounded-full ring-2" />
                        )}
                      </div>
                      <p className="text-fg-muted text-xs leading-relaxed whitespace-pre-wrap">
                        {notif.message}
                      </p>
                      <p className="text-fg-subtle flex items-center gap-1 pt-0.5 text-[11px] font-medium">
                        <Clock className="h-3 w-3" />
                        {new Date(notif.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-fg-muted hover:text-danger h-8 w-8 p-0 opacity-60 transition-opacity group-hover:opacity-100"
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
            );
          })}
        </div>
      )}
    </div>
  );
}
