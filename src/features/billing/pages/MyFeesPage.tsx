import { IndianRupee, QrCode, CheckCircle2 } from 'lucide-react';

import { Card, CardBody, CardHeader, Badge } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { useActiveAcademy, useAcademy } from '@/features/academies';
import { formatPaise } from '@/lib/utils/money';
import { usePlayerFeeDetail } from '../hooks/useBilling';
import { toPeriodMonth } from '../api/billingApi';

/**
 * Player-facing "Pay Fees" page. Shows what the player owes this month, the
 * academy owner's UPI QR code to pay it (uploaded on Academy Settings), and
 * the player's own payment history. Read-only: the player pays the owner
 * directly through their own UPI app, then the owner marks it paid on their
 * side (`/fees/:memberId`) -- nothing here moves money or writes a payment.
 */
export default function MyFeesPage() {
  const { academyId, membership } = useActiveAcademy();
  const playerId = membership?.role === 'player' ? membership.id : null;

  const academyQuery = useAcademy(academyId);
  const detailQuery = usePlayerFeeDetail(academyId, playerId);

  if (membership && membership.role !== 'player') {
    return (
      <div className="space-y-4">
        <h1 className="text-fg text-xl font-semibold">Pay Fees</h1>
        <EmptyState
          title="Pay Fees is for players"
          description="You're not signed in as a player on this academy."
        />
      </div>
    );
  }

  if (detailQuery.isPending || academyQuery.isPending) {
    return <p className="text-fg-muted">Loading your fees…</p>;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />;
  }

  const detail = detailQuery.data;
  const academy = academyQuery.data;

  const currentPeriod = toPeriodMonth(new Date());
  const paidThisMonthPaise = detail.payments
    .filter((p) => p.periodMonth === currentPeriod)
    .reduce((sum, p) => sum + p.amountPaise, 0);
  const monthlyFeePaise = detail.monthlyFeePaise;
  const isPaid = monthlyFeePaise !== null && paidThisMonthPaise >= monthlyFeePaise;
  const monthLabel = new Date(`${currentPeriod}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div>
        <h1 className="text-fg text-2xl font-bold tracking-tight">Pay Fees</h1>
        <p className="text-fg-muted mt-1 text-sm">{membership?.academyName ?? 'Academy'}</p>
      </div>

      {/* Prominent due/status banner */}
      <Card className={isPaid ? 'border-success/40' : 'border-warning/40'}>
        <CardBody className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                isPaid ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
              }`}
            >
              {isPaid ? <CheckCircle2 className="h-6 w-6" /> : <IndianRupee className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-fg-muted text-xs font-semibold tracking-wider uppercase">
                {monthLabel}
              </p>
              {monthlyFeePaise === null ? (
                <p className="text-fg text-lg font-bold">Fee not set yet</p>
              ) : (
                <p className="text-fg text-xl font-bold tracking-tight">
                  {formatPaise(monthlyFeePaise)}{' '}
                  <span className="text-fg-muted text-sm font-normal">/ month</span>
                </p>
              )}
            </div>
          </div>
          {monthlyFeePaise !== null && (
            <Badge tone={isPaid ? 'success' : 'warning'}>{isPaid ? 'Paid' : 'Unpaid'}</Badge>
          )}
        </CardBody>
      </Card>

      {/* QR code to pay */}
      <Card>
        <CardHeader
          title="Scan to Pay"
          description="Pay directly to your academy owner via UPI. The app doesn't handle this payment -- once you've paid, ask them to mark it received."
        />
        <CardBody>
          {academy?.paymentQrUrl ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <img
                src={academy.paymentQrUrl}
                alt="Scan to pay your academy fees"
                className="border-border-subtle h-56 w-56 shrink-0 rounded-2xl border bg-white object-contain p-2"
              />
              <div className="space-y-2 text-center sm:text-left">
                {monthlyFeePaise !== null && (
                  <p className="text-fg text-lg font-semibold">
                    Amount: {formatPaise(monthlyFeePaise)}
                  </p>
                )}
                {academy.paymentNote && (
                  <p className="text-fg-muted text-sm">{academy.paymentNote}</p>
                )}
                <p className="text-fg-muted text-xs">
                  Open any UPI app (Google Pay, PhonePe, FamPay, etc.), scan this code, and enter
                  the amount above.
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<QrCode className="h-8 w-8" />}
              title="No payment QR code yet"
              description="Your academy owner hasn't added a payment QR code yet. Check back later or ask them directly."
            />
          )}
        </CardBody>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader
          title="Payment History"
          description="Payments your academy owner has recorded."
        />
        <CardBody>
          {detail.payments.length === 0 ? (
            <p className="text-fg-muted">No payments recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {detail.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="border-border-subtle flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                >
                  <div>
                    <p className="text-fg font-medium">{formatPaise(payment.amountPaise)}</p>
                    <p className="text-fg-muted text-xs">
                      For{' '}
                      {new Date(`${payment.periodMonth}T00:00:00Z`).toLocaleDateString(undefined, {
                        month: 'long',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}{' '}
                      • Paid on{' '}
                      {new Date(`${payment.paidOn}T00:00:00Z`).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </p>
                  </div>
                  {payment.method && <Badge tone="neutral">{payment.method}</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
