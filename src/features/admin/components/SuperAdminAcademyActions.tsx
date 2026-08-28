import { useState } from 'react';
import { UserPlus, Sparkles, UserCheck, Settings, FlaskConical } from 'lucide-react';
import { Modal } from '@/components/ui';
import { useAuthStore, useTestModeStore } from '@/stores';
import { useActiveAcademy } from '@/features/academies';
import { AddMemberModal } from './AddMemberModal';
import { AddCoachModal } from './AddCoachModal';
import { SeedDemoDataModal } from './SeedDemoDataModal';
import { TestAppAsModal } from './TestAppAsModal';

export function SuperAdminAcademyActions() {
  const isSuperAdmin = useAuthStore((s) => s.profile?.isSuperAdmin === true);
  // Resolve through useActiveAcademy, not the raw `academyStore.activeAcademyId`.
  // The store stays null until the user explicitly switches academies, while the
  // dashboards themselves fall back to the first active membership — so reading
  // the store directly hid this whole panel (Add Member / Add Coach / Seed Demo
  // Data / Test App As) from any super admin who never touched the switcher.
  const { academyId: activeAcademyId } = useActiveAcademy();
  const testModeRole = useTestModeStore((s) => s.activeRole);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [isTestAppAsModalOpen, setIsTestAppAsModalOpen] = useState(false);

  if (!isSuperAdmin || !activeAcademyId || testModeRole !== null) return null;

  return (
    <>
      {/*
       * Deliberately unobtrusive: this page is meant to look and feel exactly
       * like the academy owner's own dashboard when a super admin enters an
       * academy. A single small icon (no banner, no "Super Admin" label,
       * no color) keeps Add Member / Add Coach / Seed Demo Data / Test App As
       * reachable without announcing that a super admin is looking at it.
       */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          title="Academy management"
          aria-label="Academy management"
          className="text-fg-muted hover:text-fg hover:bg-surface-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <Settings className="h-4 w-4" />
        </button>
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
                  Preview as Student, Coach, Academy Owner, or Parent
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
