import { useState } from 'react';
import { CalendarCheck, Trophy, Layers } from 'lucide-react';
import { MobilePageHeader } from '@/components/mobile';
import { Card, CardBody, Select } from '@/components/ui';
import { useAcademyStore } from '@/stores';
import { useBatches } from '@/features/batches/hooks/useBatches';
import { useAcademyMembers } from '@/features/members/hooks/useMembers';
import type { UUID } from '@/types';
import {
  useMonthlyAttendanceReport,
  usePlayerPerformanceReport,
  useBatchScheduleReport,
} from '../hooks/useReportsData';
import { MonthlyAttendanceReportView } from '../components/MonthlyAttendanceReportView';
import { PlayerPerformanceReportView } from '../components/PlayerPerformanceReportView';
import { BatchScheduleReportView } from '../components/BatchScheduleReportView';

export type ReportType = 'attendance' | 'performance' | 'schedules';

export default function ReportsPage() {
  const activeAcademyId = useAcademyStore((s) => s.activeAcademyId);

  const [activeTab, setActiveTab] = useState<ReportType>('attendance');

  // Filter states
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedBatchId, setSelectedBatchId] = useState<UUID | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<UUID | null>(null);

  // Queries for batches and members to populate dropdowns
  const { data: batches = [], isLoading: isLoadingBatches } = useBatches(activeAcademyId);
  const { data: members = [], isLoading: isLoadingMembers } = useAcademyMembers(activeAcademyId, {
    role: 'player',
    status: 'active',
  });

  // Default select first batch/player if none selected
  const effectiveBatchId = selectedBatchId || (batches[0]?.id as UUID) || null;
  const effectivePlayerId = selectedPlayerId || (members[0]?.id as UUID) || null;

  // Report Data Queries
  const attendanceQuery = useMonthlyAttendanceReport(
    activeAcademyId,
    effectiveBatchId,
    selectedYear,
    selectedMonth,
  );

  const performanceQuery = usePlayerPerformanceReport(activeAcademyId, effectivePlayerId);

  const scheduleQuery = useBatchScheduleReport(activeAcademyId);

  const reportTabs = [
    {
      id: 'attendance' as ReportType,
      label: 'Monthly Attendance',
      desc: '31-day presence register',
      icon: CalendarCheck,
    },
    {
      id: 'performance' as ReportType,
      label: 'Player Performance',
      desc: 'Athlete report card & MVP',
      icon: Trophy,
    },
    {
      id: 'schedules' as ReportType,
      label: 'Batch Schedules',
      desc: 'Venue & coach allocations',
      icon: Layers,
    },
  ];

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      {/* Mobile Top App Header */}
      <div className="md:hidden">
        <MobilePageHeader
          title="Reports & Exports"
          subtitle="Academy Registers & Cards"
          showBack={true}
          showSettingsAction={false}
        />
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block print:hidden">
        <h1 className="text-fg text-2xl font-black tracking-tight">Reports & Export Center</h1>
        <p className="text-fg-muted mt-1 text-sm font-medium">
          Generate, preview, print, and export official academy registers, player cards, and batch
          schedules.
        </p>
      </div>

      {/* 1. Report Category Tab Switcher */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-3 print:hidden">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                isActive
                  ? 'border-primary/40 bg-primary/10 text-primary shadow-xs'
                  : 'border-border-subtle bg-surface hover:bg-surface-muted/60 text-fg-muted'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  isActive ? 'bg-primary font-bold text-black' : 'bg-surface-muted text-fg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="block truncate text-xs font-bold">{tab.label}</span>
                <span className="text-fg-muted block truncate text-[10px]">{tab.desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. Dynamic Filter Bar */}
      <Card className="border-border-subtle bg-surface rounded-2xl border print:hidden">
        <CardBody className="p-3.5">
          {activeTab === 'attendance' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[180px] flex-1">
                <label className="text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                  Select Batch
                </label>
                <Select
                  value={effectiveBatchId || ''}
                  onChange={(e) => setSelectedBatchId(e.target.value as UUID)}
                  disabled={isLoadingBatches || batches.length === 0}
                  className="w-full text-xs"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.playerCount || 0} players)
                    </option>
                  ))}
                  {batches.length === 0 && <option value="">No batches available</option>}
                </Select>
              </div>

              <div className="w-28">
                <label className="text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                  Month
                </label>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="w-full text-xs"
                >
                  {[
                    'Jan',
                    'Feb',
                    'Mar',
                    'Apr',
                    'May',
                    'Jun',
                    'Jul',
                    'Aug',
                    'Sep',
                    'Oct',
                    'Nov',
                    'Dec',
                  ].map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="w-24">
                <label className="text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                  Year
                </label>
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="w-full text-xs"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[220px] flex-1">
                <label className="text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                  Select Athlete
                </label>
                <Select
                  value={effectivePlayerId || ''}
                  onChange={(e) => setSelectedPlayerId(e.target.value as UUID)}
                  disabled={isLoadingMembers || members.length === 0}
                  className="w-full text-xs"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName || m.email || m.id}
                    </option>
                  ))}
                  {members.length === 0 && <option value="">No athletes registered</option>}
                </Select>
              </div>
            </div>
          )}

          {activeTab === 'schedules' && (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-fg text-xs font-bold">
                  Full Academy Venue & Batch Schedule
                </span>
                <p className="text-fg-muted text-[11px]">
                  Showing all active training squads, coaches, and ground allocations.
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 3. Report View Container */}
      <div>
        {activeTab === 'attendance' && (
          <>
            {attendanceQuery.isLoading ? (
              <div className="text-fg-muted py-12 text-center text-sm">
                Generating Monthly Attendance Register...
              </div>
            ) : attendanceQuery.data ? (
              <MonthlyAttendanceReportView data={attendanceQuery.data} />
            ) : (
              <div className="text-fg-muted py-12 text-center text-sm">
                No attendance data available for the selected batch and period.
              </div>
            )}
          </>
        )}

        {activeTab === 'performance' && (
          <>
            {performanceQuery.isLoading ? (
              <div className="text-fg-muted py-12 text-center text-sm">
                Compiling Athlete Performance Card...
              </div>
            ) : performanceQuery.data ? (
              <PlayerPerformanceReportView data={performanceQuery.data} />
            ) : (
              <div className="text-fg-muted py-12 text-center text-sm">
                No performance data available for this athlete.
              </div>
            )}
          </>
        )}

        {activeTab === 'schedules' && (
          <>
            {scheduleQuery.isLoading ? (
              <div className="text-fg-muted py-12 text-center text-sm">
                Compiling Venue & Batch Schedules...
              </div>
            ) : scheduleQuery.data ? (
              <BatchScheduleReportView data={scheduleQuery.data} />
            ) : (
              <div className="text-fg-muted py-12 text-center text-sm">
                No batch schedules found for this academy.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
