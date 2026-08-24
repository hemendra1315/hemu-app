import { useState } from 'react';
import { Button, Badge } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { useActiveAcademy } from '@/features/academies';
import { EditCricketProfileModal } from './EditCricketProfileModal';
import type { PlayerProfile, PlayerStatistics } from '../api/playersTypes';

interface CricketCardProps {
  profile: PlayerProfile;
  stats: PlayerStatistics | null;
}

export function CricketCard({ profile, stats }: CricketCardProps) {
  const { user } = useAuth();
  const { membership } = useActiveAcademy();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Can edit if they are the player, OR if they are an academy owner/admin
  const canEdit = (user && user.id === profile.userId) || membership?.role === 'academy_owner';

  const dismissals = stats ? stats.battingInnings - stats.battingNotOuts : 0;
  const battingAverage =
    stats && stats.battingInnings > 0
      ? dismissals > 0
        ? (stats.battingRuns / dismissals).toFixed(2)
        : stats.battingRuns.toFixed(2)
      : '0.00';

  const strikeRate =
    stats && stats.ballsFacedSum > 0
      ? ((stats.battingRuns / stats.ballsFacedSum) * 100).toFixed(2)
      : '0.00';

  const bowlingAverage =
    stats && stats.bowlingWickets > 0
      ? (stats.bowlingRunsConceded / stats.bowlingWickets).toFixed(2)
      : '0.00';

  const economy =
    stats && stats.bowlingOvers > 0
      ? (stats.bowlingRunsConceded / stats.bowlingOvers).toFixed(2)
      : '0.00';

  return (
    <>
      <div className="bg-surface border-border-subtle overflow-hidden rounded-xl border shadow-2xs">
        {/* HEADER SECTION */}
        <div className="bg-surface-muted/40 border-border-subtle/50 border-b p-5">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="border-border-subtle relative h-20 w-20 shrink-0 rounded-full border bg-white shadow-2xs sm:h-24 sm:w-24">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName || 'Player'}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="bg-surface-muted flex h-full w-full items-center justify-center rounded-full">
                  <span className="text-fg-muted text-2xl font-bold">
                    {profile.fullName?.[0] ?? '?'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col items-center text-center sm:items-start sm:text-left">
              <div className="flex w-full flex-col justify-between sm:flex-row sm:items-start">
                <div>
                  <h1 className="font-heading text-fg text-xl font-extrabold uppercase sm:text-2xl">
                    {profile.fullName ?? 'Unknown Player'}
                  </h1>
                  <div className="mt-1 flex items-center justify-center gap-1.5 sm:justify-start">
                    {profile.academyLogoUrl && (
                      <img
                        src={profile.academyLogoUrl}
                        alt=""
                        className="h-4 w-4 rounded-full object-cover"
                      />
                    )}
                    <p className="text-fg-muted font-sans text-xs font-medium">
                      {profile.academyName}
                    </p>
                  </div>
                </div>

                {canEdit && (
                  <div className="mt-3 sm:mt-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsEditModalOpen(true)}
                      className="min-h-[40px] rounded-[10px] px-3.5 text-xs font-bold"
                    >
                      Edit Profile
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge
                  tone="brand"
                  className="font-mono text-[9px] font-bold tracking-wider uppercase"
                >
                  {profile.playerRole?.replace('_', ' ').toUpperCase() || 'PLAYER'}
                </Badge>
                {profile.jerseyNumber && (
                  <Badge tone="neutral" className="font-mono text-[9px] font-bold">
                    No. {profile.jerseyNumber}
                  </Badge>
                )}
                {profile.batchName && (
                  <Badge tone="neutral" className="font-sans text-[9px] font-bold uppercase">
                    {profile.batchName}
                  </Badge>
                )}
                {profile.playerCode && (
                  <Badge tone="neutral" className="font-mono text-[9px] font-bold">
                    ID: {profile.playerCode}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CRICKET PROFILE & BIO */}
        <div className="grid gap-6 p-5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <h3 className="font-heading text-fg-muted mb-1.5 block text-[10px] font-bold tracking-wider uppercase">
              Player Bio
            </h3>
            <p className="text-fg mt-1 font-sans text-xs leading-relaxed whitespace-pre-wrap">
              {profile.bio || 'No bio provided yet.'}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                Batting Style
              </h3>
              <p className="text-fg mt-0.5 font-sans text-xs font-bold capitalize">
                {profile.battingStyle?.replace('_', ' ') || '--'}
              </p>
            </div>
            <div>
              <h3 className="font-heading text-fg-muted mb-1 block text-[10px] font-bold tracking-wider uppercase">
                Bowling Style
              </h3>
              <p className="text-fg mt-0.5 font-sans text-xs font-bold capitalize">
                {profile.bowlingStyle?.replace('_', ' ') || '--'}
              </p>
            </div>
          </div>
        </div>

        {/* STATISTICS */}
        <div className="bg-surface-muted/30 border-border-subtle grid grid-cols-2 gap-px border-t sm:grid-cols-4">
          <StatBox label="Matches" value={stats?.matchesPlayed.toString() ?? '--'} />
          <StatBox label="Runs" value={stats?.battingRuns.toString() ?? '--'} />
          <StatBox label="Wickets" value={stats?.bowlingWickets.toString() ?? '--'} />
          <StatBox label="Catches" value={stats?.fieldingCatches.toString() ?? '--'} />
          <StatBox label="Batting Avg" value={stats ? battingAverage : '--'} />
          <StatBox label="Strike Rate" value={stats ? strikeRate : '--'} />
          <StatBox
            label="Bowling Avg"
            value={stats && stats.bowlingWickets > 0 ? bowlingAverage : '--'}
          />
          <StatBox label="Economy" value={stats && stats.bowlingOvers > 0 ? economy : '--'} />
        </div>
      </div>

      <EditCricketProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={profile}
      />
    </>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border-border-subtle/20 flex flex-col items-center justify-center border-r border-b p-4 text-center last:border-r-0">
      <span className="font-heading text-fg-muted text-[10px] font-bold tracking-wider uppercase">
        {label}
      </span>
      <span className="text-fg mt-1 font-mono text-lg font-bold">{value}</span>
    </div>
  );
}
