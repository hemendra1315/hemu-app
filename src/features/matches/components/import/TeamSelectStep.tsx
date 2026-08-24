import { useState } from 'react';
import { Button } from '@/components/ui';
import type { ExtractedMatchData } from '../../import/cricheroesPdfTypes';

export function TeamSelectStep({
  data,
  onConfirm,
  onBack,
}: {
  data: ExtractedMatchData;
  onConfirm: (teamId: 'A' | 'B', opponentName: string) => void;
  onBack: () => void;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState<'A' | 'B'>('A');

  const selectedAcademyTeamName = selectedTeamId === 'A' ? data.teamA.name : data.teamB.name;
  const opponentName = selectedTeamId === 'A' ? data.teamB.name : data.teamA.name;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-fg text-lg font-semibold">Select Your Academy Team</h3>
        <p className="text-fg-muted text-sm">
          Which of the two teams in the CricHeroes scorecard belongs to your academy?
        </p>
      </div>

      {/* Bug 1 fix: surface parse warnings so users know scores need manual verification */}
      {data.warnings.length > 0 && (
        <div className="bg-warning-500/10 border-warning-500/30 text-warning-500 rounded-xl border p-4 text-sm">
          <p className="font-semibold">⚠ Score data could not be fully detected</p>
          <ul className="mt-1 list-disc pl-4">
            {data.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs opacity-80">Please verify the scores manually after import.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setSelectedTeamId('A')}
          className={`rounded-xl border p-5 text-left transition ${
            selectedTeamId === 'A'
              ? 'border-primary bg-primary/10'
              : 'border-border-subtle hover:border-primary/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-fg font-bold">{data.teamA.name}</span>
            {data.teamA.score ? (
              <span className="text-fg-muted text-xs font-semibold">{data.teamA.score}</span>
            ) : (
              <span className="text-warning-500 text-xs italic">Score not detected</span>
            )}
          </div>
          <p className="text-fg-muted mt-2 text-xs">Click to select as Academy Team</p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedTeamId('B')}
          className={`rounded-xl border p-5 text-left transition ${
            selectedTeamId === 'B'
              ? 'border-primary bg-primary/10'
              : 'border-border-subtle hover:border-primary/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-fg font-bold">{data.teamB.name}</span>
            {data.teamB.score ? (
              <span className="text-fg-muted text-xs font-semibold">{data.teamB.score}</span>
            ) : (
              <span className="text-warning-500 text-xs italic">Score not detected</span>
            )}
          </div>
          <p className="text-fg-muted mt-2 text-xs">Click to select as Academy Team</p>
        </button>
      </div>

      <div className="bg-surface-subtle border-border-subtle rounded-xl border p-4 text-sm">
        <p className="text-fg font-medium">Selected Configuration:</p>
        <p className="text-fg-muted mt-1">
          <strong>Academy Team:</strong> {selectedAcademyTeamName}
        </p>
        <p className="text-fg-muted">
          <strong>Opponent:</strong> {opponentName}
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button type="button" onClick={() => onConfirm(selectedTeamId, opponentName)}>
          Next: Player Mapping →
        </Button>
      </div>
    </div>
  );
}
