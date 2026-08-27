import { useState, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, UserCheck, Building2, ChevronRight, Users } from 'lucide-react';

import { Modal, Select } from '@/components/ui';
import { useAcademyStore, useAuthStore, useTestModeStore, useUiStore } from '@/stores';
import { useActiveAcademy, useMemberships } from '@/features/academies';
import { usePlatformAcademies } from '@/features/admin/hooks/useAdmin';
import type { PlatformAcademy } from '@/features/admin/api/adminApi';
import type { TestModeRole } from '@/stores/testModeStore';

type SelectableTestRole = Exclude<TestModeRole, null>;

const ROLE_LABELS: Record<SelectableTestRole, string> = {
  student: 'Student',
  coach: 'Coach',
  academy_owner: 'Academy Owner',
  parent: 'Parent',
};

/** Must stay in step with ROLE_HOME / HomeRedirect's test-mode branch. */
const ROLE_PATHS: Record<SelectableTestRole, string> = {
  student: '/player',
  coach: '/coach',
  academy_owner: '/dashboard',
  parent: '/parent/dashboard',
};

interface TestAppAsModalProps {
  open: boolean;
  onClose: () => void;
}

export function TestAppAsModal({ open, onClose }: TestAppAsModalProps) {
  const navigate = useNavigate();
  const selectId = useId();
  const pushToast = useUiStore((state) => state.pushToast);
  // Resolved (not the raw store value): `academyStore.activeAcademyId` is null
  // until the user explicitly switches academies, while the dashboards fall back
  // to the first active membership. Reading the store directly made this modal
  // default to the first *platform* academy rather than the one actually being
  // viewed, so a preview silently targeted the wrong academy.
  const { academyId: activeAcademyId } = useActiveAcademy();
  const setActiveAcademy = useAcademyStore((state) => state.setActiveAcademy);
  const setTestMode = useTestModeStore((state) => state.setTestMode);
  const isSuperAdmin = useAuthStore((state) => state.profile?.isSuperAdmin === true);

  const platformAcademiesQuery = usePlatformAcademies({ enabled: isSuperAdmin && open });
  const myMemberships = useMemberships();

  // Combine platform academies with personal memberships for selection
  const platformList: Array<{ id: string; name: string; city: string | null }> =
    platformAcademiesQuery.data?.map((a: PlatformAcademy) => ({
      id: a.id,
      name: a.name,
      city: a.city,
    })) ??
    myMemberships.active.map((m) => ({
      id: m.academyId,
      name: m.academyName,
      city: m.city,
    }));

  const [selectedAcademyId, setSelectedAcademyId] = useState<string>(
    activeAcademyId ?? (platformList[0]?.id || ''),
  );

  const currentSelectedId = selectedAcademyId || activeAcademyId || platformList[0]?.id || '';

  const handleSelectRole = (role: Exclude<TestModeRole, null>) => {
    if (currentSelectedId && currentSelectedId !== activeAcademyId) {
      setActiveAcademy(currentSelectedId);
    }

    onClose();

    const roleLabel = ROLE_LABELS[role];
    const targetPath = ROLE_PATHS[role];

    /**
     * Navigate BEFORE flipping the role — the order matters and is not
     * cosmetic.
     *
     * The route change and the role change are not applied in one commit, so
     * there is an intermediate render, and whichever guard is mounted for it
     * decides whether we survive. Setting the role first meant the page being
     * left re-evaluated *itself* against the new role: leaving the owner
     * dashboard as "coach" failed its own `RequireRole allow={['academy_owner',
     * 'super_admin']}`, which fired `<Navigate to="/forbidden" replace />` and
     * clobbered this navigation. Test App As therefore landed on 403 for every
     * role except the one whose home you already happened to be on.
     *
     * Going to the destination first makes the intermediate state "super admin,
     * test mode off", which every route permits (`effectiveSuperAdmin`), and
     * the final state is the test role on its own home route, which that route
     * permits by definition. Neither intermediate can fail.
     */
    navigate(targetPath);
    setTestMode(role, currentSelectedId);

    pushToast({
      title: '🧪 Test Mode Active',
      description: `Now viewing application as ${roleLabel}`,
      variant: 'info',
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="🧪 Test App As" size="md">
      <div className="space-y-4 py-1">
        {/* Academy Selector */}
        {platformList.length > 0 && (
          <div className="space-y-1.5">
            <label
              htmlFor={selectId}
              className="text-fg-muted text-xs font-bold tracking-wider uppercase"
            >
              Target Academy
            </label>
            <Select
              id={selectId}
              value={currentSelectedId}
              onChange={(e) => setSelectedAcademyId(e.target.value)}
              className="min-h-[44px]"
            >
              {platformList.map((acad) => (
                <option key={acad.id} value={acad.id}>
                  {acad.name} {acad.city ? `(${acad.city})` : ''}
                </option>
              ))}
            </Select>
          </div>
        )}

        <p className="text-fg-muted text-xs">
          Select a role to preview the application layout and features without changing database
          permissions:
        </p>

        {/* Role Options List */}
        <div className="space-y-2.5">
          {/* Student Role */}
          <button
            type="button"
            onClick={() => handleSelectRole('student')}
            className="border-border-subtle hover:border-primary/50 hover:bg-primary/5 bg-surface flex min-h-[60px] w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-fg text-sm font-bold">Student / Player</p>
                <p className="text-fg-muted truncate text-xs">
                  See the app from a player&apos;s perspective (stats, upcoming training & drills).
                </p>
              </div>
            </div>
            <ChevronRight className="text-fg-muted h-5 w-5 shrink-0" />
          </button>

          {/* Coach Role */}
          <button
            type="button"
            onClick={() => handleSelectRole('coach')}
            className="border-border-subtle hover:border-info/50 hover:bg-info/5 bg-surface flex min-h-[60px] w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-info/10 text-info flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                <UserCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-fg text-sm font-bold">Coach</p>
                <p className="text-fg-muted truncate text-xs">
                  See sessions, attendance, players and matches from a coach perspective.
                </p>
              </div>
            </div>
            <ChevronRight className="text-fg-muted h-5 w-5 shrink-0" />
          </button>

          {/* Academy Owner Role */}
          <button
            type="button"
            onClick={() => handleSelectRole('academy_owner')}
            className="border-border-subtle bg-surface flex min-h-[60px] w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all hover:border-amber-500/50 hover:bg-amber-500/5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-fg text-sm font-bold">Academy Owner</p>
                <p className="text-fg-muted truncate text-xs">
                  See the complete academy management experience and squad performance.
                </p>
              </div>
            </div>
            <ChevronRight className="text-fg-muted h-5 w-5 shrink-0" />
          </button>

          {/* Parent Role */}
          <button
            type="button"
            onClick={() => handleSelectRole('parent')}
            className="border-border-subtle bg-surface flex min-h-[60px] w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all hover:border-purple-500/50 hover:bg-purple-500/5"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                <Users className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-fg text-sm font-bold">Parent</p>
                <p className="text-fg-muted truncate text-xs">
                  See the family dashboard: a child&apos;s sessions, attendance and results.
                </p>
              </div>
            </div>
            <ChevronRight className="text-fg-muted h-5 w-5 shrink-0" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
