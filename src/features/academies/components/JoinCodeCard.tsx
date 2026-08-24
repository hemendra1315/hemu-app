import { Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { ErrorState } from '@/components/feedback';
import { Button, Skeleton } from '@/components/ui';
import { Can } from '@/lib/rbac';
import { useUiStore } from '@/stores';
import type { UUID } from '@/types';
import type { JoinableRole } from '@/types/enums';

import { useJoinCode, useRegenerateJoinCode } from '../hooks/useAcademies';

/**
 * Ultra-compact single-row Join Code component (40-50px vertical height).
 * Displays Join Code, copy action, and secondary regenerate button.
 */
export function JoinCodeCard({
  academyId,
  role = 'player',
}: {
  academyId: UUID;
  role?: JoinableRole;
}) {
  const { data: code, isPending, isError, error, refetch } = useJoinCode(academyId, role);
  const regenerate = useRegenerateJoinCode(academyId, role);
  const pushToast = useUiStore((state) => state.pushToast);
  const [prevCode, setPrevCode] = useState(code);
  const [copied, setCopied] = useState(false);

  if (code !== prevCode) {
    setPrevCode(code);
    setCopied(false);
  }

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      pushToast({ title: 'Could not copy', description: code, variant: 'warning' });
    }
  };

  if (isError) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  return (
    <div className="border-border-subtle bg-surface flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 shadow-2xs">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-fg-muted shrink-0 text-xs font-bold tracking-wider uppercase">
          {role === 'coach' ? 'Coach Code:' : 'Join Code:'}
        </span>
        {isPending ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <code className="text-fg truncate font-mono text-sm font-extrabold tracking-[0.2em]">
            {code ?? '—'}
          </code>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void copy()}
          disabled={!code || isPending}
          className="h-9 min-h-[36px] px-2.5 text-xs font-semibold"
          aria-label="Copy join code"
        >
          <Copy className="mr-1 h-3.5 w-3.5" aria-hidden />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Can do="academy:regenerate_join_code">
          <Button
            variant="ghost"
            size="sm"
            isLoading={regenerate.isPending}
            onClick={() => regenerate.mutate()}
            className="text-fg-muted hover:text-fg h-9 min-h-[36px] w-9 min-w-[36px] p-0"
            aria-label="Regenerate join code"
            title="Regenerate code"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </Can>
      </div>
    </div>
  );
}
