import type { UUID } from '@/types';

/** A player's current custom monthly fee, backed by `player_fees`. */
export type PlayerFeeSetting = {
  playerId: UUID;
  monthlyFeePaise: number;
  updatedAt: string;
};

export type SetPlayerFeeInput = {
  monthlyFeePaise: number;
};

/** One payment ledger row, backed by `fee_payments`. */
export type FeePayment = {
  id: UUID;
  playerId: UUID;
  amountPaise: number;
  /** First-of-month date (`YYYY-MM-01`) this payment counts toward. */
  periodMonth: string;
  paidOn: string;
  method: string | null;
  notes: string | null;
  createdAt: string;
};

export type RecordPaymentInput = {
  amountPaise: number;
  periodMonth: string;
  paidOn: string;
  method: string | null;
  notes: string | null;
};

/**
 * One row of the Fees list: a player plus whatever's needed to show a
 * paid/unpaid badge for one calendar month without a second round trip.
 * `monthlyFeePaise` is `null` until the owner sets a fee for this player --
 * shown as "No fee set" rather than defaulting to 0, which would look paid.
 */
export type PlayerFeeSummary = {
  playerId: UUID;
  fullName: string | null;
  email: string;
  monthlyFeePaise: number | null;
  /** Sum of `fee_payments.amount_paise` for the requested month. */
  paidPaiseThisMonth: number;
  /** `paidPaiseThisMonth >= monthlyFeePaise`. Always false with no fee set. */
  isPaid: boolean;
};

/** Full detail for one player: their fee setting plus their whole ledger. */
export type PlayerFeeDetail = {
  playerId: UUID;
  fullName: string | null;
  email: string;
  monthlyFeePaise: number | null;
  payments: FeePayment[];
};
