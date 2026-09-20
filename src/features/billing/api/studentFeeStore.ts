import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiError, ApiErrorCode, toApiError } from '@/lib/api';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';

export const FAMPAY_UPI_ID = '7358875632@fam';
export const FAMPAY_PAYEE_NAME = 'Hemendra';
export const FAMPAY_UPI_NUMBER = '7358875632';
export const STUDENT_MONTHLY_FEE_AMOUNT = 200;

/**
 * Builds the canonical, unified UPI URI used by both the dynamic QR code and the deep-link button.
 * Note: NPCI UPI specifications require literal '@' in `pa=` (not '%40').
 */
export function buildStudentFeeUpiUri(monthLabel: string): string {
  const note = `CAM Student Pass ${monthLabel}`.trim();
  const uri = `upi://pay?pa=${FAMPAY_UPI_ID}&pn=${encodeURIComponent(FAMPAY_PAYEE_NAME)}&am=${STUDENT_MONTHLY_FEE_AMOUNT}&cu=INR&tn=${encodeURIComponent(note)}`;

  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    // eslint-disable-next-line no-console
    console.log('UPI URI:', uri);
  }

  return uri;
}

export const UPI_TEST_VARIANTS = {
  variant1_rawBase: `upi://pay?pa=${FAMPAY_UPI_ID}&pn=${encodeURIComponent(FAMPAY_PAYEE_NAME)}`,
  variant2_withAmount: `upi://pay?pa=${FAMPAY_UPI_ID}&pn=${encodeURIComponent(FAMPAY_PAYEE_NAME)}&am=${STUDENT_MONTHLY_FEE_AMOUNT}&cu=INR`,
  variant3_withNoteLiteralAt: (monthLabel: string) =>
    `upi://pay?pa=${FAMPAY_UPI_ID}&pn=${encodeURIComponent(FAMPAY_PAYEE_NAME)}&am=${STUDENT_MONTHLY_FEE_AMOUNT}&cu=INR&tn=${encodeURIComponent(`CAM Student Pass ${monthLabel}`.trim())}`,
  variant4_withEncodedAt: (monthLabel: string) =>
    `upi://pay?pa=${encodeURIComponent(FAMPAY_UPI_ID)}&pn=${encodeURIComponent(FAMPAY_PAYEE_NAME)}&am=${STUDENT_MONTHLY_FEE_AMOUNT}&cu=INR&tn=${encodeURIComponent(`CAM Student Pass ${monthLabel}`.trim())}`,
};

const RECEIPTS_BUCKET = 'payment-receipts';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, enough for one admin review session

export interface StudentFeePayment {
  id: string;
  studentId: string;
  studentName: string; // Registered student name in academy
  registeredName?: string; // Confirmed name matching app profile
  payerName?: string; // Optional UPI payer name (e.g. parent name)
  studentEmail: string;
  academyId: string;
  academyName: string;
  monthKey: string; // e.g. "2026-09"
  monthLabel: string; // e.g. "September 2026"
  amount: number; // 200
  utr?: string; // Optional reference
  /** Path inside the private `payment-receipts` Storage bucket. Never a base64 payload. */
  receiptStoragePath?: string;
  /** Short-lived signed URL for displaying the receipt image; resolved on demand, never persisted. */
  screenshotUrl?: string;
  status: 'verified' | 'pending' | 'rejected';
  paidAt: string; // ISO string
}

export interface SubmitStudentFeeClaimInput {
  studentId: string;
  studentName: string;
  registeredName: string;
  payerName?: string;
  studentEmail: string;
  academyId: string;
  academyName: string;
  monthKey: string;
  monthLabel: string;
  amount: number;
  receiptFile: File;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function getCurrentMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getCurrentMonthLabel(date = new Date()): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatMonthLabelFromKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '1', 10) - 1;
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function monthKeyToPeriodDate(monthKey: string): string {
  return `${monthKey}-01`;
}

function periodDateToMonthKey(periodMonth: string): string {
  return periodMonth.slice(0, 7);
}

