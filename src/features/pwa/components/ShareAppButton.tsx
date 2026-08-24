import { Check, Share } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui';
import { useUiStore } from '@/stores';

import { SHARE_APP_DATA, useShare } from '../hooks/useShare';

/**
 * Share App button.
 *
 * Uses the native Web Share sheet where available; otherwise falls back to
 * copying the production URL to the clipboard.
 */
export function ShareAppButton() {
  const { supported, share, copyUrl } = useShare();
  const pushToast = useUiStore((state) => state.pushToast);
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => window.clearTimeout(resetTimer.current);
  }, []);

  const handleShare = async () => {
    if (supported) {
      const shared = await share();
      // If the native sheet completed, that is the user-facing confirmation.
      if (shared) return;
    }

    const ok = await copyUrl();
    if (!ok) return;

    setCopied(true);
    pushToast({ title: 'Link copied', description: SHARE_APP_DATA.url, variant: 'success' });
    resetTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="secondary"
      size="md"
      onClick={() => void handleShare()}
      leftIcon={
        copied ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Share className="h-4 w-4" aria-hidden />
        )
      }
      className="min-h-[44px]"
    >
      {copied ? 'Link copied' : 'Share App'}
    </Button>
  );
}
