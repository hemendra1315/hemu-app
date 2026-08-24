import { X } from 'lucide-react';
import { useEffect } from 'react';

import { cn } from '@/lib/utils/cn';
import { useUiStore, type Toast } from '@/stores';

const TONES: Record<Toast['variant'], string> = {
  info: 'border-border-subtle',
  success: 'border-success',
  warning: 'border-warning',
  error: 'border-danger',
};

/** Renders the toast queue from the UI store; each toast auto-dismisses. */
export function Toaster() {
  const toasts = useUiStore((state) => state.toasts);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useUiStore((state) => state.dismissToast);

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(toast.id), 5000);
    return () => window.clearTimeout(timer);
  }, [toast.id, dismissToast]);

  return (
    <div
      className={cn(
        'bg-surface pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border-l-4 p-3 shadow-lg',
        TONES[toast.variant],
      )}
    >
      <div className="flex-1">
        <p className="text-fg text-sm font-medium">{toast.title}</p>
        {toast.description ? (
          <p className="text-fg-muted mt-0.5 text-sm">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss notification"
        className="text-fg-muted hover:text-fg"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
