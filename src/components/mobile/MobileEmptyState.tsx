import type { ReactNode } from 'react';
import { Button } from '@/components/ui';

type MobileEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
};

export function MobileEmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: MobileEmptyStateProps) {
  return (
    <div
      className={`bg-surface border-border-subtle flex flex-col items-center justify-center space-y-3 rounded-2xl border border-dashed p-6 text-center ${className}`}
    >
      {icon && (
        <div className="bg-primary/10 text-primary mb-1 flex h-12 w-12 items-center justify-center rounded-2xl">
          {icon}
        </div>
      )}
      <div className="max-w-xs space-y-1">
        <h3 className="text-fg text-base font-semibold">{title}</h3>
        <p className="text-fg-muted text-xs leading-relaxed">{description}</p>
      </div>
      {action && (
        <Button
          onClick={action.onClick}
          variant="primary"
          className="mt-2 min-h-[44px] font-medium"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
