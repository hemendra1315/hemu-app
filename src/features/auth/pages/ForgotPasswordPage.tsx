import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

import { Button, Card, CardBody, Input } from '@/components/ui';
import { FormField } from '@/components/form';
import { errorMessage } from '@/lib/api';

import { requestPasswordReset } from '../api/authApi';

/**
 * Step one of password recovery: ask for the address, send the email.
 *
 * The success screen never confirms whether an account exists for the address
 * given — doing so would let anyone use this form to discover which people
 * are registered here.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isSent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      setError('Please enter your email address.');
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(emailTrimmed);
      setSent(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  if (isSent) {
    return (
      <Card className="border-border-subtle w-full max-w-md shadow-lg">
        <CardBody className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-fg text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="text-fg-muted text-sm">
            If <strong className="text-fg">{email.trim()}</strong> has an account, we&apos;ve sent
            it a link to set a new password. The link expires in an hour.
          </p>
          <Link to="/sign-in" className="block">
            <Button className="w-full" variant="secondary">
              Back to Sign In
            </Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border-border-subtle w-full max-w-md shadow-lg">
      <CardBody className="space-y-5 p-6">
        <div className="text-center">
          <h1 className="text-fg text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Enter your email and we&apos;ll send you a link to set a new one.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
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

          {error ? (
            <div
              role="alert"
              className="bg-danger/10 text-danger border-danger/20 rounded-lg border p-3 text-xs font-medium"
            >
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
            Send reset link
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link to="/sign-in" className="text-primary font-semibold hover:underline">
            Back to Sign In
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
