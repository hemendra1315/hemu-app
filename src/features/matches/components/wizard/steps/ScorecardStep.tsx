import { useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import type {
  WizardBattingEntry,
  WizardBowlingEntry,
  WizardFieldingEntry,
  WizardState,
} from '../types';

const DISMISSAL_TYPES = [
  'bowled',
  'caught',
  'lbw',
  'run_out',
  'stumped',
  'hit_wicket',
  'retired',
  'not_out',
];

export function ScorecardStep({
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
  const [subTab, setSubTab] = useState<'batting' | 'bowling' | 'fielding'>('batting');

  // Initialize scorecard arrays from lineup if empty
  const batting =
    state.batting.length > 0
      ? state.batting
      : state.lineup.map((l) => ({
          memberId: l.memberId,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          isOut: true,
          dismissalType: 'bowled',
          isGuest: l.isGuest,
          guestName: l.guestName,
        }));

  const bowling = state.bowling.length > 0 ? state.bowling : [];

  const fielding = state.fielding.length > 0 ? state.fielding : [];

  function updateBatting(memberId: string, patch: Partial<WizardBattingEntry>) {
    const updated = batting.map((b) => (b.memberId === memberId ? { ...b, ...patch } : b));
    onChange({ batting: updated });
  }

  function updateBowling(memberId: string, patch: Partial<WizardBowlingEntry>) {
    const updated = bowling.map((b) => (b.memberId === memberId ? { ...b, ...patch } : b));
    onChange({ bowling: updated });
  }

  function updateFielding(memberId: string, patch: Partial<WizardFieldingEntry>) {
    const updated = fielding.map((f) => (f.memberId === memberId ? { ...f, ...patch } : f));
    onChange({ fielding: updated });
  }

  function addBowler(memberId: string) {
    if (bowling.some((b) => b.memberId === memberId)) return;
    onChange({
      bowling: [
        ...bowling,
        {
          memberId,
          overs: '0.0',
          maidens: 0,
          runsConceded: 0,
          wickets: 0,
          wides: 0,
          noBalls: 0,
        },
      ],
    });
  }

  function addFielder(memberId: string) {
    if (fielding.some((f) => f.memberId === memberId)) return;
    onChange({
      fielding: [
        ...fielding,
        {
          memberId,
          catches: 0,
          runOuts: 0,
          stumpings: 0,
        },
      ],
    });
  }

  const memberMap = new Map(state.lineup.map((l) => [l.memberId, l]));

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="border-border-subtle flex border-b">
        <button
          type="button"
          id="scorecard-tab-batting"
          onClick={() => setSubTab('batting')}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            subTab === 'batting'
              ? 'border-primary text-primary font-semibold'
              : 'text-fg-muted hover:text-fg border-transparent'
          }`}
        >
          Batting ({batting.length})
        </button>
        <button
          type="button"
          id="scorecard-tab-bowling"
          onClick={() => setSubTab('bowling')}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            subTab === 'bowling'
              ? 'border-primary text-primary font-semibold'
              : 'text-fg-muted hover:text-fg border-transparent'
          }`}
        >
          Bowling ({bowling.length})
        </button>
        <button
          type="button"
          id="scorecard-tab-fielding"
          onClick={() => setSubTab('fielding')}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            subTab === 'fielding'
              ? 'border-primary text-primary font-semibold'
              : 'text-fg-muted hover:text-fg border-transparent'
          }`}
        >
          Fielding ({fielding.length})
        </button>
      </div>

      {/* BATTING TAB */}
      {subTab === 'batting' && (
        <div className="space-y-3">
          {batting.map((entry) => {
            const player = memberMap.get(entry.memberId);
            return (
              <div
                key={entry.memberId}
                className="border-border-subtle space-y-2 rounded-xl border p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-fg font-medium">{player?.fullName ?? player?.email}</p>
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={!entry.isOut}
                      onChange={(e) =>
                        updateBatting(entry.memberId, {
                          isOut: !e.target.checked,
                          dismissalType: e.target.checked ? 'not_out' : 'bowled',
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    Not Out
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div>
                    <label className="text-fg-muted block text-xs">Runs</label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.runs}
                      onChange={(e) =>
                        updateBatting(entry.memberId, { runs: Math.max(0, Number(e.target.value)) })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-fg-muted block text-xs">Balls</label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.balls}
                      onChange={(e) =>
                        updateBatting(entry.memberId, {
                          balls: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-fg-muted block text-xs">4s</label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.fours}
                      onChange={(e) =>
                        updateBatting(entry.memberId, {
                          fours: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-fg-muted block text-xs">6s</label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.sixes}
                      onChange={(e) =>
                        updateBatting(entry.memberId, {
                          sixes: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-fg-muted block text-xs">Dismissal</label>
                    <Select
                      disabled={!entry.isOut}
                      value={entry.dismissalType}
                      onChange={(e) =>
                        updateBatting(entry.memberId, { dismissalType: e.target.value })
                      }
                    >
                      {DISMISSAL_TYPES.map((d) => (
                        <option key={d} value={d}>
                          {d.replace('_', ' ')}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BOWLING TAB */}
      {subTab === 'bowling' && (
        <div className="space-y-3">
          {bowling.map((entry) => {
            const player = memberMap.get(entry.memberId);
            return (
              <div
                key={entry.memberId}
                className="border-border-subtle space-y-2 rounded-xl border p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-fg font-medium">{player?.fullName ?? player?.email}</p>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ bowling: bowling.filter((b) => b.memberId !== entry.memberId) })
                    }
                    className="text-danger-500 text-xs hover:underline"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <div>
                    <label className="text-fg-muted block text-xs">Overs (e.g. 4.0)</label>
                    <Input
                      type="text"
                      value={entry.overs}
                      hasError={Boolean(entry.overs) && !/^\d+(\.[0-5])?$/.test(entry.overs.trim())}
                      onChange={(e) => updateBowling(entry.memberId, { overs: e.target.value })}
                    />
                    {Boolean(entry.overs) && !/^\d+(\.[0-5])?$/.test(entry.overs.trim()) && (
                      <p className="text-danger-500 mt-1 text-xs" role="alert">
                        Invalid overs (e.g. 4.0 - 4.5)
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-fg-muted block text-xs">Maidens</label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.maidens}
                      onChange={(e) =>
                        updateBowling(entry.memberId, {
                          maidens: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-fg-muted block text-xs">Runs</label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.runsConceded}
                      onChange={(e) =>
                        updateBowling(entry.memberId, {
                          runsConceded: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-fg-muted block text-xs">Wickets</label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.wickets}
                      onChange={(e) =>
                        updateBowling(entry.memberId, {
                          wickets: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-fg-muted block text-xs">Wides</label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.wides}
                      onChange={(e) =>
                        updateBowling(entry.memberId, {
                          wides: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-fg-muted block text-xs">No Balls</label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.noBalls}
                      onChange={(e) =>
                        updateBowling(entry.memberId, {
                          noBalls: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-2">
            <Select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  addBowler(e.target.value);
                }
              }}
              className="w-full sm:w-64"
            >
              <option value="">+ Add Bowler…</option>
              {state.lineup
                .filter((l) => !bowling.some((b) => b.memberId === l.memberId))
                .map((l) => (
                  <option key={l.memberId} value={l.memberId}>
                    {l.fullName ?? l.email}
                  </option>
                ))}
            </Select>
          </div>
        </div>
      )}

      {/* FIELDING TAB */}
      {subTab === 'fielding' && (
        <div className="space-y-3">
          {fielding.map((entry) => {
            const player = memberMap.get(entry.memberId);
            return (
              <div
                key={entry.memberId}
                className="border-border-subtle space-y-2 rounded-xl border p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-fg font-medium">{player?.fullName ?? player?.email}</p>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ fielding: fielding.filter((f) => f.memberId !== entry.memberId) })
                    }
                    className="text-danger-500 text-xs hover:underline"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-fg-muted block text-xs">Catches</label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.catches}
                      onChange={(e) =>
                        updateFielding(entry.memberId, {
                          catches: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-fg-muted block text-xs">Run Outs</label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.runOuts}
                      onChange={(e) =>
                        updateFielding(entry.memberId, {
                          runOuts: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-fg-muted block text-xs">Stumpings</label>
                    <Input
                      type="number"
                      min="0"
                      value={entry.stumpings}
                      onChange={(e) =>
                        updateFielding(entry.memberId, {
                          stumpings: Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-2">
            <Select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  addFielder(e.target.value);
                }
              }}
              className="w-full sm:w-64"
            >
              <option value="">+ Add Fielder…</option>
              {state.lineup
                .filter((l) => !fielding.some((f) => f.memberId === l.memberId))
                .map((l) => (
                  <option key={l.memberId} value={l.memberId}>
                    {l.fullName ?? l.email}
                  </option>
                ))}
            </Select>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button
          type="button"
          id="scorecard-next-btn"
          onClick={() => {
            const hasInvalidOvers = bowling.some(
              (b) => Boolean(b.overs) && !/^\d+(\.[0-5])?$/.test(b.overs.trim()),
            );
            if (hasInvalidOvers) {
              setSubTab('bowling');
              return;
            }
            // Save state if initialized locally
            onChange({ batting, bowling, fielding });
            onNext();
          }}
        >
          Next: Awards →
        </Button>
      </div>
    </div>
  );
}
