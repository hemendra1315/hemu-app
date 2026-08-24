import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications, NOTIFICATIONS_KEYS } from '../hooks/useNotifications';

export function NotificationBell() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useNotifications();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${user.id}`,
        },
        () => {
          // Invalidate the notifications list query so React Query refetches.
          void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEYS.lists() });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Recalculate unreadCount whenever notifications change
  const unreadCount = notifications.filter((n) => n.status !== 'read' && !n.read_at).length;

  return (
    <Link
      to="/notifications"
      className="text-fg-muted hover:text-fg hover:bg-surface-hover relative rounded-full p-2 transition"
      aria-label="View notifications"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-900">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
