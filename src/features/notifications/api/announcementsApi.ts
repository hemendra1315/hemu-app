import { supabase } from '@/lib/supabase/client';
import { toApiError } from '@/lib/api/errors';

export type AudienceType = 'all' | 'coaches' | 'players' | 'batch' | 'all_parents';

export interface Announcement {
  id: string;
  academy_id: string;
  created_by: string | null;
  title: string;
  message: string;
  audience: AudienceType;
  batch_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnouncementPayload {
  academy_id: string;
  title: string;
  message: string;
  audience: AudienceType;
  batch_id?: string | null;
}

export const announcementsApi = {
  async getAnnouncements(academyId: string): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false });

    if (error) {
      throw toApiError(error);
    }

    return data as Announcement[];
  },

  async createAnnouncement(payload: CreateAnnouncementPayload): Promise<Announcement> {
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        academy_id: payload.academy_id,
        title: payload.title,
        message: payload.message,
        audience: payload.audience,
        batch_id: payload.batch_id || null,
      })
      .select()
      .single();

    if (error) {
      throw toApiError(error);
    }

    return data as Announcement;
  },

  async deleteAnnouncement(announcementId: string): Promise<void> {
    const { error } = await supabase.from('announcements').delete().eq('id', announcementId);

    if (error) {
      throw toApiError(error);
    }
  },
};
