import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Award, BookOpen, Layers, Pencil } from 'lucide-react';

import { ErrorState, EmptyState } from '@/components/feedback';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Textarea,
} from '@/components/ui';
import { MobilePageHeader } from '@/components/mobile';
import { useActiveAcademy } from '@/features/academies';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/lib/api/errors';
import { useCan } from '@/lib/rbac';
import { isUUID } from '@/lib/validators';
import { useUiStore } from '@/stores';
import type { UUID } from '@/types';
import { useCoach, useMyCoachId, useUpdateCoachProfile } from '../hooks/useCoaches';
import type { CoachWithBatches, UpdateCoachProfileInput } from '../api/coachesTypes';

/** Comma-separated tag input, matching the convention `BatchesPage` already
 * uses for `trainingDays` -- typed as free text, split into an array on
 * save, rather than a bespoke chip widget. */
function tagsToText(tags: string[]): string {
  return tags.join(', ');
}
function textToTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function CoachProfilePage() {
  const { coachId: coachIdParam } = useParams();
  const navigate = useNavigate();
  const { academyId } = useActiveAcademy();
  const { profile } = useAuth();
  const canManageAny = useCan('coaches:manage');

  const isMe = coachIdParam === 'me';
  const myCoachIdQuery = useMyCoachId(academyId, isMe ? (profile?.id ?? null) : null);
  const resolvedCoachId: UUID | null = isMe
    ? (myCoachIdQuery.data ?? null)
    : coachIdParam && isUUID(coachIdParam)
      ? (coachIdParam as UUID)
      : null;

  const coachQuery = useCoach(academyId, resolvedCoachId);
  const updateProfile = useUpdateCoachProfile(academyId as UUID);
  const pushToast = useUiStore((state) => state.pushToast);

  const [editing, setEditing] = useState(false);

  if (!academyId) return null;

  if (isMe && myCoachIdQuery.isPending) {
    return <p className="text-fg-muted py-8 text-center text-sm">Loading your profile…</p>;
  }

  if (isMe && !myCoachIdQuery.isPending && !resolvedCoachId) {
    return (
      <EmptyState
        title="No coach profile found"
        description="Your account doesn't have a coach profile in this academy yet."
      />
    );
  }

  if (!resolvedCoachId) {
    return <EmptyState title="Coach not found" description="This coach link isn't valid." />;
  }

  if (coachQuery.isPending) {
    return <p className="text-fg-muted py-8 text-center text-sm">Loading coach profile…</p>;
  }

  if (coachQuery.isError || !coachQuery.data) {
    return <ErrorState error={coachQuery.error} onRetry={() => void coachQuery.refetch()} />;
  }

  const coach = coachQuery.data;
  const isOwnProfile = coach.userId === profile?.id;
  const canEdit = canManageAny || isOwnProfile;

  const handleSave = async (input: UpdateCoachProfileInput) => {
    try {
      await updateProfile.mutateAsync({ coachId: coach.coachId, input });
      pushToast({ title: 'Coach profile updated', variant: 'success' });
      setEditing(false);
    } catch (error) {
      pushToast({
        title: 'Could not update profile',
        description: errorMessage(error),
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <div className="md:hidden">
        <MobilePageHeader
          title={coach.fullName ?? coach.email}
          subtitle={isOwnProfile ? 'Your coach profile' : 'Coach profile'}
        />
      </div>
      <div className="hidden items-center justify-between gap-3 md:flex">
        <div>
          <h1 className="text-fg text-xl font-bold">{coach.fullName ?? coach.email}</h1>
          <p className="text-fg-muted text-sm">
            {isOwnProfile ? 'Your coach profile' : 'Coach profile'}
          </p>
        </div>
        {canManageAny ? (
          <Button variant="ghost" size="sm" onClick={() => void navigate('/coaches')}>
            &larr; All coaches
          </Button>
        ) : null}
      </div>

      <Card>
        <CardBody className="flex items-center gap-4">
          <Avatar
            name={coach.fullName ?? coach.email}
            src={coach.avatarUrl ?? undefined}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="text-fg text-base font-bold">{coach.fullName ?? 'Unnamed coach'}</p>
            <p className="text-fg-muted text-sm">{coach.email}</p>
          </div>
          {canEdit && !editing ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </Button>
          ) : null}
        </CardBody>
      </Card>

      {editing && canEdit ? (
        <CoachProfileEditForm
          coach={coach}
          isSaving={updateProfile.isPending}
          onCancel={() => setEditing(false)}
          onSave={(input) => void handleSave(input)}
        />
      ) : (
        <Card>
          <CardHeader title="About" />
          <CardBody className="space-y-4">
            <p className="text-fg text-sm">{coach.bio || 'No bio added yet.'}</p>

            <div>
              <p className="text-fg-muted mb-1.5 text-xs font-semibold tracking-wide uppercase">
                Specialties
              </p>
              {coach.specialization.length === 0 ? (
                <p className="text-fg-muted text-sm italic">None set yet</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {coach.specialization.map((tag) => (
                    <Badge key={tag} tone="brand">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-fg-muted mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                Certifications
              </p>
              {coach.certifications.length === 0 ? (
                <p className="text-fg-muted text-sm italic">None added yet</p>
              ) : (
                <ul className="text-fg list-inside list-disc text-sm">
                  {coach.certifications.map((cert) => (
                    <li key={cert}>{cert}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="text-fg-muted flex items-center gap-1.5 text-sm">
              <Award className="h-4 w-4" aria-hidden />
              {coach.experienceYears !== null
                ? `${coach.experienceYears} year${coach.experienceYears === 1 ? '' : 's'} of experience`
                : 'Experience not set'}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4" aria-hidden />
              Assigned batches
            </span>
          }
        />
        <CardBody className="p-0">
          {coach.batches.length === 0 ? (
            <p className="text-fg-muted p-4 text-center text-sm">Not assigned to any batch yet.</p>
          ) : (
            <ul className="divide-border-subtle divide-y">
              {coach.batches.map((batch) => (
                <li
                  key={batch.batchId}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <Link
                    to={`/batches/${batch.batchId}`}
                    className="text-fg font-medium hover:underline"
                  >
                    {batch.batchName}
                  </Link>
                  <Badge tone={batch.isPrimary ? 'brand' : 'neutral'}>
                    {batch.isPrimary ? 'Head Coach' : 'Assistant'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function CoachProfileEditForm({
  coach,
  isSaving,
  onCancel,
  onSave,
}: {
  coach: CoachWithBatches;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (input: UpdateCoachProfileInput) => void;
}) {
  // Mounted only once `coach` data has arrived (see the parent's `editing`
  // gate), so seeding state straight from props here can't repeat the
  // stale-defaultValues bug a coach edit form on this app hit before: a form
  // whose initial values are captured before its data has loaded.
  const [bio, setBio] = useState(coach.bio ?? '');
  const [specialization, setSpecialization] = useState(tagsToText(coach.specialization));
  const [certifications, setCertifications] = useState(tagsToText(coach.certifications));
  const [experienceYears, setExperienceYears] = useState(
    coach.experienceYears !== null ? String(coach.experienceYears) : '',
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsedYears = experienceYears.trim() === '' ? null : Number(experienceYears);
    onSave({
      bio: bio.trim() === '' ? null : bio.trim(),
      specialization: textToTags(specialization),
      certifications: textToTags(certifications),
      experienceYears:
        parsedYears !== null && Number.isFinite(parsedYears) ? Math.max(0, parsedYears) : null,
    });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader title="Edit coach profile" />
        <CardBody className="space-y-4">
          <label className="block text-sm">
            <span className="text-fg-muted mb-1.5 block">Bio</span>
            <Textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="A short introduction — playing background, coaching philosophy, etc."
            />
          </label>

          <label className="block text-sm">
            <span className="text-fg-muted mb-1.5 block">
              Specialties <span className="text-xs font-normal">(comma-separated)</span>
            </span>
            <Input
              value={specialization}
              onChange={(event) => setSpecialization(event.target.value)}
              placeholder="Batting, Fast bowling, Fielding"
            />
          </label>

          <label className="block text-sm">
            <span className="text-fg-muted mb-1.5 block">
              Certifications <span className="text-xs font-normal">(comma-separated)</span>
            </span>
            <Input
              value={certifications}
              onChange={(event) => setCertifications(event.target.value)}
              placeholder="Level 2 Coaching Certificate, First Aid"
            />
          </label>

          <label className="block text-sm">
            <span className="text-fg-muted mb-1.5 block">Years of experience</span>
            <Input
              type="number"
              min={0}
              value={experienceYears}
              onChange={(event) => setExperienceYears(event.target.value)}
              className="max-w-[160px]"
            />
          </label>
        </CardBody>
        <div className="border-border-subtle/60 flex flex-col gap-2 border-t p-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
