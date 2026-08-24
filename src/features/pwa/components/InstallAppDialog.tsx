import { Modal } from '@/components/ui';

type InstallAppDialogProps = {
  open: boolean;
  onClose: () => void;
};

const STEPS = ['Tap the Share button in Safari.', 'Select Add to Home Screen.', 'Tap Add.'];

/**
 * iOS/Safari does not expose `beforeinstallprompt`, so we cannot trigger the
 * native flow. Show concise, mobile-friendly manual instructions instead.
 */
export function InstallAppDialog({ open, onClose }: InstallAppDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Install Cricket Academy Manager" size="sm">
      <p className="text-fg-muted text-sm">To install this app on your iPhone:</p>
      <ol className="text-fg mt-3 list-decimal space-y-2 pl-5 text-sm">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </Modal>
  );
}
