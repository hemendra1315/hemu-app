import { useState } from 'react';
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
  Megaphone,
  Layers,
  FileSpreadsheet,
  QrCode,
  UserCheck,
} from 'lucide-react';
import { MobilePageHeader } from '@/components/mobile';
import { Card } from '@/components/ui';
import { useAuthStore, useTestModeStore } from '@/stores';
import { useActiveAcademy, useMemberships } from '@/features/academies';
import { useAuth } from '@/features/auth';
import { useCan } from '@/lib/rbac';
import { StudentMonthlyFeeModal, STUDENT_MONTHLY_FEE_AMOUNT } from '@/features/billing';

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
  const canExportReports = useCan('reports:export');
  const isSuperAdmin = profile?.isSuperAdmin === true && !testModeRole;

  const displayRole = testModeRole
    ? testModeRole === 'student'
      ? 'student'
      : testModeRole
    : (current?.role ?? 'player');

  const { logout } = useAuth();
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);

  const handleSignOut = async () => {
    await logout();
    navigate('/sign-in', { replace: true });
  };

  const managementItems: (MenuItem | false)[] = [
    canManageMembers && {
      to: '/members',
      label: 'Players & Members',
      desc: 'Squad directory, athletes & staff',
      icon: Users,
    },
    canManageMembers && {
      to: '/batches',
      label: 'Batches & Squads',
      desc: 'Training cohorts & timing schedules',
      icon: Layers,
    },
    (canExportReports || canManageMembers) && {
      to: '/reports',
      label: 'Reports & Export Center',
      desc: 'Attendance registers, athlete cards & schedules',
      icon: FileSpreadsheet,
    },
    {
      to: '/stats',
      label: 'Stats & Telemetry',
      desc: 'Cricket analytics, leaderboards & metrics',
      icon: BarChart2,
    },
  ];

  const activityItems: (MenuItem | false)[] = [
    canReadAttendance && {
      to: '/attendance',
      label: 'Attendance & Analytics',
      desc: 'Attendance registers, records & monthly trends',
      icon: UserCheck,
    },
    canReadAttendance && {
      to: '/sessions',
      label: 'Training Sessions & Drills',
      desc: 'Schedule, training plans & batch sessions',
      icon: CalendarCheck,
    },
    canReadMatches && {
      to: '/matches',
      label: 'Matches & Scorecards',
      desc: 'Live fixtures, CricHeroes & results',
      icon: Trophy,
    },
    canReadDrills && {
      to: '/drills',
      label: 'Drill Bank & Skills',
      desc: 'Technical drill bank and skill logs',
      icon: Activity,
    },
    {
      to: '/announcements',
      label: 'Announcements',
      desc: 'Academy news, bulletins & broadcasts',
      icon: Megaphone,
    },
  ];

  const accountItems: (MenuItem | false)[] = [
    {
      to: '/profile',
      label: 'My Account & Profile',
      desc: profile?.fullName ?? profile?.email ?? 'User Account',
      icon: User,
    },
    isSuperAdmin && {
      to: '/admin',
      label: 'Super Admin Panel',
      desc: 'Platform governance & academy management',
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
    <div className="space-y-4 pb-24 md:pb-8">
      <div className="md:hidden">
        <MobilePageHeader
          title="More"
          subtitle={membership?.academyName ?? 'Academy Navigation'}
          showBack={false}
          showSettingsAction={false}
        />
      </div>

      <div className="hidden md:block">
        <h1 className="text-fg text-2xl font-black tracking-tight">More Options</h1>
        <p className="text-fg-muted mt-1 text-sm font-medium">
          Academy directory, settings, training tools, and profile preferences.
        </p>
      </div>

      <div className="space-y-4">
        {/* 1. Prominent Academy Settings Card for Owners */}
        {canUpdateAcademy && (
          <button
            onClick={() => navigate('/settings/academy')}
            className="border-primary/30 bg-primary/10 hover:bg-primary/15 group flex min-h-[58px] w-full items-center justify-between rounded-2xl border p-4 text-left transition-all active:scale-[0.99]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-black shadow-xs">
                <Settings className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-fg truncate text-sm font-bold">Academy Settings</span>
                <p className="text-fg-muted truncate text-xs">
                  Branding, join code & operational details
                </p>
              </div>
            </div>
            <ChevronRight className="text-primary h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        {/* 2. Student Monthly Pass (FamPay QR ₹200) */}
        <button
          type="button"
          onClick={() => setIsFeeModalOpen(true)}
          className="group flex min-h-[58px] w-full items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-left transition-all hover:bg-emerald-500/15 active:scale-[0.99]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 font-bold text-white shadow-xs">
              <QrCode className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-fg truncate text-sm font-bold">Student Monthly App Pass</span>
                <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-black text-emerald-600 uppercase dark:text-emerald-400">
                  ₹{STUDENT_MONTHLY_FEE_AMOUNT} / mo
                </span>
              </div>
              <p className="text-fg-muted truncate text-xs">
                FamPay QR scan, UPI payment & monthly access status
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-emerald-500 transition-transform group-hover:translate-x-0.5" />
        </button>

        {/* 3. User Account Card */}
        <Card className="border-border-subtle bg-surface flex items-center justify-between rounded-2xl border p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary/15 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-base font-black">
              {(profile?.fullName?.[0] ?? profile?.email?.[0] ?? 'U').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-fg truncate text-sm font-bold">
                {profile?.fullName ?? 'User Profile'}
              </p>
              <p className="text-fg-muted truncate text-xs">{profile?.email}</p>
              {displayRole && (
                <span className="bg-primary/10 text-primary border-primary/20 mt-1 inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                  {displayRole.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
        </Card>

        <StudentMonthlyFeeModal
          open={isFeeModalOpen}
          onClose={() => setIsFeeModalOpen(false)}
          studentId={profile?.id || 'demo_student'}
          studentName={profile?.fullName || 'Student Player'}
          studentEmail={profile?.email || 'player@cam.app'}
          academyId={membership?.academyId || 'academy_1'}
          academyName={membership?.academyName || 'Cricket Academy'}
        />

        {/* Menu Sections */}
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-2">
            <h3 className="text-fg-muted px-1 text-xs font-bold tracking-wider uppercase">
              {section.title}
            </h3>
            <Card className="border-border-subtle bg-surface divide-border-subtle divide-y overflow-hidden rounded-2xl border">
              {section.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={i}
                    onClick={() => navigate(item.to)}
                    className="hover:bg-surface-muted/60 group flex min-h-[54px] w-full items-center justify-between p-3.5 text-left transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-fg group-hover:text-primary truncate text-sm font-bold transition-colors">
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className="bg-primary rounded-md px-1.5 py-0.5 text-[10px] font-black text-black uppercase">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-fg-muted truncate text-xs">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="text-fg-muted group-hover:text-primary h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </Card>
          </div>
        ))}

        {/* Switch Academy Button */}
        <button
          onClick={() => navigate('/onboarding/select-academy')}
          className="border-border-subtle bg-surface hover:bg-surface-muted/60 group flex min-h-[48px] w-full items-center justify-between rounded-2xl border p-3.5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Building2 className="text-primary h-4 w-4" />
            <span className="text-fg text-sm font-bold">Switch Academy</span>
          </div>
          <ChevronRight className="text-fg-muted group-hover:text-primary h-4 w-4 transition-colors" />
        </button>

        {/* Sign Out Button */}
        <button
          onClick={() => void handleSignOut()}
          className="bg-danger/10 hover:bg-danger/20 text-danger border-danger/20 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border p-3.5 font-bold transition active:scale-[0.99]"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
