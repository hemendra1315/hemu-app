import type { UUID } from '@/types';

/** The app creator's own QR + amount, shown to every signed-in user. */
export type PlatformSettings = {
  paymentQrUrl: string | null;
  paymentNote: string | null;
  monthlyFeePaise: number;
};

export type UpdatePlatformSettingsInput = {
  monthlyFeePaise?: number;
  paymentNote?: string | null;
};

/** One payment ledger row, backed by `platform_subscription_payments`. */
export type SubscriptionPayment = {
  id: UUID;
  userId: UUID;
  amountPaise: number;
  /** First-of-month date (`YYYY-MM-01`) this payment counts toward. */
  periodMonth: string;
  paidOn: string;
  method: string | null;
  notes: string | null;
  createdAt: string;
};

export type RecordSubscriptionPaymentInput = {
  amountPaise: number;
  periodMonth: string;
  paidOn: string;
  method: string | null;
  notes: string | null;
};

export type SubscriptionClaimStatus = 'pending' | 'confirmed' | 'dismissed';

/**
 * A user's self-report that they've paid -- backed by
 * `platform_subscription_claims`. Never itself proof of payment; the app
 * creator confirms or dismisses it against what actually shows up in their
 * own UPI app, using `payerPhone` to match the sender.
 */
export type SubscriptionClaim = {
  id: UUID;
  userId: UUID;
  periodMonth: string;
  payerPhone: string;
  note: string | null;
  status: SubscriptionClaimStatus;
  createdAt: string;
};

export type SubmitSubscriptionClaimInput = {
  periodMonth: string;
  payerPhone: string;
  note?: string | null;
};

/** Everything the signed-in user's own "My Subscription" page needs. */
export type MySubscriptionStatus = {
  settings: PlatformSettings;
  payments: SubscriptionPayment[];
  claims: SubscriptionClaim[];
};

/**
 * One row of the super admin's subscribers list: a user plus their paid
 * status for one month, without a second round trip per user.
 */
export type SubscriberSummary = {
  userId: UUID;
  fullName: string | null;
  email: string;
  isSuperAdmin: boolean;
  paidPaiseThisMonth: number;
  isPaid: boolean;
  /** This user's still-open claim for the browsed month, if any. */
  pendingClaim: SubscriptionClaim | null;
};
