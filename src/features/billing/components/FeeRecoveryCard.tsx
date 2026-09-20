import { useState } from 'react';
import { IndianRupee, MessageSquare, Check, Copy, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui';
import { useUiStore } from '@/stores';
import type { FeeRecoveryItem } from '../api/billingApi';
import { FAMPAY_UPI_ID } from '../api/studentFeeStore';

interface FeeRecoveryCardProps {
  item: FeeRecoveryItem;
  academyName: string;
  onRecordCash: (item: FeeRecoveryItem) => void;
  onMarkPaid: (item: FeeRecoveryItem) => void;
}

export function FeeRecoveryCard({
  item,
  academyName,
  onRecordCash,
  onMarkPaid: _onMarkPaid,
}: FeeRecoveryCardProps) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [hasCopiedUpi, setHasCopiedUpi] = useState(false);

  const cleanPhone = (item.phone || '').replace(/[^0-9]/g, '');
  const upiIntentUrl = `upi://pay?pa=${FAMPAY_UPI_ID}&pn=${encodeURIComponent(
    academyName,
  )}&am=${item.balanceAmount}&cu=INR&tn=${encodeURIComponent(`Fee for ${item.studentName}`)}`;

  const reminderMessage = `Dear Parent, reminder from ${academyName}: ₹${item.balanceAmount.toLocaleString(
    'en-IN',
  )} academy fee is pending for ${item.studentName}${
    item.daysOverdue > 0 ? ` (${item.daysOverdue} days overdue)` : ''
  }. Pay easily via UPI: ${upiIntentUrl}`;

  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`}?text=${encodeURIComponent(
        reminderMessage,
      )}`
    : `https://wa.me/?text=${encodeURIComponent(reminderMessage)}`;

  const handleCopyUpiLink = async () => {
    try {
      await navigator.clipboard.writeText(upiIntentUrl);
      setHasCopiedUpi(true);
      pushToast({ title: 'UPI payment link copied to clipboard', variant: 'success' });
      setTimeout(() => setHasCopiedUpi(false), 2000);
    } catch {
      pushToast({ title: 'Failed to copy link', variant: 'error' });
    }
  };

  const isLongOverdue = item.urgency === 'long_overdue';
  const isDueToday = item.urgency === 'due_today';

  return (
    <div
      className={`flex flex-col justify-between gap-3.5 rounded-2xl border p-4 transition-all sm:flex-row sm:items-center ${
        isLongOverdue
          ? 'border-rose-500/40 bg-rose-500/5 dark:bg-rose-950/20'
          : isDueToday
            ? 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20'
            : 'border-border-subtle bg-surface hover:border-border-strong'
      }`}
    >
      {/* Student & Debt Info */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-fg truncate font-sans text-sm font-extrabold">
            {item.studentName}
          </span>
          {item.batchName && (
            <span className="border-border-subtle bg-surface-container-low text-fg-muted py-0.2 rounded-md border px-2 font-mono text-[10px] font-bold">
              {item.batchName}
            </span>
          )}
          {isLongOverdue ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 font-mono text-[10px] font-black text-white uppercase">
              <AlertTriangle className="h-3 w-3" />
              {item.daysOverdue}d Overdue
            </span>
          ) : isDueToday ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 font-mono text-[10px] font-black text-white uppercase">
              <Clock className="h-3 w-3" />
              Due Today
            </span>
          ) : (
            <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-black text-rose-700 uppercase dark:text-rose-300">
              {item.daysOverdue}d Overdue
            </span>
          )}
        </div>

        <div className="text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span>Inv #{item.invoiceNumber}</span>
          {item.phone && <span className="font-mono">📱 {item.phone}</span>}
          {item.studentEmail && <span className="truncate">✉️ {item.studentEmail}</span>}
        </div>
      </div>

      {/* Financial Numbers & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <div className="text-left sm:text-right">
          <span className="text-fg-muted block text-[10px] font-bold tracking-wider uppercase">
            Balance Due
          </span>
          <span className="font-mono text-lg font-black text-rose-600 sm:text-xl dark:text-rose-400">
            ₹{item.balanceAmount.toLocaleString('en-IN')}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 1-Click WhatsApp Reminder */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 min-h-[36px] items-center gap-1.5 rounded-xl border-emerald-600/30 bg-emerald-600 px-3 text-xs font-black text-white shadow-xs transition-transform hover:bg-emerald-700 active:scale-95"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>WhatsApp Nudge</span>
          </a>

          {/* Quick Cash Logger */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onRecordCash(item)}
            className="border-border-subtle bg-surface text-fg h-9 min-h-[36px] rounded-xl px-3 text-xs font-bold transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-700 active:scale-95 dark:hover:text-emerald-300"
          >
            <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
            <span>Record Cash</span>
          </Button>

          {/* Copy Direct UPI Deep-Link */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleCopyUpiLink()}
            className="text-fg-muted hover:text-fg h-9 w-9 rounded-xl p-0"
            title="Copy UPI Deep Link"
          >
            {hasCopiedUpi ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
