import { useState } from 'react';
import { Modal, Button, Input, Select } from '@/components/ui';
import { useUpdateCricketProfile } from '../hooks/usePlayers';
import type { PlayerProfile } from '../api/playersTypes';

interface EditCricketProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PlayerProfile;
}

export function EditCricketProfileModal({
  isOpen,
  onClose,
  profile,
}: EditCricketProfileModalProps) {
  const [bio, setBio] = useState(profile.bio || '');
  const [jerseyNumber, setJerseyNumber] = useState(profile.jerseyNumber || '');
  const [battingStyle, setBattingStyle] = useState(profile.battingStyle || '');
  const [bowlingStyle, setBowlingStyle] = useState(profile.bowlingStyle || '');
  const [playerRole, setPlayerRole] = useState(profile.playerRole || '');

  const updateProfile = useUpdateCricketProfile();

  const handleSave = () => {
    updateProfile.mutate(
      {
        academyId: profile.academyId,
        playerId: profile.id,
        data: {
          bio: bio || null,
          jerseyNumber: jerseyNumber ? parseInt(jerseyNumber, 10) : null,
          battingStyle: battingStyle || null,
          bowlingStyle: bowlingStyle || null,
          playerRole: playerRole || null,
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={updateProfile.isPending}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleSave} isLoading={updateProfile.isPending}>
        Save Profile
      </Button>
    </>
  );

  return (
    <Modal open={isOpen} onClose={onClose} size="lg" title="Edit Cricket Profile" footer={footer}>
      <div className="space-y-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="playerRole" className="text-fg text-sm font-medium">
              Playing Role
            </label>
            <Select
              id="playerRole"
              value={playerRole}
              onChange={(e) => setPlayerRole(e.target.value)}
            >
              <option value="">Select Role</option>
              <option value="batsman">Batsman</option>
              <option value="bowler">Bowler</option>
              <option value="all_rounder">All Rounder</option>
              <option value="wicketkeeper">Wicketkeeper</option>
            </Select>
          </div>

          <div className="space-y-1">
            <label htmlFor="jerseyNumber" className="text-fg text-sm font-medium">
              Jersey Number
            </label>
            <Input
              id="jerseyNumber"
              type="number"
              placeholder="e.g. 10"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="battingStyle" className="text-fg text-sm font-medium">
              Batting Style
            </label>
            <Select
              id="battingStyle"
              value={battingStyle}
              onChange={(e) => setBattingStyle(e.target.value)}
            >
              <option value="">Select Style</option>
              <option value="right_hand">Right Hand</option>
              <option value="left_hand">Left Hand</option>
            </Select>
          </div>

          <div className="space-y-1">
            <label htmlFor="bowlingStyle" className="text-fg text-sm font-medium">
              Bowling Style
            </label>
            <Input
              id="bowlingStyle"
              placeholder="e.g. Right-arm fast"
              value={bowlingStyle}
              onChange={(e) => setBowlingStyle(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1 pt-2">
          <label htmlFor="bio" className="text-fg text-sm font-medium">
            Player Bio & Achievements
          </label>
          <textarea
            id="bio"
            rows={4}
            className="border-input placeholder:text-fg-muted focus:border-brand focus:ring-brand/20 flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Add your cricket background, achievements, and goals..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
