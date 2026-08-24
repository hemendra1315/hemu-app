import { Link, useParams } from 'react-router-dom';

import { Card, CardBody, CardFooter, CardHeader, Badge } from '@/components/ui';
import { buttonStyles } from '@/components/ui/buttonStyles';
import { EmptyState, ErrorState } from '@/components/feedback';
import { useAcademyMember } from '../hooks/useMembers';
import { formatDate } from '@/lib/utils/date';
import { ROLE_LABELS } from '@/types/enums';

export default function MemberProfilePage() {
  const { memberId } = useParams();
  const query = useAcademyMember(memberId ?? null);

  if (!memberId) {
    return (
      <EmptyState
        title="Invalid player"
        description="Unable to resolve this player. Please return to the roster and try again."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-fg text-xl font-semibold">Player profile</h1>
          <p className="text-fg-muted text-sm">View player details and membership status.</p>
        </div>
        <Link to="/members" className={buttonStyles('secondary', 'sm')}>
          Back to roster
        </Link>
      </div>

      <Card>
        <CardHeader
          title="Player details"
          description="A quick view of the player's academy membership."
        />
        <CardBody>
          {query.isPending ? (
            <div className="space-y-3">
              <div className="h-5 w-2/5 rounded bg-slate-200" />
              <div className="h-5 w-1/2 rounded bg-slate-200" />
              <div className="h-24 rounded bg-slate-200" />
            </div>
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : !query.data ? (
            <EmptyState
              title="Player not found"
              description="This player is not available in the current academy roster."
            />
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-fg-muted text-xs tracking-wide uppercase">Name</p>
                  <p className="text-fg text-base font-medium">
                    {query.data.fullName ?? 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-fg-muted text-xs tracking-wide uppercase">Email</p>
                  <p className="text-fg text-base font-medium">{query.data.email}</p>
                </div>
                <div>
                  <p className="text-fg-muted text-xs tracking-wide uppercase">Role</p>
                  <p className="text-fg text-base font-medium">{ROLE_LABELS[query.data.role]}</p>
                </div>
                <div>
                  <p className="text-fg-muted text-xs tracking-wide uppercase">Status</p>
                  <Badge tone={query.data.status === 'active' ? 'success' : 'warning'}>
                    {query.data.status}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-fg-muted text-xs tracking-wide uppercase">Joined</p>
                  <p className="text-fg text-base font-medium">
                    {query.data.joinedAt ? formatDate(query.data.joinedAt) : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-fg-muted text-xs tracking-wide uppercase">Phone</p>
                  <p className="text-fg text-base font-medium">
                    {query.data.phone ?? 'Not provided'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-fg-muted text-xs tracking-wide uppercase">Member ID</p>
                <p className="text-fg text-sm break-all">{query.data.id}</p>
              </div>
            </div>
          )}
        </CardBody>
        <CardFooter>
          <p className="text-fg-muted text-sm">
            Use the roster to change membership actions and roles.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
