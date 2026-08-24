import { ChevronRight } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { Avatar, buttonStyles, Card, CardBody, CardHeader } from '@/components/ui';
import { useActiveAcademy, useMemberships } from '@/features/academies';
import { useAuthStore } from '@/stores';
import { ROLE_LABELS, ROLE_HOME } from '@/types/enums';

/** Chooser shown when a user belongs to several academies and none is active. */
export default function SelectAcademyPage() {
  const { active, isLoading } = useMemberships();
  const { switchAcademy } = useActiveAcademy();
  const isSuperAdmin = useAuthStore((state) => state.profile?.isSuperAdmin === true);
  const navigate = useNavigate();

  if (isSuperAdmin) return <Navigate to="/admin" replace />;

  if (!isLoading && active.length === 0) return <Navigate to="/onboarding" replace />;

  return (
    <Card>
      <CardHeader title="Choose an academy" description="You can switch at any time." />
      <CardBody className="space-y-2">
        {active.map((membership) => (
          <button
            key={membership.academyId}
            type="button"
            className="border-border-subtle hover:bg-surface-muted flex w-full items-center gap-3 rounded-lg border p-3 text-left"
            onClick={() => {
              switchAcademy(membership.academyId);
              void navigate(ROLE_HOME[membership.role] || '/dashboard', { replace: true });
            }}
          >
            <Avatar name={membership.academyName} src={membership.logoUrl} />
            <span className="min-w-0 flex-1">
              <span className="text-fg block truncate font-medium">{membership.academyName}</span>
              <span className="text-fg-muted block text-xs">
                {ROLE_LABELS[membership.role]}
                {membership.city ? ` · ${membership.city}` : ''}
              </span>
            </span>
            <ChevronRight className="text-fg-muted h-4 w-4" aria-hidden />
          </button>
        ))}

        <Link to="/onboarding" className={buttonStyles('ghost', 'sm', 'mt-2')}>
          Join another academy
        </Link>
      </CardBody>
    </Card>
  );
}
