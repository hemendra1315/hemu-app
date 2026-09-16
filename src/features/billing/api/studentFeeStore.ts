import { useSyncExternalStore } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';

export const FAMPAY_UPI_ID = '7358875632@fam';
export const FAMPAY_UPI_NUMBER = '7358875632';
export const STUDENT_MONTHLY_FEE_AMOUNT = 200;

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
  screenshotUrl?: string;
  status: 'verified' | 'pending' | 'rejected';
  paidAt: string; // ISO string
}

const STORAGE_KEY = 'cam_student_fee_payments';
const PAYMENT_EVENT = 'cam_student_fee_payment_updated';

let cachedPayments: StudentFeePayment[] = [];
let isInitialized = false;

function loadPaymentsFromStorage(): StudentFeePayment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StudentFeePayment[];
  } catch (err) {
    logger.warn('load_student_fee_payments_failed', { error: String(err) });
    return [];
  }
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

async function syncPaymentsWithSupabase() {
  if (typeof window === 'undefined' || !supabase) return;
  try {
    const [claimsRes, paymentsRes] = await Promise.all([
      supabase
        .from('platform_subscription_claims')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('platform_subscription_payments')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    const claims = claimsRes.data ?? [];
    const payments = paymentsRes.data ?? [];

    if (claims.length === 0 && payments.length === 0) return;

    // Create lookup set for paid months
    const paymentMap = new Set<string>();
    payments.forEach((p) => {
      paymentMap.add(`${p.user_id}_${p.period_month}`);
    });

    const serverPayments: StudentFeePayment[] = [];
    const processedKeys = new Set<string>();

    claims.forEach((claim) => {
      let noteData: Record<string, unknown> = {};
      if (claim.note) {
        try {
          noteData = JSON.parse(claim.note);
        } catch {
          noteData = {};
        }
      }

      const key = `${claim.user_id}_${claim.period_month}`;
      processedKeys.add(key);

      const hasPaidRecord = paymentMap.has(key);
      const status = fromDbStatus(claim.status, hasPaidRecord);

      serverPayments.push({
        id: claim.id,
        studentId: claim.user_id,
        studentName: String(noteData.studentName || noteData.registeredName || 'Player'),
        registeredName:
          typeof noteData.registeredName === 'string' ? noteData.registeredName : undefined,
        payerName: typeof noteData.payerName === 'string' ? noteData.payerName : undefined,
        studentEmail: typeof noteData.studentEmail === 'string' ? noteData.studentEmail : '',
        academyId: typeof noteData.academyId === 'string' ? noteData.academyId : '',
        academyName: typeof noteData.academyName === 'string' ? noteData.academyName : '',
        monthKey: claim.period_month,
        monthLabel:
          typeof noteData.monthLabel === 'string'
            ? noteData.monthLabel
            : formatMonthLabelFromKey(claim.period_month),
        amount: typeof noteData.amount === 'number' ? noteData.amount : STUDENT_MONTHLY_FEE_AMOUNT,
        utr: typeof noteData.utr === 'string' ? noteData.utr : undefined,
        screenshotUrl:
          typeof noteData.screenshotUrl === 'string' ? noteData.screenshotUrl : undefined,
        status,
        paidAt: claim.created_at || new Date().toISOString(),
      });
    });

    // Also parse any payments that didn't originate from a recorded claim
    payments.forEach((payment) => {
      const key = `${payment.user_id}_${payment.period_month}`;
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        serverPayments.push({
          id: payment.id,
          studentId: payment.user_id,
          studentName: 'Player',
          studentEmail: '',
          academyId: '',
          academyName: '',
          monthKey: payment.period_month,
          monthLabel: formatMonthLabelFromKey(payment.period_month),
          amount: Math.round((payment.amount_paise || 20000) / 100),
          status: 'verified',
          paidAt: payment.paid_on || payment.created_at || new Date().toISOString(),
        });
      }
    });

    // Merge server payments with local payments
    const local = loadPaymentsFromStorage();
    const localMap = new Map(local.map((p) => [p.id, p]));
    serverPayments.forEach((sp) => {
      localMap.set(sp.id, sp);
    });

    const merged = Array.from(localMap.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    notifyListeners();
  } catch (err) {
    logger.warn('sync_platform_subscriptions_failed', { error: String(err) });
  }
}

function getStoreSnapshot(): StudentFeePayment[] {
  if (!isInitialized) {
    cachedPayments = loadPaymentsFromStorage();
    isInitialized = true;
    void syncPaymentsWithSupabase();
  }
  return cachedPayments;
}

const listeners = new Set<() => void>();

function notifyListeners() {
  cachedPayments = loadPaymentsFromStorage();
  listeners.forEach((l) => l());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PAYMENT_EVENT));
  }
}

function subscribeStore(callback: () => void) {
  listeners.add(callback);
  const handleStorageChange = () => {
    cachedPayments = loadPaymentsFromStorage();
    callback();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(PAYMENT_EVENT, callback);
    window.addEventListener('storage', handleStorageChange);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener(PAYMENT_EVENT, callback);
      window.removeEventListener('storage', handleStorageChange);
    }
  };
}

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

export function getAllStudentFeePayments(): StudentFeePayment[] {
  return getStoreSnapshot();
}

export function getStudentPaymentForMonth(
  studentId: string,
  monthKey: string = getCurrentMonthKey(),
): StudentFeePayment | undefined {
  const all = getStoreSnapshot();
  return all.find((p) => p.studentId === studentId && p.monthKey === monthKey);
}

