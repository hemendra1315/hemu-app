import { useState } from 'react';
import { Download, DollarSign, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui';
import type { FeeDuesReportData } from '../types';
import { downloadCsvFile } from '../utils/csvExporter';
import { formatPaiseForExport, generateFeeDuesCsv } from '../utils/reportGenerators';
import { PrintableReportContainer } from './PrintableReportContainer';

interface FeeDuesReportViewProps {
  data: FeeDuesReportData;
}

export function FeeDuesReportView({ data }: FeeDuesReportViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'overdue' | 'due_soon'>('all');

  const filteredRecords =
    statusFilter === 'all' ? data.records : data.records.filter((r) => r.status === statusFilter);

  const handleExportCsv = () => {
    const csv = generateFeeDuesCsv(data);
    const filename = `Fee_Collection_Summary_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCsvFile(filename, csv);
  };

  const getStatusBadge = (status: 'paid' | 'partial' | 'overdue' | 'due_soon') => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-block rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500 uppercase">
            Paid
          </span>
        );
      case 'partial':
        return (
          <span className="inline-block rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-500 uppercase">
            Partial
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-block rounded-md bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-500 uppercase">
            Overdue
          </span>
        );
      case 'due_soon':
        return (
          <span className="inline-block rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500 uppercase">
            Due Soon
          </span>
        );
    }
  };

  return (
    <PrintableReportContainer
      academyName={data.academyName}
      title="Fee Collection & Outstanding Dues Summary"
      subtitle={`Generated on ${data.generatedAt}`}
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
        {/* Financial KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:grid-cols-4">
          <div className="border-border-subtle bg-surface-muted/40 rounded-xl border p-3 print:border-black/20 print:bg-transparent">
            <div className="flex items-center gap-2">
              <DollarSign className="text-primary h-4 w-4" />
              <span className="text-fg-muted text-xs font-semibold uppercase">
                Total Receivable
              </span>
            </div>
            <p className="text-fg mt-1 text-xl font-black">
              {formatPaiseForExport(data.totalReceivablePaise)}
            </p>
          </div>

          <div className="border-border-subtle bg-surface-muted/40 rounded-xl border p-3 print:border-black/20 print:bg-transparent">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-fg-muted text-xs font-semibold uppercase">Total Collected</span>
            </div>
            <p className="text-fg mt-1 text-xl font-black">
              {formatPaiseForExport(data.totalCollectedPaise)}
            </p>
          </div>

          <div className="border-border-subtle bg-surface-muted/40 rounded-xl border p-3 print:border-black/20 print:bg-transparent">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <span className="text-fg-muted text-xs font-semibold uppercase">Total Overdue</span>
            </div>
            <p className="text-fg mt-1 text-xl font-black">
              {formatPaiseForExport(data.totalOverduePaise)}
            </p>
          </div>

          <div className="border-border-subtle bg-surface-muted/40 rounded-xl border p-3 print:border-black/20 print:bg-transparent">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-fg-muted text-xs font-semibold uppercase">Collection %</span>
            </div>
            <p className="text-fg mt-1 text-xl font-black">
              {data.collectionRatePercent.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Status Filter Tabs (hidden in print) */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {(['all', 'overdue', 'due_soon', 'paid'] as const).map((status) => (
            <Button
              key={status}
              type="button"
              variant={statusFilter === status ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="text-xs capitalize"
            >
              {status.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>

        {/* Detailed Dues Ledger Table */}
        <div className="border-border-subtle divide-border-subtle overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-surface-muted text-fg-muted border-border-subtle border-b font-bold tracking-wider uppercase">
              <tr>
                <th className="px-3 py-2.5">Athlete Name</th>
                <th className="px-3 py-2.5">Batch</th>
                <th className="px-3 py-2.5">Plan</th>
                <th className="px-3 py-2.5 text-right">Total Due</th>
                <th className="px-3 py-2.5 text-right">Paid</th>
                <th className="px-3 py-2.5 text-right">Balance Due</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-center">Due Date</th>
                <th className="px-3 py-2.5">Parent Phone</th>
              </tr>
            </thead>
            <tbody className="divide-border-subtle divide-y font-mono">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-fg-muted py-6 text-center font-sans">
                    No billing records found matching current filter.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr
                    key={rec.playerId}
                    className="hover:bg-surface-muted/30 font-sans transition-colors"
                  >
                    <td className="px-3 py-2 font-semibold">{rec.playerName}</td>
                    <td className="text-fg-muted px-3 py-2">{rec.batchName}</td>
                    <td className="text-fg-muted px-3 py-2 text-[11px]">{rec.planName}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium">
                      {formatPaiseForExport(rec.amountDuePaise)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-emerald-500">
                      {formatPaiseForExport(rec.amountPaidPaise)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold">
                      {formatPaiseForExport(rec.balanceDuePaise)}
                    </td>
                    <td className="px-3 py-2 text-center">{getStatusBadge(rec.status)}</td>
                    <td className="text-fg-muted px-3 py-2 text-center font-mono text-[11px]">
                      {rec.dueDate}
                    </td>
                    <td className="text-fg-muted px-3 py-2 text-[11px]">
                      {rec.parentPhone || '-'}
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
