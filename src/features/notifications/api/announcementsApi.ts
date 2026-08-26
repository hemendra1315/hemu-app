import { rpc } from '@/lib/api';
import { toApiError } from '@/lib/api/errors';
import { supabase } from '@/lib/supabase/client';

export type AudienceType = 'all' | 'coaches' | 'players' | 'batch' | 'all_parents' | 'custom';

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

/** One row per targeted batch or person on a `custom` announcement. */
export interface AnnouncementTarget {
  id: string;
  announcement_id: string;
  batch_id: string | null;
  academy_member_id: string | null;
}

export interface CreateAnnouncementPayload {
  academy_id: string;
  title: string;
  message: string;
  audience: AudienceType;
  /** Only for the legacy single-batch audience. */
  batch_id?: string | null;
  /** `custom` audience: any number of batches. */
  batch_ids?: string[];
  /** `custom` audience: individual academy_members.id values. */
  member_ids?: string[];
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

  /** Targets for a set of announcements, so a feed can label who was addressed. */
  async getTargets(announcementIds: string[]): Promise<AnnouncementTarget[]> {
    if (announcementIds.length === 0) return [];

    const { data, error } = await supabase
      .from('announcement_targets')
      .select('id, announcement_id, batch_id, academy_member_id')
      .in('announcement_id', announcementIds);

    if (error) {
      throw toApiError(error);
    }

    return (data ?? []) as AnnouncementTarget[];
  },

  /**
   * Creating an announcement writes the announcement, its target rows and one
   * notification per recipient. That is three tables, so it goes through a
   * single transactional RPC rather than a sequence of client calls — the same
   * pattern as `save_match_result` and `create_academy`. It also means a client
   * can never leave a `custom` announcement stranded with no targets and no
   * notifications, which a multi-step write would allow.
   */
  async createAnnouncement(payload: CreateAnnouncementPayload): Promise<Announcement> {
    return rpc<Announcement>('create_announcement_with_targets', {
      p_academy_id: payload.academy_id,
      p_title: payload.title,
      p_message: payload.message,
      p_audience: payload.audience,
      p_batch_id: payload.audience === 'batch' ? (payload.batch_id ?? null) : null,
      p_batch_ids: payload.batch_ids ?? [],
      p_member_ids: payload.member_ids ?? [],
    });
  },

  async deleteAnnouncement(announcementId: string): Promise<void> {
    const { error } = await supabase.from('announcements').delete().eq('id', announcementId);

    if (error) {
      throw toApiError(error);
    }
  },
};
