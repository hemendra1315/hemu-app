import { Shield, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';

import { buttonStyles, Card, CardBody } from '@/components/ui';
import { useAuth } from '@/features/auth';

/** First screen for a signed-in user with no academy: join one with its join code. */
export default function OnboardingStartPage() {
  const { displayName, profile } = useAuth();
  const isSuperAdmin = Boolean(profile?.isSuperAdmin);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-fg text-2xl font-semibold">
          Welcome{displayName ? `, ${displayName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-fg-muted text-sm">
          {isSuperAdmin
            ? 'Manage academies via the platform admin dashboard, or join an existing academy.'
            : 'You are not part of an academy yet. Enter your academy join code to get started.'}
        </p>
      </header>

      <div className={`grid gap-4 ${isSuperAdmin ? 'sm:grid-cols-2' : 'mx-auto max-w-md'}`}>
        <Card className="border-border-subtle shadow-md">
          <CardBody className="flex h-full flex-col gap-3 p-6">
            <Ticket className="text-primary h-7 w-7" aria-hidden />
            <div className="flex-1">
              <h2 className="text-fg text-lg font-semibold">Join an Academy</h2>
              <p className="text-fg-muted mt-1.5 text-sm">
                Enter the join code shared by your academy. The academy owner or staff will approve
                your request.
              </p>
            </div>
            <Link to="/onboarding/join-academy" className={buttonStyles('primary')}>
              Join with a code
            </Link>
          </CardBody>
        </Card>

        {isSuperAdmin && (
          <Card className="border-border-subtle shadow-md">
            <CardBody className="flex h-full flex-col gap-3 p-6">
              <Shield className="text-primary h-7 w-7" aria-hidden />
              <div className="flex-1">
                <h2 className="text-fg text-lg font-semibold">Super Admin Management</h2>
                <p className="text-fg-muted mt-1.5 text-sm">
                  Create new academies and issue secure owner invitation links from the platform
                  dashboard.
                </p>
              </div>
              <Link to="/admin" className={buttonStyles('secondary')}>
                Go to Platform Admin
              </Link>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
