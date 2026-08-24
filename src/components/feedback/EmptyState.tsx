import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

/** Standard "nothing here yet" state, used by every list view. */
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="border-border-subtle flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center">
      <span className="text-fg-muted">{icon ?? <Inbox className="h-8 w-8" aria-hidden />}</span>
      <div>
        <p className="text-fg font-medium">{title}</p>
        {description ? <p className="text-fg-muted mt-1 text-sm">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
