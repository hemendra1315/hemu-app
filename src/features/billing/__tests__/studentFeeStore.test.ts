import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FAMPAY_UPI_ID,
  STUDENT_MONTHLY_FEE_AMOUNT,
  getCurrentMonthKey,
  getCurrentMonthLabel,
  formatMonthLabelFromKey,
  getAllStudentFeePayments,
  getStudentPaymentForMonth,
  recordStudentFeePayment,
  updateStudentFeePaymentStatus,
} from '../api/studentFeeStore';

describe('studentFeeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('exposes correct FamPay configuration constants', () => {
    expect(FAMPAY_UPI_ID).toBe('7358875632@fam');
    expect(STUDENT_MONTHLY_FEE_AMOUNT).toBe(200);
  });

  it('computes month keys and labels accurately', () => {
    const testDate = new Date(2026, 8, 14); // September 2026
    expect(getCurrentMonthKey(testDate)).toBe('2026-09');
    expect(getCurrentMonthLabel(testDate)).toBe('September 2026');
    expect(formatMonthLabelFromKey('2026-09')).toBe('September 2026');
  });

  it('records student fee payment and stores in localStorage', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const payment = recordStudentFeePayment({
      studentId: 'student_123',
      studentName: 'Aarav Sharma',
      studentEmail: 'aarav@example.com',
      academyId: 'acad_1',
      academyName: 'Apex Cricket Academy',
      monthKey: '2026-09',
      monthLabel: 'September 2026',
      amount: 200,
      utr: '425891029384',
    });

    expect(payment.id).toBeDefined();
    expect(payment.status).toBe('pending');
    expect(payment.amount).toBe(200);
    expect(payment.utr).toBe('425891029384');

    const all = getAllStudentFeePayments();
    expect(all).toHaveLength(1);
    expect(all[0]?.studentName).toBe('Aarav Sharma');

    const studentPayment = getStudentPaymentForMonth('student_123', '2026-09');
    expect(studentPayment).toBeDefined();
    expect(studentPayment?.utr).toBe('425891029384');

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cam_student_fee_payment_updated' }),
    );
  });

  it('updates payment status correctly', () => {
    const payment = recordStudentFeePayment({
      studentId: 'student_456',
      studentName: 'Rohan Patel',
      studentEmail: 'rohan@example.com',
      academyId: 'acad_1',
      academyName: 'Apex Cricket Academy',
      monthKey: '2026-09',
      monthLabel: 'September 2026',
      amount: 200,
      utr: '123456789012',
    });

    updateStudentFeePaymentStatus(payment.id, 'rejected');

    const updated = getStudentPaymentForMonth('student_456', '2026-09');
    expect(updated?.status).toBe('rejected');
  });
});
