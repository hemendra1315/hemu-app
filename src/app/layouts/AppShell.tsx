import {
  CalendarDays,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Trophy,
  User,
  Users,
  WifiOff,
  BarChart2,
  Settings,
} from 'lucide-react';
import { Suspense, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { LoadingScreen } from '@/components/feedback';
import { Avatar, Button, Modal, ThemeToggle } from '@/components/ui';
import { AcademySwitcher, useActiveAcademy } from '@/features/academies';
import { useAuth } from '@/features/auth';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { InstallAppButton } from '@/features/pwa/components/InstallAppButton';
import { useOnlineStatus } from '@/hooks';
import { hasCapability, useActiveRoles, useCan, type Capability } from '@/lib/rbac';
import { useAcademyStore, useTestModeStore } from '@/stores';
import { cn } from '@/lib/utils/cn';
import { MobileBottomNav, MobileFab } from '@/components/mobile';

interface NavItemDef {
  to: string;
  label: string;
  icon: ReactNode;
  requiresCapability: Capability | null;
  superAdminOnly?: boolean;
  group?: string;
  parentOnly?: boolean;
}

const SIDEBAR_ITEMS: NavItemDef[] = [
  {
    to: '/admin',
    label: 'Super Admin',
    icon: <ShieldCheck className="h-4 w-4" aria-hidden />,
    requiresCapability: null,
    superAdminOnly: true,
    group: 'Platform',
  },
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden />,
    requiresCapability: 'academy:update',
    group: 'Academy',
  },
  {
    to: '/coach',
    label: 'Coach View',
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden />,
    requiresCapability: 'sessions:manage',
    group: 'Home',
  },
  {
    to: '/parent/dashboard',
    label: 'Family Dashboard',
    icon: <Users className="h-4 w-4" aria-hidden />,
    requiresCapability: null,
    parentOnly: true,
    group: 'Home',
  },
  {
    to: '/player',
    label: 'My Cricket',
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden />,
    requiresCapability: 'stats:read_own',
    group: 'Home',
  },
  {
    to: '/members',
    label: 'Members',
    icon: <Users className="h-4 w-4" aria-hidden />,
    requiresCapability: 'members:manage',
    group: 'People',
  },
  {
    to: '/batches',
    label: 'Batches',
    icon: <Menu className="h-4 w-4" aria-hidden />,
    requiresCapability: 'batches:read',
    group: 'Training',
  },
  {
    to: '/sessions',
    label: 'Sessions',
    icon: <CalendarDays className="h-4 w-4" aria-hidden />,
    requiresCapability: 'sessions:read',
    group: 'Training',
  },
  {
    to: '/matches',
    label: 'Matches',
    icon: <Trophy className="h-4 w-4" aria-hidden />,
    requiresCapability: 'matches:read',
    group: 'Matches',
  },
  {
    to: '/stats',
    label: 'Stats & Performance',
    icon: <BarChart2 className="h-4 w-4" aria-hidden />,
    requiresCapability: null,
    group: 'Matches',
  },
  {
    to: '/settings/academy',
    label: 'Academy Settings',
    icon: <Settings className="h-4 w-4" aria-hidden />,
    requiresCapability: 'academy:update',
    group: 'Academy',
  },
  {
    to: '/profile',
    label: 'My Profile',
    icon: <User className="h-4 w-4" aria-hidden />,
    requiresCapability: null,
    group: 'Academy',
  },
];

