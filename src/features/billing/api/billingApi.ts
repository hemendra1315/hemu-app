/* eslint-disable @typescript-eslint/no-explicit-any */
import { rpc, unwrap, unwrapMaybe, unwrapVoid } from '@/lib/api';
import { fetchAcademyMember, fetchAcademyMembers } from '@/features/members/api/membersApi';
import { supabase } from '@/lib/supabase/client';
import type { UUID } from '@/types';
import type {
  FeePayment,
  FeePaymentClaim,
  PlayerFeeDetail,
  PlayerFeeSummary,
  RecordPaymentInput,
  SubmitFeePaymentClaimInput,
} from './billingTypes';

/** Always the 1st of the month, matching `fee_payments.period_month`'s check constraint. */
export function toPeriodMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Local calendar date as `YYYY-MM-DD` -- deliberately not `date.toISOString()`,
 * which reports the UTC date and would default a payment to "yesterday" for
 * roughly the first 5.5 hours after local midnight in IST (UTC+5:30, this
 * app's target timezone).
 */
export function toLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toFeePayment(row: any): FeePayment {
  return {
    id: row.id,
    playerId: row.player_id,
    amountPaise: row.amount_paise,
    periodMonth: row.period_month,
    paidOn: row.paid_on,
    method: row.method ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
  };
}

function toFeePaymentClaim(row: any): FeePaymentClaim {
  return {
    id: row.id,
    playerId: row.player_id,
    periodMonth: row.period_month,
    payerPhone: row.payer_phone,
    note: row.note ?? null,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Every active player plus their paid/unpaid status for one month. Base list
 * is `academy_members` (role=player, active) -- same reasoning as
 * `fetchActiveCoachMembers` in the coaches feature: a player still shows up,
 * just as "no fee set", rather than being silently dropped because they have
 * no `player_fees` row yet.
 */
export async function fetchFeeSummaries(
  academyId: UUID,
  periodMonth: string,
): Promise<PlayerFeeSummary[]> {
  const players = await fetchAcademyMembers(academyId, { role: 'player', status: 'active' });
  if (players.length === 0) return [];

  const [feeRows, paymentRows, claimRows] = await Promise.all([
    unwrap<any[]>(
      supabase
        .from('player_fees')
        .select('player_id, monthly_fee_paise')
        .eq('academy_id', academyId)
        .returns<any[]>(),
    ),
    unwrap<any[]>(
      supabase
        .from('fee_payments')
        .select('player_id, amount_paise')
        .eq('academy_id', academyId)
        .eq('period_month', periodMonth)
        .returns<any[]>(),
    ),
    unwrap<any[]>(
      supabase
        .from('fee_payment_claims')
        .select('id, player_id, period_month, payer_phone, note, status, created_at')
        .eq('academy_id', academyId)
        .eq('period_month', periodMonth)
        .eq('status', 'pending')
        .returns<any[]>(),
    ),
  ]);

  const feeByPlayer = new Map(
    feeRows.map((row) => [row.player_id as UUID, row.monthly_fee_paise as number]),
  );
  const paidByPlayer = new Map<UUID, number>();
  for (const row of paymentRows) {
    const playerId = row.player_id as UUID;
    paidByPlayer.set(playerId, (paidByPlayer.get(playerId) ?? 0) + (row.amount_paise as number));
  }
  // At most one pending claim per player/month (enforced by a unique index),
  // so a straight overwrite is safe here.
  const pendingClaimByPlayer = new Map(
    claimRows.map((row) => [row.player_id as UUID, toFeePaymentClaim(row)]),
  );

  return players
    .map((player): PlayerFeeSummary => {
      const monthlyFeePaise = feeByPlayer.get(player.id) ?? null;
      const paidPaiseThisMonth = paidByPlayer.get(player.id) ?? 0;
      return {
        playerId: player.id,
        fullName: player.fullName,
        email: player.email,
        monthlyFeePaise,
        paidPaiseThisMonth,
        isPaid: monthlyFeePaise !== null && paidPaiseThisMonth >= monthlyFeePaise,
        pendingClaim: pendingClaimByPlayer.get(player.id) ?? null,
      };
    })
    .sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
}

export async function fetchPlayerFeeDetail(
  academyId: UUID,
  playerId: UUID,
): Promise<PlayerFeeDetail> {
  const [member, feeRow, paymentRows, claimRows] = await Promise.all([
    fetchAcademyMember(playerId),
    unwrapMaybe<any>(
      supabase
        .from('player_fees')
        .select('monthly_fee_paise')
        .eq('academy_id', academyId)
        .eq('player_id', playerId)
        .maybeSingle()
        .returns<any>(),
    ),
    unwrap<any[]>(
      supabase
        .from('fee_payments')
        .select('id, player_id, amount_paise, period_month, paid_on, method, notes, created_at')
        .eq('academy_id', academyId)
        .eq('player_id', playerId)
        .order('paid_on', { ascending: false })
        .returns<any[]>(),
    ),
    unwrap<any[]>(
      supabase
        .from('fee_payment_claims')
        .select('id, player_id, period_month, payer_phone, note, status, created_at')
        .eq('academy_id', academyId)
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .returns<any[]>(),
    ),
  ]);

  return {
    playerId,
    fullName: member.fullName,
    email: member.email,
    monthlyFeePaise: feeRow?.monthly_fee_paise ?? null,
    payments: paymentRows.map(toFeePayment),
    claims: claimRows.map(toFeePaymentClaim),
  };
}

export async function setPlayerFee(
  academyId: UUID,
  playerId: UUID,
  monthlyFeePaise: number,
): Promise<void> {
  await unwrapVoid(
    supabase
      .from('player_fees')
      .upsert(
        { academy_id: academyId, player_id: playerId, monthly_fee_paise: monthlyFeePaise },
        { onConflict: 'player_id' },
      ),
  );
}

export async function recordPayment(
  academyId: UUID,
  playerId: UUID,
  input: RecordPaymentInput,
): Promise<void> {
  await unwrapVoid(
    supabase.from('fee_payments').insert({
      academy_id: academyId,
      player_id: playerId,
      amount_paise: input.amountPaise,
      period_month: input.periodMonth,
      paid_on: input.paidOn,
      method: input.method,
      notes: input.notes,
    }),
  );
}

export async function deletePayment(paymentId: UUID): Promise<void> {
  await unwrapVoid(supabase.from('fee_payments').delete().eq('id', paymentId));
}

/**
 * A player self-reporting "I've Paid" for one month. RLS only lets this
 * insert as the caller's own player row in this academy (`player_id =
 * my_player_id(academy_id)`, which resolves to the caller's own membership
 * -- a linked parent's account can't satisfy it on the child's behalf), and
 * only as 'pending' -- a player can never mark themselves paid outright. The
 * unique index on (player_id, period_month) where status = 'pending' means a
 * second attempt while one is already open fails at the database, not just
 * the UI.
 */
export async function submitFeePaymentClaim(
  academyId: UUID,
  playerId: UUID,
  input: SubmitFeePaymentClaimInput,
): Promise<void> {
  await unwrapVoid(
    supabase.from('fee_payment_claims').insert({
      academy_id: academyId,
      player_id: playerId,
      period_month: input.periodMonth,
      payer_phone: input.payerPhone,
      note: input.note ?? null,
    }),
  );
}

/** The player withdrawing their own still-pending claim (e.g. submitted by
 * mistake). RLS only allows this while the claim is still pending. */
export async function withdrawFeePaymentClaim(claimId: UUID): Promise<void> {
  await unwrapVoid(supabase.from('fee_payment_claims').delete().eq('id', claimId));
}

/**
 * Owner only. Runs entirely inside `confirm_fee_payment_claim` -- the RPC
 * locks the claim row, re-checks it's still pending, looks up the player's
 * current fee, and writes the real `fee_payments` row, all in one
 * transaction. That server-side row lock (rather than a client-side
 * conditional update, the pattern platform_subscription_claims uses) is what
 * makes a double-click or two-tabs race safe here.
 */
export async function confirmFeePaymentClaim(claimId: UUID): Promise<void> {
  await rpc<{ payment_id: UUID }>('confirm_fee_payment_claim', { p_claim_id: claimId });
}

/** Owner only -- the claim turned out not to match a real payment. Same
 * row-locked RPC pattern as confirming. */
export async function dismissFeePaymentClaim(claimId: UUID): Promise<void> {
  await rpc<null>('dismiss_fee_payment_claim', { p_claim_id: claimId });
}
