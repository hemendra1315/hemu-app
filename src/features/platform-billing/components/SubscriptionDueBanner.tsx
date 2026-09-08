import { Clock, IndianRupee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { formatPaise } from '@/lib/utils/money';
import { useMySubscriptionStatus } from '../hooks/usePlatformBilling';
import { toPeriodMonth } from '../api/platformBillingApi';

/**
 * Global, site-wide reminder that the signed-in user owes the app's monthly
 * subscription -- rendered once in `AppShell`, above the routed content, so
 * it shows on every page for every role (owner, coach, player, parent). Not
 * shown to the super admin (they're the one collecting, not paying) or while
 * previewing the app in Test Mode (that's still the super admin's own
 * account underneath). Hides itself once this month is paid, so it doesn't
 * linger as noise once handled.
 */
export function SubscriptionDueBanner({ suppressed }: { suppressed: boolean }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.isSuperAdmin === true;

  const statusQuery = useMySubscriptionStatus(
    !suppressed && !isSuperAdmin ? (profile?.id ?? null) : null,
  );

  if (suppressed || isSuperAdmin || !statusQuery.data) return null;

  const { settings, payments, claims } = statusQuery.data;
  const currentPeriod = toPeriodMonth(new Date());
  const paidThisMonthPaise = payments
    .filter((p) => p.periodMonth === currentPeriod)
    .reduce((sum, p) => sum + p.amountPaise, 0);
  // Any recorded payment counts as paid -- see the matching comment in
  // platformBillingApi.ts for why this isn't a `>= monthlyFeePaise` check.
  const isPaid = paidThisMonthPaise > 0;

  // Handled -- don't keep nagging once it's paid.
  if (isPaid) return null;

  const hasPendingClaim = claims.some(
    (c) => c.periodMonth === currentPeriod && c.status === 'pending',
  );

  if (hasPendingClaim) {
    return (
      <div className="border-info/30 bg-info/10 relative z-30 flex min-h-[36px] flex-wrap items-center justify-between gap-1.5 border-b px-3 py-1.5 text-xs font-medium md:text-sm">
        <div className="text-info flex min-w-0 flex-1 items-center gap-1.5">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="truncate">
            App subscription marked paid --{' '}
            <strong className="font-bold">pending confirmation</strong>
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="border-info/40 bg-info/20 text-info hover:bg-info/30 h-7 shrink-0 px-2 text-xs font-semibold"
          onClick={() => navigate('/subscription')}
        >
          View
        </Button>
      </div>
    );
  }

  return (
    <div className="border-warning/30 bg-warning/10 relative z-30 flex min-h-[36px] flex-wrap items-center justify-between gap-1.5 border-b px-3 py-1.5 text-xs font-medium md:text-sm">
      <div className="text-warning flex min-w-0 flex-1 items-center gap-1.5">
        <IndianRupee className="h-4 w-4 shrink-0" />
        <span className="truncate">
          <strong className="font-bold">{formatPaise(settings.monthlyFeePaise)}</strong> app
          subscription due this month
        </span>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="border-warning/40 bg-warning/20 text-warning hover:bg-warning/30 h-7 shrink-0 px-2 text-xs font-semibold"
        onClick={() => navigate('/subscription')}
      >
        Pay Now
      </Button>
    </div>
  );
}
