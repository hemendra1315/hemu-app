import { useState } from 'react';
import { Button, Select } from '@/components/ui';
import { BATTING_ORDER_OPENING } from '../types';
import type { WizardLineupEntry, WizardState } from '../types';

function positionOptions(currentEntry: WizardLineupEntry, allLineup: WizardLineupEntry[]) {
  const numberedOrders = allLineup
    .filter((l) => l.memberId !== currentEntry.memberId && l.battingOrder > 0)
    .map((l) => l.battingOrder);
  const maxNumbered = numberedOrders.length > 0 ? Math.max(...numberedOrders) : 0;
  const maxOffer = Math.max(maxNumbered + 1, 11);

  const opts: { value: number; label: string }[] = [
    { value: BATTING_ORDER_OPENING, label: 'Opening' },
  ];
  for (let i = 1; i <= maxOffer; i++) {
    opts.push({ value: i, label: String(i) });
  }
  return opts;
}

function hasDuplicateNumbered(
  lineup: WizardLineupEntry[],
  entryId: string,
  order: number,
): boolean {
  if (order === BATTING_ORDER_OPENING) return false;
  return lineup.some((l) => l.memberId !== entryId && l.battingOrder === order && order > 0);
}

export function BattingOrderStep({
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
  const [addCount, setAddCount] = useState(0);

  function updateEntry(memberId: string, patch: Partial<WizardLineupEntry>) {
    onChange({
      lineup: state.lineup.map((l) => (l.memberId === memberId ? { ...l, ...patch } : l)),
    });
  }

  function addBatter() {
    const maxOrder = Math.max(...state.lineup.map((l) => l.battingOrder));
    setAddCount((c) => c + 1);
    onChange({
      lineup: state.lineup.map((l, idx) =>
        idx === state.lineup.length - 1 - addCount ? { ...l, battingOrder: maxOrder + 1 } : l,
      ),
    });
  }

  const sortedLineup = [...state.lineup].sort((a, b) => {
    if (a.battingOrder === BATTING_ORDER_OPENING && b.battingOrder === BATTING_ORDER_OPENING)
      return 0;
    if (a.battingOrder === BATTING_ORDER_OPENING) return -1;
    if (b.battingOrder === BATTING_ORDER_OPENING) return 1;
    return a.battingOrder - b.battingOrder;
  });

  return (
    <div className="space-y-4">
      <p className="text-fg-muted text-sm">
        Set the batting position for each player. Multiple players can be "Opening". Duplicate
        numbered positions are highlighted in red.
      </p>

      <div className="space-y-3">
        {sortedLineup.map((entry) => {
          const options = positionOptions(entry, state.lineup);
          const isDuplicate = hasDuplicateNumbered(
            state.lineup,
            entry.memberId,
            entry.battingOrder,
          );

          return (
            <div
              key={entry.memberId}
              className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                isDuplicate ? 'border-danger-500 bg-danger-500/10' : 'border-border-subtle'
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="bg-surface-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {entry.fullName?.[0] ?? '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-fg truncate text-sm font-medium">
                    {entry.fullName ?? entry.email}
                  </p>
                  {isDuplicate && (
                    <p className="text-danger-500 text-xs">Duplicate position — please change</p>
                  )}
                </div>
              </div>

              <Select
                aria-label={`Batting position for ${entry.fullName ?? entry.email}`}
                value={entry.battingOrder}
                onChange={(e) =>
                  updateEntry(entry.memberId, { battingOrder: Number(e.target.value) })
                }
                className="w-32 shrink-0"
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateEntry(entry.memberId, { isCaptain: !entry.isCaptain })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    entry.isCaptain ? 'bg-primary text-white' : 'bg-surface-muted text-fg-muted'
                  }`}
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateEntry(entry.memberId, { isViceCaptain: !entry.isViceCaptain })
                  }
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    entry.isViceCaptain
                      ? 'bg-primary/80 text-white'
                      : 'bg-surface-muted text-fg-muted'
                  }`}
                >
                  VC
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateEntry(entry.memberId, { isWicketkeeper: !entry.isWicketkeeper })
                  }
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    entry.isWicketkeeper
                      ? 'bg-success text-white'
                      : 'bg-surface-muted text-fg-muted'
                  }`}
                >
                  WK
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        id="add-batter-btn"
        onClick={addBatter}
        className="text-primary hover:text-primary/80 flex items-center gap-2 text-sm font-medium"
      >
        <span className="text-lg">+</span> Add Batter
      </button>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button
          type="button"
          id="batting-order-next-btn"
          onClick={() => {
            const hasDups = state.lineup.some((e) =>
              hasDuplicateNumbered(state.lineup, e.memberId, e.battingOrder),
            );
            if (!hasDups) onNext();
          }}
        >
          Next: Scorecard →
        </Button>
      </div>
    </div>
  );
}
