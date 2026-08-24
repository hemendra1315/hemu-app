import { Clock, RefreshCw } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

import { EmptyState } from '@/components/feedback';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { useMemberships } from '@/features/academies';
import { useAuth, useIdentity } from '@/features/auth';
import { formatDateTime } from '@/lib/utils/date';
import { ROLE_LABELS, ROLE_HOME } from '@/types/enums';

/** Waiting room for users whose join request has not been approved yet. */
export default function PendingApprovalPage() {
  const { pendingRequests, pending, hasAnyAcademy, active } = useMemberships();
  const { profile } = useAuth();
  const identity = useIdentity();

  const activeMembership = active[0];
  if (hasAnyAcademy && activeMembership)
    return <Navigate to={ROLE_HOME[activeMembership.role]} replace />;

  const waiting = [
    ...pendingRequests.map((request) => ({
      id: request.id,
      academyName: request.academyName,
      role: request.requestedRole,
      createdAt: request.createdAt,
    })),
    ...pending.map((membership) => ({
      id: membership.id,
      academyName: membership.academyName,
      role: membership.role,
      createdAt: null,
    })),
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Waiting for approval"
          description="The academy owner reviews every request. You will get access as soon as they approve."
          action={
            <Button
              variant="secondary"
              size="sm"
              isLoading={identity.isFetching}
              onClick={() => void identity.refetch()}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Check again
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {waiting.length === 0 ? (
            <EmptyState
              title="No pending requests"
              description="Join an academy with a code, or create your own."
              icon={<Clock className="h-8 w-8" aria-hidden />}
            />
          ) : (
            <ul className="space-y-2">
              {waiting.map((item) => (
                <li
                  key={item.id}
                  className="border-border-subtle flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-fg font-medium">{item.academyName || 'Academy'}</p>
                    <p className="text-fg-muted text-xs">
                      Requested as {ROLE_LABELS[item.role]}
                      {item.createdAt ? ` · ${formatDateTime(item.createdAt)}` : ''}
                    </p>
                  </div>
                  <Badge tone="warning">Pending</Badge>
                </li>
              ))}
            </ul>
          )}

          <p className="text-fg-muted text-sm">
            Signed in as {profile?.email}.{' '}
            <Link to="/onboarding" className="text-primary hover:underline">
              Join another academy
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
