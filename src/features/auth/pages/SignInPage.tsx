import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Mail } from 'lucide-react';

import { Button, Card, CardBody, Input } from '@/components/ui';
import { FormField } from '@/components/form';
import { errorMessage } from '@/lib/api';
import { env } from '@/lib/env';
import { useUiStore } from '@/stores';

import { useAuth } from '../hooks/useAuth';
import { signUpWithPassword } from '../api/authApi';

/** Authentication entry point supporting both Email/Password sign in/up and Google OAuth. */
export default function SignInPage() {
  const [searchParams] = useSearchParams();
  const { login, loginWithPassword, isAuthenticated } = useAuth();
  const pushToast = useUiStore((s) => s.pushToast);

  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isGoogleSubmitting, setGoogleSubmitting] = useState(false);

  const pendingInviteToken = sessionStorage.getItem('pending_owner_invite_token');
  const redirectTarget =
    searchParams.get('redirectTo') ||
    (pendingInviteToken ? `/academy/invite/${pendingInviteToken}` : '/');

  if (isAuthenticated) return <Navigate to={redirectTarget} replace />;

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailTrimmed = email.trim();
    if (!emailTrimmed || !password) {
      setError('Please enter both email and password.');
      return;
    }

    if (isSignUp) {
      if (!confirmPassword) {
        setError('Please confirm your password.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        const { session } = await signUpWithPassword(emailTrimmed, password);
        pushToast({
          title: 'Account created',
          description: 'Your account has been registered successfully.',
          variant: 'success',
        });
        if (session) {
          // Auto-login active, redirect is handled by top-level Navigate check
          setSubmitting(false);
        } else {
          // Confirmation email required
          setSignUpSuccess(true);
          setSubmitting(false);
        }
      } else {
        await loginWithPassword(emailTrimmed, password);
      }
    } catch (cause) {
      setError(errorMessage(cause));
      setSubmitting(false);
    }
  };

  const onGoogleSignIn = async () => {
    setGoogleSubmitting(true);
    setError(null);
    try {
      await login();
    } catch (cause) {
      setError(errorMessage(cause));
      setGoogleSubmitting(false);
    }
  };

  if (signUpSuccess) {
    return (
      <Card className="border-border-subtle w-full max-w-md shadow-lg">
        <CardBody className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-fg text-2xl font-bold tracking-tight">Verify Your Email</h1>
          <p className="text-fg-muted text-sm">
            We&apos;ve sent a verification link to <strong className="text-fg">{email}</strong>.
            Please check your inbox and confirm your email address to complete onboarding.
          </p>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => {
              setSignUpSuccess(false);
              setIsSignUp(false);
              setEmail('');
              setPassword('');
              setConfirmPassword('');
              setError(null);
            }}
          >
            Back to Sign In
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border-border-subtle w-full max-w-md shadow-lg">
      <CardBody className="space-y-5 p-6">
        <div className="text-center">
          <h1 className="text-fg text-2xl font-bold tracking-tight">{env.appName}</h1>
          <p className="text-fg-muted mt-1 text-sm">
            {isSignUp
              ? 'Create an account to manage your academy'
              : 'Sign in to manage your academy'}
          </p>
        </div>

        <form onSubmit={onPasswordSubmit} className="space-y-4" noValidate>
          <FormField label="Email" required>
            {(field) => (
              <Input
                {...field}
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            )}
          </FormField>

          <FormField label="Password" required>
            {(field) => (
              <Input
                {...field}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
              />
            )}
          </FormField>

          {isSignUp && (
            <FormField label="Confirm Password" required>
              {(field) => (
                <Input
                  {...field}
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              )}
            </FormField>
          )}

          {error ? (
            <div
              role="alert"
              className="bg-danger/10 text-danger border-danger/20 rounded-lg border p-3 text-xs font-medium"
            >
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isSubmitting}
            disabled={isGoogleSubmitting}
          >
            {isSignUp ? 'Sign Up' : 'Sign In with Password'}
          </Button>

          <div className="pt-2 text-center text-sm">
            <span className="text-fg-muted">
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            </span>
            <button
              type="button"
              className="text-primary font-semibold hover:underline"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setConfirmPassword('');
              }}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-border-subtle w-full border-t" />
          <span className="bg-surface text-fg-muted px-3 text-xs tracking-wider uppercase">or</span>
          <div className="border-border-subtle w-full border-t" />
        </div>

        <Button
          variant="secondary"
          className="w-full"
          size="lg"
          isLoading={isGoogleSubmitting}
          disabled={isSubmitting}
          onClick={onGoogleSignIn}
        >
          Continue with Google
        </Button>

        <p className="text-fg-muted text-center text-xs">
          By continuing you agree to the academy&apos;s terms of use.
        </p>
      </CardBody>
    </Card>
  );
}
