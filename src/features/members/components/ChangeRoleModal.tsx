import { useState } from 'react';
import { Check, ShieldCheck, User, Users, Briefcase } from 'lucide-react';
import { Modal, Button, Avatar } from '@/components/ui';
import { useUpdateMember } from '../hooks/useMembers';
import { useUiStore } from '@/stores';
import { ROLE_LABELS, type AppRole, type AssignableMemberRole } from '@/types/enums';
import type { UUID } from '@/types';

export type ChangeRoleModalProps = {
  open: boolean;
  onClose: () => void;
  member: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl?: string | null;
    role: AppRole | string;
  } | null;
  academyId: UUID;
};

const ROLES: Array<{
  id: AssignableMemberRole;
  label: string;
  badgeTone: string;
  icon: typeof User;
  description: string;
  features: string[];
}> = [
  {
    id: 'player',
    label: 'Player',
    badgeTone: 'border-primary/20 bg-primary-pale text-primary',
    icon: User,
    description: 'Enrolled cricketer in the academy squads',
    features: [
      'Player dashboard & cricket card',
      'Match stats, batting & bowling performance',
      'View assigned drills & training schedule',
    ],
  },
  {
    id: 'coach',
    label: 'Coach',
    badgeTone: 'border-info/20 bg-info-pale text-info',
    icon: Briefcase,
    description: 'Training staff & squad instructor',
    features: [
      'Manage squad drills & practice sessions',
      'Record attendance & coach feedback notes',
      'Full match scoring & squad lineup access',
    ],
  },
  {
    id: 'parent',
    label: 'Parent',
    badgeTone: 'border-saffron/20 bg-saffron-pale text-saffron',
    icon: Users,
    description: 'Parent / guardian of an academy player',
    features: [
      'Link & monitor child progress',
      'Track session attendance history',
      'Receive academy announcements & alerts',
    ],
  },
];

function getInitialRole(role?: string): AssignableMemberRole {
  if (role === 'coach' || role === 'parent' || role === 'player') {
    return role;
  }
  return 'player';
}

export function ChangeRoleModal({ open, onClose, member, academyId }: ChangeRoleModalProps) {
  if (!member) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary h-5 w-5" />
          <span>Change Member Role</span>
        </div>
      }
      size="md"
    >
      <ChangeRoleForm key={member.id} member={member} academyId={academyId} onClose={onClose} />
    </Modal>
  );
}

function ChangeRoleForm({
  member,
  academyId,
  onClose,
}: {
  member: NonNullable<ChangeRoleModalProps['member']>;
  academyId: UUID;
  onClose: () => void;
}) {
  const [selectedRole, setSelectedRole] = useState<AssignableMemberRole>(() =>
    getInitialRole(member.role),
  );
  const { changeRole } = useUpdateMember(academyId);
  const pushToast = useUiStore((state) => state.pushToast);

  const currentRole = member.role as AppRole;
  const isUnchanged = member.role === selectedRole;

  const handleSave = () => {
    if (isUnchanged) {
      onClose();
      return;
    }

    changeRole.mutate(
      { membershipId: member.id, role: selectedRole },
      {
        onSuccess: () => {
          pushToast({
            title: `Role updated to ${ROLE_LABELS[selectedRole]} for ${member.fullName ?? member.email}`,
            variant: 'success',
          });
          onClose();
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Failed to update member role';
          pushToast({
            title: 'Role change failed',
            description: message,
            variant: 'error',
          });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* Member Preview Header */}
      <div className="border-border-subtle bg-surface-container-low flex items-center gap-3 rounded-xl border p-3">
        <Avatar
          name={member.fullName ?? member.email}
          src={member.avatarUrl}
          size="md"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-fg truncate font-sans text-sm font-bold">
            {member.fullName ?? member.email}
          </h3>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-fg-muted font-mono text-[11px]">{member.email}</span>
            <span className="text-fg-muted text-[10px]">•</span>
            <span className="text-fg-muted font-mono text-[10px] uppercase">
              Current:{' '}
              <strong className="text-fg">{ROLE_LABELS[currentRole] ?? currentRole}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Role Options */}
      <div className="space-y-2.5">
        <label className="font-heading text-fg-muted block text-xs font-bold tracking-wider uppercase">
          Select New Role
        </label>
        <div className="grid gap-2.5">
          {ROLES.map((roleOption) => {
            const isSelected = selectedRole === roleOption.id;
            const isCurrent = member.role === roleOption.id;
            const Icon = roleOption.icon;

            return (
              <div
                key={roleOption.id}
                onClick={() => setSelectedRole(roleOption.id)}
                className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-2xs'
                    : 'border-border-subtle bg-surface hover:border-border-subtle/80 hover:bg-surface-muted/20'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-fg'
                      : 'border-border-subtle bg-surface-container-low text-fg-muted'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-fg text-sm font-bold tracking-wide uppercase">
                      {roleOption.label}
                    </span>
                    {isCurrent && (
                      <span className="border-border-subtle bg-surface-container-low py-0.2 text-fg-muted rounded border px-1.5 font-mono text-[9px] font-bold uppercase">
                        Current Role
                      </span>
                    )}
                  </div>
                  <p className="text-fg-muted mt-0.5 font-sans text-xs">{roleOption.description}</p>
                  <ul className="mt-2 space-y-1">
                    {roleOption.features.map((feature, i) => (
                      <li
                        key={i}
                        className="text-fg-muted flex items-center gap-1.5 font-sans text-[11px]"
                      >
                        <Check className="text-primary h-3 w-3 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-1 flex shrink-0 items-center justify-center">
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-fg'
                        : 'border-border-subtle'
                    }`}
                  >
                    {isSelected && <div className="bg-surface h-1.5 w-1.5 rounded-full" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Actions */}
      <div className="border-border-subtle/60 flex items-center justify-end gap-2.5 border-t pt-3">
        <Button variant="ghost" onClick={onClose} disabled={changeRole.isPending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          isLoading={changeRole.isPending}
          disabled={isUnchanged}
        >
          {isUnchanged ? 'No Changes' : `Make ${ROLE_LABELS[selectedRole]}`}
        </Button>
      </div>
    </div>
  );
}
