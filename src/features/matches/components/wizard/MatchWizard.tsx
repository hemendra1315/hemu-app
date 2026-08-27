import { useState } from 'react';
import { Card, CardBody } from '@/components/ui';
import type { UUID } from '@/types';
import { INITIAL_WIZARD_STATE, WIZARD_STEPS, type WizardState, type WizardStep } from './types';
import { MatchDetailsStep } from './steps/MatchDetailsStep';
import { SelectPlayersStep } from './steps/SelectPlayersStep';
import { BattingOrderStep } from './steps/BattingOrderStep';
import { ScorecardStep } from './steps/ScorecardStep';
import { AwardsStep } from './steps/AwardsStep';
import { ReviewStep } from './steps/ReviewStep';
import { useSaveMatchResult } from '../../hooks/useMatches';
import type { SaveMatchResultPayload } from '../../api/matchesTypes';
import { useUiStore } from '@/stores';

export function MatchWizard({
  academyId,
  initialState,
  onComplete,
}: {
  academyId: UUID;
  initialState?: WizardState;
  onComplete: (matchId: UUID) => void;
}) {
  const pushToast = useUiStore((state) => state.pushToast);
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    initialState ? 'scorecard' : 'details',
  );
  const [state, setState] = useState<WizardState>(initialState ?? INITIAL_WIZARD_STATE);

  const saveMutation = useSaveMatchResult(academyId);

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  function updateState(patch: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  function nextStep() {
    if (stepIndex >= 0 && stepIndex < WIZARD_STEPS.length - 1) {
      const nextStepObj = WIZARD_STEPS[stepIndex + 1];
      if (nextStepObj) setCurrentStep(nextStepObj.id);
    }
  }

  function prevStep() {
    if (stepIndex > 0) {
      const prevStepObj = WIZARD_STEPS[stepIndex - 1];
      if (prevStepObj) setCurrentStep(prevStepObj.id);
    }
  }

  async function handleSave() {
    /**
     * `match_batting.batting_order` is what the match detail scorecard renders
     * as "Pos" (0 → "Opening") and sorts the innings by. The Batting Order step
     * collects it, but only ever wrote it to `state.lineup` — the batting rows
     * were built without it, so `saveMatchResult` fell back to its `0` default
     * and every batter on a wizard-created match was stored as position 0. The
     * whole side then displayed as "Opening" in arbitrary order, and an entire
     * wizard step's output was silently discarded.
     *
     * `state.batting` is seeded from `state.lineup` and keyed by the same
     * `memberId`, so this lookup is exact for guests and members alike.
     */
    const battingOrderByMember = new Map(state.lineup.map((l) => [l.memberId, l.battingOrder]));

    // Construct payload for save_match_result RPC
    const payload: SaveMatchResultPayload = {
      match: {
        matchName: state.matchName,
        matchDate: state.matchDate,
        opponentName: state.opponentName || null,
        venue: state.venue || null,
        matchType: state.matchType,
        format: state.format,
        result: state.result,
        teamScore: state.teamScore || null,
        overs: state.overs ? parseFloat(state.overs) : null,
        tournament: state.tournament || null,
      },
      lineups: state.lineup.map((l) => ({
        academyMemberId: l.isGuest ? null : l.memberId,
        battingOrder: l.battingOrder,
        isCaptain: l.isCaptain,
        isViceCaptain: l.isViceCaptain,
        isWicketkeeper: l.isWicketkeeper,
        isGuest: l.isGuest ?? false,
        guestName: l.isGuest ? l.guestName || l.fullName : null,
      })),
      batting: state.batting.map((b) => ({
        academyMemberId: b.isGuest ? null : b.memberId,
        runs: b.runs,
        balls: b.balls,
        fours: b.fours,
        sixes: b.sixes,
        isOut: b.isOut,
        dismissalType: b.dismissalType || null,
        battingOrder: battingOrderByMember.get(b.memberId) ?? null,
        isGuest: b.isGuest ?? false,
        guestName: b.isGuest ? b.guestName || null : null,
      })),
      bowling: state.bowling.map((b) => ({
        academyMemberId: b.isGuest ? null : b.memberId,
        overs: parseFloat(b.overs) || 0,
        maidens: b.maidens,
        runsConceded: b.runsConceded,
        wickets: b.wickets,
        wides: b.wides,
        noBalls: b.noBalls,
        isGuest: b.isGuest ?? false,
        guestName: b.isGuest ? b.guestName || null : null,
      })),
      fielding: state.fielding.map((f) => ({
        academyMemberId: f.isGuest ? null : f.memberId,
        catches: f.catches,
        runOuts: f.runOuts,
        stumpings: f.stumpings,
        isGuest: f.isGuest ?? false,
        guestName: f.isGuest ? f.guestName || null : null,
      })),
      awards: {
        playerOfMatchId:
          state.awards.playerOfMatchId && !state.awards.playerOfMatchId.startsWith('guest_')
            ? state.awards.playerOfMatchId
            : null,
        bestBatterId:
          state.awards.bestBatterId && !state.awards.bestBatterId.startsWith('guest_')
            ? state.awards.bestBatterId
            : null,
        bestBowlerId:
          state.awards.bestBowlerId && !state.awards.bestBowlerId.startsWith('guest_')
            ? state.awards.bestBowlerId
            : null,
        bestFielderId:
          state.awards.bestFielderId && !state.awards.bestFielderId.startsWith('guest_')
            ? state.awards.bestFielderId
            : null,
      },
    };

    try {
      const res = await saveMutation.mutateAsync(payload);
      pushToast({ title: 'Match saved successfully', variant: 'success' });
      onComplete(res.matchId as UUID);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save match result';
      pushToast({ title: 'Save Match Failed', description: msg, variant: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Header / Step bar */}
      <div className="border-border-subtle bg-surface-subtle flex max-w-full overflow-x-auto rounded-xl border p-1">
        {WIZARD_STEPS.map((s, idx) => {
          const isActive = s.id === currentStep;
          const isDone = idx < stepIndex;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (isDone) setCurrentStep(s.id);
              }}
              disabled={!isDone && !isActive}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : isDone
                    ? 'text-primary hover:bg-surface-muted cursor-pointer'
                    : 'text-fg-muted cursor-not-allowed opacity-50'
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                  isActive
                    ? 'text-primary bg-white font-bold'
                    : isDone
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-muted text-fg-muted'
                }`}
              >
                {idx + 1}
              </span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardBody className="p-6">
          {currentStep === 'details' && (
            <MatchDetailsStep state={state} onChange={updateState} onNext={nextStep} />
          )}

          {currentStep === 'players' && (
            <SelectPlayersStep
              state={state}
              onChange={updateState}
              onNext={nextStep}
              onBack={prevStep}
              academyId={academyId}
            />
          )}

          {currentStep === 'batting-order' && (
            <BattingOrderStep
              state={state}
              onChange={updateState}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}

          {currentStep === 'scorecard' && (
            <ScorecardStep
              state={state}
              onChange={updateState}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}

          {currentStep === 'awards' && (
            <AwardsStep state={state} onChange={updateState} onNext={nextStep} onBack={prevStep} />
          )}

          {currentStep === 'review' && (
            <ReviewStep
              state={state}
              onSave={handleSave}
              onBack={prevStep}
              isSubmitting={saveMutation.isPending}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