export function recordStudentFeePayment(
  data: Omit<StudentFeePayment, 'id' | 'paidAt' | 'status'>,
  status: 'pending' | 'verified' = 'pending',
): StudentFeePayment {
  const existing = getStoreSnapshot();
  const id = `pay_${data.monthKey}_${data.studentId}_${Date.now()}`;
  const newPayment: StudentFeePayment = {
    ...data,
    id,
    paidAt: new Date().toISOString(),
    status,
  };

  // Filter out any previous draft for same month/student, then add new one
  const filtered = existing.filter(
    (p) => !(p.studentId === data.studentId && p.monthKey === data.monthKey),
  );
  filtered.unshift(newPayment);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    notifyListeners();
  } catch (err) {
    logger.error('save_student_fee_payment_failed', { error: String(err) });
  }

  // Asynchronously persist to Supabase live tables
  if (supabase && typeof window !== 'undefined') {
    void (async () => {
      try {
        const notePayload = JSON.stringify({
          studentName: newPayment.studentName,
          registeredName: newPayment.registeredName,
          payerName: newPayment.payerName,
          studentEmail: newPayment.studentEmail,
          academyId: newPayment.academyId,
          academyName: newPayment.academyName,
          monthLabel: newPayment.monthLabel,
          amount: newPayment.amount,
          utr: newPayment.utr,
          screenshotUrl: newPayment.screenshotUrl,
        });

        const payerPhone =
          (
            newPayment.payerName ||
            newPayment.registeredName ||
            newPayment.studentName ||
            FAMPAY_UPI_NUMBER
          ).trim() || FAMPAY_UPI_NUMBER;

        const { data: claimData, error: claimError } = await supabase
          .from('platform_subscription_claims')
          .insert({
            user_id: newPayment.studentId,
            period_month: newPayment.monthKey,
            payer_phone: payerPhone,
            note: notePayload,
            status: toDbStatus(status),
          })
          .select('id')
          .single();

        if (claimError) {
          logger.warn('insert_platform_subscription_claim_failed', { error: claimError.message });
        } else if (claimData && status === 'verified') {
          await supabase.from('platform_subscription_payments').insert({
            user_id: newPayment.studentId,
            amount_paise: (newPayment.amount || STUDENT_MONTHLY_FEE_AMOUNT) * 100,
            period_month: newPayment.monthKey,
            paid_on: newPayment.paidAt,
            method: 'upi',
          });
        }
      } catch (err) {
        logger.warn('persist_subscription_claim_error', { error: String(err) });
      }
    })();
  }

  return newPayment;
}

export function updateStudentFeePaymentStatus(
  paymentId: string,
  status: 'verified' | 'pending' | 'rejected',
): void {
  const existing = getStoreSnapshot();
  const payment = existing.find((p) => p.id === paymentId);
  const updated = existing.map((p) => (p.id === paymentId ? { ...p, status } : p));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notifyListeners();
  } catch (err) {
    logger.error('update_student_payment_status_failed', { error: String(err) });
  }

  // Asynchronously update in Supabase
  if (supabase && typeof window !== 'undefined' && payment) {
    void (async () => {
      try {
        const dbStatus = toDbStatus(status);
        await supabase
          .from('platform_subscription_claims')
          .update({
            status: dbStatus,
            resolved_at: status !== 'pending' ? new Date().toISOString() : null,
          })
          .match({ user_id: payment.studentId, period_month: payment.monthKey });

        if (status === 'verified') {
          await supabase.from('platform_subscription_payments').upsert({
            user_id: payment.studentId,
            amount_paise: (payment.amount || STUDENT_MONTHLY_FEE_AMOUNT) * 100,
            period_month: payment.monthKey,
            paid_on: payment.paidAt || new Date().toISOString(),
            method: 'upi',
          });
        } else if (status === 'rejected') {
          await supabase
            .from('platform_subscription_payments')
            .delete()
            .match({ user_id: payment.studentId, period_month: payment.monthKey });
        }
      } catch (err) {
        logger.warn('update_subscription_status_db_error', { error: String(err) });
      }
    })();
  }
}

const EMPTY_SNAPSHOT: StudentFeePayment[] = [];

/** Hook for subscribing to student fee payments in React components */
export function useStudentFeePayment(studentId?: string) {
  const payments = useSyncExternalStore(subscribeStore, getStoreSnapshot, () => EMPTY_SNAPSHOT);

  const currentMonthKey = getCurrentMonthKey();
  const currentMonthLabel = getCurrentMonthLabel();

  const payment = studentId
    ? payments.find((p) => p.studentId === studentId && p.monthKey === currentMonthKey)
    : undefined;

  return {
    payment,
    isPaidThisMonth: Boolean(payment && payment.status === 'verified'),
    isPendingThisMonth: Boolean(payment && payment.status === 'pending'),
    isRejectedThisMonth: Boolean(payment && payment.status === 'rejected'),
    status: payment?.status,
    currentMonthKey,
    currentMonthLabel,
    refreshPayment: () => {
      notifyListeners();
      void syncPaymentsWithSupabase();
    },
  };
}

/** Hook for Super Admin dashboard to view all payments */
export function useAllPlatformFeePayments() {
  const payments = useSyncExternalStore(subscribeStore, getStoreSnapshot, () => EMPTY_SNAPSHOT);

  return {
    payments,
    refresh: () => {
      notifyListeners();
      void syncPaymentsWithSupabase();
    },
  };
}
