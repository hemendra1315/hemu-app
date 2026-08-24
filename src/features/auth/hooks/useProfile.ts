import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { useAuthStore } from '@/stores';

import { updateMyProfile, type UpdateProfileInput } from '../api/profileApi';

/** Updates the signed-in user's profile and refreshes the identity snapshot. */
export function useUpdateProfile() {
  const userId = useAuthStore((state) => state.user?.id);
  const setProfile = useAuthStore((state) => state.setProfile);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => {
      if (!userId) throw new Error('Not signed in.');
      return updateMyProfile(userId, input);
    },
    onSuccess: async (profile) => {
      setProfile(profile);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.identity(userId ?? 'anonymous'),
      });
    },
  });
}
