import { Download, MapPin, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import type { BatchScheduleReportData } from '../types';
import { downloadCsvFile } from '../utils/csvExporter';
import { generateBatchScheduleCsv } from '../utils/reportGenerators';
import { PrintableReportContainer } from './PrintableReportContainer';

interface BatchScheduleReportViewProps {
  data: BatchScheduleReportData;
}

export function BatchScheduleReportView({ data }: BatchScheduleReportViewProps) {
  const handleExportCsv = () => {
    const csv = generateBatchScheduleCsv(data);
    const filename = `Batch_Schedules_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCsvFile(filename, csv);
  };

  return (
    <PrintableReportContainer
      academyName={data.academyName}
      title="Batch Schedule & Venue Allocation Sheets"
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
          <span>Export CSV</span>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Batch Cards Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2">
          {data.batches.map((batch) => (
            <div
              key={batch.batchId}
              className="border-border-subtle bg-surface-muted/30 rounded-2xl border p-4 print:border-black/20 print:bg-transparent"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-fg text-base font-black">{batch.batchName}</h3>
                  <span className="text-primary text-[11px] font-bold tracking-wider uppercase print:text-black">
                    {batch.ageGroup || 'Standard Cohort'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-fg-muted block text-[10px] uppercase">Utilization</span>
                  <span className="text-fg font-mono text-xs font-bold">
                    {batch.enrolledCount} / {batch.capacity} ({batch.utilizationPercent.toFixed(0)}
                    %)
                  </span>
                </div>
              </div>

              {/* Progress Bar for Utilization */}
              <div className="bg-surface-muted my-3 h-2 w-full overflow-hidden rounded-full print:border print:border-black">
                <div
                  className="bg-primary h-full rounded-full transition-all print:bg-black"
                  style={{ width: `${Math.min(batch.utilizationPercent, 100)}%` }}
                />
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <UserCheck className="text-primary h-3.5 w-3.5 shrink-0 print:text-black" />
                  <span className="text-fg-muted">Head Coach:</span>
                  <span className="text-fg font-medium">
                    {batch.coachNames.join(', ') || 'Unassigned'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="text-primary h-3.5 w-3.5 shrink-0 print:text-black" />
                  <span className="text-fg-muted">Venue Ground:</span>
                  <span className="text-fg font-medium">{batch.venueName}</span>
                </div>
              </div>

              {/* Weekly Timetable Schedule Slots */}
              <div className="border-border-subtle mt-4 border-t pt-3">
                <span className="text-fg-muted mb-2 block text-[10px] font-bold tracking-wider uppercase">
                  Weekly Schedule Slots
                </span>
                {batch.schedules.length === 0 ? (
                  <p className="text-fg-muted text-xs">No recurring schedule slots assigned.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {batch.schedules.map((s, idx) => (
                      <div
                        key={idx}
                        className="bg-surface border-border-subtle rounded-lg border p-2 text-center print:border-black/20"
                      >
                        <span className="text-primary block text-xs font-bold uppercase print:text-black">
                          {s.dayOfWeek}
                        </span>
                        <span className="text-fg-muted font-mono text-[11px]">
                          {s.startTime} - {s.endTime}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PrintableReportContainer>
  );
}
