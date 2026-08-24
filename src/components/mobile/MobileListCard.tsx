import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

type MobileListCardProps = {
  title: string;
  subtitle?: string;
  leftElement?: ReactNode;
  rightBadge?: ReactNode;
  onClick?: () => void;
  className?: string;
};

export function MobileListCard({
  title,
  subtitle,
  leftElement,
  rightBadge,
  onClick,
  className = '',
}: MobileListCardProps) {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      onClick={onClick}
      className={`bg-surface hover:bg-surface-muted/40 border-border-subtle flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left shadow-2xs transition active:scale-[0.99] ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leftElement && <div className="shrink-0">{leftElement}</div>}
        <div className="min-w-0">
          <h4 className="text-fg truncate text-sm font-semibold">{title}</h4>
          {subtitle && <p className="text-fg-muted mt-0.5 truncate text-xs">{subtitle}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {rightBadge}
        {onClick && <ChevronRight className="text-fg-muted/60 h-4 w-4" />}
      </div>
    </Component>
  );
}
