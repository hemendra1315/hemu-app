import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import { Badge, Button } from '@/components/ui';
import { EmptyState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { isUUID } from '@/lib/validators';
import { formatDate, formatTime } from '@/lib/utils/date';
import {
  usePlayerProfile,
  usePlayerStatistics,
  usePlayerMatches,
  usePlayerAwards,
  usePlayerMilestones,
  usePlayerCoachNotes,
  usePlayerAttendanceSummary,
  usePlayerDrillSummary,
  usePlayerCareerHighlights,
  usePlayerChartData,
  usePlayerUpcomingSessions,
} from '../hooks/usePlayers';
import type {
  PlayerAttendanceSummary,
  PlayerAward,
  PlayerCareerHighlight,
  PlayerChartData,
  PlayerCoachNote,
  PlayerDrillSummary,
  PlayerMatch,
  PlayerMilestone,
  PlayerStatistics,
} from '../api/playersTypes';
import { SimpleBarChart, SimpleLineChart } from '@/components/charts/SimpleBarChart';
import { CricketCard } from '../components/CricketCard';
import { FamilyTab } from '../components/FamilyTab';

type TabId =
  'overview' | 'attendance' | 'training' | 'matches' | 'batting' | 'bowling' | 'awards' | 'parent';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'training', label: 'Training' },
  { id: 'matches', label: 'Matches' },
  { id: 'batting', label: 'Batting' },
  { id: 'bowling', label: 'Bowling' },
  { id: 'awards', label: 'Awards' },
  { id: 'parent', label: 'Parent' },
];

