import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Megaphone, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, Card, Input, Textarea, Select } from '@/components/ui';
import { MobilePageHeader } from '@/components/mobile';
import { useCreateAnnouncement } from '../hooks/useAnnouncements';
import { useActiveAcademy } from '@/features/academies/hooks/useAcademies';
import { useBatches } from '@/features/batches/hooks/useBatches';
import { useUiStore } from '@/stores';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

const schema = z
  .object({
    title: z.string().min(1, 'Title is required').max(100),
    message: z.string().min(1, 'Message is required').max(1000),
    audience: z.enum(['all', 'coaches', 'players', 'batch', 'all_parents']),
    batch_id: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.audience === 'batch' && !data.batch_id) {
        return false;
      }
      return true;
    },
    {
      message: 'Batch is required when audience is batch',
      path: ['batch_id'],
    },
  );

type FormValues = z.infer<typeof schema>;

export function CreateAnnouncementPage() {
  const navigate = useNavigate();
  const { academyId, membership } = useActiveAcademy();
  const createAnnouncement = useCreateAnnouncement();
  const { data: batches = [] } = useBatches(academyId || null);
  const pushToast = useUiStore((s) => s.pushToast);

  const isOwner = membership?.role === 'academy_owner' || membership?.role === 'super_admin';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      message: '',
      audience: isOwner ? 'all' : 'batch',
      batch_id: null,
    },
  });

  // Set default audience to batch if the user is a coach
  useEffect(() => {
    if (membership && membership.role !== 'academy_owner' && membership.role !== 'super_admin') {
      setValue('audience', 'batch');
    }
  }, [membership, setValue]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const audience = watch('audience');

  const filteredBatches = isOwner ? batches : batches.filter((b) => b.coachId === membership?.id);

  const onSubmit = async (data: FormValues) => {
    if (!academyId) return;

    try {
      const announcement = await createAnnouncement.mutateAsync({
        academy_id: academyId,
        title: data.title,
        message: data.message,
        audience: data.audience,
        batch_id: data.batch_id,
      });

      pushToast({ title: 'Announcement sent successfully', variant: 'success' });

      // Trigger push notifications in the background (non-blocking)
      void supabase.functions
        .invoke('send-push-notification', { body: { announcement_id: announcement.id } })
        .then(({ error }) => {
          if (error) logger.warn('push_dispatch_failed', { error: String(error) });
        });

      navigate('/announcements');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send announcement';
      pushToast({ title: message, variant: 'error' });
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 md:pb-8">
      <div className="md:hidden">
        <MobilePageHeader
          title="New Announcement"
          subtitle="Broadcast to academy members"
          showBack={true}
        />
      </div>

      <div className="hidden md:flex md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="text-fg-muted hover:text-fg flex items-center gap-1 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
          <h1 className="text-fg flex items-center gap-2.5 text-2xl font-black tracking-tight">
            <Megaphone className="text-primary h-6 w-6" />
            Create Announcement
          </h1>
          <p className="text-fg-muted mt-1 text-sm font-medium">
            Broadcast updates, notices, and match schedules to members.
          </p>
        </div>
      </div>

      <Card className="border-border-subtle bg-surface rounded-2xl border p-5 sm:p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-4">
            <div>
              <label className="text-fg mb-1.5 block text-xs font-bold tracking-wider uppercase">
                Title
              </label>
              <Input
                {...register('title')}
                placeholder="E.g. Ground maintenance & training rescheduled"
                disabled={isSubmitting}
                className={errors.title ? 'border-danger' : ''}
              />
              {errors.title && (
                <p className="text-danger mt-1 text-xs font-medium">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="text-fg mb-1.5 block text-xs font-bold tracking-wider uppercase">
                Target Audience
              </label>
              <Select
                {...register('audience')}
                disabled={isSubmitting}
                onChange={(e) => {
                  setValue(
                    'audience',
                    e.target.value as 'all' | 'coaches' | 'players' | 'batch' | 'all_parents',
                  );
                  if (e.target.value !== 'batch') {
                    setValue('batch_id', null);
                  }
                }}
              >
                {isOwner && <option value="all">Entire Academy (All Members)</option>}
                {isOwner && <option value="coaches">All Coaches</option>}
                {isOwner && <option value="players">All Players</option>}
                {isOwner && <option value="all_parents">All Parents</option>}
                <option value="batch">Specific Batch</option>
              </Select>
            </div>

            {audience === 'batch' && (
              <div>
                <label className="text-fg mb-1.5 block text-xs font-bold tracking-wider uppercase">
                  Select Batch
                </label>
                <Select
                  {...register('batch_id')}
                  disabled={isSubmitting}
                  className={errors.batch_id ? 'border-danger' : ''}
                >
                  <option value="">Choose a squad/batch...</option>
                  {filteredBatches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.name}
                    </option>
                  ))}
                </Select>
                {errors.batch_id && (
                  <p className="text-danger mt-1 text-xs font-medium">{errors.batch_id.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="text-fg mb-1.5 block text-xs font-bold tracking-wider uppercase">
                Message Content
              </label>
              <Textarea
                {...register('message')}
                placeholder="Write your announcement details here..."
                disabled={isSubmitting}
                className={`min-h-[160px] resize-y ${errors.message ? 'border-danger' : ''}`}
              />
              {errors.message && (
                <p className="text-danger mt-1 text-xs font-medium">{errors.message.message}</p>
              )}
            </div>
          </div>

          <div className="border-border-subtle flex items-center justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 font-bold text-black"
            >
              {isSubmitting ? (
                'Broadcasting...'
              ) : (
                <>
                  <Send className="mr-1.5 h-4 w-4" />
                  Send Announcement
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
