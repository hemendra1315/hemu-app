import { useState } from 'react';
import { Download, Calendar, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui';
import type { MonthlyAttendanceReportData } from '../types';
import { downloadCsvFile } from '../utils/csvExporter';
import { generateMonthlyAttendanceCsv } from '../utils/reportGenerators';
import { PrintableReportContainer } from './PrintableReportContainer';

interface MonthlyAttendanceReportViewProps {
  data: MonthlyAttendanceReportData;
  onBatchChange?: (batchId: string) => void;
  onMonthChange?: (year: number, month: number) => void;
}

export function MonthlyAttendanceReportView({ data }: MonthlyAttendanceReportViewProps) {
  const [filterAtRiskOnly, setFilterAtRiskOnly] = useState(false);

  const displayedRows = filterAtRiskOnly ? data.rows.filter((r) => r.percentage < 75) : data.rows;

  const handleExportCsv = () => {
    const csv = generateMonthlyAttendanceCsv(data);
    const filename = `Attendance_Register_${data.batchName}_${data.year}_${String(data.month).padStart(2, '0')}.csv`;
    downloadCsvFile(filename, csv);
  };

  const getStatusBadge = (status: 'present' | 'absent' | 'late' | 'excused' | null) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-emerald-500/15 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            P
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-rose-500/15 font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400">
            A
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-amber-500/15 font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
            L
          </span>
        );
      case 'excused':
        return (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-sky-500/15 font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400">
            E
          </span>
        );
      default:
        return <span className="text-fg-muted/40 font-mono text-xs">-</span>;
    }
  };

  return (
    <PrintableReportContainer
      academyName={data.academyName}
      title="Monthly Attendance Register"
      subtitle={`Batch: ${data.batchName} | Period: ${data.year}-${String(data.month).padStart(2, '0')}`}
      actions={
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleExportCsv}
          className="flex items-center gap-1.5"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV / Excel</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* KPI Metrics Summary */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:grid-cols-4">
          <div className="border-border-subtle bg-surface-muted/40 rounded-xl border p-3 print:border-black/20 print:bg-transparent">
            <div className="flex items-center gap-2">
              <Calendar className="text-primary h-4 w-4" />
              <span className="text-fg-muted text-xs font-semibold uppercase">Sessions</span>
            </div>
            <p className="text-fg mt-1 text-xl font-black">{data.batchSummary.totalSessions}</p>
          </div>

          <div className="border-border-subtle bg-surface-muted/40 rounded-xl border p-3 print:border-black/20 print:bg-transparent">
            <div className="flex items-center gap-2">
              <Users className="text-primary h-4 w-4" />
              <span className="text-fg-muted text-xs font-semibold uppercase">Roster Size</span>
            </div>
            <p className="text-fg mt-1 text-xl font-black">{data.rows.length} Athletes</p>
          </div>

          <div className="border-border-subtle bg-surface-muted/40 rounded-xl border p-3 print:border-black/20 print:bg-transparent">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-fg-muted text-xs font-semibold uppercase">Avg Attendance</span>
            </div>
            <p className="text-fg mt-1 text-xl font-black">
              {data.batchSummary.averageAttendanceRate.toFixed(1)}%
            </p>
          </div>

          <div className="border-border-subtle bg-surface-muted/40 rounded-xl border p-3 print:border-black/20 print:bg-transparent">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-fg-muted text-xs font-semibold uppercase">
                At-Risk (&lt;75%)
              </span>
            </div>
            <p className="text-fg mt-1 text-xl font-black">{data.batchSummary.atRiskCount}</p>
          </div>
        </div>

        {/* Legend & Filter Bar (hidden in print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-4">
            <span className="text-fg-muted font-bold tracking-wider uppercase">Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-500/15 font-bold text-emerald-600 dark:text-emerald-400">
                P
              </span>
              <span>Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-rose-500/15 font-bold text-rose-600 dark:text-rose-400">
                A
              </span>
              <span>Absent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-500/15 font-bold text-amber-600 dark:text-amber-400">
                L
              </span>
              <span>Late</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-sky-500/15 font-bold text-sky-600 dark:text-sky-400">
                E
              </span>
              <span>Excused</span>
            </div>
          </div>

          <Button
            type="button"
            variant={filterAtRiskOnly ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilterAtRiskOnly(!filterAtRiskOnly)}
            className="text-xs"
          >
            {filterAtRiskOnly ? 'Show All Athletes' : 'Filter At-Risk Only (<75%)'}
          </Button>
        </div>

        {/* Presence Grid Table */}
        <div className="border-border-subtle divide-border-subtle overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-surface-muted/70 text-fg-muted border-border-subtle border-b font-bold tracking-wider uppercase">
              <tr>
                <th className="bg-surface-muted/90 sticky left-0 z-10 px-3 py-2.5">Athlete Name</th>
                {Array.from({ length: data.daysInMonth }, (_, idx) => idx + 1).map((d) => (
                  <th key={d} className="px-1.5 py-2.5 text-center font-mono">
                    {d}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center">Present</th>
                <th className="px-3 py-2.5 text-center">Sessions</th>
                <th className="px-3 py-2.5 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-border-subtle divide-y">
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={data.daysInMonth + 4} className="text-fg-muted py-6 text-center">
                    No athlete records found for this period.
                  </td>
                </tr>
              ) : (
                displayedRows.map((row) => (
                  <tr key={row.playerId} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="bg-surface sticky left-0 z-10 px-3 py-2 font-semibold">
                      {row.playerName}
                    </td>
                    {Array.from({ length: data.daysInMonth }, (_, idx) => idx + 1).map((d) => (
                      <td key={d} className="px-1 py-1 text-center">
                        {getStatusBadge(row.attendanceByDay[d] ?? null)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-mono font-bold">
                      {row.presentCount}
                    </td>
                    <td className="text-fg-muted px-3 py-2 text-center font-mono">
                      {row.totalSessions}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-black">
                      <span
                        className={
                          row.percentage >= 85
                            ? 'text-emerald-500'
                            : row.percentage >= 75
                              ? 'text-amber-500'
                              : 'text-rose-500'
                        }
                      >
                        {row.percentage.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PrintableReportContainer>
  );
}
