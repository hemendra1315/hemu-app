import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  UserPlus,
  UserCheck,
  Users,
  Layers,
  CalendarCheck,
  CalendarDays,
  Trophy,
  FileSpreadsheet,
} from 'lucide-react';

import { Button, Modal } from '@/components/ui';
import { useCan } from '@/lib/rbac';

export function DashboardQuickActions() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const canManagePlayers = useCan('players:manage');
  const canReadPlayers = useCan('players:read');
  const canManageBatches = useCan('batches:manage');
  const canReadBatches = useCan('batches:read');
  const canManageSessions = useCan('sessions:manage');
  const canManageMatches = useCan('matches:manage');
  const canMarkAttendance = useCan('attendance:mark');

  const actions = [
    canManagePlayers && {
      label: 'Add Player',
      icon: <UserPlus className="text-primary h-5 w-5" />,
      onClick: () => navigate('/members'),
      description: 'Invite or create player profile',
    },
    canManagePlayers && {
      label: 'Add Coach',
      icon: <UserCheck className="text-info h-5 w-5" />,
      onClick: () => navigate('/members'),
      description: 'Assign coaching staff',
    },
    canManageBatches && {
      label: 'Create Batch',
      icon: <Layers className="text-warning h-5 w-5" />,
      onClick: () => navigate('/batches'),
      description: 'Set up squad or training group',
    },
    canManageSessions && {
      label: 'Schedule Session',
      icon: <CalendarDays className="text-success h-5 w-5" />,
      onClick: () => navigate('/sessions'),
      description: 'Add training or net practice',
    },
    canManageMatches && {
      label: 'Add Match',
      icon: <Trophy className="h-5 w-5 text-amber-500" />,
      onClick: () => navigate('/matches/new'),
      description: 'Create match & scorecard',
    },
    canMarkAttendance && {
      label: 'Mark Attendance',
      icon: <CalendarCheck className="h-5 w-5 text-emerald-500" />,
      onClick: () => navigate('/sessions'),
      description: 'Update session roster attendance',
    },
    canReadBatches && {
      label: 'View Batches',
      icon: <Layers className="h-5 w-5 text-sky-500" />,
      onClick: () => navigate('/batches'),
      description: 'View training groups and rosters',
    },
    canReadPlayers && {
      label: 'View Players',
      icon: <Users className="h-5 w-5 text-indigo-500" />,
      onClick: () => navigate('/members'),
      description: 'View player directory & profiles',
    },
    canManageMatches && {
      label: 'Import CricHeroes',
      icon: <FileSpreadsheet className="h-5 w-5 text-purple-500" />,
      onClick: () => navigate('/matches/new'),
      description: 'Import scorecards from PDF',
    },
  ].filter(Boolean) as Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    description: string;
  }>;

  if (actions.length === 0) return null;

  const handleActionClick = (onClick: () => void) => {
    setIsOpen(false);
    onClick();
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="flex h-12 min-h-[48px] w-full items-center justify-center gap-2 text-base font-bold shadow-xs"
      >
        <Plus className="h-5 w-5 stroke-[2.5]" />
        <span>Quick Actions</span>
      </Button>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Quick Actions" size="md">
        <div className="space-y-3 py-1">
          <p className="text-fg-muted text-xs">Select an action to perform:</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {actions.map((act, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleActionClick(act.onClick)}
                className="border-border-subtle hover:border-primary/50 hover:bg-primary/5 bg-surface flex min-h-[56px] items-center gap-3.5 rounded-xl border p-3.5 text-left transition-all select-none"
              >
                <div className="bg-surface-elevated border-border-subtle flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                  {act.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-fg truncate text-sm font-bold">{act.label}</p>
                  <p className="text-fg-muted truncate text-xs">{act.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
