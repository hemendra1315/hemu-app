import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search, IndianRupee, X } from 'lucide-react';

import { Button, Modal } from '@/components/ui';
import { ErrorState, EmptyState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { useUiStore } from '@/stores';
import {
  fetchFeeRecoveryItems,
  recordManualPayment,
  type FeeRecoveryItem,
} from '../api/billingApi';
import { FeeRecoveryCard } from '../components/FeeRecoveryCard';

export default function FeeRecoveryInboxPage() {
  const navigate = useNavigate();
  const { academyId, membership } = useActiveAcademy();
  const pushToast = useUiStore((s) => s.pushToast);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'all' | 'due_today' | 'overdue' | 'long_overdue'>(
    'all',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [cashModalItem, setCashModalItem] = useState<FeeRecoveryItem | null>(null);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cashNotes, setCashNotes] = useState('');

  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['fee-recovery-items', academyId],
    enabled: Boolean(academyId),
    queryFn: () => fetchFeeRecoveryItems(academyId as string),
    staleTime: 15 * 1000,
  });

  const recordCashMutation = useMutation({
    mutationFn: (input: {
      studentUserId: string;
      invoiceId?: string;
      amount: number;
      notes?: string;
    }) =>
      recordManualPayment({
        academyId: academyId as string,
        studentUserId: input.studentUserId,
        invoiceId: input.invoiceId,
        amount: input.amount,
        paymentMethod: 'cash',
        referenceNumber: `CASH-${Date.now().toString().slice(-6)}`,
        notes: input.notes || 'Cash collected on ground',
      }),
    onSuccess: () => {
      pushToast({ title: 'Cash payment recorded successfully', variant: 'success' });
      setCashModalItem(null);
      void queryClient.invalidateQueries({ queryKey: ['fee-recovery-items', academyId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['student-fee'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast({ title: 'Failed to record cash', description: msg, variant: 'error' });
    },
  });

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.phone && item.phone.includes(searchQuery)) ||
        item.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'due_today' && item.urgency === 'due_today') ||
        (activeTab === 'overdue' && item.urgency === 'overdue') ||
        (activeTab === 'long_overdue' && item.urgency === 'long_overdue');

      return matchesSearch && matchesTab;
    });
  }, [items, searchQuery, activeTab]);

  const summary = useMemo(() => {
    let totalOverdue = 0;
    let dueTodayCount = 0;
    let overdueCount = 0;
    let longOverdueCount = 0;

    for (const item of items) {
      totalOverdue += item.balanceAmount;
      if (item.urgency === 'due_today') dueTodayCount++;
      else if (item.urgency === 'long_overdue') longOverdueCount++;
      else overdueCount++;
    }

    return {
      totalOverdue,
      totalCount: items.length,
      dueTodayCount,
      overdueCount,
      longOverdueCount,
    };
  }, [items]);

  const handleOpenCashModal = (item: FeeRecoveryItem) => {
    setCashModalItem(item);
    setCashAmount(item.balanceAmount);
    setCashNotes(`Cash received on pitch for ${item.studentName}`);
  };

  const handleConfirmCashPayment = () => {
    if (!cashModalItem || cashAmount <= 0) return;
    recordCashMutation.mutate({
      studentUserId: cashModalItem.studentUserId,
      invoiceId: cashModalItem.invoiceId,
      amount: cashAmount,
      notes: cashNotes,
    });
  };

  if (!academyId) {
    return (
      <EmptyState
        title="No academy selected"
        description="Select an academy to view fee recovery."
      />
    );
  }

  return (
    <div className="space-y-4 pb-28 md:pb-8">
      {/* 1. Header with Back Navigation & Debt Overview */}
      <div className="border-border-subtle/80 flex flex-col gap-3 border-b pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate(-1)}
              className="border-border-subtle bg-surface text-fg hover:bg-surface-muted flex h-10 w-10 items-center justify-center rounded-xl border font-bold shadow-xs transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-fg font-heading text-xl font-black tracking-tight uppercase md:text-2xl">
                  Fee Recovery Inbox
                </h1>
                <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-[11px] font-black text-rose-700 uppercase dark:text-rose-300">
                  {summary.totalCount} Unpaid
                </span>
              </div>
              <p className="text-fg-muted font-sans text-xs font-semibold">
                Recover overdue academy dues via instant WhatsApp reminders & ground cash
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-1.5 text-right">
              <span className="block text-[10px] font-extrabold tracking-wider text-rose-800 uppercase dark:text-rose-200">
                Total Overdue Debt
              </span>
              <span className="font-mono text-lg font-black text-rose-600 dark:text-rose-400">
                ₹{summary.totalOverdue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Filter Tabs Strip */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="text-fg-muted absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, phone or invoice..."
              className="border-border-subtle bg-surface-container-low text-fg placeholder:text-fg-muted/60 focus:border-primary h-10 w-full rounded-xl border py-2 pr-8 pl-8 font-sans text-xs focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-fg-muted hover:text-fg absolute top-1/2 right-3 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold transition-all ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900'
                  : 'border-border-subtle bg-surface text-fg hover:bg-surface-muted border'
              }`}
            >
              <span>All ({summary.totalCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('due_today')}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold transition-all ${
                activeTab === 'due_today'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'border-border-subtle bg-surface text-fg hover:bg-surface-muted border'
              }`}
            >
              <span>Due Today ({summary.dueTodayCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('overdue')}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold transition-all ${
                activeTab === 'overdue'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'border-border-subtle bg-surface text-fg hover:bg-surface-muted border'
              }`}
            >
              <span>1–30d ({summary.overdueCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('long_overdue')}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold transition-all ${
                activeTab === 'long_overdue'
                  ? 'bg-rose-800 text-white shadow-xs'
                  : 'border-border-subtle bg-surface text-fg hover:bg-surface-muted border'
              }`}
            >
              <span>30d+ ({summary.longOverdueCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Recovery List Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="border-border-subtle bg-surface h-24 animate-pulse rounded-2xl border"
            />
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No matching defaulters' : 'Zero overdue fees'}
          description={
            searchQuery
              ? 'Try searching with a different name or phone number.'
              : 'All students are up to date on their academy fees!'
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <FeeRecoveryCard
              key={item.invoiceId}
              item={item}
              academyName={membership?.academyName || 'Cricket Academy'}
              onRecordCash={handleOpenCashModal}
              onMarkPaid={handleOpenCashModal}
            />
          ))}
        </div>
      )}

      {/* 4. Quick Cash Collection Modal */}
      {cashModalItem && (
        <Modal
          open={Boolean(cashModalItem)}
          onClose={() => setCashModalItem(null)}
          title="Record Ground Cash Payment"
        >
          <div className="space-y-4 p-1">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Recording cash received from{' '}
                <strong className="font-black">{cashModalItem.studentName}</strong>
              </p>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                Invoice #{cashModalItem.invoiceNumber} · Balance Due: ₹
                {cashModalItem.balanceAmount.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-fg block text-xs font-extrabold uppercase">
                Amount Received (₹)
              </label>
              <div className="relative">
                <IndianRupee className="text-fg-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <input
                  type="number"
                  min={1}
                  max={cashModalItem.balanceAmount * 2}
                  className="border-border-subtle bg-surface-container-low text-fg h-11 w-full rounded-xl border py-2 pr-4 pl-9 font-mono text-base font-black focus:border-emerald-600 focus:outline-none"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-fg block text-xs font-extrabold uppercase">
                Payment Notes / Reference
              </label>
              <input
                type="text"
                className="border-border-subtle bg-surface-container-low text-fg h-10 w-full rounded-xl border px-3 text-xs font-medium focus:border-emerald-600 focus:outline-none"
                value={cashNotes}
                onChange={(e) => setCashNotes(e.target.value)}
                placeholder="e.g. Handed to coach on turf"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="ghost"
                onClick={() => setCashModalItem(null)}
                className="h-10 text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmCashPayment}
                isLoading={recordCashMutation.isPending}
                className="h-10 bg-emerald-600 px-5 text-xs font-black text-white shadow-xs hover:bg-emerald-700 active:scale-95"
              >
                Confirm Cash Received
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
