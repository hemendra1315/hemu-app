import { Button, Select } from '@/components/ui';
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

  function updateAward(key: keyof typeof awards, value: string | null) {
    onChange({
      awards: {
        ...awards,
        [key]: value || null,
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
    <div className="space-y-5">
      <p className="text-fg-muted text-sm">
        Select optional match award winners. All awards are optional and can be skipped.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-fg mb-1 block text-sm font-medium">Player of the Match</label>
          <Select
            value={awards.playerOfMatchId ?? ''}
            onChange={(e) => updateAward('playerOfMatchId', e.target.value)}
          >
            <option value="">None / Not awarded</option>
            {players.map((p) => (
              <option key={p.memberId} value={p.memberId}>
                {p.fullName ?? p.email}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="text-fg mb-1 block text-sm font-medium">Best Batter</label>
          <Select
            value={awards.bestBatterId ?? ''}
            onChange={(e) => updateAward('bestBatterId', e.target.value)}
          >
            <option value="">None / Not awarded</option>
            {players.map((p) => (
              <option key={p.memberId} value={p.memberId}>
                {p.fullName ?? p.email}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="text-fg mb-1 block text-sm font-medium">Best Bowler</label>
          <Select
            value={awards.bestBowlerId ?? ''}
            onChange={(e) => updateAward('bestBowlerId', e.target.value)}
          >
            <option value="">None / Not awarded</option>
            {players.map((p) => (
              <option key={p.memberId} value={p.memberId}>
                {p.fullName ?? p.email}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="text-fg mb-1 block text-sm font-medium">Best Fielder</label>
          <Select
            value={awards.bestFielderId ?? ''}
            onChange={(e) => updateAward('bestFielderId', e.target.value)}
          >
            <option value="">None / Not awarded</option>
            {players.map((p) => (
              <option key={p.memberId} value={p.memberId}>
                {p.fullName ?? p.email}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" id="skip-awards-btn" onClick={handleSkip}>
            Skip Awards
          </Button>
          <Button type="button" id="awards-next-btn" onClick={onNext}>
            Next: Review & Save →
          </Button>
        </div>
      </div>
    </div>
  );
}
