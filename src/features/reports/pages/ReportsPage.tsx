import { useMemo, useState } from 'react';
import { FileDown, FileText } from 'lucide-react';

import { ErrorState } from '@/components/feedback';
import { Button, Card, CardBody, CardHeader } from '@/components/ui';
import { MobilePageHeader, MobileStatCard } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { useBatches } from '@/features/batches';
import { useAcademyMembers } from '@/features/members';
import { recentMonths, monthBounds } from '@/features/attendance/api/attendanceInsights';
import { useBatchReport, usePlayerReport } from '../hooks/useReports';
import type { UUID } from '@/types';

type Scope = 'batch' | 'player';

function rateLabel(rate: number | null): string {
  return rate === null ? '—' : `${rate}%`;
}

export default function ReportsPage() {
  const { academyId } = useActiveAcademy();
  const months = useMemo(() => recentMonths(12), []);

  const [scope, setScope] = useState<Scope>('batch');
  const [batchId, setBatchId] = useState<UUID | ''>('');
  const [playerId, setPlayerId] = useState<UUID | ''>('');
  const [fromMonth, setFromMonth] = useState(() => months[2]?.value ?? months[0]?.value ?? '');
  const [toMonth, setToMonth] = useState(() => months[0]?.value ?? '');
  const [submitted, setSubmitted] = useState(false);

  const batchesQuery = useBatches(academyId);
  const playersQuery = useAcademyMembers(academyId, { role: 'player', status: 'active' });

  const selectedBatch = batchesQuery.data?.find((b) => b.id === batchId);
  const selectedPlayer = playersQuery.data?.find((p) => p.id === playerId);

  const from = monthBounds(fromMonth).from;
  const to = monthBounds(toMonth).to;

  const batchReport = useBatchReport(
    academyId,
    batchId || null,
    selectedBatch?.name ?? '',
    from,
    to,
    submitted && scope === 'batch',
  );
  const playerReport = usePlayerReport(
    academyId,
    playerId || null,
    selectedPlayer?.fullName ?? selectedPlayer?.email ?? 'Unknown player',
    from,
    to,
    submitted && scope === 'player',
  );

  const report = scope === 'batch' ? batchReport : playerReport;
  const canGenerate = scope === 'batch' ? Boolean(batchId) : Boolean(playerId);
  const rangeInvalid = fromMonth > toMonth;

  const printUrl =
    scope === 'batch'
      ? `/reports/print?scope=batch&id=${batchId}&name=${encodeURIComponent(selectedBatch?.name ?? '')}&from=${from}&to=${to}`
      : `/reports/print?scope=player&id=${playerId}&name=${encodeURIComponent(selectedPlayer?.fullName ?? selectedPlayer?.email ?? '')}&from=${from}&to=${to}`;

  if (!academyId) return null;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="md:hidden">
        <MobilePageHeader title="Reports" subtitle="Attendance and performance summaries" />
      </div>
      <div className="hidden md:block">
        <h1 className="text-fg text-xl font-bold">Reports</h1>
        <p className="text-fg-muted text-sm">
          Build an attendance and performance summary for a batch or a player.
        </p>
      </div>

      <Card>
        <CardHeader title="Build a report" />
        <CardBody className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setScope('batch');
                setSubmitted(false);
              }}
              className={`min-h-[40px] flex-1 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                scope === 'batch'
                  ? 'bg-primary text-primary-fg border-primary'
                  : 'border-border-subtle bg-surface text-fg-muted'
              }`}
            >
              By batch
            </button>
            <button
              type="button"
              onClick={() => {
                setScope('player');
                setSubmitted(false);
              }}
              className={`min-h-[40px] flex-1 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                scope === 'player'
                  ? 'bg-primary text-primary-fg border-primary'
                  : 'border-border-subtle bg-surface text-fg-muted'
              }`}
            >
              By player
            </button>
          </div>

          {scope === 'batch' ? (
            <label className="block text-sm">
              <span className="text-fg-muted mb-1.5 block">Batch</span>
              <select
                value={batchId}
                onChange={(event) => {
                  setBatchId(event.target.value as UUID);
                  setSubmitted(false);
                }}
                className="border-border-subtle bg-surface text-fg min-h-[44px] w-full rounded-lg border px-3 text-sm"
              >
                <option value="">Select a batch…</option>
                {(batchesQuery.data ?? []).map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block text-sm">
              <span className="text-fg-muted mb-1.5 block">Player</span>
              <select
                value={playerId}
                onChange={(event) => {
                  setPlayerId(event.target.value as UUID);
                  setSubmitted(false);
                }}
                className="border-border-subtle bg-surface text-fg min-h-[44px] w-full rounded-lg border px-3 text-sm"
              >
                <option value="">Select a player…</option>
                {(playersQuery.data ?? []).map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.fullName ?? player.email}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-fg-muted mb-1.5 block">From</span>
              <select
                value={fromMonth}
                onChange={(event) => {
                  setFromMonth(event.target.value);
                  setSubmitted(false);
                }}
                className="border-border-subtle bg-surface text-fg min-h-[44px] w-full rounded-lg border px-3 text-sm"
              >
                {[...months].reverse().map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-fg-muted mb-1.5 block">To</span>
              <select
                value={toMonth}
                onChange={(event) => {
                  setToMonth(event.target.value);
                  setSubmitted(false);
                }}
                className="border-border-subtle bg-surface text-fg min-h-[44px] w-full rounded-lg border px-3 text-sm"
              >
                {[...months].reverse().map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {rangeInvalid ? (
            <p className="text-danger text-xs">"From" must be before or the same as "To".</p>
          ) : null}

          <Button
            disabled={!canGenerate || rangeInvalid}
            onClick={() => setSubmitted(true)}
            className="min-h-[44px] w-full sm:w-auto"
          >
            <FileText className="mr-2 h-4 w-4" />
            Generate report
          </Button>
        </CardBody>
      </Card>

      {submitted && report.isPending ? (
        <p className="text-fg-muted text-center text-sm">Building report…</p>
      ) : null}

      {submitted && report.isError ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : null}

      {submitted && report.data && report.data.scope === 'batch' ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MobileStatCard
              title="Attendance"
              value={rateLabel(report.data.overallAttendanceRate)}
            />
            <MobileStatCard title="Sessions held" value={report.data.sessionsHeld} />
            <MobileStatCard title="Players" value={report.data.players.length} />
          </div>
          <Card>
            <CardHeader
              title={report.data.batchName}
              description={`${report.data.from} to ${report.data.to}`}
              action={
                <a href={printUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm">
                    <FileDown className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </a>
              }
            />
            <CardBody className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border-subtle text-fg-muted border-b text-left text-xs uppercase">
                    <th className="px-4 py-2 font-medium">Player</th>
                    <th className="px-4 py-2 font-medium">Attendance</th>
                    <th className="px-4 py-2 font-medium">Matches</th>
                    <th className="px-4 py-2 font-medium">Runs</th>
                    <th className="px-4 py-2 font-medium">Wickets</th>
                    <th className="px-4 py-2 font-medium">Catches</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.players.map((player) => (
                    <tr
                      key={player.playerId}
                      className="border-border-subtle border-b last:border-0"
                    >
                      <td className="text-fg px-4 py-2.5 font-medium">{player.fullName}</td>
                      <td className="text-fg-muted px-4 py-2.5">
                        {rateLabel(player.attendanceRate)}
                      </td>
                      <td className="text-fg-muted px-4 py-2.5">{player.matchesPlayed}</td>
                      <td className="text-fg-muted px-4 py-2.5">{player.battingRuns}</td>
                      <td className="text-fg-muted px-4 py-2.5">{player.bowlingWickets}</td>
                      <td className="text-fg-muted px-4 py-2.5">{player.fieldingCatches}</td>
                    </tr>
                  ))}
                  {report.data.players.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-fg-muted px-4 py-6 text-center">
                        No players in this batch yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </>
      ) : null}

      {submitted && report.data && report.data.scope === 'player' ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MobileStatCard
              title="Attendance"
              value={rateLabel(report.data.attendanceRate)}
              subtext={`${report.data.present}/${report.data.sessionsRecorded} sessions`}
            />
            <MobileStatCard
              title="Matches (career)"
              value={report.data.statistics?.matchesPlayed ?? 0}
            />
            <MobileStatCard
              title="Runs (career)"
              value={report.data.statistics?.battingRuns ?? 0}
            />
            <MobileStatCard
              title="Wickets (career)"
              value={report.data.statistics?.bowlingWickets ?? 0}
            />
          </div>
          <Card>
            <CardHeader
              title={report.data.fullName}
              description={`Matches from ${report.data.from} to ${report.data.to}`}
              action={
                <a href={printUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm">
                    <FileDown className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </a>
              }
            />
            <CardBody className="p-0">
              {report.data.recentMatches.length === 0 ? (
                <p className="text-fg-muted p-4 text-center text-sm">
                  No matches recorded in this range.
                </p>
              ) : (
                <ul className="divide-border-subtle divide-y">
                  {report.data.recentMatches.map((match) => (
                    <li key={match.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-fg truncate text-sm font-medium">
                          {match.matchName}
                          {match.opponentName ? ` vs ${match.opponentName}` : ''}
                        </p>
                        <span className="text-fg-muted shrink-0 text-xs">{match.matchDate}</span>
                      </div>
                      <p className="text-fg-muted mt-1 text-xs">
                        {match.batting
                          ? `${match.batting.runs} runs (${match.batting.balls}b)`
                          : ''}
                        {match.batting && match.bowling ? ' · ' : ''}
                        {match.bowling
                          ? `${match.bowling.wickets}/${match.bowling.runsConceded}`
                          : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
