import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui';
import { errorMessage } from '@/lib/api';

type ErrorStateProps = {
  error: unknown;
  onRetry?: () => void;
  title?: string;
};

/** Inline error state for failed queries; message text comes from the API layer. */
export function ErrorState({ error, onRetry, title = 'Something went wrong' }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="border-danger/40 bg-danger/5 flex flex-col items-center gap-3 rounded-xl border p-8 text-center"
    >
      <AlertTriangle className="text-danger h-7 w-7" aria-hidden />
      <div>
        <p className="text-fg font-medium">{title}</p>
        <p className="text-fg-muted mt-1 text-sm">{errorMessage(error)}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
