import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { useUiStore } from '@/stores';
import type { UUID } from '@/types';
import { useSuperAdminSeedDemoData } from '../hooks/useAdmin';

type SeedDemoDataModalProps = {
  open: boolean;
  onClose: () => void;
  academyId: UUID;
};

export function SeedDemoDataModal({ open, onClose, academyId }: SeedDemoDataModalProps) {
  const pushToast = useUiStore((state) => state.pushToast);
  const seedMutation = useSuperAdminSeedDemoData();
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    setError(null);
    try {
      await seedMutation.mutateAsync(academyId);

      pushToast({
        title: 'Demo Data Successfully Added',
        description:
          'Demo coaches, players, batches, sessions, matches, attendance and statistics have been created.',
        variant: 'success',
      });

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to seed demo data';
      if (msg.includes('E_DUPLICATE') || msg.includes('Demo data already exists')) {
        const dupMsg = 'Demo data already exists for this academy.';
        setError(dupMsg);
        pushToast({
          title: 'Demo Data Exists',
          description: dupMsg,
          variant: 'warning',
        });
      } else {
        setError(msg);
        pushToast({
          title: 'Seed Error',
          description: msg,
          variant: 'error',
        });
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Seed Demo Data"
      footer={
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <Button variant="secondary" onClick={onClose} disabled={seedMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSeed}
            isLoading={seedMutation.isPending}
            disabled={seedMutation.isPending}
          >
            Seed Demo Data
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error ? (
          <div className="bg-warning/10 border-warning/30 text-warning-fg rounded-lg border p-4 text-sm font-medium">
            {error}
          </div>
        ) : (
          <p className="text-fg text-sm leading-relaxed">
            This will add demo coaches, players, batches, sessions, matches, attendance and
            statistics to this academy. Continue?
          </p>
        )}

        <div className="bg-surface-subtle/60 border-border-subtle text-fg-muted space-y-1 rounded-lg border p-3 text-xs">
          <p className="text-fg font-semibold">What will be generated:</p>
          <ul className="list-disc space-y-0.5 pl-4">
            <li>3 Professional Coaches</li>
            <li>3 Age-Group & Elite Batches (U14, U16, Senior)</li>
            <li>18 Players with Realistic Profiles & Playing Roles</li>
            <li>4 Training Sessions with Attendance Logs</li>
            <li>2 Completed Matches with Full Scorecards & Awards</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
