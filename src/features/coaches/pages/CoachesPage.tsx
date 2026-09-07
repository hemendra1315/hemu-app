import { Link } from 'react-router-dom';
import { Award, ChevronRight, Users } from 'lucide-react';

import { ErrorState, EmptyState } from '@/components/feedback';
import { Avatar, Badge } from '@/components/ui';
import { MobilePageHeader } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { useCoaches } from '../hooks/useCoaches';

export default function CoachesPage() {
  const { academyId } = useActiveAcademy();
  const coachesQuery = useCoaches(academyId);

  if (!academyId) return null;

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="md:hidden">
        <MobilePageHeader title="Coaches" subtitle="Profiles and batch assignments" />
      </div>
      <div className="hidden md:block">
        <h1 className="text-fg text-xl font-bold">Coaches</h1>
        <p className="text-fg-muted text-sm">
          Every coach's profile, specialties and which batches they run.
        </p>
      </div>

      {coachesQuery.isPending ? (
        <p className="text-fg-muted text-center text-sm">Loading coaches…</p>
      ) : coachesQuery.isError ? (
        <ErrorState error={coachesQuery.error} onRetry={() => void coachesQuery.refetch()} />
      ) : coachesQuery.data && coachesQuery.data.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" aria-hidden />}
          title="No coaches yet"
          description="Coaches show up here once someone joins the academy with the coach role."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(coachesQuery.data ?? []).map((coach) => {
            const cardBody = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      name={coach.fullName ?? coach.email}
                      src={coach.avatarUrl ?? undefined}
                    />
                    <div className="min-w-0">
                      <p className="text-fg truncate text-sm font-bold">
                        {coach.fullName ?? coach.email}
                      </p>
                      <p className="text-fg-muted truncate text-xs">{coach.email}</p>
                    </div>
                  </div>
                  {coach.coachId ? (
                    <ChevronRight className="text-fg-muted/60 h-4 w-4 shrink-0" />
                  ) : null}
                </div>

                {coach.specialization.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {coach.specialization.slice(0, 3).map((tag) => (
                      <Badge key={tag} tone="brand" className="px-2 py-0.5 text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                    {coach.specialization.length > 3 ? (
                      <span className="text-fg-muted text-[10px]">
                        +{coach.specialization.length - 3} more
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-fg-muted text-xs italic">No specialties set yet</p>
                )}

                {coach.experienceYears !== null ? (
                  <div className="text-fg-muted flex items-center gap-1.5 text-xs">
                    <Award className="h-3.5 w-3.5" aria-hidden />
                    <span>
                      {coach.experienceYears} year{coach.experienceYears === 1 ? '' : 's'}{' '}
                      experience
                    </span>
                  </div>
                ) : null}
              </>
            );

            // `coachId` is only null in the brief window before a new
            // coach's `coaches` row exists (see `coachesTypes.ts`) -- show
            // the card without a link rather than one pointing at
            // `/coaches/null`.
            return coach.coachId ? (
              <Link
                key={coach.userId}
                to={`/coaches/${coach.coachId}`}
                className="border-border-subtle bg-surface hover:border-primary/50 flex flex-col gap-3 rounded-xl border p-4 shadow-2xs transition-colors"
              >
                {cardBody}
              </Link>
            ) : (
              <div
                key={coach.userId}
                className="border-border-subtle bg-surface flex flex-col gap-3 rounded-xl border p-4 opacity-70 shadow-2xs"
              >
                {cardBody}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
