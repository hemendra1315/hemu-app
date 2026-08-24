import { useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { useUiStore } from '@/stores';
import type { UUID } from '@/types';
import { useSuperAdminAddMember } from '../hooks/useAdmin';

type AddCoachModalProps = {
  open: boolean;
  onClose: () => void;
  academyId: UUID;
};

export function AddCoachModal({ open, onClose, academyId }: AddCoachModalProps) {
  const pushToast = useUiStore((state) => state.pushToast);
  const addCoachMutation = useSuperAdminAddMember();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Full Name is required');
      return;
    }

    setError(null);
    try {
      await addCoachMutation.mutateAsync({
        academyId,
        fullName: fullName.trim(),
        role: 'coach',
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      pushToast({
        title: 'Coach Added',
        description: `${fullName.trim()} successfully added as a coach.`,
        variant: 'success',
      });

      setFullName('');
      setEmail('');
      setPhone('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add coach';
      setError(msg);
      pushToast({
        title: 'Error Adding Coach',
        description: msg,
        variant: 'error',
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Coach"
      footer={
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <Button variant="secondary" onClick={onClose} disabled={addCoachMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={addCoachMutation.isPending}
            disabled={addCoachMutation.isPending || !fullName.trim()}
          >
            Add Coach
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
            placeholder="e.g. Gary Kirsten"
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
            placeholder="coach@example.com"
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
      </form>
    </Modal>
  );
}
