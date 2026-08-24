import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  Trophy,
  Activity,
  User,
  Settings,
  Users,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Building2,
  BarChart2,
} from 'lucide-react';
import { MobilePageHeader } from '@/components/mobile';
import { Card, Badge } from '@/components/ui';
import { useAuthStore, useTestModeStore } from '@/stores';
import { useActiveAcademy, useMemberships } from '@/features/academies';
import { useAuth } from '@/features/auth';
import { useCan } from '@/lib/rbac';

interface MenuItem {
  to: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export function MorePage() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const { membership } = useActiveAcademy();
  const { current } = useMemberships();
  const testModeRole = useTestModeStore((s) => s.activeRole);

  const canReadAttendance = useCan('attendance:read');
  const canReadMatches = useCan('matches:read');
  const canReadDrills = useCan('drills:read');
  const canManageMembers = useCan('members:manage');
  const canUpdateAcademy = useCan('academy:update');
  const isSuperAdmin = profile?.isSuperAdmin === true && !testModeRole;

  const displayRole = testModeRole
    ? testModeRole === 'student'
      ? 'student'
      : testModeRole
    : (current?.role ?? 'player');

  const { logout } = useAuth();

  const handleSignOut = async () => {
    await logout();
    navigate('/sign-in', { replace: true });
  };

  const managementItems: (MenuItem | false)[] = [
    canManageMembers && {
      to: '/members',
      label: 'Players & Members',
      desc: 'Players and staff directory',
      icon: Users,
    },
    canManageMembers && {
      to: '/batches',
      label: 'Batches & Groups',
      desc: 'Training batches and schedules',
      icon: Building2,
    },
    {
      to: '/stats',
      label: 'Stats & Performance',
      desc: 'Cricket statistics and analytics',
      icon: BarChart2,
    },
  ];

  const activityItems: (MenuItem | false)[] = [
    canReadAttendance && {
      to: '/sessions',
      label: 'Attendance & Sessions',
      desc: 'Log and track attendance',
      icon: CalendarCheck,
    },
    canReadMatches && {
      to: '/matches',
      label: 'Matches & Fixtures',
      desc: 'Scorecards and match results',
      icon: Trophy,
    },
    canReadDrills && {
      to: '/drills',
      label: 'Drills & Training',
      desc: 'Drill bank and skill logs',
      icon: Activity,
    },
  ];

  const accountItems: (MenuItem | false)[] = [
    {
      to: '/profile',
      label: 'My Profile',
      desc: profile?.fullName ?? profile?.email ?? 'User Account',
      icon: User,
    },
    isSuperAdmin && {
      to: '/admin',
      label: 'Super Admin Panel',
      desc: 'Platform-wide controls',
      icon: ShieldCheck,
      badge: 'Admin',
    },
  ];

  const sections = [
    {
      title: canUpdateAcademy || canManageMembers ? 'Academy Management' : 'Cricket & Stats',
      items: managementItems.filter((x): x is MenuItem => Boolean(x)),
    },
    {
      title: 'Activity & Sessions',
      items: activityItems.filter((x): x is MenuItem => Boolean(x)),
    },
    {
      title: 'Account',
      items: accountItems.filter((x): x is MenuItem => Boolean(x)),
    },
  ];

  return (
    <div className="bg-bg min-h-screen pb-24 md:pb-6">
      <MobilePageHeader title="More" subtitle={membership?.academyName ?? 'Academy Navigation'} />

      <div className="space-y-3 px-4 pt-1">
        {/* 1. Top-Level Prominent Academy Settings Card (Absolute Top for Owners/Admins) */}
        {canUpdateAcademy && (
          <button
            onClick={() => navigate('/settings/academy')}
            className="bg-primary/5 border-primary/30 hover:bg-primary/10 active:bg-primary/15 flex min-h-[56px] w-full items-center justify-between rounded-2xl border p-3.5 text-left shadow-2xs transition active:scale-[0.99]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary text-primary-fg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs">
                <Settings className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-fg truncate text-sm font-bold">Academy Settings</span>
                <p className="text-fg-muted truncate text-xs">
                  Academy profile, join code & details
                </p>
              </div>
            </div>
            <ChevronRight className="text-primary h-5 w-5 shrink-0" />
          </button>
        )}

        {/* 2. User Card */}
        <Card className="bg-surface border-border-subtle flex items-center justify-between p-3.5 shadow-2xs">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold">
              {profile?.fullName?.[0] ?? profile?.email?.[0] ?? 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-fg truncate text-sm font-semibold">
                {profile?.fullName ?? 'User Profile'}
              </p>
              <p className="text-fg-muted truncate text-xs">{profile?.email}</p>
              {displayRole && (
                <span className="bg-surface-muted text-fg-muted mt-0.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                  {displayRole.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Menu Sections */}
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-2">
            <h3 className="text-fg-muted px-0.5 text-xs font-semibold tracking-wider uppercase">
              {section.title}
            </h3>
            <Card className="divide-border-subtle bg-surface border-border-subtle divide-y overflow-hidden shadow-2xs">
              {section.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={i}
                    onClick={() => navigate(item.to)}
                    className="hover:bg-surface-muted/50 active:bg-surface-muted flex min-h-[52px] w-full items-center justify-between p-3.5 text-left transition"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-fg truncate text-sm font-semibold">
                            {item.label}
                          </span>
                          {item.badge && (
                            <Badge tone="brand" className="text-[10px]">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-fg-muted truncate text-xs">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="text-fg-muted/60 h-4 w-4 shrink-0" />
                  </button>
                );
              })}
            </Card>
          </div>
        ))}

        {/* Switch Academy Button */}
        <button
          onClick={() => navigate('/onboarding/select-academy')}
          className="bg-surface hover:bg-surface-muted/60 border-border-subtle flex min-h-[48px] w-full items-center justify-between rounded-2xl border p-3.5 shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <Building2 className="text-primary h-4 w-4" />
            <span className="text-fg text-sm font-medium">Switch Academy</span>
          </div>
          <ChevronRight className="text-fg-muted/60 h-4 w-4" />
        </button>

        {/* Sign Out Button */}
        <button
          onClick={() => void handleSignOut()}
          className="bg-danger/10 hover:bg-danger/15 text-danger flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl p-3.5 font-semibold shadow-2xs transition active:scale-[0.99]"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
