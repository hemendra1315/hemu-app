import { useState } from 'react';
import { ShieldAlert, ShieldCheck, QrCode, Receipt } from 'lucide-react';
import { Button } from '@/components/ui';
import { STUDENT_MONTHLY_FEE_AMOUNT, useStudentFeePayment } from '../api/studentFeeStore';
import { StudentMonthlyFeeModal } from './StudentMonthlyFeeModal';

interface StudentMonthlyFeeBannerProps {
  studentId: string;
  studentName: string;
  studentEmail: string;
  academyId: string;
  academyName: string;
  className?: string;
}

export function StudentMonthlyFeeBanner({
  studentId,
  studentName,
  studentEmail,
  academyId,
  academyName,
  className = '',
}: StudentMonthlyFeeBannerProps) {
  const { payment, isPaidThisMonth, currentMonthLabel } = useStudentFeePayment(studentId);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (isPaidThisMonth && payment) {
    return (
      <>
        <aside
          aria-label="Student Monthly Pass Active"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 shadow-2xs dark:text-emerald-300 ${className}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-fg font-bold">Pass Active · {payment.monthLabel}</p>
              <p className="text-fg-muted text-[11px]">
                ₹{payment.amount} paid · Ref:{' '}
                <span className="font-mono font-semibold">{payment.utr}</span>
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>Receipt</span>
          </Button>
        </aside>

        <StudentMonthlyFeeModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          studentId={studentId}
          studentName={studentName}
          studentEmail={studentEmail}
          academyId={academyId}
          academyName={academyName}
        />
      </>
    );
  }

  return (
    <>
      <aside
        aria-label="Student Monthly App Fee Due"
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/15 p-4 text-xs text-amber-800 shadow-xs dark:text-amber-200 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-fg text-sm font-bold">
                Monthly Pass · ₹{STUDENT_MONTHLY_FEE_AMOUNT}
              </h4>
              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-amber-700 uppercase dark:text-amber-300">
                {currentMonthLabel}
              </span>
            </div>
            <p className="text-fg-muted mt-0.5 text-xs">
              Access all training drills, match stats, and schedules.
            </p>
          </div>
        </div>

        <Button
          size="md"
          variant="primary"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 font-bold shadow-md active:scale-95"
        >
          <QrCode className="h-4 w-4" />
          <span>Pay ₹{STUDENT_MONTHLY_FEE_AMOUNT}</span>
        </Button>
      </aside>

      <StudentMonthlyFeeModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        studentId={studentId}
        studentName={studentName}
        studentEmail={studentEmail}
        academyId={academyId}
        academyName={academyName}
      />
    </>
  );
}
