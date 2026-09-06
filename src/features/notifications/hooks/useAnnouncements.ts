import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '../api/announcementsApi';
import type { CreateAnnouncementPayload } from '../api/announcementsApi';
import { useActiveAcademy } from '@/features/academies/hooks/useAcademies';

export const ANNOUNCEMENTS_KEYS = {
  all: ['announcements'] as const,
  lists: (academyId: string) => [...ANNOUNCEMENTS_KEYS.all, academyId, 'list'] as const,
};

export function useAnnouncements(limit?: number) {
  const { academyId } = useActiveAcademy();

  return useQuery({
    queryKey: limit
      ? [...ANNOUNCEMENTS_KEYS.lists(academyId || ''), limit]
      : ANNOUNCEMENTS_KEYS.lists(academyId || ''),
    queryFn: () => announcementsApi.getAnnouncements(academyId!, limit),
    enabled: !!academyId,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAnnouncementPayload) =>
      announcementsApi.createAnnouncement(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ANNOUNCEMENTS_KEYS.lists(variables.academy_id),
      });
    },
  });
}

// The delete API call already existed (announcementsApi.deleteAnnouncement) but
// had no hook and no button anywhere in the UI -- staff had no way to remove
// a mistaken or outdated announcement short of going into Supabase directly.
export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (announcementId: string) => announcementsApi.deleteAnnouncement(announcementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENTS_KEYS.all });
    },
  });
}
