import { useState } from 'react';

import { Button, Card, CardBody, CardHeader, Textarea } from '@/components/ui';
import { Can } from '@/lib/rbac';
import type { UUID } from '@/types';

import type { MatchLineup } from '../api/matchesTypes';
import { useMatchCoachNotes, useSaveMatchCoachNote } from '../hooks/useMatches';

/**
 * Closes the gap where `match_coach_notes` was read by three places in the
 * codebase but written by none: `save_match_result` parsed a `notes` field
 * out of its payload and dropped it on the floor, and no screen ever offered
 * a coach a place to type one in. This is that place. Writes go straight to
 * `match_coach_notes` (see `saveMatchCoachNote`) rather than through the
 * match-result RPC, so a coach can add or edit a note any time after the
 * match, independent of the scorecard.
 */
export function MatchCoachNotesCard({
  matchId,
  academyId,
  lineups,
}: {
  matchId: UUID;
  academyId: UUID;
  lineups: MatchLineup[];
}) {
  const notesQuery = useMatchCoachNotes(matchId);
  const saveNote = useSaveMatchCoachNote(matchId, academyId);

  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [savedFor, setSavedFor] = useState<string | null>(null);

  const rosterPlayers = lineups.filter(
    (lineup): lineup is MatchLineup & { academyMemberId: UUID } =>
      !lineup.isGuest && Boolean(lineup.academyMemberId),
  );

  if (rosterPlayers.length === 0) return null;

  async function handleSave(academyMemberId: UUID, note: string) {
    setSavingFor(academyMemberId);
    try {
      await saveNote.mutateAsync({ academyMemberId, notes: note });
      setSavedFor(academyMemberId);
      window.setTimeout(() => {
        setSavedFor((current) => (current === academyMemberId ? null : current));
      }, 2000);
    } finally {
      setSavingFor(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Coach Notes"
        description="Visible to everyone in the academy. Only coaches and the owner can write them."
      />
      <CardBody>
        <Can
          do="matches:manage"
          fallback={
            notesQuery.isPending ? (
              <p className="text-fg-muted text-sm">Loading notes…</p>
            ) : (
              (() => {
                const written = (notesQuery.data ?? []).filter((note) => note.notes);
                if (written.length === 0) {
                  return (
                    <p className="text-fg-muted text-sm">No coach notes for this match yet.</p>
                  );
                }
                return (
                  <ul className="space-y-3">
                    {written.map((note) => {
                      const player = rosterPlayers.find(
                        (lineup) => lineup.academyMemberId === note.academyMemberId,
                      )?.player;
                      return (
                        <li key={note.id} className="text-sm">
                          <p className="text-fg font-medium">
                            {player?.fullName ?? player?.email ?? 'Player'}
                          </p>
                          <p className="text-fg-muted mt-0.5 whitespace-pre-wrap">{note.notes}</p>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()
            )
          }
        >
          {notesQuery.isPending ? (
            <p className="text-fg-muted text-sm">Loading notes…</p>
          ) : (
            <div className="space-y-4">
              {rosterPlayers.map((lineup) => {
                const initialNote =
                  notesQuery.data?.find((n) => n.academyMemberId === lineup.academyMemberId)
                    ?.notes ?? '';
                return (
                  <CoachPlayerNoteItem
                    key={`${lineup.academyMemberId}-${initialNote}`}
                    lineup={lineup}
                    initialNote={initialNote}
                    savedFor={savedFor}
                    savingFor={savingFor}
                    onSave={handleSave}
                  />
                );
              })}
            </div>
          )}
        </Can>
      </CardBody>
    </Card>
  );
}

function CoachPlayerNoteItem({
  lineup,
  initialNote,
  savedFor,
  savingFor,
  onSave,
}: {
  lineup: MatchLineup & { academyMemberId: UUID };
  initialNote: string;
  savedFor: string | null;
  savingFor: string | null;
  onSave: (academyMemberId: UUID, note: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initialNote);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-fg text-sm font-medium">
          {lineup.player.fullName ?? lineup.player.email}
        </p>
        {savedFor === lineup.academyMemberId && (
          <span className="text-success text-xs font-medium">Saved</span>
        )}
      </div>
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="How did they play? Anything to work on before the next session?"
        className="min-h-[70px] text-sm"
        disabled={savingFor === lineup.academyMemberId}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="secondary"
          isLoading={savingFor === lineup.academyMemberId}
          onClick={() => void onSave(lineup.academyMemberId, draft)}
        >
          Save note
        </Button>
      </div>
    </div>
  );
}
