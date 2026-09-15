import { useMemo } from 'react';
import { Trophy, Sparkles } from 'lucide-react';
import { Button, Select } from '@/components/ui';
import { calculateMatchMvp } from '../../../import/cricketMvpCalculator';
import type { WizardState } from '../types';

export function AwardsStep({
  state,
  onChange,
  onNext,
  onBack,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const awards = state.awards;
  const players = state.lineup;

  const mvpResult = useMemo(
    () => calculateMatchMvp(state.lineup, state.batting, state.bowling, state.fielding),
    [state.lineup, state.batting, state.bowling, state.fielding],
  );

  function updateAward(key: keyof typeof awards, value: string | null) {
    onChange({
      awards: {
        ...awards,
        [key]: value || null,
      },
    });
  }

  function handleAutoApplyMvp() {
    onChange({
      awards: {
        playerOfMatchId: (mvpResult.playerOfMatch?.memberId as string) || null,
        bestBatterId: (mvpResult.bestBatter?.memberId as string) || null,
        bestBowlerId: (mvpResult.bestBowler?.memberId as string) || null,
        bestFielderId: (mvpResult.bestFielder?.memberId as string) || null,
      },
    });
  }

  function handleSkip() {
    onChange({
      awards: {
        playerOfMatchId: null,
        bestBatterId: null,
        bestBowlerId: null,
        bestFielderId: null,
      },
    });
    onNext();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-heading text-fg text-base font-extrabold tracking-tight uppercase">
            Match Awards & Accolades
          </h3>
          <p className="text-fg-muted font-sans text-xs">
            Select performance award winners or auto-populate based on the calculated cricket MVP
            index.
          </p>
        </div>
        {mvpResult.playerOfMatch && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleAutoApplyMvp}
            className="border-primary/30 text-primary hover:bg-primary/10 flex h-8 items-center gap-1.5 px-3 text-xs font-bold"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Auto-Apply MVP Recommendations
          </Button>
        )}
      </div>

      {/* MVP Points Leaderboard Summary */}
      {mvpResult.leaderboard.length > 0 && (
        <div className="border-border-subtle bg-surface/60 space-y-3 rounded-2xl border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="text-primary h-4 w-4" />
              <span className="font-heading text-fg text-xs font-extrabold tracking-wider uppercase">
                Top Match Performers (MVP Score)
              </span>
            </div>
            <span className="text-fg-muted font-mono text-[11px]">Points Formula v2.0</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {mvpResult.leaderboard.slice(0, 6).map((item, idx) => (
              <div
                key={item.memberId}
                className="border-border-subtle/70 bg-surface-muted/40 flex items-center justify-between rounded-xl border p-2.5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-black ${
                      idx === 0
                        ? 'bg-primary text-black'
                        : idx === 1
                          ? 'text-fg bg-white/20'
                          : 'bg-surface border-border-subtle text-fg-muted border'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <span className="text-fg truncate font-semibold">{item.playerName}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-fg-muted font-mono text-[11px]">
                    {item.statsSummary.runs > 0 ? `${item.statsSummary.runs}r ` : ''}
                    {item.statsSummary.wickets > 0 ? `${item.statsSummary.wickets}w ` : ''}
                    {item.statsSummary.catches > 0 ? `${item.statsSummary.catches}c` : ''}
                  </span>
                  <span className="text-primary bg-primary/10 border-primary/20 rounded-md border px-2 py-0.5 font-mono font-black">
                    {item.totalPoints} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Award Selector Dropdowns */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border-border-subtle bg-surface space-y-1.5 rounded-xl border p-3.5">
          <div className="flex items-center justify-between">
            <label className="text-fg text-xs font-bold tracking-wider uppercase">
              Player of the Match
            </label>
            {mvpResult.playerOfMatch && (
              <span className="text-primary font-mono text-[10px] font-bold">
                Rec: {mvpResult.playerOfMatch.playerName}
              </span>
            )}
          </div>
          <Select
            value={awards.playerOfMatchId ?? ''}
            onChange={(e) => updateAward('playerOfMatchId', e.target.value)}
            className="text-xs"
          >
            <option value="">None / Not awarded</option>
            {players.map((p) => (
              <option key={p.memberId} value={p.memberId}>
                {p.fullName ?? p.email} {p.isGuest ? '(Guest)' : ''}
              </option>
            ))}
          </Select>
        </div>

        <div className="border-border-subtle bg-surface space-y-1.5 rounded-xl border p-3.5">
          <div className="flex items-center justify-between">
            <label className="text-fg text-xs font-bold tracking-wider uppercase">
              Best Batter
            </label>
            {mvpResult.bestBatter && (
              <span className="text-primary font-mono text-[10px] font-bold">
                Rec: {mvpResult.bestBatter.playerName} ({mvpResult.bestBatter.statsSummary.runs}r)
              </span>
            )}
          </div>
          <Select
            value={awards.bestBatterId ?? ''}
            onChange={(e) => updateAward('bestBatterId', e.target.value)}
            className="text-xs"
          >
            <option value="">None / Not awarded</option>
            {players.map((p) => (
              <option key={p.memberId} value={p.memberId}>
                {p.fullName ?? p.email} {p.isGuest ? '(Guest)' : ''}
              </option>
            ))}
          </Select>
        </div>

        <div className="border-border-subtle bg-surface space-y-1.5 rounded-xl border p-3.5">
          <div className="flex items-center justify-between">
            <label className="text-fg text-xs font-bold tracking-wider uppercase">
              Best Bowler
            </label>
            {mvpResult.bestBowler && (
              <span className="text-primary font-mono text-[10px] font-bold">
                Rec: {mvpResult.bestBowler.playerName} ({mvpResult.bestBowler.statsSummary.wickets}
                w)
              </span>
            )}
          </div>
          <Select
            value={awards.bestBowlerId ?? ''}
            onChange={(e) => updateAward('bestBowlerId', e.target.value)}
            className="text-xs"
          >
            <option value="">None / Not awarded</option>
            {players.map((p) => (
              <option key={p.memberId} value={p.memberId}>
                {p.fullName ?? p.email} {p.isGuest ? '(Guest)' : ''}
              </option>
            ))}
          </Select>
        </div>

        <div className="border-border-subtle bg-surface space-y-1.5 rounded-xl border p-3.5">
          <div className="flex items-center justify-between">
            <label className="text-fg text-xs font-bold tracking-wider uppercase">
              Best Fielder
            </label>
            {mvpResult.bestFielder && (
              <span className="text-primary font-mono text-[10px] font-bold">
                Rec: {mvpResult.bestFielder.playerName}
              </span>
            )}
          </div>
          <Select
            value={awards.bestFielderId ?? ''}
            onChange={(e) => updateAward('bestFielderId', e.target.value)}
            className="text-xs"
          >
            <option value="">None / Not awarded</option>
            {players.map((p) => (
              <option key={p.memberId} value={p.memberId}>
                {p.fullName ?? p.email} {p.isGuest ? '(Guest)' : ''}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack} className="text-xs">
          ← Back
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            id="skip-awards-btn"
            onClick={handleSkip}
            className="text-xs"
          >
            Skip Awards
          </Button>
          <Button type="button" id="awards-next-btn" onClick={onNext} className="text-xs font-bold">
            Next: Review & Save →
          </Button>
        </div>
      </div>
    </div>
  );
}
