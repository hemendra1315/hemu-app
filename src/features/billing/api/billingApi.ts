import { rpc } from '@/lib/api';
import { parseAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import type { PaymentMethod, PaymentStatus, InvoiceStatus } from '../providers/types';

export interface Invoice {
  id: string;
  academyId: string;
  membershipId: string;
  feePlanId: string | null;
  invoiceNumber: string;
  title: string;
  amount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  dueDate: string;
  issuedAt: string;
  paidAt: string | null;
  notes: string | null;
}

export interface Payment {
  id: string;
  academyId: string;
  invoiceId: string;
  membershipId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  referenceNumber: string | null;
  receiptUrl: string | null;
  notes: string | null;
  rejectionReason: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface RecordManualPaymentInput {
  academyId: string;
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  notes?: string;
  receiptUrl?: string;
  idempotencyKey?: string;
}

export interface SubmitPaymentProofInput {
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  receiptUrl: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface ReviewPaymentProofInput {
  paymentId: string;
  action: 'approve' | 'reject';
  rejectionReason?: string;
  idempotencyKey?: string;
}

/**
 * 1. Record Manual Payment (Staff Flow)
 */
export async function recordManualPayment(input: RecordManualPaymentInput) {
  const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
  try {
    return await rpc<Record<string, unknown>>('record_manual_payment', {
      p_academy_id: input.academyId,
      p_invoice_id: input.invoiceId,
      p_amount: input.amount,
      p_payment_method: input.paymentMethod,
      p_reference_number: input.referenceNumber,
      p_idempotency_key: idempotencyKey,
      p_notes: input.notes ?? null,
      p_receipt_url: input.receiptUrl ?? null,
    });
  } catch (err) {
    throw parseAppError(err);
  }
}

/**
 * 2. Submit Payment Proof (Player / Parent Flow)
 */
export async function submitPaymentProof(input: SubmitPaymentProofInput) {
  const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
  try {
    return await rpc<Record<string, unknown>>('submit_payment_proof', {
      p_invoice_id: input.invoiceId,
      p_amount: input.amount,
      p_payment_method: input.paymentMethod,
      p_reference_number: input.referenceNumber,
      p_receipt_url: input.receiptUrl,
      p_notes: input.notes ?? null,
      p_idempotency_key: idempotencyKey,
    });
  } catch (err) {
    throw parseAppError(err);
  }
}

/**
 * 3. Review Payment Proof (Staff Approval / Rejection Flow)
 */
export async function reviewPaymentProof(input: ReviewPaymentProofInput) {
  const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
  try {
    return await rpc<Record<string, unknown>>('review_payment_proof', {
      p_payment_id: input.paymentId,
      p_action: input.action,
      p_rejection_reason: input.rejectionReason ?? null,
      p_idempotency_key: idempotencyKey,
    });
  } catch (err) {
    throw parseAppError(err);
  }
}

interface InvoiceDbRow {
  id: string;
  academy_id: string;
  membership_id: string;
  fee_plan_id: string | null;
  invoice_number: string;
  title?: string;
  amount: number | string;
  discount_amount?: number | string;
  tax_amount?: number | string;
  total_amount: number | string;
  paid_amount?: number | string;
  status: InvoiceStatus;
  due_date: string;
  issued_at: string;
  paid_at?: string | null;
  notes?: string | null;
}

interface PaymentDbRow {
  id: string;
  academy_id: string;
  invoice_id: string;
  membership_id: string;
  amount: number | string;
  currency: string;
  payment_method: PaymentMethod;
  status: PaymentStatus;
  reference_number?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
  rejection_reason?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  paid_at?: string | null;
  created_at: string;
}

/**
 * 4. Fetch Invoices for an Academy
 */
export async function fetchAcademyInvoices(academyId: string): Promise<Invoice[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('invoices')
    .select('*')
    .eq('academy_id', academyId)
    .order('due_date', { ascending: false });

  if (error) throw parseAppError(error);

  return ((data as InvoiceDbRow[]) || []).map((row) => ({
    id: row.id,
    academyId: row.academy_id,
    membershipId: row.membership_id,
    feePlanId: row.fee_plan_id,
    invoiceNumber: row.invoice_number,
    title: row.title || 'Academy Fee',
    amount: Number(row.amount),
    discountAmount: Number(row.discount_amount || 0),
    taxAmount: Number(row.tax_amount || 0),
    totalAmount: Number(row.total_amount),
    paidAmount: Number(row.paid_amount || 0),
    status: row.status,
    dueDate: row.due_date,
    issuedAt: row.issued_at,
    paidAt: row.paid_at || null,
    notes: row.notes || null,
  }));
}

/**
 * 5. Fetch Payments for an Invoice
 */
export async function fetchInvoicePayments(invoiceId: string): Promise<Payment[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false });

  if (error) throw parseAppError(error);

  return ((data as PaymentDbRow[]) || []).map((row) => ({
    id: row.id,
    academyId: row.academy_id,
    invoiceId: row.invoice_id,
    membershipId: row.membership_id,
    amount: Number(row.amount),
    currency: row.currency,
    paymentMethod: row.payment_method,
    status: row.status,
    referenceNumber: row.reference_number || null,
    receiptUrl: row.receipt_url || null,
    notes: row.notes || null,
    rejectionReason: row.rejection_reason || null,
    verifiedBy: row.verified_by || null,
    verifiedAt: row.verified_at || null,
    paidAt: row.paid_at || null,
    createdAt: row.created_at,
  }));
}
