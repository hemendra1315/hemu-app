import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Send, Users, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Avatar, Badge, Button, Card, Input, Select, Textarea } from '@/components/ui';
import { useActiveAcademy } from '@/features/academies/hooks/useAcademies';
import { useBatches } from '@/features/batches/hooks/useBatches';
import { useAcademyMembers } from '@/features/members';
import { errorMessage } from '@/lib/api/errors';
import { useUiStore } from '@/stores';
import { ROLE_LABELS } from '@/types/enums';

import { useCreateAnnouncement } from '../hooks/useAnnouncements';

const schema = z.object({
  title: z.string().min(1, 'Give the announcement a title').max(100),
  message: z.string().min(1, 'Write a message').max(1000),
  audience: z.enum(['all', 'coaches', 'players', 'all_parents', 'custom']),
});

type FormValues = z.infer<typeof schema>;

export function CreateAnnouncementPage() {
  const navigate = useNavigate();
  const { academyId } = useActiveAcademy();
  const createAnnouncement = useCreateAnnouncement();
  const { data: batches = [] } = useBatches(academyId || null);
  const { data: members = [], isPending: membersPending } = useAcademyMembers(academyId ?? null, {
    status: 'active',
  });
  const pushToast = useUiStore((s) => s.pushToast);

  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [peopleSearch, setPeopleSearch] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', message: '', audience: 'all' },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const audience = watch('audience');
  const isCustom = audience === 'custom';

  const filteredMembers = useMemo(() => {
    const term = peopleSearch.trim().toLowerCase();
    const sorted = [...members].sort((a, b) =>
      (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email),
    );
    if (!term) return sorted;
    return sorted.filter((member) =>
      `${member.fullName ?? ''} ${member.email}`.toLowerCase().includes(term),
    );
  }, [members, peopleSearch]);

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

  const targetCount = selectedBatchIds.length + selectedMemberIds.length;

  const onSubmit = async (data: FormValues) => {
    if (!academyId) return;

    if (data.audience === 'custom' && targetCount === 0) {
      pushToast({
        title: 'Choose who this is for',
        description: 'Pick at least one batch or one person.',
        variant: 'warning',
      });
      return;
    }

    try {
      await createAnnouncement.mutateAsync({
        academy_id: academyId,
        title: data.title,
        message: data.message,
        audience: data.audience,
        batch_ids: data.audience === 'custom' ? selectedBatchIds : [],
        member_ids: data.audience === 'custom' ? selectedMemberIds : [],
      });

      pushToast({ title: 'Announcement sent', variant: 'success' });
      navigate('/announcements');
    } catch (error: unknown) {
      pushToast({ title: errorMessage(error), variant: 'error' });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Announcement</h1>
        <p className="text-fg-muted mt-1 text-sm">
          Send a message to the whole academy, or just to the batches and people who need it.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-fg mb-1.5 block text-sm font-medium" htmlFor="ann-title">
                Title
              </label>
              <Input
                id="ann-title"
                {...register('title')}
                placeholder="E.g. Ground closed tomorrow"
                disabled={isSubmitting}
                className={errors.title ? 'border-danger' : ''}
              />
              {errors.title && <p className="text-danger mt-1 text-sm">{errors.title.message}</p>}
            </div>

            <div>
              <label className="text-fg mb-1.5 block text-sm font-medium" htmlFor="ann-message">
                Message
              </label>
              <Textarea
                id="ann-message"
                {...register('message')}
                placeholder="Type your announcement here..."
                disabled={isSubmitting}
                className={`min-h-[150px] resize-y ${errors.message ? 'border-danger' : ''}`}
              />
              {errors.message && (
                <p className="text-danger mt-1 text-sm">{errors.message.message}</p>
              )}
            </div>

            <div>
              <label className="text-fg mb-1.5 block text-sm font-medium" htmlFor="ann-audience">
                Send to
              </label>
              <Select id="ann-audience" {...register('audience')} disabled={isSubmitting}>
                <option value="all">Entire academy</option>
                <option value="coaches">All coaches</option>
                <option value="players">All players</option>
                <option value="all_parents">All parents</option>
                <option value="custom">Choose batches &amp; people…</option>
              </Select>
              {!isCustom && (
                <p className="text-fg-muted mt-1.5 text-xs">
                  Parents of a player are notified whenever their child&apos;s batch is.
                </p>
              )}
            </div>

            {isCustom && (
              <div className="border-border-subtle space-y-5 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-fg flex items-center gap-2 text-sm font-semibold">
                    <Users className="h-4 w-4" aria-hidden />
                    Recipients
                  </span>
                  <Badge tone={targetCount > 0 ? 'brand' : 'warning'}>
                    {targetCount === 0 ? 'Nobody selected' : `${targetCount} selected`}
                  </Badge>
                </div>

                {/* Batches */}
                <div>
                  <p className="text-fg-muted mb-2 text-xs font-bold tracking-wider uppercase">
                    Batches
                  </p>
                  {batches.length === 0 ? (
                    <p className="text-fg-muted text-sm">No batches yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {batches.map((batch) => {
                        const on = selectedBatchIds.includes(batch.id);
                        return (
                          <button
                            key={batch.id}
                            type="button"
                            disabled={isSubmitting}
                            aria-pressed={on}
                            onClick={() => setSelectedBatchIds((prev) => toggle(prev, batch.id))}
                            className={`min-h-[40px] rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                              on
                                ? 'border-primary bg-primary text-primary-inverse'
                                : 'border-border-subtle text-fg-muted hover:bg-surface-muted'
                            }`}
                          >
                            {batch.name}
                            {batch.playerCount ? (
                              <span className="ml-1.5 opacity-70">({batch.playerCount})</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Individual people */}
                <div>
                  <p className="text-fg-muted mb-2 text-xs font-bold tracking-wider uppercase">
                    People
                  </p>

                  <div className="relative mb-2">
                    <Search
                      className="text-fg-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                      aria-hidden
                    />
                    <Input
                      value={peopleSearch}
                      onChange={(event) => setPeopleSearch(event.target.value)}
                      placeholder="Search by name or email"
                      className="pl-9"
                      disabled={isSubmitting}
                      aria-label="Search people"
                    />
                    {peopleSearch && (
                      <button
                        type="button"
                        onClick={() => setPeopleSearch('')}
                        className="text-fg-muted hover:text-fg absolute top-1/2 right-3 -translate-y-1/2"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {membersPending ? (
                    <p className="text-fg-muted text-sm">Loading members…</p>
                  ) : filteredMembers.length === 0 ? (
                    <p className="text-fg-muted text-sm">Nobody matches that search.</p>
                  ) : (
                    <ul className="border-border-subtle divide-border-subtle max-h-64 divide-y overflow-y-auto rounded-lg border">
                      {filteredMembers.map((member) => {
                        const on = selectedMemberIds.includes(member.id);
                        return (
                          <li key={member.id}>
                            <label className="hover:bg-surface-muted flex min-h-[52px] cursor-pointer items-center gap-3 px-3 py-2">
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={isSubmitting}
                                onChange={() =>
                                  setSelectedMemberIds((prev) => toggle(prev, member.id))
                                }
                                className="accent-primary h-4 w-4 shrink-0"
                              />
                              <Avatar
                                name={member.fullName ?? member.email}
                                src={member.avatarUrl}
                                size="sm"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="text-fg block truncate text-sm font-medium">
                                  {member.fullName ?? member.email}
                                </span>
                                <span className="text-fg-muted block truncate text-xs">
                                  {member.email}
                                </span>
                              </span>
                              <Badge tone="neutral">{ROLE_LABELS[member.role]}</Badge>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <p className="text-fg-muted text-xs">
                  Picking a batch reaches its players, its coach, and those players&apos; parents.
                  Someone in two selections is still only notified once.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                'Sending…'
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send announcement
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
