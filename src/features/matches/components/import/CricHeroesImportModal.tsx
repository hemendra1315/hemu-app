import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, CardBody } from '@/components/ui';
import { useAcademyMembers } from '@/features/members';
import { useAcademyMatches } from '../../hooks/useMatches';
import type { UUID } from '@/types';
import { type ExtractedMatchData, type MappedPlayer } from '../../import/cricheroesPdfTypes';
import { buildImportWizardState } from '../../import/buildImportWizardState';
import type { WizardState } from '../wizard/types';
import { parseCricHeroesText } from '../../import/cricheroesPdfParser';
import { matchPlayers } from '../../import/playerNameMatcher';
import { checkDuplicateMatch } from '../../import/duplicateMatchChecker';
import {
  fetchCricHeroesPlayerMappings,
  saveCricHeroesPlayerMappings,
} from '../../api/cricheroesMappingsApi';
import { PdfUploadStep } from './PdfUploadStep';
import { TeamSelectStep } from './TeamSelectStep';
import { PlayerMappingStep } from './PlayerMappingStep';

export function CricHeroesImportModal({
  academyId,
  onImportReady,
  onCancel,
}: {
  academyId: UUID;
  onImportReady: (wizardState: WizardState) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'upload' | 'teams' | 'players' | 'duplicate'>('upload');
  const [extracted, setExtracted] = useState<ExtractedMatchData | null>(null);
  const [selectedAcademyTeamId, setSelectedAcademyTeamId] = useState<'A' | 'B'>('A');
  const [opponentName, setOpponentName] = useState<string>('');
  const [mappedPlayers, setMappedPlayers] = useState<MappedPlayer[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const membersQuery = useAcademyMembers(academyId, { status: 'active' });
  const academyMatchesQuery = useAcademyMatches(academyId);

  const mappingsQuery = useQuery({
    queryKey: ['cricheroes-mappings', academyId],
    queryFn: () => fetchCricHeroesPlayerMappings(academyId),
    enabled: Boolean(academyId),
  });

  const members = membersQuery.data ?? [];
  const existingMatches = academyMatchesQuery.data ?? [];
  const savedMappings = mappingsQuery.data ?? [];

  function handleFileLoaded(text: string) {
    const parsed = parseCricHeroesText(text);
    setExtracted(parsed);

    // Extract all player names from innings
    const allNames: string[] = [];
    parsed.innings.forEach((inn) => {
      inn.batting.forEach((b) => allNames.push(b.name));
      inn.bowling.forEach((b) => allNames.push(b.name));
    });

    const candidates = members.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      email: m.email,
    }));

    const matched = matchPlayers(allNames, candidates, savedMappings);
    setMappedPlayers(matched);

    // Check duplicate
    const dupCheck = checkDuplicateMatch(parsed, existingMatches);
    if (dupCheck.isDuplicate && dupCheck.confidenceReason) {
      setDuplicateWarning(dupCheck.confidenceReason);
    } else {
      setDuplicateWarning(null);
    }

    setStep('teams');
  }

  function handleTeamsConfirmed(teamId: 'A' | 'B', oppName: string) {
    setSelectedAcademyTeamId(teamId);
    setOpponentName(oppName);

    if (duplicateWarning) {
      setStep('duplicate');
    } else {
      setStep('players');
    }
  }

  async function handleFinalizeImport() {
    if (!extracted) return;

    // Save mapping decisions to database for future imports
    const mappingsToSave = mappedPlayers
      .filter((p) => !p.isIgnored)
      .map((p) => ({
        cricheroesPlayerId: p.cricheroesPlayerId ?? null,
        cricheroesName: p.cricheroesName,
        academyMemberId: p.isGuest ? null : p.academyMemberId,
        isGuest: p.isGuest,
        confidenceScore: p.confidenceScore,
      }));

    try {
      await saveCricHeroesPlayerMappings(academyId, mappingsToSave);
    } catch {
      // Non-blocking: continue import even if mapping save encounters a network glitch
    }

    onImportReady(
      buildImportWizardState({
        extracted,
        mappedPlayers,
        selectedAcademyTeamId,
        opponentName,
      }),
    );
  }

  return (
    <Card className="mx-auto max-w-3xl shadow-xl">
      <CardBody className="p-6">
        {step === 'upload' && <PdfUploadStep onFileLoaded={handleFileLoaded} onCancel={onCancel} />}

        {step === 'teams' && extracted && (
          <TeamSelectStep
            data={extracted}
            onConfirm={handleTeamsConfirmed}
            onBack={() => setStep('upload')}
          />
        )}

        {step === 'duplicate' && (
          <div className="space-y-6 text-center">
            <div className="bg-warning-500/10 border-warning-500/30 text-warning-500 rounded-2xl border p-6">
              <h3 className="text-lg font-bold">Possible Duplicate Match Detected</h3>
              <p className="mt-2 text-sm">{duplicateWarning}</p>
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="ghost" onClick={onCancel}>
                Cancel Import
              </Button>
              <Button onClick={() => setStep('players')}>Continue Import Anyway</Button>
            </div>
          </div>
        )}

        {step === 'players' && (
          <PlayerMappingStep
            mappedPlayers={mappedPlayers}
            academyPlayers={members.map((m) => ({
              id: m.id,
              fullName: m.fullName,
              email: m.email,
            }))}
            onChange={setMappedPlayers}
            onNext={handleFinalizeImport}
            onBack={() => setStep('teams')}
          />
        )}
      </CardBody>
    </Card>
  );
}
