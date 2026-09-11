import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Clock, Pencil, Plus, Trash2, X } from 'lucide-react';

import { ErrorState, EmptyState } from '@/components/feedback';
import { Avatar, Button, Card, CardBody, CardHeader, Input, Textarea } from '@/components/ui';
import { MobilePageHeader } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { errorMessage } from '@/lib/api/errors';
import { isUUID } from '@/lib/validators';
import { formatPaise, rupeesToPaise } from '@/lib/utils/money';
import { useUiStore } from '@/stores';
import type { UUID } from '@/types';
import { toLocalDate, toPeriodMonth } from '../api/billingApi';
import { usePlayerFeeDetail, usePlayerFeeActions } from '../hooks/useBilling';

export default function PlayerFeeDetailPage() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const { academyId } = useActiveAcademy();
  const pushToast = useUiStore((state) => state.pushToast);

  const playerId: UUID | null = memberId && isUUID(memberId) ? (memberId as UUID) : null;
  const detailQuery = usePlayerFeeDetail(academyId, playerId);
  const { setFee, addPayment, removePayment, confirmClaim, dismissClaim } = usePlayerFeeActions(
    academyId as UUID,
    playerId as UUID,
  );

  const [editingFee, setEditingFee] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);

  if (!academyId) return null;
  if (!playerId)
    return <EmptyState title="Player not found" description="This link isn't valid." />;

  if (detailQuery.isPending) {
    return <p className="text-fg-muted py-8 text-center text-sm">Loading…</p>;
  }
  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />;
  }

  const detail = detailQuery.data;
  // A player can have more than one simultaneously-pending claim -- the
  // unique index only enforces one PENDING claim per (player, MONTH), not
  // per player overall (e.g. they fell behind and claimed both January and
  // February). Showing every pending claim, not just the most recent one,
  // is what lets the owner confirm/dismiss an older unresolved month too.
  const pendingClaims = detail.claims.filter((c) => c.status === 'pending');

  const handleSetFee = async (rupees: number) => {
    try {
      await setFee.mutateAsync(rupeesToPaise(rupees));
      pushToast({ title: 'Fee updated', variant: 'success' });
      setEditingFee(false);
    } catch (error) {
      pushToast({
        title: 'Could not update fee',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  };

  const handleAddPayment = async (input: {
    amountRupees: number;
    periodMonth: string;
    paidOn: string;
    method: string;
    notes: string;
  }) => {
    try {
      await addPayment.mutateAsync({
        amountPaise: rupeesToPaise(input.amountRupees),
        periodMonth: input.periodMonth,
        paidOn: input.paidOn,
        method: input.method.trim() === '' ? null : input.method.trim(),
        notes: input.notes.trim() === '' ? null : input.notes.trim(),
      });
      pushToast({ title: 'Payment recorded', variant: 'success' });
      setAddingPayment(false);
    } catch (error) {
      pushToast({
        title: 'Could not record payment',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  };

  const handleRemovePayment = async (paymentId: UUID) => {
    try {
      await removePayment.mutateAsync(paymentId);
      pushToast({ title: 'Payment removed', variant: 'success' });
    } catch (error) {
      pushToast({
        title: 'Could not remove payment',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  };

  const handleConfirmClaim = async (claimId: UUID) => {
    try {
      await confirmClaim.mutateAsync(claimId);
      pushToast({ title: 'Payment confirmed', variant: 'success' });
    } catch (error) {
      pushToast({
        title: 'Could not confirm payment',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  };

  const handleDismissClaim = async (claimId: UUID) => {
    try {
      await dismissClaim.mutateAsync(claimId);
      pushToast({ title: 'Claim dismissed', variant: 'success' });
    } catch (error) {
      pushToast({
        title: 'Could not dismiss claim',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="md:hidden">
        <MobilePageHeader title={detail.fullName ?? detail.email} subtitle="Fees" />
      </div>
      <div className="hidden items-center justify-between gap-3 md:flex">
        <div>
          <h1 className="text-fg text-xl font-bold">{detail.fullName ?? detail.email}</h1>
          <p className="text-fg-muted text-sm">Fees</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void navigate('/fees')}>
          &larr; All fees
        </Button>
      </div>

      <Card>
        <CardBody className="flex items-center gap-4">
          <Avatar name={detail.fullName ?? detail.email} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-fg text-base font-bold">{detail.fullName ?? 'Unnamed player'}</p>
            <p className="text-fg-muted text-sm">{detail.email}</p>
          </div>
        </CardBody>
      </Card>

      {pendingClaims.map((pendingClaim) => (
        <Card key={pendingClaim.id} className="border-info/40">
          <CardBody className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Clock className="text-info h-4 w-4 shrink-0" />
              <p className="text-fg text-sm font-semibold">
                Says they paid for{' '}
                {new Date(`${pendingClaim.periodMonth}T00:00:00Z`).toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </p>
            </div>
            <p className="text-fg-muted text-sm">
              From phone number <strong className="text-fg">{pendingClaim.payerPhone}</strong>.
              Check it against your own UPI app before confirming.
            </p>
            {pendingClaim.note && <p className="text-fg-muted text-xs">{pendingClaim.note}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-danger hover:bg-danger/10"
                isLoading={dismissClaim.isPending && dismissClaim.variables === pendingClaim.id}
                disabled={confirmClaim.isPending || dismissClaim.isPending}
                onClick={() => void handleDismissClaim(pendingClaim.id)}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Dismiss
              </Button>
              <Button
                type="button"
                size="sm"
                isLoading={confirmClaim.isPending && confirmClaim.variables === pendingClaim.id}
                disabled={confirmClaim.isPending || dismissClaim.isPending}
                onClick={() => void handleConfirmClaim(pendingClaim.id)}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Confirm payment
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader title="Monthly fee" />
        <CardBody>
          {editingFee ? (
            <FeeForm
              initialRupees={detail.monthlyFeePaise !== null ? detail.monthlyFeePaise / 100 : null}
              isSaving={setFee.isPending}
              onCancel={() => setEditingFee(false)}
              onSave={(rupees) => void handleSetFee(rupees)}
            />
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-fg text-lg font-bold">
                {detail.monthlyFeePaise !== null
                  ? `${formatPaise(detail.monthlyFeePaise)}/month`
                  : 'Not set'}
              </p>
              <Button variant="secondary" size="sm" onClick={() => setEditingFee(true)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                {detail.monthlyFeePaise !== null ? 'Edit' : 'Set fee'}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Payment history"
          action={
            !addingPayment ? (
              <Button variant="secondary" size="sm" onClick={() => setAddingPayment(true)}>
                <Plus className="mr-2 h-3.5 w-3.5" />
                Record payment
              </Button>
            ) : undefined
          }
        />
        <CardBody className={addingPayment ? undefined : 'p-0'}>
          {addingPayment ? (
            <PaymentForm
              defaultAmountRupees={
                detail.monthlyFeePaise !== null ? detail.monthlyFeePaise / 100 : null
              }
              isSaving={addPayment.isPending}
              onCancel={() => setAddingPayment(false)}
              onSave={(input) => void handleAddPayment(input)}
            />
          ) : detail.payments.length === 0 ? (
            <p className="text-fg-muted p-4 text-center text-sm">No payments recorded yet.</p>
          ) : (
            <ul className="divide-border-subtle divide-y">
              {detail.payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-fg text-sm font-semibold">
                      {formatPaise(payment.amountPaise)}{' '}
                      <span className="text-fg-muted font-normal">
                        for{' '}
                        {new Date(`${payment.periodMonth}T00:00:00Z`).toLocaleDateString('en-IN', {
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </span>
                    </p>
                    <p className="text-fg-muted text-xs">
                      Paid{' '}
                      {new Date(`${payment.paidOn}T00:00:00Z`).toLocaleDateString('en-IN', {
                        timeZone: 'UTC',
                      })}
                      {payment.method ? ` · ${payment.method}` : ''}
                      {payment.notes ? ` · ${payment.notes}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemovePayment(payment.id)}
                    aria-label="Remove payment"
                    className="text-fg-muted hover:text-danger shrink-0 p-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function FeeForm({
  initialRupees,
  isSaving,
  onCancel,
  onSave,
}: {
  initialRupees: number | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (rupees: number) => void;
}) {
  const [value, setValue] = useState(initialRupees !== null ? String(initialRupees) : '');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const rupees = Number(value);
    if (!Number.isFinite(rupees) || rupees < 0) return;
    onSave(rupees);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="block flex-1 text-sm">
        <span className="text-fg-muted mb-1.5 block">Monthly fee (₹)</span>
        <Input
          type="number"
          min={0}
          step="1"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoFocus
        />
      </label>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSaving}>
          Save
        </Button>
      </div>
    </form>
  );
}

function PaymentForm({
  defaultAmountRupees,
  isSaving,
  onCancel,
  onSave,
}: {
  defaultAmountRupees: number | null;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (input: {
    amountRupees: number;
    periodMonth: string;
    paidOn: string;
    method: string;
    notes: string;
  }) => void;
}) {
  const [amount, setAmount] = useState(
    defaultAmountRupees !== null ? String(defaultAmountRupees) : '',
  );
  const [periodMonth, setPeriodMonth] = useState(() => toPeriodMonth(new Date()));
  const [paidOn, setPaidOn] = useState(() => toLocalDate(new Date()));
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const amountRupees = Number(amount);
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) return;
    onSave({ amountRupees, periodMonth, paidOn, method, notes });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-fg-muted mb-1.5 block">Amount (₹)</span>
          <Input
            type="number"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="text-fg-muted mb-1.5 block">For month</span>
          <Input
            type="month"
            value={periodMonth.slice(0, 7)}
            onChange={(event) => setPeriodMonth(`${event.target.value}-01`)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-fg-muted mb-1.5 block">Date paid</span>
          <Input type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-fg-muted mb-1.5 block">
            Method <span className="text-xs font-normal">(optional)</span>
          </span>
          <Input
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            placeholder="Cash, UPI, bank transfer…"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-fg-muted mb-1.5 block">
          Notes <span className="text-xs font-normal">(optional)</span>
        </span>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSaving}>
          Record payment
        </Button>
      </div>
    </form>
  );
}
