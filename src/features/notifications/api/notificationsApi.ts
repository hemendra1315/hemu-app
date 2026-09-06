import { supabase } from '@/lib/supabase/client';
import { toApiError } from '@/lib/api/errors';

export type NotifChannel = 'in_app' | 'push' | 'email';
export type NotifStatus = 'queued' | 'sent' | 'failed' | 'read';

export interface Notification {
  id: string;
  academy_id: string;
  announcement_id: string | null;
  recipient_user_id: string;
  title: string;
  message: string;
  notification_type: string;
  channel: NotifChannel;
  status: NotifStatus;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export const notificationsApi = {
  // Was unbounded -- every notification a user has ever received, fetched
  // fresh on every /notifications visit AND refetched in full on every
  // single realtime INSERT event via NotificationBell's subscription. For
  // any long-lived member that grows without limit. Bounded to a recent
  // window by default; callers that genuinely need everything can still
  // pass a larger limit explicitly.
  async getNotifications(limit = 50): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw toApiError(error);
    }

    return data as Notification[];
  },

  // The bell's unread badge only ever needs a count, not the rows
  // themselves -- previously it fetched (and re-fetched, on every
  // realtime insert) the user's ENTIRE notification history just to run
  // `.filter(...).length` in the browser. A `head: true` count query
  // never transfers row data and stays correct however large the unread
  // count actually is (a bounded row fetch would silently undercount
  // past its limit).
  async getUnreadCount(): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .is('read_at', null);

    if (error) {
      throw toApiError(error);
    }

    return count ?? 0;
  },

  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({
        read_at: new Date().toISOString(),
        status: 'read',
      })
      .eq('id', notificationId);

    if (error) {
      throw toApiError(error);
    }
  },

  async markAllAsRead(): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({
        read_at: new Date().toISOString(),
        status: 'read',
      })
      .is('read_at', null);

    if (error) {
      throw toApiError(error);
    }
  },

  async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);

    if (error) {
      throw toApiError(error);
    }
  },
};
