/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query/queryClient';

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

import { supabase } from '@/lib/supabase/client';
import {
  FAMPAY_UPI_ID,
  FAMPAY_PAYEE_NAME,
  STUDENT_MONTHLY_FEE_AMOUNT,
  buildStudentFeeUpiUri,
  UPI_TEST_VARIANTS,
  getCurrentMonthKey,
  getCurrentMonthLabel,
  formatMonthLabelFromKey,
  fetchMyStudentFeeClaims,
  submitStudentFeeClaim,
  useSubmitStudentFeeClaim,
} from '../api/studentFeeStore';

const mockedSupabase = vi.mocked(supabase);

function queryWrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client: createQueryClient() }, children);
}

type Row = Record<string, any>;

/** Mimics the codebase's shared PostgREST query-builder mock pattern (see attendanceApi.test.ts). */
function createMockBuilder(response: { data: any; error: any }) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(response),
    maybeSingle: vi.fn().mockResolvedValue(response),
    then: (onfulfilled?: (val: any) => any, onrejected?: (reason: any) => any) =>
      Promise.resolve(response).then(onfulfilled, onrejected),
  };
  return builder;
}

function mockStorageBucket({
  uploadError = null as any,
  removeError = null as any,
}: { uploadError?: any; removeError?: any } = {}) {
  const bucket = {
    upload: vi.fn().mockResolvedValue({ data: { path: 'mock' }, error: uploadError }),
    remove: vi.fn().mockResolvedValue({ data: null, error: removeError }),
    createSignedUrls: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  (mockedSupabase.storage.from as any).mockReturnValue(bucket);
  return bucket;
}

function makeReceiptFile(name = 'receipt.png'): File {
  return new File(['fake receipt bytes'], name, { type: 'image/png' });
}

const claimsRow = (overrides: Row = {}): Row => ({
  id: 'claim-1',
  user_id: 'student_123',
  period_month: '2026-09-01',
  payer_phone: '9876543210',
  note: JSON.stringify({
    studentName: 'Aarav Sharma',
    registeredName: 'Aarav Sharma',
    studentEmail: 'aarav@example.com',
    academyId: 'acad_1',
    academyName: 'Apex Cricket Academy',
    monthLabel: 'September 2026',
    amount: 200,
  }),
  status: 'pending',
  created_at: '2026-09-01T00:00:00Z',
  resolved_at: null,
  receipt_storage_path: 'student_123/receipt.png',
  ...overrides,
});

describe('studentFeeStore date helpers', () => {
  it('exposes correct FamPay configuration constants', () => {
    expect(FAMPAY_UPI_ID).toBe('7358875632@fam');
    expect(FAMPAY_PAYEE_NAME).toBe('Hemendra');
    expect(STUDENT_MONTHLY_FEE_AMOUNT).toBe(200);
  });

  it('builds canonical student fee UPI URI with exact matching parameters', () => {
    const uri = buildStudentFeeUpiUri('September 2026');
    expect(uri).toBe(
      'upi://pay?pa=7358875632@fam&pn=Hemendra&am=200&cu=INR&tn=CAM%20Student%20Pass%20September%202026',
    );
    expect(uri).toContain('7358875632@fam');
    expect(uri).not.toContain('%40');
  });

  it('provides all 4 diagnostic test variants for mobile intent debugging', () => {
    expect(UPI_TEST_VARIANTS.variant1_rawBase).toBe('upi://pay?pa=7358875632@fam&pn=Hemendra');
    expect(UPI_TEST_VARIANTS.variant2_withAmount).toBe(
      'upi://pay?pa=7358875632@fam&pn=Hemendra&am=200&cu=INR',
    );
    expect(UPI_TEST_VARIANTS.variant3_withNoteLiteralAt('September 2026')).toBe(
      'upi://pay?pa=7358875632@fam&pn=Hemendra&am=200&cu=INR&tn=CAM%20Student%20Pass%20September%202026',
    );
    expect(UPI_TEST_VARIANTS.variant4_withEncodedAt('September 2026')).toBe(
      'upi://pay?pa=7358875632%40fam&pn=Hemendra&am=200&cu=INR&tn=CAM%20Student%20Pass%20September%202026',
    );
  });

  it('computes month keys and labels accurately', () => {
    const testDate = new Date(2026, 8, 14); // September 2026
    expect(getCurrentMonthKey(testDate)).toBe('2026-09');
    expect(getCurrentMonthLabel(testDate)).toBe('September 2026');
    expect(formatMonthLabelFromKey('2026-09')).toBe('September 2026');
  });
});

describe('fetchMyStudentFeeClaims — Supabase is the source of truth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('maps claim rows from Supabase into StudentFeePayment view models', async () => {
    const claimsBuilder = createMockBuilder({ data: [claimsRow()], error: null });
    const paymentsBuilder = createMockBuilder({ data: [], error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      table === 'platform_subscription_claims' ? claimsBuilder : paymentsBuilder,
    );

    const result = await fetchMyStudentFeeClaims('student_123');

    expect(result).toHaveLength(1);
    expect(result[0]?.studentName).toBe('Aarav Sharma');
    expect(result[0]?.monthKey).toBe('2026-09');
    expect(result[0]?.status).toBe('pending');
    expect(result[0]?.receiptStoragePath).toBe('student_123/receipt.png');
  });

  it('ignores stale/garbage localStorage entirely — persistence comes only from Supabase', async () => {
    // Simulate a stale cache from a previous (pre-fix) version of the app, or
    // tampered client state, sitting under the old localStorage key.
    localStorage.setItem(
      'cam_student_fee_payments',
      JSON.stringify([
        {
          id: 'stale-local-only',
          studentId: 'student_123',
          monthKey: getCurrentMonthKey(),
          status: 'verified',
        },
      ]),
    );

    const claimsBuilder = createMockBuilder({
      data: [claimsRow({ status: 'pending' })],
      error: null,
    });
    const paymentsBuilder = createMockBuilder({ data: [], error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      table === 'platform_subscription_claims' ? claimsBuilder : paymentsBuilder,
    );

    const result = await fetchMyStudentFeeClaims('student_123');

    // The stale localStorage-only "verified" record must never surface —
    // only what Supabase actually returned (a single "pending" claim).
    expect(result).toHaveLength(1);
    expect(result.some((p) => p.id === 'stale-local-only')).toBe(false);
    expect(result[0]?.status).toBe('pending');
  });

  it('surfaces a real error when the Supabase read fails (no silent empty state)', async () => {
    const claimsBuilder = createMockBuilder({
      data: null,
      error: { message: 'network down', code: 'PGRST000' },
    });
    const paymentsBuilder = createMockBuilder({ data: [], error: null });
    mockedSupabase.from.mockImplementation((table: string) =>
      table === 'platform_subscription_claims' ? claimsBuilder : paymentsBuilder,
    );

    await expect(fetchMyStudentFeeClaims('student_123')).rejects.toThrow();
  });
});

