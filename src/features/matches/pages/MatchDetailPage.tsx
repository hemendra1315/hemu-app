import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Target, Shield, Award } from 'lucide-react';

import { ErrorState, EmptyState } from '@/components/feedback';
import { useActiveAcademy } from '@/features/academies';
import { isUUID } from '@/lib/validators';
import {
  useMatch,
  useMatchLineups,
  useMatchBatting,
  useMatchBowling,
  useMatchFielding,
  useMatchAwards,
} from '../hooks/useMatches';
import { formatDate } from '@/lib/utils/date';

export default function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { academyId } = useActiveAcademy();
  const navigate = useNavigate();

  const matchQuery = useMatch(matchId ?? null, academyId);
  const lineupsQuery = useMatchLineups(matchId ?? null);
  const battingQuery = useMatchBatting(matchId ?? null);
  const bowlingQuery = useMatchBowling(matchId ?? null);
  const fieldingQuery = useMatchFielding(matchId ?? null);
  const awardsQuery = useMatchAwards(matchId ?? null);

  const captain = useMemo(() => lineupsQuery.data?.find((l) => l.isCaptain), [lineupsQuery.data]);
  const viceCaptain = useMemo(
    () => lineupsQuery.data?.find((l) => l.isViceCaptain),
    [lineupsQuery.data],
  );
  const wicketkeeper = useMemo(
    () => lineupsQuery.data?.find((l) => l.isWicketkeeper),
    [lineupsQuery.data],
  );

  if (!matchId || !isUUID(matchId)) {
    return (
      <EmptyState
        title={!matchId ? 'No match selected' : 'Invalid match link'}
        description={
          !matchId
            ? 'Select a match from the matches list to view its details.'
            : 'The match link you followed is not valid. Please return to the matches list.'
        }
      />
    );
  }

  if (matchQuery.isPending) {
    return (
      <div className="animate-pulse space-y-4 pb-24 md:pb-6">
        <div className="bg-surface border-border-subtle h-28 rounded-xl border" />
        <div className="bg-surface border-border-subtle h-48 rounded-xl border" />
        <div className="bg-surface border-border-subtle h-48 rounded-xl border" />
      </div>
    );
  }

  if (matchQuery.isError || !matchQuery.data) {
    return <ErrorState error={matchQuery.error} onRetry={() => void matchQuery.refetch()} />;
  }

  const match = matchQuery.data;

  return (
    <div className="flex flex-col space-y-4 pb-24 md:pb-6">
      {/* 1. Top Header with Back Button */}
      <div className="border-border-subtle/40 flex items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/matches')}
            className="border-border-subtle bg-surface text-fg-muted hover:text-fg hover:bg-surface-muted flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
            aria-label="Back to matches"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-heading text-fg text-lg font-extrabold tracking-tight uppercase md:text-xl">
              {match.matchName}
            </h1>
            <p className="text-fg-muted font-sans text-xs">
              {formatDate(match.matchDate)} {match.opponentName ? `• vs ${match.opponentName}` : ''}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center rounded border px-2.5 py-0.5 font-sans text-[10px] font-bold uppercase ${
            match.status === 'completed'
              ? 'border-success/30 bg-success-pale text-success'
              : match.status === 'in_progress'
                ? 'border-primary/30 bg-primary-pale text-primary'
                : 'border-border-subtle bg-surface-container-low text-fg-muted'
          }`}
        >
          {match.status}
        </span>
      </div>

      {/* 2. Match Summary Hero Card */}
      <div className="divide-border-subtle/50 border-border-subtle bg-surface divide-y overflow-hidden rounded-xl border shadow-2xs">
        <div className="flex flex-col gap-2.5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="border-primary/30 bg-primary-pale font-heading text-primary rounded border px-2 py-0.5 text-[10px] font-bold uppercase">
              {match.format?.toUpperCase()}
            </span>
            <span className="border-border-subtle/70 bg-surface-container-low font-heading text-fg-muted rounded border px-2 py-0.5 text-[10px] font-bold uppercase">
              {match.matchType}
            </span>
            {match.tournament && (
              <span className="border-border-subtle/70 bg-surface-container-low text-fg-muted rounded border px-2 py-0.5 font-sans text-[11px]">
                {match.tournament}
              </span>
            )}
          </div>

          {match.teamScore && (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-heading text-primary text-2xl font-extrabold">
                {match.teamScore}
              </span>
              {match.overs && (
                <span className="text-fg-muted font-mono text-xs">({match.overs} overs)</span>
              )}
            </div>
          )}
        </div>

        {/* Leadership Chips */}
        {(captain || viceCaptain || wicketkeeper) && (
          <div className="bg-surface-container-low/40 flex flex-wrap items-center gap-3 p-3 font-sans text-xs">
            {captain && (
              <div className="text-fg flex items-center gap-1.5">
                <span className="bg-primary/20 py-0.2 text-primary rounded px-1.5 font-mono text-[10px] font-bold">
                  C
                </span>
                <span>{captain.player.fullName ?? captain.player.email}</span>
              </div>
            )}
            {viceCaptain && (
              <div className="text-fg flex items-center gap-1.5">
                <span className="bg-info/20 py-0.2 text-info rounded px-1.5 font-mono text-[10px] font-bold">
                  VC
                </span>
                <span>{viceCaptain.player.fullName ?? viceCaptain.player.email}</span>
              </div>
            )}
            {wicketkeeper && (
              <div className="text-fg flex items-center gap-1.5">
                <span className="bg-saffron/20 py-0.2 text-saffron rounded px-1.5 font-mono text-[10px] font-bold">
                  WK
                </span>
                <span>{wicketkeeper.player.fullName ?? wicketkeeper.player.email}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Batting Scorecard Card */}
      <div className="border-border-subtle bg-surface rounded-xl border p-4 shadow-2xs">
        <div className="border-border-subtle/50 mb-3 border-b pb-2.5">
          <h2 className="font-heading text-fg text-sm font-extrabold tracking-tight uppercase">
            Batting Scorecard
          </h2>
        </div>

        {battingQuery.isPending ? (
          <p className="text-fg-muted py-4 text-center font-sans text-xs">Loading batting stats…</p>
        ) : !battingQuery.data || battingQuery.data.length === 0 ? (
          <p className="text-fg-muted py-4 text-center font-sans text-xs">
            No batting scorecard recorded.
          </p>
        ) : (
          <div className="divide-border-subtle/40 divide-y overflow-x-auto font-mono text-xs">
            {/* Table Header */}
            <div className="font-heading text-fg-muted grid grid-cols-12 gap-1 pb-2 text-[10px] font-bold tracking-wider uppercase">
              <div className="col-span-5">Batter</div>
              <div className="col-span-2 text-right">R</div>
              <div className="col-span-2 text-right">B</div>
              <div className="col-span-1 text-right">4s</div>
              <div className="col-span-1 text-right">6s</div>
              <div className="col-span-1 text-right">SR</div>
            </div>

            {/* Rows */}
            {[...(battingQuery.data ?? [])]
              .sort((a, b) => (a.battingOrder ?? 99) - (b.battingOrder ?? 99))
              .map((b) => {
                const strikeRate = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '-';
                return (
                  <div key={b.id} className="grid grid-cols-12 items-center gap-1 py-2.5">
                    <div className="col-span-5 min-w-0">
                      <p className="text-fg truncate font-sans font-bold">
                        {b.player.fullName ?? b.player.email}
                      </p>
                      <p className="text-fg-muted truncate font-sans text-[10px]">
                        {b.isOut ? (b.dismissalType ?? 'Out') : 'Not out'}
                      </p>
                    </div>
                    <div className="text-primary col-span-2 text-right font-extrabold">
                      {b.runs}
                    </div>
                    <div className="text-fg-muted col-span-2 text-right">{b.balls}</div>
                    <div className="text-fg col-span-1 text-right">{b.fours}</div>
                    <div className="text-fg col-span-1 text-right">{b.sixes}</div>
                    <div className="text-fg-muted col-span-1 text-right">{strikeRate}</div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 4. Bowling Scorecard Card */}
      <div className="border-border-subtle bg-surface rounded-xl border p-4 shadow-2xs">
        <div className="border-border-subtle/50 mb-3 border-b pb-2.5">
          <h2 className="font-heading text-fg text-sm font-extrabold tracking-tight uppercase">
            Bowling Scorecard
          </h2>
        </div>

        {bowlingQuery.isPending ? (
          <p className="text-fg-muted py-4 text-center font-sans text-xs">Loading bowling stats…</p>
        ) : !bowlingQuery.data || bowlingQuery.data.length === 0 ? (
          <p className="text-fg-muted py-4 text-center font-sans text-xs">
            No bowling scorecard recorded.
          </p>
        ) : (
          <div className="divide-border-subtle/40 divide-y overflow-x-auto font-mono text-xs">
            <div className="font-heading text-fg-muted grid grid-cols-12 gap-1 pb-2 text-[10px] font-bold tracking-wider uppercase">
              <div className="col-span-5">Bowler</div>
              <div className="col-span-2 text-right">O</div>
              <div className="col-span-1 text-right">M</div>
              <div className="col-span-2 text-right">R</div>
              <div className="col-span-2 text-right">W</div>
            </div>

            {bowlingQuery.data.map((b) => (
              <div key={b.id} className="grid grid-cols-12 items-center gap-1 py-2.5">
                <div className="col-span-5 min-w-0">
                  <p className="text-fg truncate font-sans font-bold">
                    {b.player.fullName ?? b.player.email}
                  </p>
                  <p className="text-fg-muted truncate font-sans text-[10px]">
                    Wides: {b.wides} · NB: {b.noBalls}
                  </p>
                </div>
                <div className="text-fg col-span-2 text-right">{b.overs}</div>
                <div className="text-fg-muted col-span-1 text-right">{b.maidens}</div>
                <div className="text-fg-muted col-span-2 text-right">{b.runsConceded}</div>
                <div className="text-primary col-span-2 text-right font-extrabold">{b.wickets}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Fielding & Awards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Fielding Card */}
        <div className="border-border-subtle bg-surface rounded-xl border p-4 shadow-2xs">
          <div className="border-border-subtle/50 mb-3 border-b pb-2.5">
            <h2 className="font-heading text-fg text-sm font-extrabold tracking-tight uppercase">
              Fielding Telemetry
            </h2>
          </div>

          {fieldingQuery.isPending ? (
            <p className="text-fg-muted py-4 text-center font-sans text-xs">Loading fielding…</p>
          ) : !fieldingQuery.data || fieldingQuery.data.length === 0 ? (
            <p className="text-fg-muted py-4 text-center font-sans text-xs">
              No fielding actions recorded.
            </p>
          ) : (
            <div className="divide-border-subtle/40 space-y-1 divide-y">
              {fieldingQuery.data.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-2 text-xs">
                  <span className="text-fg font-sans font-bold">
                    {f.player.fullName ?? f.player.email}
                  </span>
                  <div className="text-fg-muted flex items-center gap-2.5 font-mono text-[11px]">
                    <span>C: {f.catches}</span>
                    <span>RO: {f.runOuts}</span>
                    <span>ST: {f.stumpings}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Awards Card */}
        <div className="border-border-subtle bg-surface rounded-xl border p-4 shadow-2xs">
          <div className="border-border-subtle/50 mb-3 border-b pb-2.5">
            <h2 className="font-heading text-fg text-sm font-extrabold tracking-tight uppercase">
              Match Honors & Awards
            </h2>
          </div>

          {awardsQuery.isPending ? (
            <p className="text-fg-muted py-4 text-center font-sans text-xs">Loading awards…</p>
          ) : !awardsQuery.data ? (
            <p className="text-fg-muted py-4 text-center font-sans text-xs">
              No match awards logged.
            </p>
          ) : (
            <div className="space-y-2.5">
              {awardsQuery.data.playerOfMatch && (
                <div className="border-primary/30 bg-primary-pale/40 flex items-center gap-2.5 rounded-lg border p-2.5">
                  <Trophy className="text-primary h-4 w-4" />
                  <div>
                    <p className="font-heading text-primary text-[10px] font-bold uppercase">
                      Player of the Match
                    </p>
                    <p className="text-fg font-sans text-xs font-bold">
                      {awardsQuery.data.playerOfMatch.fullName ??
                        awardsQuery.data.playerOfMatch.email}
                    </p>
                  </div>
                </div>
              )}

              {awardsQuery.data.bestBatter && (
                <div className="border-border-subtle bg-surface-container-low flex items-center gap-2.5 rounded-lg border p-2.5">
                  <Award className="text-info h-4 w-4" />
                  <div>
                    <p className="font-heading text-fg-muted text-[10px] font-bold uppercase">
                      Best Batter
                    </p>
                    <p className="text-fg font-sans text-xs font-bold">
                      {awardsQuery.data.bestBatter.fullName ?? awardsQuery.data.bestBatter.email}
                    </p>
                  </div>
                </div>
              )}

              {awardsQuery.data.bestBowler && (
                <div className="border-border-subtle bg-surface-container-low flex items-center gap-2.5 rounded-lg border p-2.5">
                  <Target className="text-saffron h-4 w-4" />
                  <div>
                    <p className="font-heading text-fg-muted text-[10px] font-bold uppercase">
                      Best Bowler
                    </p>
                    <p className="text-fg font-sans text-xs font-bold">
                      {awardsQuery.data.bestBowler.fullName ?? awardsQuery.data.bestBowler.email}
                    </p>
                  </div>
                </div>
              )}

              {awardsQuery.data.bestFielder && (
                <div className="border-border-subtle bg-surface-container-low flex items-center gap-2.5 rounded-lg border p-2.5">
                  <Shield className="text-success h-4 w-4" />
                  <div>
                    <p className="font-heading text-fg-muted text-[10px] font-bold uppercase">
                      Best Fielder
                    </p>
                    <p className="text-fg font-sans text-xs font-bold">
                      {awardsQuery.data.bestFielder.fullName ?? awardsQuery.data.bestFielder.email}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
