import { useState } from 'react';
import { IndianRupee, QrCode, CheckCircle2, Sparkles, Clock, X } from 'lucide-react';

import { Card, CardBody, CardHeader, Badge, Button, Input, Textarea } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/lib/api';
import { formatPaise } from '@/lib/utils/money';
import { useUiStore } from '@/stores';
import {
  useMySubscriptionStatus,
  useSubmitSubscriptionClaim,
  useWithdrawSubscriptionClaim,
} from '../hooks/usePlatformBilling';
import { toPeriodMonth } from '../api/platformBillingApi';

/**
 * "My Subscription" -- shown to every signed-in user (any role). Separate
 * from the academy-level "Pay Fees" page: that one is a player paying their
 * academy owner, this one is every user paying the app's creator. Read-only:
 * the user pays the app creator directly via UPI, and the app creator marks
 * it received from their own private admin view -- nothing here moves money.
 */
export default function MySubscriptionPage() {
  const { profile } = useAuth();
  const pushToast = useUiStore((s) => s.pushToast);
  const statusQuery = useMySubscriptionStatus(profile?.id ?? null);
  const submitClaim = useSubmitSubscriptionClaim();
  const withdrawClaim = useWithdrawSubscriptionClaim();

  const [showClaimForm, setShowClaimForm] = useState(false);
  const [payerPhone, setPayerPhone] = useState('');
  const [claimNote, setClaimNote] = useState('');

  if (profile?.isSuperAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-fg text-xl font-semibold">My Subscription</h1>
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title="You're the app creator"
          description="This page is for other users paying you. See the Subscriptions tab in the Super Admin panel to track who's paid."
        />
      </div>
    );
  }

  if (statusQuery.isPending) {
    return <p className="text-fg-muted">Loading your subscription…</p>;
  }

  if (statusQuery.isError || !statusQuery.data) {
    return <ErrorState error={statusQuery.error} onRetry={() => void statusQuery.refetch()} />;
  }

  const { settings, payments, claims } = statusQuery.data;
  const currentPeriod = toPeriodMonth(new Date());
  const paidThisMonthPaise = payments
    .filter((p) => p.periodMonth === currentPeriod)
    .reduce((sum, p) => sum + p.amountPaise, 0);
  // Any recorded payment counts as paid -- not a threshold against the
  // *current* monthly amount, which can change after the payment was
  // recorded (see the matching comment in platformBillingApi.ts).
  const isPaid = paidThisMonthPaise > 0;
  const monthLabel = new Date(`${currentPeriod}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const pendingClaim = claims.find(
    (c) => c.periodMonth === currentPeriod && c.status === 'pending',
  );

  const handleSubmitClaim = async () => {
    if (!profile?.id) return;
    const phone = payerPhone.trim();
    if (!phone) {
      pushToast({ title: 'Enter the phone number you paid from', variant: 'error' });
      return;
    }
    try {
      await submitClaim.mutateAsync({
        userId: profile.id,
        input: { periodMonth: currentPeriod, payerPhone: phone, note: claimNote.trim() || null },
      });
      pushToast({
        title: 'Marked as paid',
        description: "We'll confirm it once it's checked against your payment.",
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
        <h1 className="text-fg text-2xl font-bold tracking-tight">My Subscription</h1>
        <p className="text-fg-muted mt-1 text-sm">Your app subscription with CyberMentors.</p>
      </div>

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
                <p className="text-fg text-xl font-bold tracking-tight">
                  {formatPaise(settings.monthlyFeePaise)}{' '}
                  <span className="text-fg-muted text-sm font-normal">/ month</span>
                </p>
              </div>
            </div>
            {isPaid ? (
              <Badge tone="success">Paid</Badge>
            ) : pendingClaim ? (
              <Badge tone="neutral" className="border-info/30 bg-info/10 text-info">
                Pending confirmation
              </Badge>
            ) : (
              <Badge tone="warning">Unpaid</Badge>
            )}
          </div>

          {!isPaid && pendingClaim && (
            <div className="border-info/30 bg-info/10 space-y-2 rounded-xl border p-3.5">
              <p className="text-fg text-sm">
                You said you paid from <strong>{pendingClaim.payerPhone}</strong>. We'll mark this
                paid once it's checked against your payment.
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

          {!isPaid && !pendingClaim && !showClaimForm && (
            <Button type="button" size="sm" onClick={() => setShowClaimForm(true)}>
              I've Paid
            </Button>
          )}

          {!isPaid && !pendingClaim && showClaimForm && (
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
                  So we can match it to the payment in our UPI app.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-fg block text-sm font-medium">Note (optional)</label>
                <Textarea
                  value={claimNote}
                  onChange={(e) => setClaimNote(e.target.value)}
                  rows={2}
                  placeholder="Anything that helps us find your payment"
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

      <Card>
        <CardHeader
          title="Scan to Pay"
          description="Pay the app's monthly subscription directly via UPI. The app doesn't handle this payment -- once you've paid, it'll be marked received on our side."
        />
        <CardBody>
          {settings.paymentQrUrl ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <img
                src={settings.paymentQrUrl}
                alt="Scan to pay your app subscription"
                className="border-border-subtle h-56 w-56 shrink-0 rounded-2xl border bg-white object-contain p-2"
              />
              <div className="space-y-2 text-center sm:text-left">
                <p className="text-fg text-lg font-semibold">
                  Amount: {formatPaise(settings.monthlyFeePaise)}
                </p>
                {settings.paymentNote && (
                  <p className="text-fg-muted text-sm">{settings.paymentNote}</p>
                )}
                <p className="text-fg-muted text-xs">
                  Open any UPI app, scan this code, and enter the amount above.
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<QrCode className="h-8 w-8" />}
              title="No payment QR code yet"
              description="The app creator hasn't added a payment QR code yet. Check back later."
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Payment History" description="Payments recorded on your account." />
        <CardBody>
          {payments.length === 0 ? (
            <p className="text-fg-muted">No payments recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
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
