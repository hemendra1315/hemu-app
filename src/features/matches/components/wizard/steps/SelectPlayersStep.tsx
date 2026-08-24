import { Button } from '@/components/ui';
import { useAcademyMembers } from '@/features/members';
import type { UUID } from '@/types';
import type { WizardState } from '../types';

export function SelectPlayersStep({
  state,
  onChange,
  onNext,
  onBack,
  academyId,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
  academyId: UUID;
}) {
  const membersQuery = useAcademyMembers(academyId, { status: 'active' });
  const members = membersQuery.data ?? [];

  function togglePlayer(id: UUID) {
    const current = state.selectedPlayerIds;
    if (current.includes(id)) {
      onChange({ selectedPlayerIds: current.filter((x) => x !== id) });
    } else {
      onChange({ selectedPlayerIds: [...current, id] });
    }
  }

  function handleNext() {
    if (state.selectedPlayerIds.length === 0) return;

    // Sync lineup entries with selected players
    const existingMap = new Map(state.lineup.map((l) => [l.memberId, l]));
    const memberMap = new Map(members.map((m) => [m.id, m]));

    const newLineup = state.selectedPlayerIds.map((id, idx) => {
      const existing = existingMap.get(id);
      if (existing) return existing;
      const member = memberMap.get(id);
      return {
        memberId: id,
        fullName: member?.fullName ?? null,
        email: member?.email ?? '',
        avatarUrl: member?.avatarUrl ?? null,
        battingOrder: idx < 2 ? 0 : idx + 1,
        isCaptain: false,
        isViceCaptain: false,
        isWicketkeeper: false,
      };
    });

    onChange({ lineup: newLineup });
    onNext();
  }

  return (
    <div className="space-y-4">
      <p className="text-fg-muted text-sm">
        Select the players who participated in this match. At least 1 player required.
      </p>

      {membersQuery.isPending ? (
        <p className="text-fg-muted">Loading players…</p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const selected = state.selectedPlayerIds.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                id={`player-select-${member.id}`}
                onClick={() => togglePlayer(member.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-border-subtle hover:border-primary/40'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    selected ? 'bg-primary text-white' : 'bg-surface-muted text-fg'
                  }`}
                >
                  {selected ? '✓' : (member.fullName?.[0] ?? '?')}
                </div>
                <div>
                  <p className="text-fg font-medium">{member.fullName ?? member.email}</p>
                  <p className="text-fg-muted text-xs capitalize">{member.role}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {state.selectedPlayerIds.length > 0 && (
        <p className="text-fg-muted text-sm">
          {state.selectedPlayerIds.length} player{state.selectedPlayerIds.length !== 1 ? 's' : ''}{' '}
          selected
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button
          type="button"
          id="players-next-btn"
          onClick={handleNext}
          disabled={state.selectedPlayerIds.length === 0}
        >
          Next: Batting Order →
        </Button>
      </div>
    </div>
  );
}
