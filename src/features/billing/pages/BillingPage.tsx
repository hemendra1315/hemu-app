import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, IndianRupee } from 'lucide-react';

import { ErrorState, EmptyState } from '@/components/feedback';
import { Badge } from '@/components/ui';
import { MobilePageHeader } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { formatPaise } from '@/lib/utils/money';
import { toPeriodMonth } from '../api/billingApi';
import { useFeeSummaries } from '../hooks/useBilling';

function monthLabel(periodMonth: string): string {
  // `periodMonth` is a plain `YYYY-MM-01` date -- parsed as UTC so the label
  // can't drift a day off in a timezone behind UTC.
  return new Date(`${periodMonth}T00:00:00Z`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function shiftMonth(periodMonth: string, delta: number): string {
  const parts = periodMonth.split('-').map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? 1;
  return toPeriodMonth(new Date(year, month - 1 + delta, 1));
}

export default function BillingPage() {
  const { academyId } = useActiveAcademy();
  const [periodMonth, setPeriodMonth] = useState(() => toPeriodMonth(new Date()));
  const summariesQuery = useFeeSummaries(academyId, periodMonth);

  const counts = useMemo(() => {
    const rows = summariesQuery.data ?? [];
    const paid = rows.filter((r) => r.isPaid).length;
    const noFeeSet = rows.filter((r) => r.monthlyFeePaise === null).length;
    return { paid, unpaid: rows.length - paid - noFeeSet, noFeeSet, total: rows.length };
  }, [summariesQuery.data]);

  if (!academyId) return null;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="md:hidden">
        <MobilePageHeader title="Fees" subtitle="Who's paid this month" />
      </div>
      <div className="hidden md:block">
        <h1 className="text-fg text-xl font-bold">Fees</h1>
        <p className="text-fg-muted text-sm">Track each player's monthly fee and payments.</p>
      </div>

      <div className="border-border-subtle bg-surface flex items-center justify-between gap-3 rounded-xl border p-3">
        <button
          type="button"
          onClick={() => setPeriodMonth((m) => shiftMonth(m, -1))}
          className="hover:bg-surface-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-fg text-sm font-bold">{monthLabel(periodMonth)}</p>
        <button
          type="button"
          onClick={() => setPeriodMonth((m) => shiftMonth(m, 1))}
          className="hover:bg-surface-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {summariesQuery.isPending ? (
        <p className="text-fg-muted text-center text-sm">Loading…</p>
      ) : summariesQuery.isError ? (
        <ErrorState error={summariesQuery.error} onRetry={() => void summariesQuery.refetch()} />
      ) : counts.total === 0 ? (
        <EmptyState
          icon={<IndianRupee className="h-8 w-8" aria-hidden />}
          title="No players yet"
          description="Players show up here once they join the academy."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone="success">{counts.paid} paid</Badge>
            <Badge tone="danger">{counts.unpaid} unpaid</Badge>
            {counts.noFeeSet > 0 ? (
              <Badge tone="neutral">{counts.noFeeSet} no fee set</Badge>
            ) : null}
          </div>

          <div className="border-border-subtle bg-surface divide-border-subtle divide-y overflow-hidden rounded-xl border">
            {(summariesQuery.data ?? []).map((row) => (
              <Link
                key={row.playerId}
                to={`/fees/${row.playerId}`}
                className="hover:bg-surface-muted flex items-center justify-between gap-3 p-3.5"
              >
                <div className="min-w-0">
                  <p className="text-fg truncate text-sm font-semibold">
                    {row.fullName ?? row.email}
                  </p>
                  <p className="text-fg-muted truncate text-xs">
                    {row.monthlyFeePaise !== null
                      ? `${formatPaise(row.monthlyFeePaise)}/month`
                      : 'No fee set'}
                  </p>
                  {!row.isPaid && row.pendingClaim && (
                    <p className="text-info mt-1 truncate text-xs font-medium">
                      <Clock className="mr-1 inline h-3 w-3" />
                      Says paid from {row.pendingClaim.payerPhone}
                    </p>
                  )}
                </div>
                {row.monthlyFeePaise === null ? (
                  <Badge tone="neutral" className="shrink-0">
                    Set fee
                  </Badge>
                ) : row.isPaid ? (
                  <Badge tone="success" className="shrink-0">
                    Paid
                  </Badge>
                ) : row.pendingClaim ? (
                  <Badge tone="neutral" className="border-info/30 bg-info/10 text-info shrink-0">
                    Pending
                  </Badge>
                ) : (
                  <Badge tone="danger" className="shrink-0">
                    Unpaid
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