/** Authenticated application chrome: sidebar (desktop), bottom nav (mobile), top bar & routed content. */
export function AppShell() {
  const { profile, logout } = useAuth();
  const roles = useActiveRoles();
  const online = useOnlineStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const { membership } = useActiveAcademy();
  const activeAcademyId = useAcademyStore((state) => state.activeAcademyId);
  const testModeRole = useTestModeStore((state) => state.activeRole);
  const exitTestMode = useTestModeStore((state) => state.exitTestMode);

  const isSuperAdmin = profile?.isSuperAdmin === true;
  const displayName = profile?.fullName ?? profile?.email ?? 'User';

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const isSuperAdminMode =
    isSuperAdmin && !testModeRole && Boolean(activeAcademyId) && location.pathname !== '/admin';

  // Filter allowed items for the user
  const allowedNavItems = SIDEBAR_ITEMS.filter((item) => {
    const isParent = testModeRole === 'parent' || (!testModeRole && roles.includes('parent'));
    if (testModeRole) {
      if (item.superAdminOnly) return false;
      if (item.parentOnly && !isParent) return false;
      const mappedTestRole = testModeRole === 'student' ? 'player' : testModeRole;
      return (
        item.requiresCapability === null || hasCapability([mappedTestRole], item.requiresCapability)
      );
    }
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.parentOnly && !isParent) return false;
    return item.requiresCapability === null || hasCapability(roles, item.requiresCapability);
  });

  const canUpdateAcademy = useCan('academy:update');
  const targetSettingsRoute = canUpdateAcademy ? '/settings/academy' : '/profile';

  return (
    <div className="bg-bg min-h-screen">
      {/* HEADER: Compact & Responsive */}
      <header className="border-border-subtle bg-surface/95 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur-md">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AcademySwitcher className="min-w-0" />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {!online ? (
            <span
              className="text-warning flex items-center gap-1 text-xs font-medium"
              role="status"
            >
              <WifiOff className="h-4 w-4" aria-hidden /> Offline
            </span>
          ) : null}
          <NotificationBell />
          <ThemeToggle />
          <button
            onClick={() => navigate(targetSettingsRoute)}
            aria-label="Settings"
            className="text-fg-muted hover:bg-surface-muted hover:text-fg flex h-9 w-9 items-center justify-center rounded-xl transition active:scale-95"
          >
            <Settings className="h-4 w-4" />
          </button>
          <NavLink to="/profile" aria-label="View Profile">
            <Avatar name={displayName} src={profile?.avatarUrl} size="sm" />
          </NavLink>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await logout();
              navigate('/sign-in', { replace: true });
            }}
            className="hidden min-h-[40px] px-3 text-xs sm:inline-flex"
          >
            Sign out
          </Button>
        </div>
      </header>

      {/* TEST MODE BANNER */}
      {testModeRole ? (
        <div className="relative z-30 flex min-h-[36px] flex-wrap items-center justify-between gap-1.5 border-b border-purple-500/30 bg-purple-500/15 px-3 py-1.5 text-xs font-medium text-purple-700 md:text-sm dark:text-purple-300">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <FlaskConical className="h-4 w-4 shrink-0 text-purple-500" />
            <span className="truncate">
              <strong className="font-bold">TEST MODE</strong> · Viewing as{' '}
              <span className="font-semibold">
                {testModeRole === 'student'
                  ? 'Student'
                  : testModeRole === 'coach'
                    ? 'Coach'
                    : 'Academy Owner'}
              </span>
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 shrink-0 border-purple-500/40 bg-purple-500/20 px-2 text-xs font-semibold text-purple-700 hover:bg-purple-500/30 dark:text-purple-200"
            onClick={() => {
              exitTestMode();
              navigate('/admin');
            }}
          >
            Exit Test Mode
          </Button>
        </div>
      ) : isSuperAdminMode ? (
        <div className="relative z-30 flex min-h-[36px] flex-wrap items-center justify-between gap-1.5 border-b border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-700 md:text-sm dark:text-amber-300">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="truncate">
              <strong className="font-bold">SUPER ADMIN</strong> · Viewing:{' '}
              <span className="font-semibold">{membership?.academyName || 'Academy'}</span>
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 shrink-0 border-amber-500/40 bg-amber-500/20 px-2 text-xs font-medium text-amber-700 hover:bg-amber-500/30 dark:text-amber-200"
            onClick={() => navigate('/admin')}
          >
            Admin
          </Button>
        </div>
      ) : null}

      <div className="flex">
        {/* DESKTOP SIDEBAR (>= 768px / md) */}
        <aside className="border-border-subtle bg-surface hidden md:block md:w-56 md:shrink-0 md:border-r md:p-3">
          <nav className="space-y-6">
            {['Home', 'People', 'Training', 'Matches', 'Academy', 'Platform'].map((group) => {
              const groupItems = allowedNavItems.filter((i) => i.group === group);
              if (groupItems.length === 0) return null;
              return (
                <div key={group} className="space-y-1">
                  <p className="text-fg-muted mb-2 px-3 text-xs font-bold tracking-wider uppercase">
                    {group}
                  </p>
                  {groupItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
                          isActive
                            ? 'bg-primary text-primary-inverse'
                            : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                        )
                      }
                    >
                      {item.icon}
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 md:pb-6">
          <Suspense fallback={<LoadingScreen />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* MOBILE FIXED BOTTOM NAVIGATION & FAB */}
      <MobileFab />
      <MobileBottomNav />

      {/* MORE MENU SHEET MODAL (< 768px / md) */}
      <Modal
        open={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        title="More & Account"
        size="sm"
      >
        <div className="space-y-5 py-2">
          {/* Academy Group */}
          <div className="space-y-1">
            <p className="text-fg-muted mb-1 px-2 text-xs font-bold tracking-wider uppercase">
              Academy
            </p>
            <NavLink
              to="/batches"
              onClick={() => setIsMoreMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                )
              }
            >
              <Menu className="h-5 w-5" />
              <span>Batches</span>
            </NavLink>
            <NavLink
              to="/sessions"
              onClick={() => setIsMoreMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                )
              }
            >
              <CalendarDays className="h-5 w-5" />
              <span>Sessions</span>
            </NavLink>
          </div>

          {/* Management Group */}
          <div className="border-border-subtle space-y-1 border-t pt-3">
            <p className="text-fg-muted mb-1 px-2 text-xs font-bold tracking-wider uppercase">
              Management
            </p>
            <NavLink
              to="/members"
              onClick={() => setIsMoreMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                )
              }
            >
              <Users className="h-5 w-5" />
              <span>Members & Roster</span>
            </NavLink>
            <NavLink
              to="/matches"
              onClick={() => setIsMoreMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                )
              }
            >
              <Trophy className="h-5 w-5" />
              <span>Matches</span>
            </NavLink>
          </div>

          {/* Account Group */}
          <div className="border-border-subtle space-y-1 border-t pt-3">
            <p className="text-fg-muted mb-1 px-2 text-xs font-bold tracking-wider uppercase">
              Account
            </p>
            <NavLink
              to="/profile"
              onClick={() => setIsMoreMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                )
              }
            >
              <User className="h-5 w-5" />
              <span>My Profile</span>
            </NavLink>
            <div className="px-2 pt-1">
              <InstallAppButton />
            </div>
            <Button
              variant="secondary"
              className="min-h-[48px] w-full justify-start gap-3 text-red-500 hover:text-red-600"
              onClick={async () => {
                setIsMoreMenuOpen(false);
                await logout();
                navigate('/sign-in', { replace: true });
              }}
            >
              <LogOut className="h-5 w-5" /> Sign out
            </Button>
          </div>

          {/* Platform / Super Admin Group */}
          {isSuperAdmin ? (
            <div className="border-border-subtle space-y-1 border-t pt-3">
              <p className="mb-1 px-2 text-xs font-bold tracking-wider text-amber-500 uppercase">
                Platform
              </p>
              <NavLink
                to="/admin"
                onClick={() => setIsMoreMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'bg-amber-500/10 font-semibold text-amber-500'
                      : 'text-amber-500/80 hover:bg-amber-500/10 hover:text-amber-500',
                  )
                }
              >
                <ShieldCheck className="h-5 w-5" />
                <span>Super Admin Panel</span>
              </NavLink>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
