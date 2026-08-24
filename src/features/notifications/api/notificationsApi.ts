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
  async getNotifications(): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw toApiError(error);
    }

    return data as Notification[];
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
