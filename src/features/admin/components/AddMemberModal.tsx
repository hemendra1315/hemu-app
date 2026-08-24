import { useState } from 'react';
import { Button, Input, Modal, Select } from '@/components/ui';
import { useBatches } from '@/features/batches';
import { useUiStore } from '@/stores';
import type { UUID } from '@/types';
import { useSuperAdminAddMember } from '../hooks/useAdmin';

type AddMemberModalProps = {
  open: boolean;
  onClose: () => void;
  academyId: UUID;
};

export function AddMemberModal({ open, onClose, academyId }: AddMemberModalProps) {
  const pushToast = useUiStore((state) => state.pushToast);
  const { data: batches = [] } = useBatches(academyId);
  const addMemberMutation = useSuperAdminAddMember();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [batchId, setBatchId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Full Name is required');
      return;
    }

    setError(null);
    try {
      await addMemberMutation.mutateAsync({
        academyId,
        fullName: fullName.trim(),
        role: 'player',
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        batchId: batchId || undefined,
      });

      pushToast({
        title: 'Member Added',
        description: `${fullName.trim()} successfully added as a player.`,
        variant: 'success',
      });

      setFullName('');
      setEmail('');
      setPhone('');
      setBatchId('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add member';
      setError(msg);
      pushToast({
        title: 'Error Adding Member',
        description: msg,
        variant: 'error',
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Member (Player)"
      footer={
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <Button variant="secondary" onClick={onClose} disabled={addMemberMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={addMemberMutation.isPending}
            disabled={addMemberMutation.isPending || !fullName.trim()}
          >
            Add Member
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-danger/10 border-danger/20 text-danger rounded-lg border p-3 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="text-fg mb-1 block text-sm font-medium">
            Full Name <span className="text-danger">*</span>
          </label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Rahul Dravid"
            required
            className="min-h-[48px]"
          />
        </div>

        <div>
          <label className="text-fg-muted mb-1 block text-sm font-medium">
            Email Address (Optional)
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="rahul@example.com"
            className="min-h-[48px]"
          />
        </div>

        <div>
          <label className="text-fg-muted mb-1 block text-sm font-medium">
            Phone Number (Optional)
          </label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+919876543210"
            className="min-h-[48px]"
          />
        </div>

        <div>
          <label className="text-fg-muted mb-1 block text-sm font-medium">
            Assign Batch (Optional)
          </label>
          <Select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="min-h-[48px]"
          >
            <option value="">No batch assigned</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.ageGroup})
              </option>
            ))}
          </Select>
        </div>
      </form>
    </Modal>
  );
}
