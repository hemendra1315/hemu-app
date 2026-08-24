import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Avatar, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { useAuth } from '@/features/auth';
import {
  getOwnerInvitationDetails,
  acceptOwnerInvitation,
  type OwnerInvitationDetails,
} from '@/features/academies/api/academiesApi';
import { useActiveAcademy } from '@/features/academies';
import { errorMessage } from '@/lib/api';
import { useAcademyStore, useAuthStore, useUiStore } from '@/stores';
import { queryKeys } from '@/lib/query/keys';

export default function OwnerInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, isIdentityReady, user } = useAuth();
  const { switchAcademy } = useActiveAcademy();
  const pushToast = useUiStore((s) => s.pushToast);

  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Store token in sessionStorage in case user needs to authenticate or complete onboarding
  useEffect(() => {
    if (token) {
      sessionStorage.setItem('pending_owner_invite_token', token);
    }
  }, [token]);

  const {
    data: invite,
    isLoading,
    error: fetchError,
  } = useQuery<OwnerInvitationDetails>({
    queryKey: ['owner-invitation-details', token],
    queryFn: () =>
      token ? getOwnerInvitationDetails(token) : Promise.reject(new Error('No token provided')),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const handleAccept = async () => {
    if (!token) return;
    setIsAccepting(true);
    setAcceptError(null);

    try {
      const res = await acceptOwnerInvitation(token);
      sessionStorage.removeItem('pending_owner_invite_token');

      // Update store and identity query so active academy and owner membership are instantly recognized
      useAcademyStore.getState().setActiveAcademy(res.academyId);
      useAuthStore.getState().setIdentityStatus('idle');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.identity(user?.id ?? 'anonymous'),
      });
      await queryClient.invalidateQueries({ queryKey: ['academy-members'] });

      switchAcademy(res.academyId);

      pushToast({
        title: `Welcome to ${res.academyName}!`,
        description: 'You are now the active Owner of this academy.',
        variant: 'success',
      });

      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setAcceptError(errorMessage(err));
      setIsAccepting(false);
    }
  };

  if (isLoading || (isAuthenticated && !isIdentityReady)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardBody className="space-y-4 py-8">
            <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
            <p className="text-fg-muted text-sm font-medium">Validating invitation...</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (fetchError || !invite || invite.status === 'not_found' || invite.status === 'invalid') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="border-border-subtle w-full max-w-md text-center shadow-lg">
          <CardBody className="space-y-4 py-8">
            <div className="bg-danger/10 text-danger mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-fg text-xl font-bold">Invalid Invitation Link</h1>
            <p className="text-fg-muted text-sm">
              This invitation link is unrecognized or malformed. Please verify the link or request a
              new one from your platform administrator.
            </p>
            <div className="pt-2">
              <Link to="/sign-in" className="inline-block w-full">
                <Button variant="secondary" className="w-full">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (invite.status === 'expired') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="border-border-subtle w-full max-w-md text-center shadow-lg">
          <CardBody className="space-y-4 py-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-fg text-xl font-bold">This invitation has expired</h1>
            <p className="text-fg-muted text-sm">
              The owner invitation for <strong>{invite.academyName || 'this academy'}</strong> has
              expired. Please ask your administrator to generate a new invitation link.
            </p>
            <div className="pt-2">
              <Link to="/" className="inline-block w-full">
                <Button variant="secondary" className="w-full">
                  Go to Home
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (invite.status === 'revoked') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="border-border-subtle w-full max-w-md text-center shadow-lg">
          <CardBody className="space-y-4 py-8">
            <div className="bg-danger/10 text-danger mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-fg text-xl font-bold">This invitation is no longer valid</h1>
            <p className="text-fg-muted text-sm">
              This invitation was revoked by the platform administrator.
            </p>
            <div className="pt-2">
              <Link to="/" className="inline-block w-full">
                <Button variant="secondary" className="w-full">
                  Go to Home
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (invite.status === 'accepted') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="border-border-subtle w-full max-w-md text-center shadow-lg">
          <CardBody className="space-y-4 py-8">
            <div className="bg-primary/10 text-primary mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="text-fg text-xl font-bold">This invitation has already been used</h1>
            <p className="text-fg-muted text-sm">
              An owner has already claimed <strong>{invite.academyName || 'this academy'}</strong>{' '}
              using this link.
            </p>
            <div className="pt-2">
              <Link to="/dashboard" className="inline-block w-full">
                <Button variant="primary" className="w-full">
                  Enter Dashboard
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Active / Valid Invitation
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="border-border-subtle w-full max-w-lg shadow-xl">
        <CardHeader
          title="Academy Owner Invitation"
          description="You have been invited to become the Owner of an academy."
        />
        <CardBody className="space-y-6 p-6 sm:p-8">
          <div className="border-border-subtle bg-surface-subtle flex flex-col items-center gap-3 rounded-2xl border p-6 text-center">
            <Avatar
              name={invite.academyName}
              src={invite.logoUrl}
              shape="rounded"
              className="h-16 w-16 text-2xl shadow-sm"
            />
            <div>
              <p className="text-fg-muted text-xs font-semibold tracking-wider uppercase">
                Academy
              </p>
              <h2 className="text-fg mt-1 text-2xl font-extrabold tracking-tight">
                {invite.academyName}
              </h2>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              Role: Academy Owner
            </div>
          </div>

          <div className="text-fg-muted space-y-2 text-xs">
            <p>
              • As the Owner, you will have full control over coaches, batches, attendance, match
              records, and academy settings.
            </p>
            <p>• You will not need to enter join codes or await approval.</p>
          </div>

          {acceptError ? (
            <div
              role="alert"
              className="border-danger/30 bg-danger/10 text-danger rounded-xl border p-3 text-xs font-medium"
            >
              {acceptError}
            </div>
          ) : null}

          {!isAuthenticated ? (
            <div className="space-y-3 pt-2">
              <Button
                variant="primary"
                size="lg"
                className="w-full font-bold"
                onClick={() => {
                  sessionStorage.setItem('pending_owner_invite_token', token || '');
                  navigate(`/sign-in?redirectTo=/academy/invite/${token}`);
                }}
              >
                Sign In to Accept Invitation
              </Button>
              <p className="text-fg-muted text-center text-xs">
                New to the platform? Clicking above allows you to create your account.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <Button
                variant="primary"
                size="lg"
                isLoading={isAccepting}
                disabled={isAccepting}
                onClick={handleAccept}
                className="w-full font-bold shadow-md"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Accept Invitation & Become Owner
              </Button>
              <p className="text-fg-muted text-center text-xs">
                Signed in as <strong className="text-fg">{user?.email}</strong>
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
