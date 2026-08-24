import { Download, Smartphone } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui';

import { usePwaInstall } from '../hooks/usePwaInstall';
import { InstallAppDialog } from './InstallAppDialog';

/**
 * Install App entry point.
 *
 * - Already installed  -> shows a disabled "App installed" state.
 * - iOS/Safari         -> always shows the button, which opens iOS instructions.
 * - Android / desktop  -> only shown when `beforeinstallprompt` was captured;
 *                         tapping it triggers the native install prompt.
 */
export function InstallAppButton() {
  const { isInstalled, isIOS, canInstall, install } = usePwaInstall();
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  if (isInstalled) {
    return (
      <Button variant="secondary" size="md" disabled className="min-h-[44px]">
        <Smartphone className="h-4 w-4" aria-hidden />
        App installed
      </Button>
    );
  }

  // On Android/desktop only surface the button once the browser is ready to
  // install; on iOS we always offer it because it opens manual instructions.
  if (!isIOS && !canInstall) return null;

  const handleInstall = () => {
    if (isIOS) {
      setInstructionsOpen(true);
      return;
    }
    void install();
  };

  return (
    <>
      <Button
        variant="primary"
        size="md"
        onClick={handleInstall}
        leftIcon={<Download className="h-4 w-4" aria-hidden />}
        className="min-h-[44px]"
      >
        Install App
      </Button>
      <InstallAppDialog open={instructionsOpen} onClose={() => setInstructionsOpen(false)} />
    </>
  );
}
