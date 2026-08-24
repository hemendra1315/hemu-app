import { Badge, Button, Select } from '@/components/ui';
import type { AcademyPlayerCandidate } from '../../import/playerNameMatcher';
import type { MappedPlayer } from '../../import/cricheroesPdfTypes';

export function PlayerMappingStep({
  mappedPlayers,
  academyPlayers,
  onChange,
  onNext,
  onBack,
}: {
  mappedPlayers: MappedPlayer[];
  academyPlayers: AcademyPlayerCandidate[];
  onChange: (updated: MappedPlayer[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  function updatePlayerMapping(idx: number, patch: Partial<MappedPlayer>) {
    const next = [...mappedPlayers];
    const current = next[idx];
    if (current) {
      next[idx] = { ...current, ...patch };
      onChange(next);
    }
  }

  function handleSelectAcademyPlayer(idx: number, memberId: string) {
    if (!memberId) {
      updatePlayerMapping(idx, {
        academyMemberId: null,
        academyMemberName: null,
        isGuest: true,
        status: 'guest_player',
      });
      return;
    }
    const found = academyPlayers.find((p) => p.id === memberId);
    updatePlayerMapping(idx, {
      academyMemberId: memberId,
      academyMemberName: found?.fullName ?? found?.email ?? null,
      isGuest: false,
      status: 'manual_matched',
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-fg text-lg font-semibold">Match Roster Players</h3>
        <p className="text-fg-muted text-sm">
          Review extracted players. Match them with your academy roster or mark them as Guest
          Players.
        </p>
      </div>

      {/* Mobile Card Layout (< md) */}
      <div className="space-y-3 md:hidden">
        {mappedPlayers.map((player, idx) => (
          <div
            key={player.cricheroesName + idx}
            className="border-border-subtle bg-surface space-y-3 rounded-xl border p-4 shadow-2xs"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-fg truncate text-base font-bold">{player.cricheroesName}</span>
              {player.isIgnored ? (
                <Badge tone="neutral">Ignored</Badge>
              ) : player.savedMapping ? (
                <Badge tone="success">Saved Mapping ✓</Badge>
              ) : player.isGuest ? (
                <Badge tone="warning">Guest Player</Badge>
              ) : player.status === 'exact_match' ? (
                <Badge tone="success">Exact Match</Badge>
              ) : (
                <Badge tone="brand">Matched</Badge>
              )}
            </div>

            <div>
              <label className="text-fg-muted mb-1 block text-xs font-medium">
                Academy Player Assignment
              </label>
              <Select
                value={player.academyMemberId ?? ''}
                onChange={(e) => handleSelectAcademyPlayer(idx, e.target.value)}
                className="w-full text-sm"
                disabled={player.isIgnored}
              >
                <option value="">-- Guest Player (Not in Academy) --</option>
                {academyPlayers.map((ap) => (
                  <option key={ap.id} value={ap.id}>
                    {ap.fullName ?? ap.email}
                  </option>
                ))}
              </Select>
            </div>

            <div className="border-border-subtle flex justify-end border-t pt-2">
              <Button
                size="sm"
                variant={player.isIgnored ? 'secondary' : 'ghost'}
                onClick={() => updatePlayerMapping(idx, { isIgnored: !player.isIgnored })}
                className="min-h-[44px]"
              >
                {player.isIgnored ? 'Include Player' : 'Ignore'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Layout (>= md) */}
      <div className="border-border-subtle hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-subtle border-border-subtle border-b">
            <tr>
              <th className="px-4 py-3 font-semibold">CricHeroes Player</th>
              <th className="px-4 py-3 font-semibold">Academy Player</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-border-subtle divide-y">
            {mappedPlayers.map((player, idx) => (
              <tr key={player.cricheroesName + idx} className="hover:bg-surface-muted/50">
                <td className="text-fg px-4 py-3 font-medium">{player.cricheroesName}</td>
                <td className="px-4 py-3">
                  <Select
                    value={player.academyMemberId ?? ''}
                    onChange={(e) => handleSelectAcademyPlayer(idx, e.target.value)}
                    className="w-full max-w-xs"
                    disabled={player.isIgnored}
                  >
                    <option value="">-- Guest Player (Not in Academy) --</option>
                    {academyPlayers.map((ap) => (
                      <option key={ap.id} value={ap.id}>
                        {ap.fullName ?? ap.email}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-3">
                  {player.isIgnored ? (
                    <Badge tone="neutral">Ignored</Badge>
                  ) : player.savedMapping ? (
                    <Badge tone="success">Saved Mapping ✓</Badge>
                  ) : player.isGuest ? (
                    <Badge tone="warning">Guest Player</Badge>
                  ) : player.status === 'exact_match' ? (
                    <Badge tone="success">Exact Match (100%)</Badge>
                  ) : player.status === 'high_confidence' ? (
                    <Badge tone="success">Matched ({player.confidenceScore}%)</Badge>
                  ) : (
                    <Badge tone="brand">Matched</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => updatePlayerMapping(idx, { isIgnored: !player.isIgnored })}
                    className="text-fg-muted hover:text-fg text-xs font-medium underline"
                  >
                    {player.isIgnored ? 'Include' : 'Ignore'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-surface-subtle border-border-subtle text-fg-muted space-y-1 rounded-xl border p-4 text-xs">
        <p className="text-fg font-semibold">Guest Player Policy:</p>
        <p>
          • Guest Players will appear on this match scorecard but will NOT be added to your academy
          roster or career statistics.
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button type="button" onClick={onNext}>
          Next: Review Scorecard →
        </Button>
      </div>
    </div>
  );
}
