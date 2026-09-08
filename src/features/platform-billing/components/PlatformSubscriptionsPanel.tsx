import { useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  QrCode,
  Upload,
  Trash2,
  AlertCircle,
  Check,
  Clock,
  X,
} from 'lucide-react';

import { Avatar, Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { errorMessage } from '@/lib/api';
import { formatPaise, paiseToRupees, rupeesToPaise } from '@/lib/utils/money';
import { useUiStore } from '@/stores';
import { toLocalDate, toPeriodMonth } from '../api/platformBillingApi';
import type { SubscriptionClaim } from '../api/platformBillingTypes';
import {
  usePlatformBillingActions,
  usePlatformSettings,
  useSubscriberSummaries,
} from '../hooks/usePlatformBilling';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function monthLabel(periodMonth: string): string {
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

/**
 * Super-admin-only panel: manage the app's own payment QR/amount, and see +
 * mark who's paid this month. Private to the app creator -- nothing here is
 * visible to academy owners, coaches, players, or parents (they only ever
 * see `MySubscriptionPage`, their own status). Embedded as a tab in
 * `PlatformDashboardPage`.
 */
export function PlatformSubscriptionsPanel() {
  const pushToast = useUiStore((s) => s.pushToast);
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  const [periodMonth, setPeriodMonth] = useState(() => toPeriodMonth(new Date()));
  const [qrError, setQrError] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [settingsSynced, setSettingsSynced] = useState(false);

  const summariesQuery = useSubscriberSummaries(periodMonth);
  const settingsQuery = usePlatformSettings();
  const { saveSettings, uploadQr, removeQr, addPayment, confirmClaim, dismissClaim } =
    usePlatformBillingActions();

  const settings = settingsQuery.data;

  // Sync the editable amount/note fields from loaded settings, once per
  // load -- during render, not in an effect (avoids the
  // react-hooks/set-state-in-effect lint rule; see AcademySettingsPage for
  // the same pattern).
  if (settings && !settingsSynced) {
    setSettingsSynced(true);
    setAmountInput(String(paiseToRupees(settings.monthlyFeePaise)));
    setNoteInput(settings.paymentNote ?? '');
  }

  const handleQrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setQrError(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setQrError('Invalid format. Please select a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setQrError('File too large. Maximum allowed size is 5 MB.');
      return;
    }

    try {
      await uploadQr.mutateAsync(file);
      pushToast({ title: 'Payment QR code updated', variant: 'success' });
    } catch (err) {
      const msg = errorMessage(err);
      setQrError(msg);
      pushToast({ title: 'Failed to upload QR code', description: msg, variant: 'error' });
    }
  };

  const handleRemoveQr = async () => {
    setQrError(null);
    try {
      await removeQr.mutateAsync(settings?.paymentQrUrl);
      pushToast({ title: 'Payment QR code removed', variant: 'success' });
    } catch (err) {
      const msg = errorMessage(err);
      setQrError(msg);
      pushToast({ title: 'Failed to remove QR code', description: msg, variant: 'error' });
    }
  };

  const handleSaveSettings = async () => {
    const rupees = Number(amountInput);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      pushToast({ title: 'Enter a valid amount', variant: 'error' });
      return;
    }
    try {
      await saveSettings.mutateAsync({
        monthlyFeePaise: rupeesToPaise(rupees),
        paymentNote: noteInput.trim() || null,
      });
      pushToast({ title: 'Subscription settings saved', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Failed to save settings',
        description: errorMessage(err),
        variant: 'error',
      });
    }
  };

  const handleConfirmClaim = async (claim: SubscriptionClaim) => {
    if (!settings) return;
    try {
      await confirmClaim.mutateAsync({ claim, amountPaise: settings.monthlyFeePaise });
      pushToast({ title: 'Payment confirmed', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Failed to confirm',
        description: errorMessage(err),
        variant: 'error',
      });
    }
  };

  const handleDismissClaim = async (claimId: string) => {
    try {
      await dismissClaim.mutateAsync(claimId);
      pushToast({ title: 'Claim dismissed', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Failed to dismiss',
        description: errorMessage(err),
        variant: 'error',
      });
    }
  };

  const handleMarkPaid = async (userId: string) => {
    if (!settings) return;
    try {
      await addPayment.mutateAsync({
        userId,
        input: {
          amountPaise: settings.monthlyFeePaise,
          periodMonth,
          paidOn: toLocalDate(new Date()),
          method: null,
          notes: null,
        },
      });
      pushToast({ title: 'Marked as paid', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Failed to record payment',
        description: errorMessage(err),
        variant: 'error',
      });
    }
  };

  const rows = summariesQuery.data ?? [];
  const paidCount = rows.filter((r) => r.isPaid).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Your Payment QR Code"
          description="Shown to every user of the app as what they owe you each month. Only you can see or change this."
        />
        <CardBody className="space-y-6">
          <div className="border-border-subtle bg-surface-elevated/60 flex flex-col gap-5 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="relative flex shrink-0 items-center justify-center">
              {settings?.paymentQrUrl ? (
                <img
                  src={settings.paymentQrUrl}
                  alt="Your payment QR code"
                  className="border-border-subtle h-24 w-24 rounded-xl border bg-white object-contain sm:h-28 sm:w-28"
                />
              ) : (
                <div className="border-border-subtle bg-surface flex h-24 w-24 items-center justify-center rounded-xl border border-dashed sm:h-28 sm:w-28">
                  <QrCode className="text-fg-muted h-8 w-8" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={qrFileInputRef}
                  onChange={handleQrFileChange}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  aria-label="Upload Payment QR Code"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  isLoading={uploadQr.isPending}
                  disabled={uploadQr.isPending || removeQr.isPending}
                  onClick={() => qrFileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  <span>{settings?.paymentQrUrl ? 'Change QR Code' : 'Upload QR Code'}</span>
                </Button>
                {settings?.paymentQrUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger/10"
                    isLoading={removeQr.isPending}
                    disabled={uploadQr.isPending || removeQr.isPending}
                    onClick={() => void handleRemoveQr()}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Remove</span>
                  </Button>
                ) : null}
              </div>
              <p className="text-fg-muted text-[11px]">
                Accepts JPG, PNG, or WebP up to 5 MB. Use your own UPI app's static QR code.
              </p>
            </div>
          </div>

          {qrError && (
            <div className="border-danger/30 bg-danger/10 text-danger flex items-center gap-2 rounded-xl border p-3 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{qrError}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-fg block text-sm font-medium">Monthly Amount (₹)</label>
              <Input
                type="number"
                min="1"
                step="1"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-fg block text-sm font-medium">Note (optional)</label>
              <Input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="e.g. your UPI ID as backup"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              isLoading={saveSettings.isPending}
              onClick={() => void handleSaveSettings()}
            >
              Save
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Subscribers"
          description="Every user of the app and whether they've paid this month. Tracking only -- nothing is blocked automatically."
        />
        <CardBody className="space-y-4">
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
            <ErrorState
              error={summariesQuery.error}
              onRetry={() => void summariesQuery.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IndianRupee className="h-8 w-8" aria-hidden />}
              title="No users yet"
              description="Users show up here once they sign up."
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge tone="success">{paidCount} paid</Badge>
                <Badge tone="danger">{rows.length - paidCount} unpaid</Badge>
              </div>

              <div className="border-border-subtle bg-surface divide-border-subtle divide-y overflow-hidden rounded-xl border">
                {rows.map((row) => {
                  const pendingClaim = row.pendingClaim;
                  return (
                    <div
                      key={row.userId}
                      className="flex flex-wrap items-center justify-between gap-3 p-3.5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar
                          name={row.fullName ?? row.email}
                          shape="rounded"
                          className="h-9 w-9"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-fg truncate text-sm font-semibold">
                            {row.fullName ?? row.email}
                            {row.isSuperAdmin && (
                              <span className="text-fg-muted ml-1 text-xs">(you)</span>
                            )}
                          </p>
                          <p className="text-fg-muted truncate text-xs">
                            {row.paidPaiseThisMonth > 0
                              ? `${formatPaise(row.paidPaiseThisMonth)} paid`
                              : 'Nothing recorded'}
                          </p>
                          {!row.isPaid && pendingClaim && (
                            <p className="text-info mt-1 truncate text-xs font-medium">
                              <Clock className="mr-1 inline h-3 w-3" />
                              Claims paid from {pendingClaim.payerPhone}
                              {pendingClaim.note ? ` — ${pendingClaim.note}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      {row.isSuperAdmin ? (
                        <Badge tone="neutral" className="shrink-0">
                          Exempt
                        </Badge>
                      ) : row.isPaid ? (
                        <Badge tone="success" className="shrink-0">
                          <Check className="mr-1 h-3 w-3" /> Paid
                        </Badge>
                      ) : pendingClaim ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger hover:bg-danger/10"
                            isLoading={
                              dismissClaim.isPending && dismissClaim.variables === pendingClaim.id
                            }
                            disabled={!settings || confirmClaim.isPending || dismissClaim.isPending}
                            onClick={() => void handleDismissClaim(pendingClaim.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            isLoading={
                              confirmClaim.isPending &&
                              confirmClaim.variables?.claim.id === pendingClaim.id
                            }
                            disabled={!settings || confirmClaim.isPending || dismissClaim.isPending}
                            onClick={() => void handleConfirmClaim(pendingClaim)}
                          >
                            Confirm
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="shrink-0"
                          isLoading={
                            addPayment.isPending && addPayment.variables?.userId === row.userId
                          }
                          disabled={!settings || addPayment.isPending}
                          onClick={() => void handleMarkPaid(row.userId)}
                        >
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
