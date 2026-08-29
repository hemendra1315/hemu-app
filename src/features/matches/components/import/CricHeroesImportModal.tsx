import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, CardBody } from '@/components/ui';
import { useAcademyMembers } from '@/features/members';
import { useAcademyMatches } from '../../hooks/useMatches';
import type { UUID } from '@/types';
import {
  type ExtractedMatchData,
  type MappedPlayer,
  getDefaultOversForFormat,
} from '../../import/cricheroesPdfTypes';
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
import type { WizardState } from '../wizard/types';

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

    // Filter relevant innings for academy team based on selected team A or B
    // Assuming innings[0] corresponds to team A (first parsed team) and innings[1] to team B
    const academyInnings =
      selectedAcademyTeamId === 'A'
        ? extracted.innings[0]
        : extracted.innings[1] || extracted.innings[0];

    const playerLookup = new Map(mappedPlayers.map((p) => [p.cricheroesName.toLowerCase(), p]));

    // CricHeroes marks the captain and wicketkeeper next to the name, e.g.
    // "Kabilan (c)". The parser lifts those off both the batting and bowling
    // tables — a captain who only bowled is still the captain — so the import
    // can tick the boxes rather than leaving them all false.
    const captains = new Set<string>();
    const keepers = new Set<string>();
    extracted.innings.forEach((inn) => {
      [...inn.batting, ...inn.bowling].forEach((p) => {
        if (p.isCaptain) captains.add(p.name.toLowerCase());
        if (p.isWicketkeeper) keepers.add(p.name.toLowerCase());
      });
    });

    // Construct WizardState compatible with existing MatchWizard
    const lineup = mappedPlayers
      .filter((p) => !p.isIgnored)
      .map((p, idx) => ({
        memberId: (p.isGuest ? `guest_${idx}` : p.academyMemberId) as UUID,
        fullName: p.isGuest ? p.cricheroesName : p.academyMemberName,
        email: '',
        avatarUrl: null,
        battingOrder: idx === 0 || idx === 1 ? 0 : idx + 1,
        isCaptain: captains.has(p.cricheroesName.toLowerCase()),
        isViceCaptain: false,
        isWicketkeeper: keepers.has(p.cricheroesName.toLowerCase()),
        isGuest: p.isGuest,
        guestName: p.isGuest ? p.cricheroesName : null,
      }));

    const batting = (academyInnings?.batting || [])
      .filter((b) => {
        const mapped = playerLookup.get(b.name.toLowerCase());
        return mapped && !mapped.isIgnored;
      })
      .map((b) => {
        const mapped = playerLookup.get(b.name.toLowerCase());
        const isGuest = mapped?.isGuest ?? true;
        return {
          memberId: (isGuest ? `guest_${b.name}` : mapped?.academyMemberId) as UUID,
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          isOut: b.isOut,
          dismissalType: b.dismissalType,
          isGuest,
          guestName: isGuest ? b.name : null,
        };
      });

    const bowling = (academyInnings?.bowling || [])
      .filter((b) => {
        const mapped = playerLookup.get(b.name.toLowerCase());
        return mapped && !mapped.isIgnored;
      })
      .map((b) => {
        const mapped = playerLookup.get(b.name.toLowerCase());
        const isGuest = mapped?.isGuest ?? true;
        return {
          memberId: (isGuest ? `guest_${b.name}` : mapped?.academyMemberId) as UUID,
          overs: b.overs,
          maidens: b.maidens,
          runsConceded: b.runsConceded,
          wickets: b.wickets,
          wides: b.wides,
          noBalls: b.noBalls,
          isGuest,
          guestName: isGuest ? b.name : null,
        };
      });

    const wizardState: WizardState = {
      matchName: extracted.matchName,
      matchDate: extracted.matchDate,
      opponentName: opponentName || extracted.teamB.name,
      venue: extracted.venue,
      matchType: extracted.matchType,
      format: extracted.format,
      result: extracted.result,
      teamScore: selectedAcademyTeamId === 'A' ? extracted.teamA.score : extracted.teamB.score,
      overs: getDefaultOversForFormat(extracted.format),
      tournament: extracted.tournament,
      selectedPlayerIds: lineup.map((l) => l.memberId),
      lineup,
      batting,
      bowling,
      fielding: [],
      awards: {
        playerOfMatchId: null,
        bestBatterId: null,
        bestBowlerId: null,
        bestFielderId: null,
      },
    };

    onImportReady(wizardState);
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
