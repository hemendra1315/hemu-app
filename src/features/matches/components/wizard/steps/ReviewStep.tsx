import { Badge, Button } from '@/components/ui';
import { BATTING_ORDER_OPENING } from '../types';
import type { WizardState } from '../types';

export function ReviewStep({
  state,
  onSave,
  onBack,
  isSubmitting,
}: {
  state: WizardState;
  onSave: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}) {
  const memberMap = new Map(state.lineup.map((l) => [l.memberId, l]));

  const pom = state.awards.playerOfMatchId ? memberMap.get(state.awards.playerOfMatchId) : null;
  const bestBatter = state.awards.bestBatterId ? memberMap.get(state.awards.bestBatterId) : null;
  const bestBowler = state.awards.bestBowlerId ? memberMap.get(state.awards.bestBowlerId) : null;
  const bestFielder = state.awards.bestFielderId ? memberMap.get(state.awards.bestFielderId) : null;

  const hasAwards = pom || bestBatter || bestBowler || bestFielder;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-fg text-lg font-semibold">Review Match Data</h3>
        <p className="text-fg-muted text-sm">Please review the details below before saving.</p>
      </div>

      {/* MATCH DETAILS */}
      <div className="border-border-subtle space-y-2 rounded-xl border p-4">
        <h4 className="text-fg font-medium">Match Details</h4>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <span className="text-fg-muted block text-xs">Match Name</span>
            <span className="text-fg font-medium">{state.matchName}</span>
          </div>
          <div>
            <span className="text-fg-muted block text-xs">Date</span>
            <span className="text-fg font-medium">{state.matchDate}</span>
          </div>
          <div>
            <span className="text-fg-muted block text-xs">Opponent</span>
            <span className="text-fg font-medium">{state.opponentName}</span>
          </div>
          <div>
            <span className="text-fg-muted block text-xs">Result</span>
            <Badge
              tone={
                state.result === 'won' ? 'success' : state.result === 'lost' ? 'danger' : 'warning'
              }
            >
              {state.result.toUpperCase()}
            </Badge>
          </div>
          {state.venue && (
            <div>
              <span className="text-fg-muted block text-xs">Venue</span>
              <span className="text-fg font-medium">{state.venue}</span>
            </div>
          )}
          {state.teamScore && (
            <div>
              <span className="text-fg-muted block text-xs">Team Score</span>
              <span className="text-fg font-medium">{state.teamScore}</span>
            </div>
          )}
        </div>
      </div>

      {/* LINEUP & BATTING ORDER */}
      <div className="border-border-subtle space-y-2 rounded-xl border p-4">
        <h4 className="text-fg font-medium">Lineup ({state.lineup.length} Players)</h4>
        <div className="flex flex-wrap gap-2">
          {state.lineup.map((l) => (
            <span
              key={l.memberId}
              className="bg-surface-muted border-border-subtle rounded-lg border px-2.5 py-1 text-xs font-medium"
            >
              {l.battingOrder === BATTING_ORDER_OPENING ? 'Opening' : `#${l.battingOrder}`}:{' '}
              {l.fullName ?? l.email}
              {l.isCaptain ? ' (C)' : ''}
              {l.isViceCaptain ? ' (VC)' : ''}
              {l.isWicketkeeper ? ' (WK)' : ''}
            </span>
          ))}
        </div>
      </div>

      {/* BATTING SCORECARD */}
      <div className="border-border-subtle space-y-2 rounded-xl border p-4">
        <h4 className="text-fg font-medium">Batting Scorecard</h4>
        {state.batting.length === 0 ? (
          <p className="text-fg-muted text-xs">No batting entries.</p>
        ) : (
          <>
            {/* Mobile Card View (< md) */}
            <div className="space-y-2.5 md:hidden">
              {state.batting.map((b) => {
                const p = memberMap.get(b.memberId);
                const displayName = b.isGuest
                  ? `${b.guestName || 'Guest Player'} (Guest)`
                  : (p?.fullName ?? p?.email ?? 'Unknown Player');
                return (
                  <div
                    key={b.memberId}
                    className="border-border-subtle bg-surface space-y-1.5 rounded-lg border p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-fg truncate font-semibold">{displayName}</span>
                      <span className="text-primary font-bold">
                        {b.runs} <span className="text-fg-muted font-normal">({b.balls}b)</span>
                      </span>
                    </div>
                    <div className="text-fg-muted flex items-center justify-between text-[11px]">
                      <span>
                        4s: {b.fours} · 6s: {b.sixes}
                      </span>
                      <span className="bg-surface-muted rounded px-1.5 py-0.5">
                        {b.isOut ? b.dismissalType : 'Not Out'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="pb-1">Player</th>
                    <th className="pb-1">Runs</th>
                    <th className="pb-1">Balls</th>
                    <th className="pb-1">4s</th>
                    <th className="pb-1">6s</th>
                    <th className="pb-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.batting.map((b) => {
                    const p = memberMap.get(b.memberId);
                    const displayName = b.isGuest
                      ? `${b.guestName || 'Guest Player'} (Guest)`
                      : (p?.fullName ?? p?.email ?? 'Unknown Player');
                    return (
                      <tr key={b.memberId} className="border-b last:border-0">
                        <td className="py-1.5 font-medium">{displayName}</td>
                        <td className="py-1.5">{b.runs}</td>
                        <td className="py-1.5">{b.balls}</td>
                        <td className="py-1.5">{b.fours}</td>
                        <td className="py-1.5">{b.sixes}</td>
                        <td className="py-1.5">{b.isOut ? b.dismissalType : 'Not Out'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* BOWLING SCORECARD */}
      <div className="border-border-subtle space-y-2 rounded-xl border p-4">
        <h4 className="text-fg font-medium">Bowling Scorecard</h4>
        {state.bowling.length === 0 ? (
          <p className="text-fg-muted text-xs">No bowling entries.</p>
        ) : (
          <>
            {/* Mobile Card View (< md) */}
            <div className="space-y-2.5 md:hidden">
              {state.bowling.map((b) => {
                const p = memberMap.get(b.memberId);
                const displayName = b.isGuest
                  ? `${b.guestName || 'Guest Player'} (Guest)`
                  : (p?.fullName ?? p?.email ?? 'Unknown Player');
                return (
                  <div
                    key={b.memberId}
                    className="border-border-subtle bg-surface space-y-1.5 rounded-lg border p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-fg truncate font-semibold">{displayName}</span>
                      <span className="text-primary font-bold">
                        {b.wickets}/{b.runsConceded}
                      </span>
                    </div>
                    <div className="text-fg-muted flex items-center justify-between text-[11px]">
                      <span>Overs: {b.overs}</span>
                      <span>Maidens: {b.maidens}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="pb-1">Player</th>
                    <th className="pb-1">Overs</th>
                    <th className="pb-1">M</th>
                    <th className="pb-1">Runs</th>
                    <th className="pb-1">Wkts</th>
                  </tr>
                </thead>
                <tbody>
                  {state.bowling.map((b) => {
                    const p = memberMap.get(b.memberId);
                    const displayName = b.isGuest
                      ? `${b.guestName || 'Guest Player'} (Guest)`
                      : (p?.fullName ?? p?.email ?? 'Unknown Player');
                    return (
                      <tr key={b.memberId} className="border-b last:border-0">
                        <td className="py-1.5 font-medium">{displayName}</td>
                        <td className="py-1.5">{b.overs}</td>
                        <td className="py-1.5">{b.maidens}</td>
                        <td className="py-1.5">{b.runsConceded}</td>
                        <td className="py-1.5">{b.wickets}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* AWARDS */}
      {hasAwards && (
        <div className="border-border-subtle space-y-2 rounded-xl border p-4">
          <h4 className="text-fg font-medium">Awards</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {pom && (
              <div>
                <span className="text-fg-muted">Player of Match:</span>{' '}
                <span className="font-medium">{pom.fullName ?? pom.email}</span>
              </div>
            )}
            {bestBatter && (
              <div>
                <span className="text-fg-muted">Best Batter:</span>{' '}
                <span className="font-medium">{bestBatter.fullName ?? bestBatter.email}</span>
              </div>
            )}
            {bestBowler && (
              <div>
                <span className="text-fg-muted">Best Bowler:</span>{' '}
                <span className="font-medium">{bestBowler.fullName ?? bestBowler.email}</span>
              </div>
            )}
            {bestFielder && (
              <div>
                <span className="text-fg-muted">Best Fielder:</span>{' '}
                <span className="font-medium">{bestFielder.fullName ?? bestFielder.email}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isSubmitting}>
          ← Back
        </Button>
        <Button type="button" id="save-match-btn" onClick={onSave} isLoading={isSubmitting}>
          Save Match
        </Button>
      </div>
    </div>
  );
}
