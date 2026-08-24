import type { TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/utils/cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean };

export function Textarea({ className, hasError = false, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={hasError || undefined}
      className={cn(
        'bg-surface text-fg border-border-subtle placeholder:text-fg-muted w-full rounded-lg border px-3 py-2 text-sm',
        hasError && 'border-danger',
        className,
      )}
      {...props}
    />
  );
}