function toDbStatus(
  status: 'verified' | 'pending' | 'rejected',
): 'confirmed' | 'pending' | 'dismissed' {
  if (status === 'verified') return 'confirmed';
  if (status === 'rejected') return 'dismissed';
  return 'pending';
}

function fromDbStatus(status: string, hasPaidRecord = false): 'verified' | 'pending' | 'rejected' {
  if (hasPaidRecord || status === 'confirmed' || status === 'approved' || status === 'verified') {
    return 'verified';
  }
  if (status === 'dismissed' || status === 'rejected') {
    return 'rejected';
  }
  return 'pending';
}

// ---------------------------------------------------------------------------
// Optimistic, UI-only draft cache
//
// This is NEVER read back to decide "is this paid" — Supabase is the single
// source of truth for that. It only powers a best-effort "submitting…"
// affordance across an accidental reload mid-submit. Every access is wrapped
// so a missing/unavailable localStorage (private browsing) or a quota error
// can never crash the feature or block the real Supabase write.
// ---------------------------------------------------------------------------

const DRAFT_PREFIX = 'cam_student_fee_draft_';

function draftKey(studentId: string, monthKey: string): string {
  return `${DRAFT_PREFIX}${studentId}_${monthKey}`;
}

function markSubmittingDraft(studentId: string, monthKey: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(draftKey(studentId, monthKey), String(Date.now()));
  } catch (err) {
    logger.warn('student_fee_draft_write_failed', { error: String(err) });
  }
}

function clearSubmittingDraft(studentId: string, monthKey: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(draftKey(studentId, monthKey));
  } catch (err) {
    logger.warn('student_fee_draft_clear_failed', { error: String(err) });
  }
}

// ---------------------------------------------------------------------------
// Row -> view-model mapping
// ---------------------------------------------------------------------------

interface ClaimRow {
  id: string;
  user_id: string;
  period_month: string;
  payer_phone: string;
  note: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  receipt_storage_path: string | null;
}

interface PaymentRow {
  id: string;
  user_id: string;
  amount_paise: number;
  period_month: string;
  paid_on: string;
  method: string | null;
  notes: string | null;
  created_at: string;
}

function claimToPayment(claim: ClaimRow, hasPaidRecord: boolean): StudentFeePayment {
  let noteData: Record<string, unknown> = {};
  if (claim.note) {
    try {
      noteData = JSON.parse(claim.note);
    } catch {
      noteData = {};
    }
  }

  const monthKey = periodDateToMonthKey(claim.period_month);

  return {
    id: claim.id,
    studentId: claim.user_id,
    studentName: String(noteData.studentName || noteData.registeredName || 'Player'),
    registeredName:
      typeof noteData.registeredName === 'string' ? noteData.registeredName : undefined,
    payerName: typeof noteData.payerName === 'string' ? noteData.payerName : undefined,
    studentEmail: typeof noteData.studentEmail === 'string' ? noteData.studentEmail : '',
    academyId: typeof noteData.academyId === 'string' ? noteData.academyId : '',
    academyName: typeof noteData.academyName === 'string' ? noteData.academyName : '',
    monthKey,
    monthLabel:
      typeof noteData.monthLabel === 'string'
        ? noteData.monthLabel
        : formatMonthLabelFromKey(monthKey),
    amount: typeof noteData.amount === 'number' ? noteData.amount : STUDENT_MONTHLY_FEE_AMOUNT,
    utr: typeof noteData.utr === 'string' ? noteData.utr : undefined,
    receiptStoragePath: claim.receipt_storage_path ?? undefined,
    status: fromDbStatus(claim.status, hasPaidRecord),
    paidAt: claim.created_at || new Date().toISOString(),
  };
}

function paymentRowToPayment(payment: PaymentRow): StudentFeePayment {
  const monthKey = periodDateToMonthKey(payment.period_month);
  return {
    id: payment.id,
    studentId: payment.user_id,
    studentName: 'Player',
    studentEmail: '',
    academyId: '',
    academyName: '',
    monthKey,
    monthLabel: formatMonthLabelFromKey(monthKey),
    amount: Math.round((payment.amount_paise || 20000) / 100),
    status: 'verified',
    paidAt: payment.paid_on || payment.created_at || new Date().toISOString(),
  };
}

