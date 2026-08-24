import { useQuery } from '@tanstack/react-query';

import { isUUID } from '@/lib/validators';
import type { UUID } from '@/types';
import {
  fetchOwnerDashboardAnalytics,
  fetchCoachDashboardAnalytics,
  fetchPlayerDashboardAnalytics,
} from '../api/dashboardAnalytics';

// ============================================================
// OWNER DASHBOARD
// ============================================================

export function useOwnerDashboardAnalytics(academyId: UUID | null) {
  return useQuery({
    queryKey: ['dashboard-owner', academyId],
    enabled: Boolean(academyId) && isUUID(academyId ?? ''),
    queryFn: () => fetchOwnerDashboardAnalytics(academyId as UUID),
  });
}

// ============================================================
// COACH DASHBOARD
// ============================================================

export function useCoachDashboardAnalytics(academyId: UUID | null, coachId: UUID | null) {
  return useQuery({
    queryKey: ['dashboard-coach', academyId, coachId],
    enabled:
      Boolean(academyId) && Boolean(coachId) && isUUID(academyId ?? '') && isUUID(coachId ?? ''),
    queryFn: () => fetchCoachDashboardAnalytics(academyId as UUID, coachId as UUID),
  });
}

// ============================================================
// PLAYER DASHBOARD
// ============================================================

export function usePlayerDashboardAnalytics(academyId: UUID | null, playerId: UUID | null) {
  return useQuery({
    queryKey: ['dashboard-player', academyId, playerId],
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerDashboardAnalytics(academyId as UUID, playerId as UUID),
  });
}
