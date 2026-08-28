import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

import { Button, Card, CardBody, Input } from '@/components/ui';
import { FormField } from '@/components/form';
import { LoadingScreen } from '@/components/feedback';
import { errorMessage } from '@/lib/api';
import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase/client';
import { useUiStore } from '@/stores';

import { updatePassword } from '../api/authApi';

type Phase = 'exchanging' | 'ready' | 'invalid' | 'done';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Step two of password recovery: the screen the emailed link lands on.
 *
 * The recovery link carries a one-time PKCE code that has to be exchanged for
 * a session before the password can be changed. The client is configured with
 * `detectSessionInUrl: false` (see lib/supabase/client.ts) precisely so pages
 * do this themselves — the exchange is guarded by a ref because the code is
 * single-use and React would otherwise burn it twice in StrictMode.
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);

  // A link that already carries an error needs no async work, so this is
  // decided during the first render rather than by a setState in the effect
  // below (which would cause a wasted cascading render).
  const [phase, setPhase] = useState<Phase>(() =>
    new URLSearchParams(window.location.search).has('error_description') ? 'invalid' : 'exchanging',
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const code = searchParams.get('code');
  const errorDescription = searchParams.get('error_description');
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    if (errorDescription) {
      // Phase is already 'invalid' from the initialiser above; just record it.
      logger.warn('password_reset_link_error', { errorDescription });
      return;
    }

    // No code in the URL usually means the link was already used, or someone
    // navigated here directly. An existing recovery session still counts, so
    // check for one before giving up.
    if (!code) {
      void supabase.auth.getSession().then(({ data }) => {
        setPhase(data.session ? 'ready' : 'invalid');
      });
      return;
    }

    void supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) {
        logger.warn('password_reset_exchange_failed', { error: String(exchangeError) });
        setPhase('invalid');
        return;
      }
      setPhase('ready');
    });
  }, [code, errorDescription]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      setPhase('done');
      pushToast({ title: 'Password updated', variant: 'success' });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'exchanging') {
    return <LoadingScreen message="Checking your link…" />;
  }

  if (phase === 'invalid') {
    return (
      <Card className="border-border-subtle w-full max-w-md shadow-lg">
        <CardBody className="space-y-5 p-6 text-center">
          <h1 className="text-fg text-2xl font-bold tracking-tight">This link has expired</h1>
          <p className="text-fg-muted text-sm">
            Password reset links can only be used once, and expire after an hour. Request a fresh
            one and it&apos;ll work.
          </p>
          <Link to="/forgot-password" className="block">
            <Button className="w-full">Request a new link</Button>
          </Link>
          <Link to="/sign-in" className="text-primary block text-sm font-semibold hover:underline">
            Back to Sign In
          </Link>
        </CardBody>
      </Card>
    );
  }

  if (phase === 'done') {
    return (
      <Card className="border-border-subtle w-full max-w-md shadow-lg">
        <CardBody className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="text-fg text-2xl font-bold tracking-tight">Password updated</h1>
          <p className="text-fg-muted text-sm">
            You&apos;re signed in with your new password on this device.
          </p>
          <Button className="w-full" onClick={() => navigate('/', { replace: true })}>
            Continue
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border-border-subtle w-full max-w-md shadow-lg">
      <CardBody className="space-y-5 p-6">
        <div className="text-center">
          <h1 className="text-fg text-2xl font-bold tracking-tight">Set a new password</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Choose something you haven&apos;t used here before.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label="New password" required>
            {(field) => (
              <Input
                {...field}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            )}
          </FormField>

          <FormField label="Confirm new password" required>
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

          {error ? (
            <div
              role="alert"
              className="bg-danger/10 text-danger border-danger/20 rounded-lg border p-3 text-xs font-medium"
            >
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
            Update password
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