export default function PlayerProfilePage() {
  const { memberId } = useParams<{ memberId: string }>();
  const { academyId, membership } = useActiveAcademy();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const profileQuery = usePlayerProfile(academyId, memberId ?? null);
  const statsQuery = usePlayerStatistics(academyId, memberId ?? null);
  const matchesQuery = usePlayerMatches(academyId, memberId ?? null);
  const awardsQuery = usePlayerAwards(academyId, memberId ?? null);
  const milestonesQuery = usePlayerMilestones(academyId, memberId ?? null);
  const notesQuery = usePlayerCoachNotes(academyId, memberId ?? null);
  const attendanceQuery = usePlayerAttendanceSummary(academyId, memberId ?? null);
  const drillsQuery = usePlayerDrillSummary(academyId, memberId ?? null);
  const highlightsQuery = usePlayerCareerHighlights(academyId, memberId ?? null);
  const chartDataQuery = usePlayerChartData(academyId, memberId ?? null);
  const sessionsQuery = usePlayerUpcomingSessions(memberId ?? null, academyId);

  if (!memberId || !academyId) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="No player selected"
          description="Select a player from the members list to view their full profile."
        />
      </div>
    );
  }

  if (!isUUID(memberId) || !isUUID(academyId)) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Invalid player link"
          description="The player link you followed is not valid. Please return to the members list."
        />
      </div>
    );
  }

  const isLoading =
    profileQuery.isPending ||
    (activeTab === 'batting' && statsQuery.isPending) ||
    (activeTab === 'bowling' && statsQuery.isPending) ||
    (activeTab === 'matches' && matchesQuery.isPending) ||
    (activeTab === 'awards' && (awardsQuery.isPending || highlightsQuery.isPending)) ||
    (activeTab === 'training' && (drillsQuery.isPending || notesQuery.isPending)) ||
    (activeTab === 'attendance' && attendanceQuery.isPending);

  const renderTabContent = () => {
    if (isLoading) {
      return <p className="text-fg-muted">Loading…</p>;
    }

    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            stats={statsQuery.data ?? null}
            matches={matchesQuery.data ?? []}
            sessions={sessionsQuery.data ?? []}
            notes={notesQuery.data ?? []}
          />
        );
      case 'attendance':
        return <AttendanceTab summary={attendanceQuery.data ?? null} />;
      case 'training':
        return (
          <div className="space-y-6">
            <DrillsTab summary={drillsQuery.data ?? null} />
            <CoachNotesTab notes={notesQuery.data ?? []} />
          </div>
        );
      case 'matches':
        return <MatchHistoryTab matches={matchesQuery.data ?? []} />;
      case 'batting':
        return (
          <StatisticsTab
            stats={statsQuery.data ?? null}
            chartData={chartDataQuery.data ?? null}
            view="batting"
          />
        );
      case 'bowling':
        return (
          <StatisticsTab
            stats={statsQuery.data ?? null}
            chartData={chartDataQuery.data ?? null}
            view="bowling"
          />
        );
      case 'awards':
        return (
          <div className="space-y-6">
            <HighlightsTab
              highlights={highlightsQuery.data ?? []}
              milestones={milestonesQuery.data ?? []}
            />
            <AwardsTab awards={awardsQuery.data ?? []} />
          </div>
        );
      case 'parent':
        return <FamilyTab academyId={academyId!} playerUserId={profileQuery.data?.userId} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Unified Compact App Bar */}
      <div className="border-border-subtle/50 flex flex-col gap-2 border-b pb-4">
        <div>
          {membership?.role === 'parent' ? (
            <Link
              to="/parent/dashboard"
              className="text-fg-muted hover:text-primary inline-flex items-center font-sans text-[10px] font-bold tracking-wider uppercase transition-colors"
            >
              ← Back to Dashboard
            </Link>
          ) : (
            <Link
              to="/members"
              className="text-fg-muted hover:text-primary inline-flex items-center font-sans text-[10px] font-bold tracking-wider uppercase transition-colors"
            >
              ← Back to Roster
            </Link>
          )}
        </div>

        {profileQuery.data && (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-heading text-fg truncate text-lg font-extrabold tracking-wide uppercase sm:text-xl">
                {profileQuery.data.fullName ?? 'Player Profile'}
              </h1>
              <div className="text-fg-muted mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold">
                {profileQuery.data.playerCode && (
                  <span className="bg-surface border-border-subtle rounded border px-1.5 py-0.5">
                    ID: {profileQuery.data.playerCode}
                  </span>
                )}
                {profileQuery.data.batchName && (
                  <span className="bg-surface border-border-subtle rounded border px-1.5 py-0.5 uppercase">
                    {profileQuery.data.batchName}
                  </span>
                )}
                <span className="bg-turf-pale text-primary border-primary/20 rounded border px-1.5 py-0.5 uppercase">
                  {profileQuery.data.playerRole?.replace('_', ' ') || 'PLAYER'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {profileQuery.isPending ? (
        <p className="text-fg-muted">Loading profile…</p>
      ) : profileQuery.isError || !profileQuery.data ? (
        <div className="border-border-subtle bg-surface rounded-xl border p-6 text-center shadow-2xs">
          <div className="space-y-3">
            <h3 className="font-heading text-fg text-lg font-bold tracking-tight uppercase">
              Student profile unavailable
            </h3>
            <p className="text-fg-muted font-sans text-xs">
              We could not locate the requested player record for this academy.
            </p>
            <div className="pt-2">
              {membership?.role === 'parent' ? (
                <Link to="/parent/dashboard">
                  <Button
                    variant="primary"
                    className="h-11 min-h-[44px] rounded-[10px] px-4 text-xs font-bold"
                  >
                    View Dashboard
                  </Button>
                </Link>
              ) : (
                <Link to="/members">
                  <Button
                    variant="primary"
                    className="h-11 min-h-[44px] rounded-[10px] px-4 text-xs font-bold"
                  >
                    View Roster
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <CricketCard profile={profileQuery.data} stats={statsQuery.data ?? null} />
          </div>

          {/* Contained Horizontal Scrolling Tab Bar */}
          <div className="border-border-subtle bg-surface max-w-full overflow-x-auto rounded-xl border p-1 shadow-2xs">
            <div className="flex min-w-max gap-1">
              {TABS.filter((tab) => {
                if (membership?.role === 'parent') {
                  return !['notes', 'training', 'parent'].includes(tab.id);
                }
                return true;
              }).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`font-heading h-11 min-h-[44px] shrink-0 rounded-lg px-4 py-2 text-[10px] font-bold tracking-wider uppercase transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-fg shadow-2xs'
                      : 'text-fg-muted hover:text-fg hover:bg-surface-muted/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {renderTabContent()}
        </>
      )}
    </div>
  );
}

function OverviewTab({
  stats,
  matches,
  sessions,
  notes,
}: {
  stats: PlayerStatistics | null;
  matches: PlayerMatch[];
  sessions: Array<{
    id: string;
    title: string;
    sessionDate: string;
    startAt: string;
    endAt: string;
    ground: string | null;
    coachName: string | null;
  }>;
  notes: PlayerCoachNote[];
}) {
  const recentMatches = matches?.slice(0, 5) ?? [];

  return (
    <div className="space-y-4">
      <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border shadow-2xs">
        <div className="border-border-subtle/50 border-b p-4">
          <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
            Career Summary
          </h3>
          <p className="text-fg-muted mt-0.5 font-sans text-[11px]">Key performance indicators</p>
        </div>
        <div className="p-4">
          {!stats ? (
            <p className="text-fg-muted font-sans text-xs">No statistics available yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 font-sans sm:grid-cols-4">
              <div>
                <p className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  Matches
                </p>
                <p className="text-fg mt-1 font-mono text-lg font-bold">{stats.matchesPlayed}</p>
              </div>
              <div>
                <p className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  Runs
                </p>
                <p className="text-fg mt-1 font-mono text-lg font-bold">{stats.battingRuns}</p>
              </div>
              <div>
                <p className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  Wickets
                </p>
                <p className="text-fg mt-1 font-mono text-lg font-bold">{stats.bowlingWickets}</p>
              </div>
              <div>
                <p className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  Catches
                </p>
                <p className="text-fg mt-1 font-mono text-lg font-bold">{stats.fieldingCatches}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border shadow-2xs">
        <div className="border-border-subtle/50 border-b p-4">
          <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
            Recent Form
          </h3>
          <p className="text-fg-muted mt-0.5 font-sans text-[11px]">Last 5 matches</p>
        </div>
        <div className="p-0">
          {recentMatches.length === 0 ? (
            <p className="text-fg-muted p-4 font-sans text-xs">No matches played yet.</p>
          ) : (
            <div className="divide-border-subtle/60 divide-y">
              {recentMatches.map((match) => (
                <Link
                  key={match.id}
                  to={`/matches/${match.id}`}
                  className="hover:bg-surface-muted/30 flex min-h-[44px] flex-col gap-2 p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-fg font-sans text-xs font-bold">{match.matchName}</p>
                    <p className="text-fg-muted mt-0.5 font-mono text-[11px]">
                      {formatDate(match.matchDate)} • {match.opponentName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {match.batting && (
                      <span className="bg-surface-muted border-border-subtle/40 text-fg-muted rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold">
                        {match.batting.runs} ({match.batting.balls})
                      </span>
                    )}
                    {match.bowling && (
                      <span className="bg-surface-muted border-border-subtle/40 text-fg-muted rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold">
                        {match.bowling.wickets}/{match.bowling.runsConceded}
                      </span>
                    )}
                    {match.awards.playerOfMatch && (
                      <Badge
                        tone="success"
                        className="font-mono text-[9px] font-bold tracking-wider uppercase"
                      >
                        POM
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border shadow-2xs">
        <div className="border-border-subtle/50 border-b p-4">
          <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
            Upcoming Session
          </h3>
          <p className="text-fg-muted mt-0.5 font-sans text-[11px]">Next scheduled training</p>
        </div>
        <div className="p-0">
          {sessions?.length === 0 ? (
            <p className="text-fg-muted p-4 font-sans text-xs">No upcoming sessions.</p>
          ) : (
            <div className="divide-border-subtle/60 divide-y font-sans">
              {sessions?.slice(0, 1).map((session) => (
                <div key={session.id} className="p-3.5">
                  <p className="text-fg text-xs font-bold">{session.title}</p>
                  <p className="text-fg-muted mt-0.5 font-mono text-[11px]">
                    {formatDate(session.sessionDate)} • {formatTime(session.startAt)} -{' '}
                    {formatTime(session.endAt)}
                  </p>
                  {session.ground && (
                    <p className="text-fg-muted mt-0.5 text-[11px]">Ground: {session.ground}</p>
                  )}
                  {session.coachName && (
                    <p className="text-fg-muted mt-0.5 text-[11px]">Coach: {session.coachName}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border font-sans shadow-2xs">
        <div className="border-border-subtle/50 border-b p-4">
          <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
            Latest Coach Feedback
          </h3>
          <p className="text-fg-muted mt-0.5 text-[11px]">Most recent note</p>
        </div>
        <div className="p-0">
          {notes?.length === 0 ? (
            <p className="text-fg-muted p-4 text-xs">No coach notes yet.</p>
          ) : (
            <div className="divide-border-subtle/60 divide-y">
              {notes?.slice(0, 1).map((note) => (
                <div key={note.id} className="p-3.5">
                  <p className="text-fg-muted font-mono text-[10px] font-bold uppercase">
                    {note.matchName} • {note.coachName}
                  </p>
                  <p className="text-fg mt-1 text-xs">{note.notes}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatisticsTab({
  stats,
  chartData,
  view = 'all',
}: {
  stats: PlayerStatistics | null;
  chartData: PlayerChartData | null;
  view?: 'batting' | 'bowling' | 'all';
}) {
  if (!stats) {
    return <p className="text-fg-muted font-sans text-xs">No statistics available.</p>;
  }

  const dismissals = stats.battingInnings - stats.battingNotOuts;
  const battingAverage =
    stats.battingInnings > 0
      ? dismissals > 0
        ? (stats.battingRuns / dismissals).toFixed(2)
        : stats.battingRuns.toFixed(2)
      : '0.00';
  const strikeRate =
    stats.ballsFacedSum > 0 ? ((stats.battingRuns / stats.ballsFacedSum) * 100).toFixed(2) : '0.00';
  const bowlingAverage =
    stats.bowlingWickets > 0
      ? (stats.bowlingRunsConceded / stats.bowlingWickets).toFixed(2)
      : '0.00';
  const economy =
    stats.bowlingOvers > 0 ? (stats.bowlingRunsConceded / stats.bowlingOvers).toFixed(2) : '0.00';

  return (
    <div className="space-y-4">
      {(view === 'all' || view === 'batting') && (
        <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border font-sans shadow-2xs">
          <div className="border-border-subtle/50 border-b p-4">
            <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
              Batting
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <StatItem label="Innings" value={stats.battingInnings.toString()} />
              <StatItem label="Runs" value={stats.battingRuns.toString()} />
              <StatItem label="Highest" value={stats.battingHighestScore?.toString() ?? '-'} />
              <StatItem label="Average" value={battingAverage} />
              <StatItem label="Strike Rate" value={strikeRate} />
              <StatItem label="Fifties" value={stats.battingFifties.toString()} />
              <StatItem label="Centuries" value={stats.battingCenturies.toString()} />
              <StatItem label="Fours" value={stats.battingFours.toString()} />
              <StatItem label="Sixes" value={stats.battingSixes.toString()} />
            </div>
            {Boolean(chartData?.runsByMatch && chartData.runsByMatch.length > 0) && chartData && (
              <div className="mt-6">
                <h4 className="font-heading text-fg-muted mb-2 text-[10px] font-bold tracking-wider uppercase">
                  Runs by Match
                </h4>
                <SimpleBarChart
                  data={chartData.runsByMatch.map((m) => ({ label: m.matchName, value: m.runs }))}
                  height={200}
                />
              </div>
            )}
            {Boolean(chartData?.strikeRateTrend && chartData.strikeRateTrend.length > 0) &&
              chartData && (
                <div className="mt-6">
                  <h4 className="font-heading text-fg-muted mb-2 text-[10px] font-bold tracking-wider uppercase">
                    Strike Rate Trend
                  </h4>
                  <SimpleLineChart
                    data={chartData.strikeRateTrend.map((m) => ({
                      label: m.matchName,
                      value: m.strikeRate,
                    }))}
                    height={200}
                  />
                </div>
              )}
          </div>
        </div>
      )}
      {(view === 'all' || view === 'bowling') && (
        <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border font-sans shadow-2xs">
          <div className="border-border-subtle/50 border-b p-4">
            <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
              Bowling
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-7">
              <StatItem label="Overs" value={stats.bowlingOvers.toString()} />
              <StatItem label="Maidens" value={stats.bowlingMaidens.toString()} />
              <StatItem label="Runs" value={stats.bowlingRunsConceded.toString()} />
              <StatItem label="Wickets" value={stats.bowlingWickets.toString()} />
              <StatItem label="Average" value={bowlingAverage} />
              <StatItem label="Economy" value={economy} />
              <StatItem label="Best" value={stats.bowlingBestBowling ?? '-'} />
            </div>
            {Boolean(chartData?.wicketsByMatch && chartData.wicketsByMatch.length > 0) &&
              chartData && (
                <div className="mt-6">
                  <h4 className="font-heading text-fg-muted mb-2 text-[10px] font-bold tracking-wider uppercase">
                    Wickets by Match
                  </h4>
                  <SimpleBarChart
                    data={chartData.wicketsByMatch.map((m) => ({
                      label: m.matchName,
                      value: m.wickets,
                    }))}
                    height={200}
                  />
                </div>
              )}
            {Boolean(chartData?.economyTrend && chartData.economyTrend.length > 0) && chartData && (
              <div className="mt-6">
                <h4 className="font-heading text-fg-muted mb-2 text-[10px] font-bold tracking-wider uppercase">
                  Economy Trend
                </h4>
                <SimpleLineChart
                  data={chartData.economyTrend.map((m) => ({
                    label: m.matchName,
                    value: m.economy,
                  }))}
                  height={200}
                />
              </div>
            )}
          </div>
        </div>
      )}
      {(view === 'all' || view === 'bowling') && (
        <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border font-sans shadow-2xs">
          <div className="border-border-subtle/50 border-b p-4">
            <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
              Fielding
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <StatItem label="Catches" value={stats.fieldingCatches.toString()} />
              <StatItem label="Run Outs" value={stats.fieldingRunOuts.toString()} />
              <StatItem label="Stumpings" value={stats.fieldingStumpings.toString()} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchHistoryTab({ matches }: { matches: PlayerMatch[] }) {
  return (
    <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border shadow-2xs">
      <div className="border-border-subtle/50 border-b p-4">
        <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
          Match History
        </h3>
        <p className="text-fg-muted mt-0.5 font-sans text-[11px]">All recorded matches</p>
      </div>
      <div className="p-0">
        {matches?.length === 0 ? (
          <p className="text-fg-muted p-4 font-sans text-xs">No matches recorded yet.</p>
        ) : (
          <div className="divide-border-subtle/60 divide-y">
            {matches?.map((match) => (
              <Link
                key={match.id}
                to={`/matches/${match.id}`}
                className="hover:bg-surface-muted/30 flex min-h-[44px] flex-col gap-2 p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-fg font-sans text-xs font-bold">{match.matchName}</p>
                  <p className="text-fg-muted mt-0.5 font-mono text-[11px]">
                    {formatDate(match.matchDate)} • {match.opponentName}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 font-sans">
                  <span className="bg-surface-muted border-border-subtle/40 text-fg-muted rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                    {match.matchType}
                  </span>
                  <span className="bg-surface-muted border-border-subtle/40 text-fg-muted rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                    {match.format.toUpperCase()}
                  </span>
                  {match.result && (
                    <Badge
                      tone={
                        match.result === 'won'
                          ? 'success'
                          : match.result === 'lost'
                            ? 'danger'
                            : 'warning'
                      }
                      className="font-mono text-[10px] font-bold tracking-wider uppercase"
                    >
                      {match.result}
                    </Badge>
                  )}
                  {match.battingOrder !== undefined && match.battingOrder !== null && (
                    <span className="bg-surface-muted border-border-subtle/40 text-fg-muted rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold">
                      Pos: {match.battingOrder === 0 ? 'Opening' : match.battingOrder}
                    </span>
                  )}
                  {match.batting && (
                    <span className="bg-surface-muted border-border-subtle/40 text-fg-muted rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold">
                      {match.batting.runs} ({match.batting.balls})
                    </span>
                  )}
                  {match.bowling && (
                    <span className="bg-surface-muted border-border-subtle/40 text-fg-muted rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold">
                      {match.bowling.wickets}/{match.bowling.runsConceded}
                    </span>
                  )}
                  {/* Selected but with nothing recorded: the player was in the
                      XI and simply never got to bat or bowl. Saying so beats a
                      row with no figures at all, which reads as missing data. */}
                  {!match.batting && !match.bowling && (
                    <span
                      className="bg-surface-muted border-border-subtle/40 text-fg-muted rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold"
                      title="Selected, but did not bat or bowl"
                    >
                      DNB
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AwardsTab({ awards }: { awards: PlayerAward[] }) {
  const counts = useMemo(() => {
    const countsMap: Record<string, number> = {};
    awards?.forEach((a) => {
      countsMap[a.awardType] = (countsMap[a.awardType] || 0) + 1;
    });
    return countsMap;
  }, [awards]);

  return (
    <div className="space-y-4">
      <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border font-sans shadow-2xs">
        <div className="border-border-subtle/50 border-b p-4">
          <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
            Award Counts
          </h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Object.entries(counts).map(([award, count]) => (
              <div key={award}>
                <p className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                  {award}
                </p>
                <p className="text-fg mt-1 font-mono text-lg font-bold">{count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border shadow-2xs">
        <div className="border-border-subtle/50 border-b p-4">
          <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
            All Awards
          </h3>
        </div>
        <div className="p-0">
          {awards?.length === 0 ? (
            <p className="text-fg-muted p-4 font-sans text-xs">No awards yet.</p>
          ) : (
            <div className="divide-border-subtle/60 divide-y">
              {awards?.map((award) => (
                <Link
                  key={award.id}
                  to={`/matches/${award.matchId}`}
                  className="hover:bg-surface-muted/30 flex min-h-[44px] items-center justify-between p-3.5 transition-colors"
                >
                  <div>
                    <p className="text-fg font-sans text-xs font-bold tracking-wide uppercase">
                      {award.awardType}
                    </p>
                    <p className="text-fg-muted mt-0.5 font-sans text-[11px]">{award.matchName}</p>
                  </div>
                  <p className="text-fg-muted font-mono text-[10px] font-bold">
                    {formatDate(award.matchDate)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightsTab({
  highlights,
  milestones,
}: {
  highlights: PlayerCareerHighlight[];
  milestones: PlayerMilestone[];
}) {
  return (
    <div className="space-y-4">
      <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border font-sans shadow-2xs">
        <div className="border-border-subtle/50 border-b p-4">
          <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
            Career Highlights
          </h3>
        </div>
        <div className="p-4">
          {highlights?.length === 0 ? (
            <p className="text-fg-muted text-xs">No highlights yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {highlights?.map((highlight) => (
                <div
                  key={highlight.type}
                  className="border-border-subtle/50 bg-surface-muted/20 rounded-xl border p-3"
                >
                  <p className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
                    {highlight.label}
                  </p>
                  <p className="text-fg mt-1 font-mono text-base font-bold">{highlight.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border shadow-2xs">
        <div className="border-border-subtle/50 border-b p-4">
          <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
            Milestones
          </h3>
          <p className="text-fg-muted mt-0.5 font-sans text-[11px]">Achieved career milestones</p>
        </div>
        <div className="p-4">
          {milestones?.length === 0 ? (
            <p className="text-fg-muted font-sans text-xs">No milestones achieved yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {milestones?.map((milestone) => (
                <Badge
                  key={milestone.id}
                  tone="brand"
                  className="font-mono text-[9px] font-bold tracking-wider uppercase"
                >
                  {milestone.milestoneType.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CoachNotesTab({ notes }: { notes: PlayerCoachNote[] }) {
  return (
    <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border shadow-2xs">
      <div className="border-border-subtle/50 border-b p-4">
        <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
          Coach Notes
        </h3>
        <p className="text-fg-muted mt-0.5 font-sans text-[11px]">Feedback from coaches</p>
      </div>
      <div className="p-0">
        {notes?.length === 0 ? (
          <p className="text-fg-muted p-4 font-sans text-xs">No coach notes yet.</p>
        ) : (
          <div className="divide-border-subtle/60 divide-y">
            {notes?.map((note) => (
              <div
                key={note.id}
                className="hover:bg-surface-muted/10 flex flex-col gap-1.5 p-4 font-sans transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-fg text-xs font-bold">{note.matchName}</p>
                  <p className="text-fg-muted font-mono text-[10px] font-bold">
                    {formatDate(note.matchDate)}
                  </p>
                </div>
                <p className="text-fg-muted text-[11px]">Coach: {note.coachName}</p>
                <p className="text-fg mt-1 text-xs leading-relaxed">{note.notes}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttendanceTab({ summary }: { summary: PlayerAttendanceSummary | null }) {
  return (
    <div className="space-y-4">
      <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border font-sans shadow-2xs">
        <div className="border-border-subtle/50 border-b p-4">
          <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
            Attendance Summary
          </h3>
        </div>
        <div className="p-4">
          {!summary ? (
            <p className="text-fg-muted text-xs">No attendance data yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatItem label="Total Sessions" value={summary.totalSessions.toString()} />
              <StatItem label="Attended" value={summary.attended.toString()} />
              <StatItem label="Absent" value={summary.absent.toString()} />
              <StatItem label="Percentage" value={`${summary.attendancePercentage}%`} />
            </div>
          )}
        </div>
      </div>

      {Boolean(summary?.monthlyData && summary.monthlyData.length > 0) && summary && (
        <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border font-sans shadow-2xs">
          <div className="border-border-subtle/50 border-b p-4">
            <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
              Monthly Attendance
            </h3>
          </div>
          <div className="p-4">
            <SimpleBarChart
              data={summary.monthlyData.map((m) => ({
                label: m.month,
                value: Math.round((m.attended / m.total) * 100),
              }))}
              height={200}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DrillsTab({ summary }: { summary: PlayerDrillSummary | null }) {
  return (
    <div className="space-y-4 font-sans">
      <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border shadow-2xs">
        <div className="border-border-subtle/50 border-b p-4">
          <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
            Drill Summary
          </h3>
        </div>
        <div className="p-4">
          {!summary ? (
            <p className="text-fg-muted text-xs">No drill assignments yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatItem label="Assigned" value={summary.assigned.toString()} />
              <StatItem label="Completed" value={summary.completed.toString()} />
              <StatItem label="Pending" value={summary.pending.toString()} />
              <StatItem label="Completion" value={`${summary.completionPercentage}%`} />
            </div>
          )}
        </div>
      </div>

      <div className="border-border-subtle bg-surface overflow-hidden rounded-xl border shadow-2xs">
        <div className="border-border-subtle/50 border-b p-4">
          <h3 className="font-heading text-fg text-xs font-bold tracking-wider uppercase">
            Recent Assignments
          </h3>
        </div>
        <div className="p-0">
          {summary?.recentAssignments?.length === 0 ? (
            <p className="text-fg-muted p-4 text-xs">No assignments yet.</p>
          ) : (
            <div className="divide-border-subtle/60 divide-y">
              {summary?.recentAssignments?.map((assignment) => (
                <div
                  key={assignment.id}
                  className="hover:bg-surface-muted/10 flex min-h-[44px] items-center justify-between p-3.5 transition-colors"
                >
                  <div>
                    <p className="text-fg text-xs font-bold">{assignment.drillName}</p>
                    <p className="text-fg-muted mt-0.5 text-[11px]">{assignment.category}</p>
                  </div>
                  <Badge
                    tone={assignment.status === 'completed' ? 'success' : 'warning'}
                    className="font-mono text-[9px] font-bold tracking-wider uppercase"
                  >
                    {assignment.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
        {label}
      </p>
      <p className="text-fg mt-1 font-mono text-base font-bold">{value}</p>
    </div>
  );
}
