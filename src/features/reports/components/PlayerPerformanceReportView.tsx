import { Trophy, Award, Shield, Target, User, Download } from 'lucide-react';
import { Button } from '@/components/ui';
import type { PlayerPerformanceReportData } from '../types';
import { downloadCsvFile } from '../utils/csvExporter';
import { generatePlayerPerformanceCsv } from '../utils/reportGenerators';
import { PrintableReportContainer } from './PrintableReportContainer';

interface PlayerPerformanceReportViewProps {
  data: PlayerPerformanceReportData;
}

export function PlayerPerformanceReportView({ data }: PlayerPerformanceReportViewProps) {
  const handleExportCsv = () => {
    const csv = generatePlayerPerformanceCsv(data);
    const filename = `Performance_Card_${data.playerName.replace(/\s+/g, '_')}.csv`;
    downloadCsvFile(filename, csv);
  };

  return (
    <PrintableReportContainer
      academyName={data.academyName}
      title="Player Performance Report Card"
      subtitle={`Athlete: ${data.playerName} | Batch: ${data.batchName}`}
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
        {/* Athlete Overview Header Banner */}
        <div className="border-border-subtle bg-surface-muted/50 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 print:border-black/20 print:bg-transparent">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 text-primary flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-mono text-xl font-black print:border print:border-black">
              {data.avatarUrl ? (
                <img
                  src={data.avatarUrl}
                  alt={data.playerName}
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                (data.playerName[0] || 'P').toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-fg text-lg font-black">{data.playerName}</h2>
              <div className="text-fg-muted flex items-center gap-2 text-xs">
                <span className="capitalize">{data.playerRole || 'Athlete'}</span>
                <span>•</span>
                <span>{data.batchName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <span className="text-fg-muted block text-[10px] font-bold tracking-wider uppercase">
                Matches
              </span>
              <span className="text-fg text-lg font-black">{data.matchesPlayed}</span>
            </div>
            <div className="text-center">
              <span className="text-fg-muted block text-[10px] font-bold tracking-wider uppercase">
                MVP Points
              </span>
              <span className="text-primary text-lg font-black print:text-black">
                {data.mvp.totalPoints}
              </span>
            </div>
            <div className="text-center">
              <span className="text-fg-muted block text-[10px] font-bold tracking-wider uppercase">
                Awards
              </span>
              <span className="text-fg text-lg font-black">{data.mvp.awards.length}</span>
            </div>
          </div>
        </div>

        {/* 1. Batting Performance */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
            <Target className="text-primary h-4 w-4" />
            <span className="text-fg">Batting Statistics</span>
          </div>
          <div className="border-border-subtle overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-surface-muted text-fg-muted border-border-subtle border-b font-bold tracking-wider uppercase">
                <tr>
                  <th className="px-3 py-2 text-center">Innings</th>
                  <th className="px-3 py-2 text-center">Runs</th>
                  <th className="px-3 py-2 text-center">Highest</th>
                  <th className="px-3 py-2 text-center">Average</th>
                  <th className="px-3 py-2 text-center">Strike Rate</th>
                  <th className="px-3 py-2 text-center">50s</th>
                  <th className="px-3 py-2 text-center">100s</th>
                  <th className="px-3 py-2 text-center">4s</th>
                  <th className="px-3 py-2 text-center">6s</th>
                </tr>
              </thead>
              <tbody className="divide-border-subtle divide-y">
                <tr className="font-mono">
                  <td className="px-3 py-2 text-center">{data.batting.innings}</td>
                  <td className="text-primary px-3 py-2 text-center font-bold print:text-black">
                    {data.batting.runs}
                  </td>
                  <td className="px-3 py-2 text-center">{data.batting.highestScore}</td>
                  <td className="px-3 py-2 text-center">
                    {(data.batting.average ?? 0).toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {(data.batting.strikeRate ?? 0).toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-center">{data.batting.fifties}</td>
                  <td className="px-3 py-2 text-center">{data.batting.hundreds}</td>
                  <td className="px-3 py-2 text-center">{data.batting.fours}</td>
                  <td className="px-3 py-2 text-center">{data.batting.sixes}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Bowling Performance */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
            <Shield className="text-primary h-4 w-4" />
            <span className="text-fg">Bowling Statistics</span>
          </div>
          <div className="border-border-subtle overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-surface-muted text-fg-muted border-border-subtle border-b font-bold tracking-wider uppercase">
                <tr>
                  <th className="px-3 py-2 text-center">Overs</th>
                  <th className="px-3 py-2 text-center">Wickets</th>
                  <th className="px-3 py-2 text-center">Maidens</th>
                  <th className="px-3 py-2 text-center">Runs</th>
                  <th className="px-3 py-2 text-center">Best</th>
                  <th className="px-3 py-2 text-center">Economy</th>
                  <th className="px-3 py-2 text-center">Average</th>
                  <th className="px-3 py-2 text-center">3w Hauls</th>
                  <th className="px-3 py-2 text-center">5w Hauls</th>
                </tr>
              </thead>
              <tbody className="divide-border-subtle divide-y">
                <tr className="font-mono">
                  <td className="px-3 py-2 text-center">{data.bowling.overs}</td>
                  <td className="text-primary px-3 py-2 text-center font-bold print:text-black">
                    {data.bowling.wickets}
                  </td>
                  <td className="px-3 py-2 text-center">{data.bowling.maidens}</td>
                  <td className="px-3 py-2 text-center">{data.bowling.runsConceded}</td>
                  <td className="px-3 py-2 text-center">{data.bowling.bestBowling}</td>
                  <td className="px-3 py-2 text-center">
                    {(data.bowling.economy ?? 0).toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {(data.bowling.average ?? 0).toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-center">{data.bowling.threeWickets}</td>
                  <td className="px-3 py-2 text-center">{data.bowling.fiveWickets}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Fielding & Awards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Fielding */}
          <div className="border-border-subtle rounded-xl border p-4">
            <h3 className="text-fg mb-3 text-xs font-bold tracking-wider uppercase">
              Fielding Impact
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-surface-muted/50 rounded-lg p-2.5">
                <span className="text-fg-muted block text-[10px] uppercase">Catches</span>
                <span className="text-fg font-mono text-base font-bold">
                  {data.fielding.catches}
                </span>
              </div>
              <div className="bg-surface-muted/50 rounded-lg p-2.5">
                <span className="text-fg-muted block text-[10px] uppercase">Stumpings</span>
                <span className="text-fg font-mono text-base font-bold">
                  {data.fielding.stumpings}
                </span>
              </div>
              <div className="bg-surface-muted/50 rounded-lg p-2.5">
                <span className="text-fg-muted block text-[10px] uppercase">Run Outs</span>
                <span className="text-fg font-mono text-base font-bold">
                  {data.fielding.runOuts}
                </span>
              </div>
            </div>
          </div>

          {/* Awards */}
          <div className="border-border-subtle rounded-xl border p-4">
            <h3 className="text-fg mb-3 text-xs font-bold tracking-wider uppercase">
              Match Recognitions & Awards
            </h3>
            {data.mvp.awards.length === 0 ? (
              <p className="text-fg-muted text-xs">No individual awards recorded yet.</p>
            ) : (
              <div className="space-y-1.5">
                {data.mvp.awards.map((award, i) => (
                  <div
                    key={i}
                    className="bg-primary/10 border-primary/20 flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs print:border-black/20"
                  >
                    <div className="flex items-center gap-1.5">
                      <Trophy className="text-primary h-3.5 w-3.5 print:text-black" />
                      <span className="text-fg font-bold print:text-black">{award.title}</span>
                    </div>
                    <span className="text-fg-muted text-[11px]">{award.matchDate}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. Technical Drill Evaluations */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
            <Award className="text-primary h-4 w-4" />
            <span className="text-fg">Technical Drill Competency</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {data.drills.map((drill, idx) => (
              <div key={idx} className="border-border-subtle rounded-xl border p-3">
                <span className="text-primary block text-[10px] font-bold tracking-wider uppercase">
                  {drill.category}
                </span>
                <h4 className="text-fg truncate text-xs font-bold">{drill.drillName}</h4>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-fg-muted text-[11px]">Score:</span>
                  <span className="font-mono text-xs font-bold">
                    {drill.score}/{drill.maxScore}
                  </span>
                </div>
                <div className="mt-1 flex gap-1">
                  {Array.from({ length: 5 }).map((_, rIdx) => (
                    <div
                      key={rIdx}
                      className={`h-1.5 flex-1 rounded-full ${
                        rIdx < drill.rating ? 'bg-primary' : 'bg-surface-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Coach Feedback Notes */}
        {data.coachNotes.length > 0 && (
          <div className="border-border-subtle rounded-xl border p-4">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
              <User className="text-primary h-4 w-4" />
              <span className="text-fg">Coaching Staff Evaluation & Recommendations</span>
            </div>
            <ul className="text-fg-muted mt-2 space-y-1 text-xs">
              {data.coachNotes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </PrintableReportContainer>
  );
}
