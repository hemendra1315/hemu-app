import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet } from 'lucide-react';
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
    <div className="mx-auto flex max-w-4xl flex-col space-y-4 pb-24 md:pb-6">
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
              Match Entry & Scorecard Wizard
            </h1>
            <p className="text-fg-muted font-sans text-xs">
              Record match scorecard or import from CricHeroes PDF
            </p>
          </div>
        </div>

        {!showImportModal && (
          <Button
            variant="secondary"
            id="open-import-modal-btn"
            onClick={() => setShowImportModal(true)}
            className="border-border-subtle bg-surface text-fg hover:bg-surface-muted h-9 min-h-[36px] rounded-lg px-3 text-xs font-bold"
          >
            <FileSpreadsheet className="text-primary mr-1.5 h-3.5 w-3.5" />
            Import PDF
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
