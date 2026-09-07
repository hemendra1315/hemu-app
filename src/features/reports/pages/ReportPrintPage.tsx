import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ErrorState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { isUUID } from '@/lib/validators';
import type { UUID } from '@/types';
import { useBatchReport, usePlayerReport } from '../hooks/useReports';

function rateLabel(rate: number | null): string {
  return rate === null ? '—' : `${rate}%`;
}

/**
 * Bare, chrome-free page rendered inside `PrintLayout`. Reads the report
 * parameters from the URL (rather than component state) so it can be opened
 * directly in a new tab from `ReportsPage`'s "Download PDF" link, and calls
 * `window.print()` on load -- the app has no PDF-generation library, so
 * "download as PDF" means "print to PDF" via the browser's own dialog.
 */
export default function ReportPrintPage() {
  const { academyId } = useActiveAcademy();
  const [params] = useSearchParams();

  const scope = params.get('scope') === 'player' ? 'player' : 'batch';
  const idParam = params.get('id') ?? '';
  const name = params.get('name') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const id = isUUID(idParam) ? (idParam as UUID) : null;

  const batchReport = useBatchReport(
    academyId,
    scope === 'batch' ? id : null,
    name,
    from,
    to,
    scope === 'batch',
  );
  const playerReport = usePlayerReport(
    academyId,
    scope === 'player' ? id : null,
    name,
    from,
    to,
    scope === 'player',
  );
  const report = scope === 'batch' ? batchReport : playerReport;

  useEffect(() => {
    if (report.data) {
      const timer = setTimeout(() => window.print(), 400);
      return () => clearTimeout(timer);
    }
  }, [report.data]);

  if (!academyId || !id) {
    return <p className="text-sm text-black">Missing report parameters.</p>;
  }

  if (report.isPending) {
    return <p className="text-sm text-black">Building report…</p>;
  }

  if (report.isError || !report.data) {
    return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;
  }

  return (
    <div className="mx-auto max-w-3xl text-black">
      <div className="no-print mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-gray-400 px-4 py-2 text-sm font-semibold"
        >
          Print / Save as PDF
        </button>
      </div>

      {report.data.scope === 'batch' ? (
        <>
          <h1 className="text-2xl font-bold">{report.data.batchName}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Attendance and performance summary · {report.data.from} to {report.data.to}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Attendance</p>
              <p className="text-lg font-bold">{rateLabel(report.data.overallAttendanceRate)}</p>
            </div>
            <div>
              <p className="text-gray-500">Sessions held</p>
              <p className="text-lg font-bold">{report.data.sessionsHeld}</p>
            </div>
            <div>
              <p className="text-gray-500">Players</p>
              <p className="text-lg font-bold">{report.data.players.length}</p>
            </div>
          </div>

          <table className="mt-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-400 text-left">
                <th className="py-2 pr-2 font-semibold">Player</th>
                <th className="py-2 pr-2 font-semibold">Attendance</th>
                <th className="py-2 pr-2 font-semibold">Matches</th>
                <th className="py-2 pr-2 font-semibold">Runs</th>
                <th className="py-2 pr-2 font-semibold">Wickets</th>
                <th className="py-2 pr-2 font-semibold">Catches</th>
              </tr>
            </thead>
            <tbody>
              {report.data.players.map((player) => (
                <tr key={player.playerId} className="border-b border-gray-200">
                  <td className="py-1.5 pr-2">{player.fullName}</td>
                  <td className="py-1.5 pr-2">{rateLabel(player.attendanceRate)}</td>
                  <td className="py-1.5 pr-2">{player.matchesPlayed}</td>
                  <td className="py-1.5 pr-2">{player.battingRuns}</td>
                  <td className="py-1.5 pr-2">{player.bowlingWickets}</td>
                  <td className="py-1.5 pr-2">{player.fieldingCatches}</td>
                </tr>
              ))}
              {report.data.players.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">
                    No players in this batch.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </>
      ) : null}

      {report.data.scope === 'player' ? (
        <>
          <h1 className="text-2xl font-bold">{report.data.fullName}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Attendance and performance summary · {report.data.from} to {report.data.to}
          </p>

          <div className="mt-6 grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">
                Attendance ({report.data.from} to {report.data.to})
              </p>
              <p className="text-lg font-bold">
                {rateLabel(report.data.attendanceRate)}
                <span className="ml-1 text-xs font-normal text-gray-500">
                  ({report.data.present}/{report.data.sessionsRecorded})
                </span>
              </p>
            </div>
            <div>
              <p className="text-gray-500">Matches (career)</p>
              <p className="text-lg font-bold">{report.data.statistics?.matchesPlayed ?? 0}</p>
            </div>
            <div>
              <p className="text-gray-500">Runs (career)</p>
              <p className="text-lg font-bold">{report.data.statistics?.battingRuns ?? 0}</p>
            </div>
            <div>
              <p className="text-gray-500">Wickets (career)</p>
              <p className="text-lg font-bold">{report.data.statistics?.bowlingWickets ?? 0}</p>
            </div>
          </div>

          <h2 className="mt-6 text-sm font-semibold text-gray-700">
            Matches from {report.data.from} to {report.data.to}
          </h2>
          {report.data.recentMatches.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No matches recorded in this range.</p>
          ) : (
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-400 text-left">
                  <th className="py-2 pr-2 font-semibold">Match</th>
                  <th className="py-2 pr-2 font-semibold">Date</th>
                  <th className="py-2 pr-2 font-semibold">Batting</th>
                  <th className="py-2 pr-2 font-semibold">Bowling</th>
                </tr>
              </thead>
              <tbody>
                {report.data.recentMatches.map((match) => (
                  <tr key={match.id} className="border-b border-gray-200">
                    <td className="py-1.5 pr-2">
                      {match.matchName}
                      {match.opponentName ? ` vs ${match.opponentName}` : ''}
                    </td>
                    <td className="py-1.5 pr-2">{match.matchDate}</td>
                    <td className="py-1.5 pr-2">
                      {match.batting ? `${match.batting.runs} runs (${match.batting.balls}b)` : '—'}
                    </td>
                    <td className="py-1.5 pr-2">
                      {match.bowling
                        ? `${match.bowling.wickets}/${match.bowling.runsConceded}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </div>
  );
}
