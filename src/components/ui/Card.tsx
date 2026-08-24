import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'bg-surface border-border-subtle/80 rounded-2xl border shadow-2xs transition-shadow duration-200 hover:shadow-xs',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-border-subtle/60 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 md:px-6 md:py-4.5',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-fg text-base font-bold tracking-tight md:text-lg">{title}</h3>
        {description ? (
          <p className="text-fg-muted mt-0.5 text-xs md:text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 md:p-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-border-subtle/60 flex items-center justify-end gap-3 border-t px-5 py-4 md:px-6 md:py-4.5',
        className,
      )}
      {...props}
    />
  );
}
