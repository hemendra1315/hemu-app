import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useActiveAcademy } from '@/features/academies';
import { MatchWizard } from '../components/wizard';
import { CricHeroesImportModal } from '../components/import';
import type { WizardState } from '../components/wizard/types';

export default function AddMatchPage() {
  const { academyId } = useActiveAcademy();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [initialImportState, setInitialImportState] = useState<WizardState | null>(null);
  const [showImportModal, setShowImportModal] = useState<boolean>(
    searchParams.get('import') === 'cricheroes',
  );

  if (!academyId) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-fg text-2xl font-bold">New Match Entry</h1>
          <p className="text-fg-muted text-sm">
            Enter match details manually or import from a CricHeroes PDF scorecard.
          </p>
        </div>

        {!showImportModal && (
          <Button
            variant="secondary"
            id="open-import-modal-btn"
            onClick={() => setShowImportModal(true)}
          >
            📥 Import CricHeroes PDF
          </Button>
        )}
      </div>

      {showImportModal ? (
        <CricHeroesImportModal
          academyId={academyId}
          onImportReady={(prefilledState) => {
            setInitialImportState(prefilledState);
            setShowImportModal(false);
          }}
          onCancel={() => setShowImportModal(false)}
        />
      ) : (
        <MatchWizard
          key={initialImportState ? 'imported' : 'manual'}
          academyId={academyId}
          initialState={initialImportState ?? undefined}
          onComplete={(matchId) => {
            navigate(`/matches/${matchId}`);
          }}
        />
      )}
    </div>
  );
}
