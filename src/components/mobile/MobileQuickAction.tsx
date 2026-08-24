import type { ReactNode } from 'react';

type MobileQuickActionProps = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  className?: string;
};

export function MobileQuickAction({
  label,
  icon,
  onClick,
  className = '',
}: MobileQuickActionProps) {
  return (
    <button
      onClick={onClick}
      className={`bg-surface hover:bg-surface-muted/60 border-border-subtle flex min-h-[48px] w-full items-center gap-3 rounded-2xl border p-3.5 text-left shadow-2xs transition active:scale-[0.98] ${className}`}
    >
      <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        {icon}
      </div>
      <span className="text-fg truncate text-xs leading-tight font-semibold">{label}</span>
    </button>
  );
}
