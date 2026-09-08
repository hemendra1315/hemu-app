/* eslint-disable @typescript-eslint/no-explicit-any */
import { unwrap, unwrapMaybe, unwrapVoid } from '@/lib/api';
import { fetchAcademyMember, fetchAcademyMembers } from '@/features/members/api/membersApi';
import { supabase } from '@/lib/supabase/client';
import type { UUID } from '@/types';
import type {
  FeePayment,
  PlayerFeeDetail,
  PlayerFeeSummary,
  RecordPaymentInput,
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

  const [feeRows, paymentRows] = await Promise.all([
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
  ]);

  const feeByPlayer = new Map(
    feeRows.map((row) => [row.player_id as UUID, row.monthly_fee_paise as number]),
  );
  const paidByPlayer = new Map<UUID, number>();
  for (const row of paymentRows) {
    const playerId = row.player_id as UUID;
    paidByPlayer.set(playerId, (paidByPlayer.get(playerId) ?? 0) + (row.amount_paise as number));
  }

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
      };
    })
    .sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
}

export async function fetchPlayerFeeDetail(
  academyId: UUID,
  playerId: UUID,
): Promise<PlayerFeeDetail> {
  const [member, feeRow, paymentRows] = await Promise.all([
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
  ]);

  return {
    playerId,
    fullName: member.fullName,
    email: member.email,
    monthlyFeePaise: feeRow?.monthly_fee_paise ?? null,
    payments: paymentRows.map(toFeePayment),
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
