import { parseAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { STUDENT_MONTHLY_FEE_AMOUNT } from './studentFeeStore';

export interface FeeRecoveryItem {
  claimId: string;
  invoiceId: string; // for backward compatibility with UI identifier expectations
  invoiceNumber: string;
  studentUserId: string;
  membershipId: string;
  studentName: string;
  studentEmail: string;
  phone?: string;
  batchName?: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate: string;
  daysOverdue: number;
  status: 'pending' | 'confirmed' | 'dismissed';
  urgency: 'due_today' | 'overdue' | 'long_overdue';
}

export interface RecordManualPaymentInput {
  academyId: string;
  studentUserId?: string;
  invoiceId?: string; // fallback if studentUserId passed as invoiceId
  amount: number;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
}

/**
 * 1. Record Manual Cash / Offline Payment (Staff & Owner Flow)
 * Writes directly into production platform_subscription_payments and confirms pending claims.
 */
export async function recordManualPayment(input: RecordManualPaymentInput) {
  const userId = input.studentUserId || input.invoiceId;
  if (!userId) {
    throw new Error('Missing student user ID for recording payment');
  }

  const periodMonth = `${new Date().toISOString().slice(0, 7)}-01`;
  const paidOn = new Date().toISOString().slice(0, 10);

  // 1. Insert/upsert into platform_subscription_payments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: paymentError } = await (supabase as any)
    .from('platform_subscription_payments')
    .upsert(
      {
        user_id: userId,
        amount_paise: Math.round(input.amount * 100),
        period_month: periodMonth,
        paid_on: paidOn,
        method: input.paymentMethod || 'cash',
        notes: input.notes || 'Cash collected on ground',
      },
      { onConflict: 'user_id,period_month' },
    );

  if (paymentError) throw parseAppError(paymentError);

  // 2. Resolve any pending claim
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('platform_subscription_claims')
    .update({
      status: 'confirmed',
      resolved_at: new Date().toISOString(),
    })
    .match({ user_id: userId, period_month: periodMonth });
}

/**
 * 2. Fetch Fee Recovery items aggregated from live platform_subscription_claims
 * joined with academy members & profiles for the given academy.
 */
export async function fetchFeeRecoveryItems(academyId: string): Promise<FeeRecoveryItem[]> {
  const memberMap = new Map<
    string,
    { id: string; userId: string; name: string; email: string; phone?: string; batchName?: string }
  >();

  // Fetch all active academy members and their profiles & batches
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberRows, error: memberError } = await (supabase as any)
    .from('academy_members')
    .select(
      'id, user_id, profiles!academy_members_user_id_fkey!inner(full_name, email, avatar_url, phone), batch_members(batches(id, name))',
    )
    .eq('academy_id', academyId);

  if (memberError) {
    throw parseAppError(memberError);
  }

  for (const m of memberRows || []) {
    const info = {
      id: m.id,
      userId: m.user_id,
      name: m.profiles?.full_name || m.profiles?.email || 'Player',
      email: m.profiles?.email || '',
      phone: m.profiles?.phone || undefined,
      batchName: m.batch_members?.[0]?.batches?.name,
    };
    memberMap.set(m.id, info);
    if (m.user_id) {
      memberMap.set(m.user_id, info);
    }
  }

  // Fetch pending platform subscription claims
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: claims, error: claimsError } = await (supabase as any)
    .from('platform_subscription_claims')
    .select('id, user_id, period_month, payer_phone, note, status, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (claimsError) {
    throw parseAppError(claimsError);
  }

  const todayStr = new Date().toISOString().split('T')[0] ?? '';
  const nowMs = Date.now();
  const recoveryItems: FeeRecoveryItem[] = [];

  for (const claim of claims || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let noteData: Record<string, any> = {};
    if (claim.note) {
      try {
        noteData = JSON.parse(claim.note);
      } catch {
        noteData = {};
      }
    }

    // Filter by academy association
    if (noteData.academyId && noteData.academyId !== academyId) {
      continue;
    }
    if (!noteData.academyId && memberMap.size > 0 && !memberMap.has(claim.user_id)) {
      continue;
    }

    const member =
      memberMap.get(claim.user_id) ||
      Array.from(memberMap.values()).find((m) => m.email === noteData.studentEmail);

    const amount =
      typeof noteData.amount === 'number' && noteData.amount > 0
        ? noteData.amount
        : STUDENT_MONTHLY_FEE_AMOUNT;

    const dueDate = claim.period_month || claim.created_at?.slice(0, 10) || todayStr;
    const dueTime = new Date(dueDate).getTime();
    const daysOverdue = Math.max(0, Math.floor((nowMs - dueTime) / 86400000));
    const isDueToday = dueDate.startsWith(todayStr.slice(0, 7)) || dueDate === todayStr;

    let urgency: 'due_today' | 'overdue' | 'long_overdue' = 'overdue';
    if (isDueToday) urgency = 'due_today';
    else if (daysOverdue > 30) urgency = 'long_overdue';

    recoveryItems.push({
      claimId: claim.id,
      invoiceId: claim.id,
      invoiceNumber: `CLAIM-${claim.id.slice(0, 8).toUpperCase()}`,
      studentUserId: claim.user_id,
      membershipId: member?.id || claim.user_id,
      studentName: noteData.studentName || member?.name || 'Player',
      studentEmail: noteData.studentEmail || member?.email || '',
      phone: claim.payer_phone || member?.phone,
      batchName: member?.batchName || 'General Squad',
      totalAmount: amount,
      paidAmount: 0,
      balanceAmount: amount,
      dueDate,
      daysOverdue,
      status: 'pending',
      urgency,
    });
  }

  return recoveryItems.sort((a, b) => b.daysOverdue - a.daysOverdue);
}