function mergeClaimsAndPayments(claims: ClaimRow[], payments: PaymentRow[]): StudentFeePayment[] {
  const paymentMap = new Set<string>();
  payments.forEach((p) => paymentMap.add(`${p.user_id}_${p.period_month}`));

  const merged: StudentFeePayment[] = [];
  const processedKeys = new Set<string>();

  claims.forEach((claim) => {
    const key = `${claim.user_id}_${claim.period_month}`;
    processedKeys.add(key);
    merged.push(claimToPayment(claim, paymentMap.has(key)));
  });

  payments.forEach((payment) => {
    const key = `${payment.user_id}_${payment.period_month}`;
    if (!processedKeys.has(key)) {
      processedKeys.add(key);
      merged.push(paymentRowToPayment(payment));
    }
  });

  return merged;
}

/** Resolves short-lived signed URLs for receipts so private objects can be viewed (admin review). */
async function withSignedScreenshotUrls(
  payments: StudentFeePayment[],
): Promise<StudentFeePayment[]> {
  const paths = Array.from(
    new Set(payments.map((p) => p.receiptStoragePath).filter((p): p is string => Boolean(p))),
  );
  if (paths.length === 0 || !supabase) return payments;

  try {
    const { data, error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error || !data) return payments;

    const urlByPath = new Map<string, string>();
    for (const d of data) {
      if (d.path && d.signedUrl && !d.error) {
        urlByPath.set(d.path, d.signedUrl);
      }
    }

    return payments.map((p) => {
      const signedUrl = p.receiptStoragePath ? urlByPath.get(p.receiptStoragePath) : undefined;
      return signedUrl ? { ...p, screenshotUrl: signedUrl } : p;
    });
  } catch (err) {
    logger.warn('resolve_receipt_signed_urls_failed', { error: String(err) });
    return payments;
  }
}

// ---------------------------------------------------------------------------
// Supabase-backed reads (source of truth — no localStorage in the read path)
// ---------------------------------------------------------------------------

