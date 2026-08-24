import type { SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean };

export function Select({ className, hasError = false, children, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={hasError || undefined}
      className={cn(
        'bg-surface text-fg border-border-subtle h-12 min-h-[48px] w-full rounded-xl border px-3.5 text-base transition-colors md:h-10 md:min-h-[40px] md:text-sm',
        'disabled:cursor-not-allowed disabled:opacity-60',
        hasError && 'border-danger',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
