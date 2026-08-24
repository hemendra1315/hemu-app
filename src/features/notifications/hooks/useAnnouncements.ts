import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '../api/announcementsApi';
import type { CreateAnnouncementPayload } from '../api/announcementsApi';
import { useActiveAcademy } from '@/features/academies/hooks/useAcademies';

export const ANNOUNCEMENTS_KEYS = {
  all: ['announcements'] as const,
  lists: (academyId: string) => [...ANNOUNCEMENTS_KEYS.all, academyId, 'list'] as const,
};

export function useAnnouncements() {
  const { academyId } = useActiveAcademy();

  return useQuery({
    queryKey: ANNOUNCEMENTS_KEYS.lists(academyId || ''),
    queryFn: () => announcementsApi.getAnnouncements(academyId!),
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
