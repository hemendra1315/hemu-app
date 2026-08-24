import type { ReactNode } from 'react';

type MobileStatCardProps = {
  title: string;
  value: string | number;
  icon?: ReactNode;
  subtext?: string;
  className?: string;
};

export function MobileStatCard({
  title,
  value,
  icon,
  subtext,
  className = '',
}: MobileStatCardProps) {
  return (
    <div
      className={`bg-surface border-border-subtle flex flex-col justify-between rounded-2xl border p-3.5 shadow-2xs ${className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-fg-muted truncate text-xs font-medium">{title}</span>
        {icon && (
          <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className="text-fg text-xl font-bold tracking-tight">{value}</p>
        {subtext && (
          <p className="text-fg-muted mt-0.5 truncate text-[11px] font-medium">{subtext}</p>
        )}
      </div>
    </div>
  );
}
