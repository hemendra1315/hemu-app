import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';
import { isUUID } from '@/lib/validators';
import type { UUID } from '@/types';
import {
  confirmFeePaymentClaim,
  deletePayment,
  dismissFeePaymentClaim,
  fetchFeeSummaries,
  fetchPlayerFeeDetail,
  recordPayment,
  setPlayerFee,
  submitFeePaymentClaim,
  withdrawFeePaymentClaim,
} from '../api/billingApi';
import type {
  PlayerFeeDetail,
  PlayerFeeSummary,
  RecordPaymentInput,
  SubmitFeePaymentClaimInput,
} from '../api/billingTypes';

export function useFeeSummaries(academyId: UUID | null, periodMonth: string) {
  return useQuery<PlayerFeeSummary[]>({
    queryKey: queryKeys.feeSummaries(academyId ?? 'none', periodMonth),
    enabled: Boolean(academyId) && isUUID(academyId ?? ''),
    queryFn: () => fetchFeeSummaries(academyId as UUID, periodMonth),
  });
}

export function usePlayerFeeDetail(academyId: UUID | null, playerId: UUID | null) {
  return useQuery<PlayerFeeDetail>({
    queryKey: queryKeys.playerFeeDetail(academyId ?? 'none', playerId ?? 'none'),
    enabled:
      Boolean(academyId) && Boolean(playerId) && isUUID(academyId ?? '') && isUUID(playerId ?? ''),
    queryFn: () => fetchPlayerFeeDetail(academyId as UUID, playerId as UUID),
  });
}

/**
 * Owner-only fee actions for one player. Bundled together (rather than three
 * separate hooks) because every one of them needs the same cache
 * invalidation -- both the detail page and the list's paid/unpaid badges
 * have to reflect a new fee amount or a new payment immediately.
 */
export function usePlayerFeeActions(academyId: UUID, playerId: UUID) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.playerFeeDetail(academyId, playerId),
    });
    void queryClient.invalidateQueries({
      queryKey: ['academies', academyId, 'fee-summaries'],
    });
  };

  const setFee = useMutation({
    mutationFn: (monthlyFeePaise: number) => setPlayerFee(academyId, playerId, monthlyFeePaise),
    onSuccess: invalidate,
  });

  const addPayment = useMutation({
    mutationFn: (input: RecordPaymentInput) => recordPayment(academyId, playerId, input),
    onSuccess: invalidate,
  });

  const removePayment = useMutation({
    mutationFn: (paymentId: UUID) => deletePayment(paymentId),
    onSuccess: invalidate,
  });

  const confirmClaim = useMutation({
    mutationFn: (claimId: UUID) => confirmFeePaymentClaim(claimId),
    onSuccess: invalidate,
  });

  const dismissClaim = useMutation({
    mutationFn: (claimId: UUID) => dismissFeePaymentClaim(claimId),
    onSuccess: invalidate,
  });

  return { setFee, addPayment, removePayment, confirmClaim, dismissClaim };
}

/**
 * Player-side: submit or withdraw an "I've Paid" claim for the player's own
 * academy membership (RLS requires `player_id = my_player_id(academy_id)`,
 * so a linked parent's account can't submit on a child's behalf -- see
 * `submitFeePaymentClaim` in billingApi.ts). Just a self-report -- it
 * doesn't mark anything paid by itself, it only surfaces on the owner's Fees
 * page for them to confirm. Invalidates both this player's own detail (their
 * pending-claim banner) and every month of the owner's fee-summaries list
 * (their pending-claim badge), mirroring `usePlayerFeeActions`'s
 * invalidation above.
 */
export function useSubmitFeePaymentClaim(academyId: UUID, playerId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitFeePaymentClaimInput) =>
      submitFeePaymentClaim(academyId, playerId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.playerFeeDetail(academyId, playerId),
      });
      void queryClient.invalidateQueries({ queryKey: ['academies', academyId, 'fee-summaries'] });
    },
  });
}

export function useWithdrawFeePaymentClaim(academyId: UUID, playerId: UUID) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (claimId: UUID) => withdrawFeePaymentClaim(claimId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.playerFeeDetail(academyId, playerId),
      });
      void queryClient.invalidateQueries({ queryKey: ['academies', academyId, 'fee-summaries'] });
    },
  });
}
