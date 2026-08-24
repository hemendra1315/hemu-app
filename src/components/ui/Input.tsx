import type { InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean };

/** Uncontrolled-friendly text input (works directly with react-hook-form `register`). */
export function Input({ className, hasError = false, ...props }: InputProps) {
  return (
    <input
      aria-invalid={hasError || undefined}
      className={cn(
        'bg-surface text-fg border-border-subtle placeholder:text-fg-muted h-12 min-h-[48px] w-full rounded-xl border px-3.5 text-base transition-colors md:h-10 md:min-h-[40px] md:text-sm',
        'disabled:cursor-not-allowed disabled:opacity-60',
        hasError && 'border-danger',
        className,
      )}
      {...props}
    />
  );
}
