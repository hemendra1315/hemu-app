import { useState } from 'react';
import { IndianRupee, QrCode, CheckCircle2, Clock, X } from 'lucide-react';

import { Card, CardBody, CardHeader, Badge, Button, Input, Textarea } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { useActiveAcademy, useAcademy } from '@/features/academies';
import { useLinkedChildren } from '@/features/parents/hooks/useParents';
import { useTestModeStore, useUiStore } from '@/stores';
import { errorMessage } from '@/lib/api';
import { formatPaise } from '@/lib/utils/money';
import type { UUID } from '@/types';
import {
  usePlayerFeeDetail,
  useSubmitFeePaymentClaim,
  useWithdrawFeePaymentClaim,
} from '../hooks/useBilling';
import { toPeriodMonth } from '../api/billingApi';

/**
 * "Pay Fees" page for players and (viewing a linked child's fees)
 * parents. Shows what's owed this month, the academy owner's UPI QR code to
 * pay it (uploaded on Academy Settings), and the payment history. Read-only:
 * the player/parent pays the owner directly through their own UPI app, then
 * the owner marks it paid on their side (`/fees/:memberId`) -- nothing here
 * moves money or writes a payment.
 */
export default function MyFeesPage() {
  const { academyId, membership } = useActiveAcademy();
  const testModeRole = useTestModeStore((s) => s.activeRole);

  const role = testModeRole
    ? testModeRole === 'student'
      ? 'player'
      : testModeRole
    : (membership?.role ?? 'player');

  const isParent = role === 'parent';

  const playerId = membership?.role === 'player' ? membership.id : null;

  // Parents don't have their own player row -- same linked-child pattern
  // used on the Stats page: pick from whichever children are linked to
  // this parent's account.
  const linkedChildrenQuery = useLinkedChildren(isParent ? (academyId ?? undefined) : undefined);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const children = linkedChildrenQuery.data ?? [];
  const activeChild = children.find((c) => c.player.id === selectedChildId) ?? children[0];
  const childPlayerId = activeChild?.player.id ?? null;

  const resolvedPlayerId = isParent ? childPlayerId : playerId;

  const academyQuery = useAcademy(academyId);
  const detailQuery = usePlayerFeeDetail(academyId, resolvedPlayerId);
  const pushToast = useUiStore((s) => s.pushToast);
  // Only a real player can submit their own claim -- RLS's insert policy
  // checks `player_id = my_player_id(academy_id)`, which resolves to the
  // *caller's own* academy_members row, so a parent's account can never
  // satisfy it on a linked child's behalf. The claim UI below is hidden
  // entirely for parents rather than showing a button that would just fail.
  const submitClaim = useSubmitFeePaymentClaim(
    (academyId ?? 'none') as UUID,
    (resolvedPlayerId ?? 'none') as UUID,
  );
  const withdrawClaim = useWithdrawFeePaymentClaim(
    (academyId ?? 'none') as UUID,
    (resolvedPlayerId ?? 'none') as UUID,
  );
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [payerPhone, setPayerPhone] = useState('');
  const [claimNote, setClaimNote] = useState('');

  if (membership && role !== 'player' && !isParent) {
    return (
      <div className="space-y-4">
        <h1 className="text-fg text-xl font-semibold">Pay Fees</h1>
        <EmptyState
          title="Pay Fees is for players and parents"
          description="You're not signed in as a player or parent on this academy."
        />
      </div>
    );
  }

  if (isParent && linkedChildrenQuery.isPending) {
    return <p className="text-fg-muted">Loading…</p>;
  }

  if (isParent && linkedChildrenQuery.isError) {
    return (
      <ErrorState
        error={linkedChildrenQuery.error}
        onRetry={() => void linkedChildrenQuery.refetch()}
      />
    );
  }

  if (isParent && children.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-fg text-xl font-semibold">Pay Fees</h1>
        <EmptyState
          title="No child linked yet"
          description="Link a child from your dashboard to see their fees here."
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
  const pendingClaim = detail.claims.find(
    (c) => c.periodMonth === currentPeriod && c.status === 'pending',
  );

  const handleSubmitClaim = async () => {
    if (!academyId || !resolvedPlayerId) return;
    const phone = payerPhone.trim();
    if (!phone) {
      pushToast({ title: 'Enter the phone number you paid from', variant: 'error' });
      return;
    }
    try {
      await submitClaim.mutateAsync({
        periodMonth: currentPeriod,
        payerPhone: phone,
        note: claimNote.trim() || null,
      });
      pushToast({
        title: 'Marked as paid',
        description: "Your academy owner will confirm it once it's checked against their payment.",
        variant: 'success',
      });
      setShowClaimForm(false);
      setPayerPhone('');
      setClaimNote('');
    } catch (err) {
      pushToast({ title: 'Failed to submit', description: errorMessage(err), variant: 'error' });
    }
  };

  const handleWithdrawClaim = async () => {
    if (!pendingClaim) return;
    try {
      await withdrawClaim.mutateAsync(pendingClaim.id);
      pushToast({ title: 'Claim withdrawn', variant: 'success' });
    } catch (err) {
      pushToast({ title: 'Failed to withdraw', description: errorMessage(err), variant: 'error' });
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div>
        <h1 className="text-fg text-2xl font-bold tracking-tight">
          {isParent ? "Child's Fees" : 'Pay Fees'}
        </h1>
        <p className="text-fg-muted mt-1 text-sm">{membership?.academyName ?? 'Academy'}</p>
      </div>

      {isParent && children.length > 1 && (
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          {children.map((child) => (
            <button
              key={child.player.id}
              type="button"
              onClick={() => setSelectedChildId(child.player.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeChild?.player.id === child.player.id
                  ? 'bg-primary text-primary-fg'
                  : 'bg-surface hover:bg-surface-muted border'
              }`}
            >
              {child.player.fullName?.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Prominent due/status banner */}
      <Card
        className={
          isPaid ? 'border-success/40' : pendingClaim ? 'border-info/40' : 'border-warning/40'
        }
      >
        <CardBody className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                  isPaid
                    ? 'bg-success/10 text-success'
                    : pendingClaim
                      ? 'bg-info/10 text-info'
                      : 'bg-warning/10 text-warning'
                }`}
              >
                {isPaid ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : pendingClaim ? (
                  <Clock className="h-6 w-6" />
                ) : (
                  <IndianRupee className="h-6 w-6" />
                )}
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
            {monthlyFeePaise !== null &&
              (isPaid ? (
                <Badge tone="success">Paid</Badge>
              ) : pendingClaim ? (
                <Badge tone="neutral" className="border-info/30 bg-info/10 text-info">
                  Pending confirmation
                </Badge>
              ) : (
                <Badge tone="warning">Unpaid</Badge>
              ))}
          </div>

          {/* Only a real player can self-report a payment -- see the
              `submitClaim`/`withdrawClaim` comment above for why parents
              don't get this control. */}
          {!isParent && !isPaid && monthlyFeePaise !== null && pendingClaim && (
            <div className="border-info/30 bg-info/10 space-y-2 rounded-xl border p-3.5">
              <p className="text-fg text-sm">
                You said you paid from <strong>{pendingClaim.payerPhone}</strong>. Your academy
                owner will mark this paid once it's checked against their payment.
              </p>
              {pendingClaim.note && <p className="text-fg-muted text-xs">{pendingClaim.note}</p>}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-danger hover:bg-danger/10"
                isLoading={withdrawClaim.isPending}
                onClick={() => void handleWithdrawClaim()}
              >
                <X className="h-3.5 w-3.5" />
                <span>Withdraw</span>
              </Button>
            </div>
          )}

          {!isParent && !isPaid && monthlyFeePaise !== null && !pendingClaim && !showClaimForm && (
            <Button type="button" size="sm" onClick={() => setShowClaimForm(true)}>
              I've Paid
            </Button>
          )}

          {!isParent && !isPaid && monthlyFeePaise !== null && !pendingClaim && showClaimForm && (
            <div className="border-border-subtle bg-surface-elevated/60 space-y-3 rounded-xl border p-3.5">
              <div className="space-y-1.5">
                <label className="text-fg block text-sm font-medium">
                  Phone number you paid from
                </label>
                <Input
                  type="tel"
                  value={payerPhone}
                  onChange={(e) => setPayerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                />
                <p className="text-fg-muted text-xs">
                  So your academy owner can match it to the payment in their UPI app.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-fg block text-sm font-medium">Note (optional)</label>
                <Textarea
                  value={claimNote}
                  onChange={(e) => setClaimNote(e.target.value)}
                  rows={2}
                  placeholder="Anything that helps them find your payment"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowClaimForm(false);
                    setPayerPhone('');
                    setClaimNote('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  isLoading={submitClaim.isPending}
                  onClick={() => void handleSubmitClaim()}
                >
                  Submit
                </Button>
              </div>
            </div>
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
