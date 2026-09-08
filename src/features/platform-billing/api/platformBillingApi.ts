/* eslint-disable @typescript-eslint/no-explicit-any */
import { toApiError, unwrap, unwrapMaybe, unwrapVoid } from '@/lib/api';
import { fetchPlatformUsers, type PlatformUser } from '@/features/admin/api/adminApi';
import { toLocalDate, toPeriodMonth } from '@/features/billing/api/billingApi';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';
import type { UUID } from '@/types';
import type {
  MySubscriptionStatus,
  PlatformSettings,
  RecordSubscriptionPaymentInput,
  SubmitSubscriptionClaimInput,
  SubscriberSummary,
  SubscriptionClaim,
  SubscriptionPayment,
  UpdatePlatformSettingsInput,
} from './platformBillingTypes';

export { toLocalDate, toPeriodMonth };

const SETTINGS_ID = 'default';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_QR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function toPlatformSettings(row: any): PlatformSettings {
  return {
    paymentQrUrl: row.payment_qr_url,
    paymentNote: row.payment_note,
    monthlyFeePaise: row.monthly_fee_paise,
  };
}

function toSubscriptionPayment(row: any): SubscriptionPayment {
  return {
    id: row.id,
    userId: row.user_id,
    amountPaise: row.amount_paise,
    periodMonth: row.period_month,
    paidOn: row.paid_on,
    method: row.method,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function toSubscriptionClaim(row: any): SubscriptionClaim {
  return {
    id: row.id,
    userId: row.user_id,
    periodMonth: row.period_month,
    payerPhone: row.payer_phone,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Every signed-in user can read this -- it's what tells them what to pay. */
export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const row = await unwrap<any>(
    supabase.from('platform_settings').select('*').eq('id', SETTINGS_ID).single().returns<any>(),
  );
  return toPlatformSettings(row);
}

/** Super admin only -- RLS rejects anyone else's write. */
export async function updatePlatformSettings(
  input: UpdatePlatformSettingsInput,
): Promise<PlatformSettings> {
  const row = await unwrap<any>(
    supabase
      .from('platform_settings')
      .update({
        ...(input.monthlyFeePaise === undefined
          ? null
          : { monthly_fee_paise: input.monthlyFeePaise }),
        ...(input.paymentNote === undefined ? null : { payment_note: input.paymentNote }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', SETTINGS_ID)
      .select('*')
      .single()
      .returns<any>(),
  );
  return toPlatformSettings(row);
}

async function setPlatformQrUrl(qrUrl: string | null): Promise<void> {
  await unwrapVoid(
    supabase
      .from('platform_settings')
      .update({ payment_qr_url: qrUrl, updated_at: new Date().toISOString() })
      .eq('id', SETTINGS_ID),
  );
}

/** Same upload path as `uploadAcademyPaymentQr`, but there's only one QR for
 * the whole platform (no per-academy folder), so the path has no owner
 * prefix -- the storage RLS checks `is_super_admin()` directly instead. */
export async function uploadPlatformQr(file: File | Blob): Promise<string> {
  const isFile = file instanceof File;
  const fileName = isFile && file.name ? file.name : 'qr.jpg';
  const fileType = file.type || 'image/jpeg';

  if (!ALLOWED_IMAGE_TYPES.includes(fileType)) {
    throw new Error('Invalid file format. Please upload a JPG, PNG, or WebP image.');
  }

  if (file.size > MAX_QR_SIZE_BYTES) {
    throw new Error('Image file is too large. Maximum allowed size is 5 MB.');
  }

  const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `qr-${Date.now()}.${ext}`;

  let safeBlob: Blob = file;
  try {
    const arrayBuffer = await file.arrayBuffer();
    safeBlob = new Blob([arrayBuffer], { type: fileType });
  } catch (err: unknown) {
    logger.warn('platform_qr_arraybuffer_conversion_failed', { error: err });
  }

  const { error: uploadError } = await supabase.storage
    .from('platform-payment-qr')
    .upload(filePath, safeBlob, {
      upsert: true,
      contentType: fileType,
    });

  if (uploadError) throw toApiError(uploadError);

  const { data } = supabase.storage.from('platform-payment-qr').getPublicUrl(filePath);
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

  await setPlatformQrUrl(publicUrl);
  return publicUrl;
}

export async function removePlatformQr(qrUrl?: string | null): Promise<void> {
  await setPlatformQrUrl(null);

  if (qrUrl && qrUrl.includes('/storage/v1/object/public/platform-payment-qr/')) {
    const baseUrl = qrUrl.split('?')[0];
    if (!baseUrl) return;
    const oldPath = baseUrl.split('/storage/v1/object/public/platform-payment-qr/')[1];
    if (oldPath) {
      supabase.storage
        .from('platform-payment-qr')
        .remove([oldPath])
        .catch((err) => {
          logger.warn('platform_qr_remove_old_failed', { error: err });
        });
    }
  }
}

/** The signed-in user's own settings + payment history + claims. RLS lets
 * them read only their own `platform_subscription_payments`/
 * `platform_subscription_claims` rows. */
export async function fetchMySubscriptionStatus(userId: UUID): Promise<MySubscriptionStatus> {
  const [settings, paymentRows, claimRows] = await Promise.all([
    fetchPlatformSettings(),
    unwrap<any[]>(
      supabase
        .from('platform_subscription_payments')
        .select('id, user_id, amount_paise, period_month, paid_on, method, notes, created_at')
        .eq('user_id', userId)
        .order('paid_on', { ascending: false })
        .returns<any[]>(),
    ),
    unwrap<any[]>(
      supabase
        .from('platform_subscription_claims')
        .select('id, user_id, period_month, payer_phone, note, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .returns<any[]>(),
    ),
  ]);

  return {
    settings,
    payments: paymentRows.map(toSubscriptionPayment),
    claims: claimRows.map(toSubscriptionClaim),
  };
}

/** Any signed-in user -- RLS only lets them insert their own, and only as
 * 'pending' (see the migration). */
export async function submitSubscriptionClaim(
  userId: UUID,
  input: SubmitSubscriptionClaimInput,
): Promise<void> {
  await unwrapVoid(
    supabase.from('platform_subscription_claims').insert({
      user_id: userId,
      period_month: input.periodMonth,
      payer_phone: input.payerPhone,
      note: input.note ?? null,
    }),
  );
}

/** A user withdrawing their own still-pending claim (e.g. submitted by
 * mistake). RLS only allows this while the claim is still pending. */
export async function withdrawSubscriptionClaim(claimId: UUID): Promise<void> {
  await unwrapVoid(supabase.from('platform_subscription_claims').delete().eq('id', claimId));
}

/** Super admin only. Every pending/resolved claim for one month, so the
 * subscribers list can show a "Confirm" action instead of "Mark Paid" where
 * a claim is waiting. */
async function fetchClaimsForPeriod(periodMonth: string): Promise<SubscriptionClaim[]> {
  const rows = await unwrap<any[]>(
    supabase
      .from('platform_subscription_claims')
      .select('id, user_id, period_month, payer_phone, note, status, created_at')
      .eq('period_month', periodMonth)
      .order('created_at', { ascending: false })
      .returns<any[]>(),
  );
  return rows.map(toSubscriptionClaim);
}

/** Super admin only. Confirming a claim first flips it out of 'pending' --
 * conditioned on it still BEING 'pending' -- and only inserts the real
 * payment row (what actually makes the user "paid"; the claim itself never
 * does) once that flip succeeds. Doing the status flip first, gated on the
 * current status, is what makes a double-click or two-tabs race safe: the
 * second caller's conditional update matches zero rows and this throws
 * instead of silently recording a second payment for the same claim. */
export async function confirmSubscriptionClaim(
  claim: SubscriptionClaim,
  amountPaise: number,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resolved = await unwrapMaybe<any>(
    supabase
      .from('platform_subscription_claims')
      .update({
        status: 'confirmed',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id ?? null,
      })
      .eq('id', claim.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
      .returns<any>(),
  );
  if (!resolved) {
    throw new Error('This claim was already resolved -- refresh and try again.');
  }

  await recordSubscriptionPayment(claim.userId, {
    amountPaise,
    periodMonth: claim.periodMonth,
    paidOn: toLocalDate(new Date()),
    method: 'UPI (self-reported)',
    notes: `Claimed from ${claim.payerPhone}${claim.note ? ` — ${claim.note}` : ''}`,
  });
}

/** Super admin only -- the claim turned out not to match a real payment.
 * Same conditional-update guard as confirming, so a double-click can't fire
 * this twice or race a concurrent confirm. */
export async function dismissSubscriptionClaim(claimId: UUID): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resolved = await unwrapMaybe<any>(
    supabase
      .from('platform_subscription_claims')
      .update({
        status: 'dismissed',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id ?? null,
      })
      .eq('id', claimId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
      .returns<any>(),
  );
  if (!resolved) {
    throw new Error('This claim was already resolved -- refresh and try again.');
  }
}

/** Super admin only. Reuses the platform users RPC (already lists every
 * profile on the platform) and merges in this month's payment sum for each. */
export async function fetchSubscriberSummaries(periodMonth: string): Promise<SubscriberSummary[]> {
  const [users, paymentRows, claims]: [PlatformUser[], any[], SubscriptionClaim[]] =
    await Promise.all([
      fetchPlatformUsers(),
      unwrap<any[]>(
        supabase
          .from('platform_subscription_payments')
          .select('user_id, amount_paise')
          .eq('period_month', periodMonth)
          .returns<any[]>(),
      ),
      fetchClaimsForPeriod(periodMonth),
    ]);

  const paidByUser = new Map<UUID, number>();
  for (const row of paymentRows) {
    const userId = row.user_id as UUID;
    paidByUser.set(userId, (paidByUser.get(userId) ?? 0) + (row.amount_paise as number));
  }

  // Most recent pending claim per user, if any -- a user could in principle
  // have more than one over time (one dismissed, one pending), but only the
  // still-open one matters for the admin's "Confirm" action.
  const pendingClaimByUser = new Map<UUID, SubscriptionClaim>();
  for (const claim of claims) {
    if (claim.status === 'pending' && !pendingClaimByUser.has(claim.userId)) {
      pendingClaimByUser.set(claim.userId, claim);
    }
  }

  return users
    .map((user): SubscriberSummary => {
      const paidPaiseThisMonth = paidByUser.get(user.id) ?? 0;
      return {
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        paidPaiseThisMonth,
        pendingClaim: pendingClaimByUser.get(user.id) ?? null,
        // Any recorded payment counts as paid for that period -- deliberately
        // NOT a `>= settings.monthlyFeePaise` threshold. This is a private
        // tracking view (never enforced), and `settings.monthlyFeePaise` is
        // always *today's* amount: if the admin ever changes the monthly fee
        // and then browses back to a past month, a threshold comparison
        // would retroactively mark correctly-paid past months as "Unpaid"
        // since old payments were recorded against the old amount. Since
        // "mark paid" always records the current amount at the time it's
        // clicked, a plain > 0 check is accurate for every period without
        // needing to snapshot a historical fee on each payment row.
        isPaid: paidPaiseThisMonth > 0,
      };
    })
    .sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
}

/** Super admin only -- RLS rejects anyone else's insert. */
export async function recordSubscriptionPayment(
  userId: UUID,
  input: RecordSubscriptionPaymentInput,
): Promise<void> {
  await unwrapVoid(
    supabase.from('platform_subscription_payments').insert({
      user_id: userId,
      amount_paise: input.amountPaise,
      period_month: input.periodMonth,
      paid_on: input.paidOn,
      method: input.method,
      notes: input.notes,
    }),
  );
}

export async function deleteSubscriptionPayment(paymentId: UUID): Promise<void> {
  await unwrapVoid(supabase.from('platform_subscription_payments').delete().eq('id', paymentId));
}
