import { useId, type ReactElement, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

type FormFieldProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-describedby'?: string }) => ReactElement | ReactNode;
};

/**
 * Label + hint + error wrapper for react-hook-form fields. Wires up ids and
 * aria-describedby so validation messages are announced by screen readers.
 */
export function FormField({
  label,
  error,
  hint,
  required = false,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-fg block text-sm font-medium">
        {label}
        {required ? <span className="text-danger ml-0.5">*</span> : null}
      </label>
      {children({ id, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-fg-muted text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