describe('submitStudentFeeClaim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const baseInput = {
    studentId: 'student_123',
    studentName: 'Aarav Sharma',
    registeredName: 'Aarav Sharma',
    studentEmail: 'aarav@example.com',
    academyId: 'acad_1',
    academyName: 'Apex Cricket Academy',
    monthKey: '2026-09',
    monthLabel: 'September 2026',
    amount: 200,
    receiptFile: makeReceiptFile(),
  };

  it('uploads the receipt file to Storage and inserts a claim with a real storage path (no base64)', async () => {
    const bucket = mockStorageBucket();
    const insertBuilder = createMockBuilder({ data: claimsRow(), error: null });
    mockedSupabase.from.mockReturnValue(insertBuilder);

    const result = await submitStudentFeeClaim(baseInput);

    expect(bucket.upload).toHaveBeenCalledTimes(1);
    const insertArg = insertBuilder.insert.mock.calls[0][0];
    expect(insertArg.receipt_storage_path).toMatch(/^student_123\//);
    expect(insertArg.note).not.toMatch(/data:image/); // never a base64 data URL
    expect(JSON.stringify(insertArg).length).toBeLessThan(2000); // nowhere near multi-MB base64 payloads
    expect(result.status).toBe('pending');
  });

  it('does not create a claim when the receipt upload fails (no evidence-less claim)', async () => {
    mockStorageBucket({ uploadError: { message: 'storage quota exceeded' } });
    const insertBuilder = createMockBuilder({ data: claimsRow(), error: null });
    mockedSupabase.from.mockReturnValue(insertBuilder);

    await expect(submitStudentFeeClaim(baseInput)).rejects.toThrow();
    expect(insertBuilder.insert).not.toHaveBeenCalled();
  });

  it('surfaces a network/DB error on insert failure instead of silently succeeding', async () => {
    mockStorageBucket();
    const insertBuilder = createMockBuilder({
      data: null,
      error: { message: 'connection reset', code: '08006' },
    });
    mockedSupabase.from.mockReturnValue(insertBuilder);

    await expect(submitStudentFeeClaim(baseInput)).rejects.toThrow();
  });

  it('shows a friendly "already submitted" message on a duplicate-period conflict (23505) and cleans up the upload', async () => {
    const bucket = mockStorageBucket();
    const insertBuilder = createMockBuilder({
      data: null,
      error: { message: 'duplicate key value violates unique constraint', code: '23505' },
    });
    mockedSupabase.from.mockReturnValue(insertBuilder);

    await expect(submitStudentFeeClaim(baseInput)).rejects.toThrow(/already submitted/i);
    // The uploaded file must not be left dangling once the claim itself failed.
    expect(bucket.remove).toHaveBeenCalledTimes(1);
  });

  it('retrying after a transient failure does not require special handling — the unique constraint plus 23505 handling prevents duplicate rows', async () => {
    mockStorageBucket();

    // First attempt: transient DB error.
    const failingBuilder = createMockBuilder({
      data: null,
      error: { message: 'timeout', code: '57014' },
    });
    mockedSupabase.from.mockReturnValueOnce(failingBuilder);
    await expect(submitStudentFeeClaim(baseInput)).rejects.toThrow();

    // Retry: succeeds and inserts exactly once more.
    mockStorageBucket();
    const successBuilder = createMockBuilder({ data: claimsRow(), error: null });
    mockedSupabase.from.mockReturnValueOnce(successBuilder);
    const result = await submitStudentFeeClaim(baseInput);

    expect(result.status).toBe('pending');
    expect(successBuilder.insert).toHaveBeenCalledTimes(1);
  });
});

