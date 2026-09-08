import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { UUID } from '@/types';
import {
  confirmSubscriptionClaim,
  deleteSubscriptionPayment,
  dismissSubscriptionClaim,
  fetchMySubscriptionStatus,
  fetchPlatformSettings,
  fetchSubscriberSummaries,
  recordSubscriptionPayment,
  removePlatformQr,
  submitSubscriptionClaim,
  updatePlatformSettings,
  uploadPlatformQr,
  withdrawSubscriptionClaim,
} from '../api/platformBillingApi';
import type {
  MySubscriptionStatus,
  RecordSubscriptionPaymentInput,
  SubmitSubscriptionClaimInput,
  SubscriptionClaim,
} from '../api/platformBillingTypes';

/** Every signed-in user's own subscription status -- their paid/unpaid state
 * this month, the app creator's QR/amount, and their own payment history. */
export function useMySubscriptionStatus(userId: UUID | null) {
  return useQuery<MySubscriptionStatus>({
    queryKey: ['platform-billing', 'my-status', userId ?? 'none'],
    enabled: Boolean(userId),
    queryFn: () => fetchMySubscriptionStatus(userId as UUID),
  });
}

/** Just the app creator's QR/amount/note -- readable by anyone signed in.
 * Used by the super admin's own settings panel, which doesn't need a whole
 * payment history alongside it. */
export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-billing', 'settings'],
    queryFn: fetchPlatformSettings,
  });
}

/** Super admin only. */
export function useSubscriberSummaries(periodMonth: string) {
  return useQuery({
    queryKey: ['platform-billing', 'subscribers', periodMonth],
    queryFn: () => fetchSubscriberSummaries(periodMonth),
  });
}

/** Any signed-in user: submit or withdraw their own "I've paid" claim for a
 * month. Just a self-report -- it doesn't mark anything paid by itself, it
 * only surfaces on the super admin's subscribers list for them to confirm. */
export function useSubmitSubscriptionClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: UUID; input: SubmitSubscriptionClaimInput }) =>
      submitSubscriptionClaim(userId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform-billing'] });
    },
  });
}

export function useWithdrawSubscriptionClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (claimId: UUID) => withdrawSubscriptionClaim(claimId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform-billing'] });
    },
  });
}

/** Bundles the super admin's settings (QR upload/remove, amount/note) and
 * per-user payment actions together -- all of them need to refresh both the
 * subscribers list and every affected user's own status. */
export function usePlatformBillingActions() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['platform-billing'] });
  };

  const saveSettings = useMutation({
    mutationFn: updatePlatformSettings,
    onSuccess: invalidate,
  });

  const uploadQr = useMutation({
    mutationFn: (file: File | Blob) => uploadPlatformQr(file),
    onSuccess: invalidate,
  });

  const removeQr = useMutation({
    mutationFn: (currentUrl?: string | null) => removePlatformQr(currentUrl),
    onSuccess: invalidate,
  });

  const addPayment = useMutation({
    mutationFn: ({ userId, input }: { userId: UUID; input: RecordSubscriptionPaymentInput }) =>
      recordSubscriptionPayment(userId, input),
    onSuccess: invalidate,
  });

  const removePayment = useMutation({
    mutationFn: (paymentId: UUID) => deleteSubscriptionPayment(paymentId),
    onSuccess: invalidate,
  });

  const confirmClaim = useMutation({
    mutationFn: ({ claim, amountPaise }: { claim: SubscriptionClaim; amountPaise: number }) =>
      confirmSubscriptionClaim(claim, amountPaise),
    onSuccess: invalidate,
  });

  const dismissClaim = useMutation({
    mutationFn: (claimId: UUID) => dismissSubscriptionClaim(claimId),
    onSuccess: invalidate,
  });

  return {
    saveSettings,
    uploadQr,
    removeQr,
    addPayment,
    removePayment,
    confirmClaim,
    dismissClaim,
  };
}
