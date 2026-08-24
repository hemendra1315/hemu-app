import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';

import { Card, CardBody, CardHeader } from '@/components/ui';

type LeaderCategory = 'runs' | 'wickets' | 'fielding';

type Batter = {
  id: string;
  name: string;
  runs: number;
  innings?: number;
};

type Bowler = {
  id: string;
  name: string;
  wickets: number;
  overs?: number;
};

type Fielder = {
  id: string;
  name: string;
  catches: number;
  runOuts?: number;
};

type PerformanceLeadersCardProps = {
  topBatters: Batter[];
  topBowlers: Bowler[];
  topFielders: Fielder[];
};

export function PerformanceLeadersCard({
  topBatters,
  topBowlers,
  topFielders,
}: PerformanceLeadersCardProps) {
  const [activeCategory, setActiveCategory] = useState<LeaderCategory>('runs');

  const renderContent = () => {
    if (activeCategory === 'runs') {
      if (!topBatters || topBatters.length === 0) {
        return (
          <p className="text-fg-muted py-6 text-center text-xs sm:text-sm">
            No batting statistics recorded yet.
          </p>
        );
      }
      return (
        <div className="space-y-2">
          {topBatters.map((player, idx) => (
            <Link
              key={player.id || idx}
              to={`/members/${player.id}`}
              className="border-border-subtle hover:border-primary/50 bg-surface flex min-h-[48px] items-center justify-between gap-3 rounded-xl border p-3 transition-colors"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    idx === 0
                      ? 'bg-amber-500/20 text-amber-500'
                      : idx === 1
                        ? 'bg-slate-400/20 text-slate-400'
                        : idx === 2
                          ? 'bg-amber-700/20 text-amber-700'
                          : 'bg-surface-elevated text-fg-muted'
                  }`}
                >
                  #{idx + 1}
                </span>
                <span className="text-fg truncate text-sm font-semibold">{player.name}</span>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-primary text-sm font-bold">{player.runs}</span>
                <span className="text-fg-muted ml-1 text-xs">runs</span>
              </div>
            </Link>
          ))}
        </div>
      );
    }

    if (activeCategory === 'wickets') {
      if (!topBowlers || topBowlers.length === 0) {
        return (
          <p className="text-fg-muted py-6 text-center text-xs sm:text-sm">
            No bowling statistics recorded yet.
          </p>
        );
      }
      return (
        <div className="space-y-2">
          {topBowlers.map((player, idx) => (
            <Link
              key={player.id || idx}
              to={`/members/${player.id}`}
              className="border-border-subtle hover:border-primary/50 bg-surface flex min-h-[48px] items-center justify-between gap-3 rounded-xl border p-3 transition-colors"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    idx === 0
                      ? 'bg-amber-500/20 text-amber-500'
                      : idx === 1
                        ? 'bg-slate-400/20 text-slate-400'
                        : idx === 2
                          ? 'bg-amber-700/20 text-amber-700'
                          : 'bg-surface-elevated text-fg-muted'
                  }`}
                >
                  #{idx + 1}
                </span>
                <span className="text-fg truncate text-sm font-semibold">{player.name}</span>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-primary text-sm font-bold">{player.wickets}</span>
                <span className="text-fg-muted ml-1 text-xs">wickets</span>
              </div>
            </Link>
          ))}
        </div>
      );
    }

    if (!topFielders || topFielders.length === 0) {
      return (
        <p className="text-fg-muted py-6 text-center text-xs sm:text-sm">
          No fielding statistics recorded yet.
        </p>
      );
    }
    return (
      <div className="space-y-2">
        {topFielders.map((player, idx) => (
          <Link
            key={player.id || idx}
            to={`/members/${player.id}`}
            className="border-border-subtle hover:border-primary/50 bg-surface flex min-h-[48px] items-center justify-between gap-3 rounded-xl border p-3 transition-colors"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  idx === 0
                    ? 'bg-amber-500/20 text-amber-500'
                    : idx === 1
                      ? 'bg-slate-400/20 text-slate-400'
                      : idx === 2
                        ? 'bg-amber-700/20 text-amber-700'
                        : 'bg-surface-elevated text-fg-muted'
                }`}
              >
                #{idx + 1}
              </span>
              <span className="text-fg truncate text-sm font-semibold">{player.name}</span>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-primary text-sm font-bold">{player.catches}</span>
              <span className="text-fg-muted ml-1 text-xs">catches</span>
            </div>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span>Performance Leaders</span>
          </div>
        }
        description="Top academy performers across formats"
        action={
          <div className="bg-surface-muted/80 border-border-subtle flex rounded-lg border p-0.5">
            <button
              type="button"
              onClick={() => setActiveCategory('runs')}
              className={`min-h-[32px] rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                activeCategory === 'runs'
                  ? 'bg-primary text-primary-fg shadow-2xs'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              Runs
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('wickets')}
              className={`min-h-[32px] rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                activeCategory === 'wickets'
                  ? 'bg-primary text-primary-fg shadow-2xs'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              Wickets
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('fielding')}
              className={`min-h-[32px] rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                activeCategory === 'fielding'
                  ? 'bg-primary text-primary-fg shadow-2xs'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              Fielding
            </button>
          </div>
        }
      />
      <CardBody className="p-3 sm:p-4">{renderContent()}</CardBody>
    </Card>
  );
}
