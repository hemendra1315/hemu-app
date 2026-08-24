import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted/80 text-fg-muted border border-border-subtle/50',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
  brand: 'bg-primary/10 text-primary border border-primary/20',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
