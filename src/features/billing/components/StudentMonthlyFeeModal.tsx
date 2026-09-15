import { useState, useId } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  UploadCloud,
  X,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import {
  FAMPAY_UPI_ID,
  STUDENT_MONTHLY_FEE_AMOUNT,
  getCurrentMonthKey,
  getCurrentMonthLabel,
  recordStudentFeePayment,
  type StudentFeePayment,
} from '../api/studentFeeStore';
import { useUiStore } from '@/stores';

interface StudentMonthlyFeeModalProps {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  studentEmail: string;
  academyId: string;
  academyName: string;
  onPaymentSuccess?: (payment: StudentFeePayment) => void;
}

export function StudentMonthlyFeeModal({
  open,
  onClose,
  studentId,
  studentName,
  studentEmail,
  academyId,
  academyName,
  onPaymentSuccess,
}: StudentMonthlyFeeModalProps) {
  const currentMonthKey = getCurrentMonthKey();
  const currentMonthLabel = getCurrentMonthLabel();
  const fileInputId = useId();

  const [utr, setUtr] = useState('');
  const [screenshotData, setScreenshotData] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedPayment, setSubmittedPayment] = useState<StudentFeePayment | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pushToast = useUiStore((s) => s.pushToast);

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(FAMPAY_UPI_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      pushToast({ title: 'UPI ID copied to clipboard!', variant: 'success' });
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      pushToast({
        title: 'File too large',
        description: 'Please upload a screenshot under 5MB.',
        variant: 'error',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setScreenshotData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const cleanUtr = utr.trim().replace(/\D/g, '');
  const isValidUtr = cleanUtr.length === 12;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isValidUtr) {
      setErrorMessage('Please enter the valid 12-digit UPI Reference / UTR Number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payment = recordStudentFeePayment({
        studentId,
        studentName,
        studentEmail,
        academyId,
        academyName,
        monthKey: currentMonthKey,
        monthLabel: currentMonthLabel,
        amount: STUDENT_MONTHLY_FEE_AMOUNT,
        utr: cleanUtr,
        screenshotUrl: screenshotData,
      });

      setSubmittedPayment(payment);
      setIsSuccess(true);
      pushToast({
        title: 'Monthly Pass Activated! 🎉',
        description: `₹200 received for ${currentMonthLabel}. Reference UTR: ${cleanUtr}`,
        variant: 'success',
      });

      if (onPaymentSuccess) {
        onPaymentSuccess(payment);
      }
    } catch {
      setErrorMessage('Unable to record payment. Please try again.');
      pushToast({ title: 'Payment recording failed', variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setUtr('');
    setScreenshotData(undefined);
    setIsSuccess(false);
    setErrorMessage(null);
    onClose();
  };

  const upiIntentUrl = `upi://pay?pa=${FAMPAY_UPI_ID}&pn=CAM%20App&am=${STUDENT_MONTHLY_FEE_AMOUNT}&cu=INR&tn=CAM%20Student%20Pass%20${encodeURIComponent(currentMonthLabel)}`;

  return (
    <Modal
      open={open}
      onClose={handleResetAndClose}
      title={isSuccess ? 'Payment Confirmed' : `Monthly Pass · ₹${STUDENT_MONTHLY_FEE_AMOUNT}`}
      size="md"
    >
      {isSuccess && submittedPayment ? (
        <div className="space-y-5 py-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-4 ring-emerald-500/20">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div>
            <h3 className="text-fg text-xl font-bold tracking-tight">Pass Active!</h3>
            <p className="text-fg-muted mt-1 text-sm">
              All features unlocked for <strong>{submittedPayment.monthLabel}</strong>.
            </p>
          </div>

          <div className="bg-surface-muted/60 border-border-subtle divide-border-subtle divide-y rounded-2xl border text-left text-xs">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-fg-muted font-medium">Player</span>
              <span className="text-fg font-semibold">{submittedPayment.studentName}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-fg-muted font-medium">Academy</span>
              <span className="text-fg font-semibold">{submittedPayment.academyName}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-fg-muted font-medium">Period</span>
              <span className="text-fg font-semibold">{submittedPayment.monthLabel}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-fg-muted font-medium">Amount</span>
              <span className="font-bold text-emerald-500">₹{submittedPayment.amount}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-fg-muted font-medium">UPI UTR Ref</span>
              <span className="text-fg font-mono font-bold tracking-wider">
                {submittedPayment.utr}
              </span>
            </div>
          </div>

          <Button className="w-full font-bold" size="lg" onClick={handleResetAndClose}>
            Done
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Top Info Banner */}
          <div className="bg-primary/10 border-primary/20 text-primary flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                <strong>{currentMonthLabel} Pass</strong>
              </span>
            </div>
            <span className="font-mono text-sm font-black">₹{STUDENT_MONTHLY_FEE_AMOUNT}</span>
          </div>

          {/* QR Code & Direct UPI section */}
          <div className="border-border-subtle bg-surface-muted/40 flex flex-col items-center justify-center rounded-2xl border p-4 text-center">
            <div className="border-primary/30 relative mb-2.5 overflow-hidden rounded-2xl border-2 bg-white p-2 shadow-md">
              <img src="/fampay_qr.jpg" alt="FamPay QR Code" className="h-40 w-40 object-contain" />
            </div>
            <p className="text-fg text-xs font-semibold">
              Scan with GPay, PhonePe, Paytm, or FamPay
            </p>

            {/* UPI ID Copy Pill */}
            <div className="bg-surface border-border-subtle mt-2.5 flex items-center gap-2 rounded-xl border px-3 py-1.5 shadow-2xs">
              <span className="text-fg-muted text-[11px] font-medium">UPI:</span>
              <code className="text-primary font-mono text-xs font-bold">{FAMPAY_UPI_ID}</code>
              <button
                type="button"
                onClick={copyUpiId}
                aria-label="Copy UPI ID"
                className="text-fg-muted hover:text-fg ml-1 transition"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Direct Mobile Pay Button */}
            <a
              href={upiIntentUrl}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Pay via UPI App</span>
            </a>
          </div>

          {/* Step 2: Enter 12-Digit UTR */}
          <div className="space-y-3">
            <div>
              <label htmlFor="utr-input" className="text-fg block text-xs font-bold">
                UPI Reference / UTR Number <span className="text-danger">*</span>
              </label>
              <p className="text-fg-muted mt-0.5 text-[11px]">
                12-digit reference number in your UPI payment receipt.
              </p>
              <div className="relative mt-1.5">
                <Input
                  id="utr-input"
                  type="text"
                  maxLength={12}
                  placeholder="e.g. 425891029384"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className="font-mono text-sm font-bold tracking-widest uppercase"
                  required
                />
                {isValidUtr && (
                  <div className="absolute top-1/2 right-3 -translate-y-1/2 text-emerald-500">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </div>
            </div>

            {/* Optional Screenshot upload */}
            <div>
              <label
                htmlFor={fileInputId}
                className="text-fg-muted mb-1.5 block text-xs font-medium"
              >
                Receipt Screenshot (Optional)
              </label>
              {screenshotData ? (
                <div className="relative flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 shrink-0" />
                    <span className="font-semibold">Screenshot Attached</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScreenshotData(undefined)}
                    className="text-fg-muted hover:text-fg p-1"
                    aria-label="Remove screenshot"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor={fileInputId}
                  className="border-border-subtle bg-surface-muted/30 text-fg-muted hover:bg-surface-muted/60 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs font-medium transition"
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload receipt image</span>
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="border-danger/30 bg-danger/10 text-danger rounded-xl border p-3 text-xs font-semibold"
            >
              {errorMessage}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={handleResetAndClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValidUtr || isSubmitting}
              isLoading={isSubmitting}
              className="flex-1 font-bold"
              size="lg"
            >
              Activate Pass (₹{STUDENT_MONTHLY_FEE_AMOUNT})
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
