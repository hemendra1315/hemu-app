import { useQuery } from '@tanstack/react-query';

import { isUUID } from '@/lib/validators';
import type { UUID } from '@/types';
import { fetchBatchReport, fetchPlayerReport } from '../api/reportsApi';

export function useBatchReport(
  academyId: UUID | null,
  batchId: UUID | null,
  batchName: string,
  from: string,
  to: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['academies', academyId ?? 'none', 'reports', 'batch', batchId, from, to],
    enabled:
      enabled &&
      Boolean(academyId) &&
      Boolean(batchId) &&
      isUUID(academyId ?? '') &&
      isUUID(batchId ?? ''),
    queryFn: () => fetchBatchReport(academyId as UUID, batchId as UUID, batchName, from, to),
  });
}

export function usePlayerReport(
  academyId: UUID | null,
  playerId: UUID | null,
  fullName: string,
  from: string,
  to: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['academies', academyId ?? 'none', 'reports', 'player', playerId, from, to],
    enabled:
      enabled &&
      Boolean(academyId) &&
      Boolean(playerId) &&
      isUUID(academyId ?? '') &&
      isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerReport(academyId as UUID, playerId as UUID, fullName, from, to),
  });
}