export async function fetchMyStudentFeeClaims(userId: string): Promise<StudentFeePayment[]> {
  if (!supabase) {
    throw new ApiError(ApiErrorCode.NETWORK, 'E_OFFLINE: Payments require an internet connection.');
  }

  const [claimsRes, paymentsRes] = await Promise.all([
    supabase
      .from('platform_subscription_claims')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('platform_subscription_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  if (claimsRes.error) throw toApiError(claimsRes.error);
  if (paymentsRes.error) throw toApiError(paymentsRes.error);

  return mergeClaimsAndPayments(
    (claimsRes.data ?? []) as ClaimRow[],
    (paymentsRes.data ?? []) as PaymentRow[],
  );
}

/** Super-admin view across every student — RLS restricts non-admins to their own rows either way. */
export async function fetchAllStudentFeeClaims(): Promise<StudentFeePayment[]> {
  if (!supabase) {
    throw new ApiError(ApiErrorCode.NETWORK, 'E_OFFLINE: Payments require an internet connection.');
  }

  const [claimsRes, paymentsRes] = await Promise.all([
    supabase.from('platform_subscription_claims').select('*').order('created_at', {
      ascending: false,
    }),
    supabase.from('platform_subscription_payments').select('*').order('created_at', {
      ascending: false,
    }),
  ]);

  if (claimsRes.error) throw toApiError(claimsRes.error);
  if (paymentsRes.error) throw toApiError(paymentsRes.error);

  const merged = mergeClaimsAndPayments(
    (claimsRes.data ?? []) as ClaimRow[],
    (paymentsRes.data ?? []) as PaymentRow[],
  );
  return withSignedScreenshotUrls(merged);
}

// ---------------------------------------------------------------------------
// Receipt upload — real file to Storage, never base64 in a text column
// ---------------------------------------------------------------------------

async function uploadReceiptFile(userId: string, file: File): Promise<string> {
  if (!supabase) {
    throw new ApiError(ApiErrorCode.NETWORK, 'E_OFFLINE: Payments require an internet connection.');
  }

  const fileName = file.name || 'receipt.jpg';
  let fileType = file.type;
  if (!fileType) {
    if (/\.(jpg|jpeg)$/i.test(fileName)) fileType = 'image/jpeg';
    else if (/\.png$/i.test(fileName)) fileType = 'image/png';
    else if (/\.webp$/i.test(fileName)) fileType = 'image/webp';
    else fileType = 'image/jpeg';
  }

  const ext =
    fileName
      .split('.')
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  // Some Android WebViews fail to send File objects directly (see uploadAvatar) —
  // normalize through ArrayBuffer for reliability on Capacitor.
  let uploadBody: Blob | File = file;
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (arrayBuffer.byteLength > 0) {
      uploadBody = new Blob([arrayBuffer], { type: fileType });
    }
  } catch (err) {
    logger.warn('receipt_arraybuffer_conversion_failed', { error: String(err) });
  }

  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(path, uploadBody, {
    upsert: false,
    contentType: fileType,
  });

  if (error) {
    throw new ApiError(
      ApiErrorCode.UNKNOWN,
      `E_RECEIPT_UPLOAD_FAILED: We could not upload your payment screenshot (${error.message}). Please check your connection and try again.`,
    );
  }

  return path;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function submitStudentFeeClaim(
  input: SubmitStudentFeeClaimInput,
): Promise<StudentFeePayment> {
  if (!supabase) {
    throw new ApiError(ApiErrorCode.NETWORK, 'E_OFFLINE: Payments require an internet connection.');
  }

  // Upload the real file first — a failed upload must never let a claim get
  // inserted with no evidence attached.
  const receiptPath = await uploadReceiptFile(input.studentId, input.receiptFile);

  const notePayload = JSON.stringify({
    studentName: input.studentName,
    registeredName: input.registeredName,
    payerName: input.payerName,
    studentEmail: input.studentEmail,
    academyId: input.academyId,
    academyName: input.academyName,
    monthLabel: input.monthLabel,
    amount: input.amount,
  });

  const payerPhone =
    (input.payerName || input.registeredName || input.studentName || FAMPAY_UPI_NUMBER).trim() ||
    FAMPAY_UPI_NUMBER;

  const { data, error } = await supabase
    .from('platform_subscription_claims')
    .insert({
      user_id: input.studentId,
      period_month: monthKeyToPeriodDate(input.monthKey),
      payer_phone: payerPhone,
      note: notePayload,
      status: 'pending',
      receipt_storage_path: receiptPath,
    })
    .select('*')
    .single();

  if (error) {
    // Don't leave an orphaned upload behind if the claim itself couldn't be recorded.
    void supabase.storage
      .from(RECEIPTS_BUCKET)
      .remove([receiptPath])
      .catch((cleanupErr) =>
        logger.warn('receipt_cleanup_after_failed_claim_failed', { error: String(cleanupErr) }),
      );

    if (error.code === '23505') {
      throw new ApiError(
        ApiErrorCode.CONFLICT,
        `E_ALREADY_SUBMITTED: You have already submitted a payment for ${input.monthLabel}. Check your existing status below instead of submitting again.`,
      );
    }
    throw toApiError(error);
  }

  return claimToPayment(data as ClaimRow, false);
}

export async function resolveStudentFeeClaim(
  payment: Pick<StudentFeePayment, 'studentId' | 'monthKey' | 'amount' | 'paidAt'>,
  status: 'verified' | 'pending' | 'rejected',
): Promise<void> {
  if (!supabase) {
    throw new ApiError(ApiErrorCode.NETWORK, 'E_OFFLINE: Payments require an internet connection.');
  }

  const dbStatus = toDbStatus(status);
  const periodDate = monthKeyToPeriodDate(payment.monthKey);

  const { error: claimError } = await supabase
    .from('platform_subscription_claims')
    .update({
      status: dbStatus,
      resolved_at: status !== 'pending' ? new Date().toISOString() : null,
    })
    .match({ user_id: payment.studentId, period_month: periodDate });

  if (claimError) throw toApiError(claimError);

  if (status === 'verified') {
    const { error: paymentError } = await supabase.from('platform_subscription_payments').upsert(
      {
        user_id: payment.studentId,
        amount_paise: Math.round((payment.amount || STUDENT_MONTHLY_FEE_AMOUNT) * 100),
        period_month: periodDate,
        paid_on: (payment.paidAt || new Date().toISOString()).slice(0, 10),
        method: 'upi',
      },
      { onConflict: 'user_id,period_month' },
    );
    if (paymentError) throw toApiError(paymentError);
  } else if (status === 'rejected') {
    const { error: deleteError } = await supabase
      .from('platform_subscription_payments')
      .delete()
      .match({ user_id: payment.studentId, period_month: periodDate });
    if (deleteError) throw toApiError(deleteError);
  }
}

// ---------------------------------------------------------------------------
// React Query hooks — Supabase is the source of truth for every read below.
// ---------------------------------------------------------------------------

const billingKeys = {
  mine: (studentId: string) => ['student-fee', 'mine', studentId] as const,
  all: ['student-fee', 'all'] as const,
};

function invalidateStudentFeeQueries(queryClient: QueryClient, studentId: string) {
  void queryClient.invalidateQueries({ queryKey: billingKeys.mine(studentId) });
  void queryClient.invalidateQueries({ queryKey: billingKeys.all });
}

/** Hook for subscribing to a student's own fee payment status (Supabase is authoritative). */
export function useStudentFeePayment(studentId?: string) {
  const currentMonthKey = getCurrentMonthKey();
  const currentMonthLabel = getCurrentMonthLabel();

  const query = useQuery({
    queryKey: billingKeys.mine(studentId ?? ''),
    queryFn: () => fetchMyStudentFeeClaims(studentId as string),
    enabled: Boolean(studentId) && Boolean(supabase),
    staleTime: 30 * 1000,
  });

  const payments = query.data ?? [];
  const payment = studentId ? payments.find((p) => p.monthKey === currentMonthKey) : undefined;

  return {
    payment,
    isPaidThisMonth: Boolean(payment && payment.status === 'verified'),
    isPendingThisMonth: Boolean(payment && payment.status === 'pending'),
    isRejectedThisMonth: Boolean(payment && payment.status === 'rejected'),
    status: payment?.status,
    currentMonthKey,
    currentMonthLabel,
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refreshPayment: () => {
      void query.refetch();
    },
  };
}

/** Hook for Super Admin dashboard to view all payments (RLS still scopes non-admin callers). */
export function useAllPlatformFeePayments() {
  const query = useQuery({
    queryKey: billingKeys.all,
    queryFn: fetchAllStudentFeeClaims,
    enabled: Boolean(supabase),
    staleTime: 15 * 1000,
  });

  return {
    payments: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    error: query.error,
    refresh: () => {
      void query.refetch();
    },
  };
}

/** Submits a payment claim: uploads the receipt to Storage, then records the claim row. */
export function useSubmitStudentFeeClaim(studentId: string) {
  const queryClient = useQueryClient();
  const currentMonthKey = getCurrentMonthKey();

  return useMutation({
    mutationFn: (input: Omit<SubmitStudentFeeClaimInput, 'studentId'>) => {
      // Best-effort optimistic "submitting…" marker only — never read back to
      // determine payment status, and never allowed to block/break the actual
      // submission if localStorage throws (quota, private browsing, etc.).
      markSubmittingDraft(studentId, currentMonthKey);
      return submitStudentFeeClaim({ ...input, studentId });
    },
    onSettled: () => {
      clearSubmittingDraft(studentId, currentMonthKey);
    },
    onSuccess: () => {
      invalidateStudentFeeQueries(queryClient, studentId);
    },
  });
}

/** Super-admin action: verify, reject, or reset a claim back to pending. */
export function useResolveStudentFeeClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payment,
      status,
    }: {
      payment: StudentFeePayment;
      status: 'verified' | 'pending' | 'rejected';
    }) => resolveStudentFeeClaim(payment, status),
    onSuccess: (_data, variables) => {
      invalidateStudentFeeQueries(queryClient, variables.payment.studentId);
    },
  });
}
