import { useSyncExternalStore } from 'react';
import { logger } from '@/lib/logger';

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

function getStoreSnapshot(): StudentFeePayment[] {
  if (!isInitialized) {
    cachedPayments = loadPaymentsFromStorage();
    isInitialized = true;
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
): StudentFeePayment {
  const existing = getStoreSnapshot();
  const id = `pay_${data.monthKey}_${data.studentId}_${Date.now()}`;
  const newPayment: StudentFeePayment = {
    ...data,
    id,
    paidAt: new Date().toISOString(),
    status: 'verified',
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

  return newPayment;
}

export function updateStudentFeePaymentStatus(
  paymentId: string,
  status: 'verified' | 'pending' | 'rejected',
): void {
  const existing = getStoreSnapshot();
  const updated = existing.map((p) => (p.id === paymentId ? { ...p, status } : p));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notifyListeners();
  } catch (err) {
    logger.error('update_student_payment_status_failed', { error: String(err) });
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
    currentMonthKey,
    currentMonthLabel,
    refreshPayment: () => {
      notifyListeners();
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
    },
  };
}
