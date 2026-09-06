import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notificationsApi';

export const NOTIFICATIONS_KEYS = {
  all: ['notifications'] as const,
  lists: () => [...NOTIFICATIONS_KEYS.all, 'list'] as const,
  unreadCount: () => [...NOTIFICATIONS_KEYS.all, 'unread-count'] as const,
};

// Was unbounded by default -- see notificationsApi.getNotifications.
export function useNotifications(limit?: number) {
  return useQuery({
    queryKey: limit ? [...NOTIFICATIONS_KEYS.lists(), limit] : NOTIFICATIONS_KEYS.lists(),
    queryFn: () => notificationsApi.getNotifications(limit),
  });
}

/** Cheap, always-accurate count for the bell badge -- see getUnreadCount. */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: NOTIFICATIONS_KEYS.unreadCount(),
    queryFn: () => notificationsApi.getUnreadCount(),
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEYS.all });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEYS.all });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.deleteNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEYS.all });
    },
  });
}