describe('useSubmitStudentFeeClaim — localStorage is optimistic UI-cache only', () => {
  const baseInput = {
    studentName: 'Aarav Sharma',
    registeredName: 'Aarav Sharma',
    studentEmail: 'aarav@example.com',
    academyId: 'acad_1',
    academyName: 'Apex Cricket Academy',
    monthKey: getCurrentMonthKey(),
    monthLabel: getCurrentMonthLabel(),
    amount: 200,
    receiptFile: makeReceiptFile(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('still submits successfully when localStorage.setItem throws (quota exceeded / private browsing)', async () => {
    mockStorageBucket();
    const insertBuilder = createMockBuilder({ data: claimsRow(), error: null });
    mockedSupabase.from.mockReturnValue(insertBuilder);

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    const { result } = renderHook(() => useSubmitStudentFeeClaim('student_123'), {
      wrapper: queryWrapper,
    });

    let payment;
    await act(async () => {
      payment = await result.current.mutateAsync(baseInput);
    });

    // The real submission (Storage upload + DB row) must succeed regardless
    // of the best-effort optimistic localStorage marker failing.
    expect(payment).toBeDefined();
    expect(insertBuilder.insert).toHaveBeenCalledTimes(1);

    setItemSpy.mockRestore();
  });

  it('still submits successfully when localStorage is entirely unavailable (getItem/setItem throw)', async () => {
    mockStorageBucket();
    const insertBuilder = createMockBuilder({ data: claimsRow(), error: null });
    mockedSupabase.from.mockReturnValue(insertBuilder);

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage is not available');
    });
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('localStorage is not available');
    });

    const { result } = renderHook(() => useSubmitStudentFeeClaim('student_123'), {
      wrapper: queryWrapper,
    });

    await act(async () => {
      await expect(result.current.mutateAsync(baseInput)).resolves.toBeDefined();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });

  it('surfaces the real submission error to the caller when the Supabase write fails', async () => {
    mockStorageBucket();
    const insertBuilder = createMockBuilder({
      data: null,
      error: { message: 'connection reset', code: '08006' },
    });
    mockedSupabase.from.mockReturnValue(insertBuilder);

    const { result } = renderHook(() => useSubmitStudentFeeClaim('student_123'), {
      wrapper: queryWrapper,
    });

    await act(async () => {
      await expect(result.current.mutateAsync(baseInput)).rejects.toThrow();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
