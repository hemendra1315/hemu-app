import { X } from 'lucide-react';
import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/cn';
import { useOverlayStackStore } from '@/stores';

import { Button } from './Button';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

/** Portal dialog with Escape-to-close and scroll locking. */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const overlayId = useId();
  const pushOverlay = useOverlayStackStore((state) => state.pushOverlay);
  const popOverlay = useOverlayStackStore((state) => state.popOverlay);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  // Registers this modal on the shared overlay stack while it is open, so a
  // single top-level Android back-button listener (see App.tsx) can close
  // whichever modal is topmost without every modal owning its own listener.
  useEffect(() => {
    if (!open) return;
    pushOverlay(overlayId, onClose);
    return () => popOverlay(overlayId);
  }, [open, onClose, overlayId, pushOverlay, popOverlay]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'bg-surface border-border-subtle relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border shadow-xl transition-all sm:rounded-xl',
          SIZES[size],
        )}
      >
        <div className="border-border-subtle flex shrink-0 items-center justify-between border-b px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-fg truncate text-base font-bold sm:text-lg">{title}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer ? (
          <div className="border-border-subtle bg-surface/95 flex shrink-0 flex-col-reverse justify-end gap-2.5 border-t p-4 backdrop-blur-md sm:flex-row">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
