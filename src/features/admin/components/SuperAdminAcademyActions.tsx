import { useState } from 'react';
import { UserPlus, Sparkles, UserCheck, Settings, Building2, FlaskConical } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { useAcademyStore, useAuthStore, useTestModeStore } from '@/stores';
import { AddMemberModal } from './AddMemberModal';
import { AddCoachModal } from './AddCoachModal';
import { SeedDemoDataModal } from './SeedDemoDataModal';
import { TestAppAsModal } from './TestAppAsModal';

export function SuperAdminAcademyActions() {
  const isSuperAdmin = useAuthStore((s) => s.profile?.isSuperAdmin === true);
  const activeAcademyId = useAcademyStore((s) => s.activeAcademyId);
  const testModeRole = useTestModeStore((s) => s.activeRole);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [isTestAppAsModalOpen, setIsTestAppAsModalOpen] = useState(false);

  if (!isSuperAdmin || !activeAcademyId || testModeRole !== null) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="truncate text-xs font-bold text-amber-500">Super Admin Controls</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsMenuOpen(true)}
          className="h-9 min-h-[36px] shrink-0 border-amber-500/30 px-3 text-xs font-bold text-amber-500 hover:bg-amber-500/20"
        >
          <Settings className="mr-1.5 h-3.5 w-3.5" />
          Manage
        </Button>
      </div>

      {/* Academy Management Bottom Sheet / Menu */}
      <Modal
        open={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="Academy Management"
        size="sm"
      >
        <div className="space-y-3 py-1">
          <p className="text-fg-muted text-xs">Platform Super Admin actions for this academy:</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setIsMemberModalOpen(true);
              }}
              className="border-border-subtle hover:border-primary/50 hover:bg-surface-elevated bg-surface flex min-h-[48px] w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
            >
              <UserPlus className="text-primary h-5 w-5 shrink-0" />
              <div>
                <p className="text-fg text-sm font-bold">Add Member</p>
                <p className="text-fg-muted text-xs">Add a player directly to this academy</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setIsCoachModalOpen(true);
              }}
              className="border-border-subtle hover:border-primary/50 hover:bg-surface-elevated bg-surface flex min-h-[48px] w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
            >
              <UserCheck className="text-info h-5 w-5 shrink-0" />
              <div>
                <p className="text-fg text-sm font-bold">Add Coach</p>
                <p className="text-fg-muted text-xs">Assign a coach to this academy</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setIsSeedModalOpen(true);
              }}
              className="border-border-subtle hover:border-primary/50 hover:bg-surface-elevated bg-surface flex min-h-[48px] w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors"
            >
              <Sparkles className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-fg text-sm font-bold">Seed Demo Data</p>
                <p className="text-fg-muted text-xs">Populate sample players, batches & matches</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setIsTestAppAsModalOpen(true);
              }}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-left transition-colors hover:border-purple-500/60 hover:bg-purple-500/15"
            >
              <FlaskConical className="h-5 w-5 shrink-0 text-purple-500" />
              <div>
                <p className="text-sm font-bold text-purple-600 dark:text-purple-300">
                  🧪 Test App As
                </p>
                <p className="text-xs text-purple-600/80 dark:text-purple-300/80">
                  Preview as Student, Coach, or Academy Owner
                </p>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      <AddMemberModal
        open={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        academyId={activeAcademyId}
      />
      <AddCoachModal
        open={isCoachModalOpen}
        onClose={() => setIsCoachModalOpen(false)}
        academyId={activeAcademyId}
      />
      <SeedDemoDataModal
        open={isSeedModalOpen}
        onClose={() => setIsSeedModalOpen(false)}
        academyId={activeAcademyId}
      />
      <TestAppAsModal open={isTestAppAsModalOpen} onClose={() => setIsTestAppAsModalOpen(false)} />
    </>
  );
}
