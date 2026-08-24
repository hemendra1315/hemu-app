import {
  Home,
  Users,
  CalendarDays,
  Layers,
  MoreHorizontal,
  Trophy,
  User,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMemberships } from '@/features/academies';
import { useAuth } from '@/features/auth';
import { useCan } from '@/lib/rbac';
import { useAcademyStore, useTestModeStore } from '@/stores';
import { ROLE_HOME, type AppRole } from '@/types/enums';

interface NavItemDef {
  key: string;
  to: string;
  label: string;
  icon: typeof Home;
  matchPrefixes: string[];
}

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { current } = useMemberships();
  const { profile } = useAuth();
  const testModeRole = useTestModeStore((s) => s.activeRole);
  const activeAcademyId = useAcademyStore((s) => s.activeAcademyId);

  const canUpdateAcademy = useCan('academy:update');
  const isSuperAdmin = profile?.isSuperAdmin === true;

  const role: AppRole = testModeRole
    ? testModeRole === 'student'
      ? 'player'
      : testModeRole
    : (current?.role ?? 'player');

  const homePath = testModeRole
    ? (ROLE_HOME[role] ?? '/dashboard')
    : isSuperAdmin && !activeAcademyId
      ? '/admin'
      : isSuperAdmin && activeAcademyId
        ? '/dashboard'
        : (ROLE_HOME[role] ?? '/dashboard');

  let items: NavItemDef[] = [];

  if (testModeRole === 'coach' || (!testModeRole && !canUpdateAcademy && role === 'coach')) {
    // Coach: Home | Players | Batches | Sessions | More
    items = [
      {
        key: 'home',
        to: homePath,
        label: 'Home',
        icon: Home,
        matchPrefixes: ['/dashboard', '/coach', '/me'],
      },
      {
        key: 'players',
        to: '/members',
        label: 'Players',
        icon: Users,
        matchPrefixes: ['/members'],
      },
      {
        key: 'batches',
        to: '/batches',
        label: 'Batches',
        icon: Layers,
        matchPrefixes: ['/batches'],
      },
      {
        key: 'sessions',
        to: '/sessions',
        label: 'Sessions',
        icon: CalendarDays,
        matchPrefixes: ['/sessions'],
      },
      {
        key: 'more',
        to: '/more',
        label: 'More',
        icon: MoreHorizontal,
        matchPrefixes: ['/more', '/drills', '/matches', '/stats', '/profile'],
      },
    ];
  } else if (
    testModeRole === 'student' ||
    (!testModeRole && !canUpdateAcademy && role === 'player')
  ) {
    // Student / Player: Home | Sessions | Matches | Profile | More
    items = [
      {
        key: 'home',
        to: homePath,
        label: 'Home',
        icon: Home,
        matchPrefixes: ['/player', '/dashboard', '/me'],
      },
      {
        key: 'sessions',
        to: '/sessions',
        label: 'Sessions',
        icon: CalendarDays,
        matchPrefixes: ['/sessions'],
      },
      {
        key: 'matches',
        to: '/matches',
        label: 'Matches',
        icon: Trophy,
        matchPrefixes: ['/matches'],
      },
      {
        key: 'profile',
        to: '/profile',
        label: 'Profile',
        icon: User,
        matchPrefixes: ['/profile'],
      },
      {
        key: 'more',
        to: '/more',
        label: 'More',
        icon: MoreHorizontal,
        matchPrefixes: ['/more', '/stats', '/drills'],
      },
    ];
  } else if (
    testModeRole === 'parent' ||
    (!testModeRole && !canUpdateAcademy && role === 'parent')
  ) {
    // Parent: Home | Profile | More
    items = [
      {
        key: 'home',
        to: homePath,
        label: 'Home',
        icon: Home,
        matchPrefixes: ['/parent/dashboard', '/dashboard'],
      },
      {
        key: 'profile',
        to: '/parent/profile',
        label: 'Profile',
        icon: User,
        matchPrefixes: ['/parent/profile', '/profile'],
      },
      {
        key: 'more',
        to: '/more',
        label: 'More',
        icon: MoreHorizontal,
        matchPrefixes: ['/more', '/parent/notifications'],
      },
    ];
  } else if (canUpdateAcademy) {
    // Owner & Super Admin: Home | Players | Sessions | Settings | More
    items = [
      {
        key: 'home',
        to: homePath,
        label: isSuperAdmin && location.pathname === '/admin' ? 'Admin' : 'Home',
        icon: isSuperAdmin && location.pathname === '/admin' ? ShieldCheck : Home,
        matchPrefixes: ['/dashboard', '/owner', '/admin', '/me'],
      },
      {
        key: 'players',
        to: '/members',
        label: 'Players',
        icon: Users,
        matchPrefixes: ['/members'],
      },
      {
        key: 'sessions',
        to: '/sessions',
        label: 'Sessions',
        icon: CalendarDays,
        matchPrefixes: ['/sessions'],
      },
      {
        key: 'settings',
        to: '/settings/academy',
        label: 'Settings',
        icon: Settings,
        matchPrefixes: ['/settings'],
      },
      {
        key: 'more',
        to: '/more',
        label: 'More',
        icon: MoreHorizontal,
        matchPrefixes: ['/more', '/drills', '/stats', '/batches', '/matches'],
      },
    ];
  }

  const isItemActive = (item: NavItemDef) => {
    return item.matchPrefixes.some(
      (prefix) => location.pathname === prefix || location.pathname.startsWith(prefix + '/'),
    );
  };

  return (
    <nav
      className="bg-surface/95 border-border-subtle fixed right-0 bottom-0 left-0 z-40 border-t pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur-md md:hidden"
      aria-label="Mobile Bottom Navigation"
    >
      <div
        className="grid h-16 items-center px-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isItemActive(item);
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.to)}
              className={`flex h-full min-h-[48px] w-full min-w-0 flex-col items-center justify-center px-1 py-1 transition active:scale-95 ${
                active ? 'text-primary font-semibold' : 'text-fg-muted hover:text-fg font-normal'
              }`}
            >
              <Icon
                className={`mb-1 h-5 w-5 shrink-0 ${active ? 'text-primary' : 'text-fg-muted'}`}
              />
              <span className="w-full truncate text-center text-[10px] leading-none tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
