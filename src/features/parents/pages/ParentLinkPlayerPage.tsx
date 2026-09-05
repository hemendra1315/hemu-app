import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link2 } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { useRedeemLinkingCode } from '../hooks/useParents';
import { useUiStore } from '@/stores';
import { errorMessage } from '@/lib/api';

/**
 * Codes are always 8 characters — `generate_parent_linking_code` emits 8 and
 * the table enforces `length(code) = 8`. Accepting 6 here meant a mistyped
 * code passed the form and came back from the server as the same generic
 * "invalid or expired" as a genuinely dead one.
 */
const schema = z.object({
  code: z.string().trim().toUpperCase().length(8, 'Linking codes are 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function ParentLinkPlayerPage() {
  const navigate = useNavigate();
  const redeemCode = useRedeemLinkingCode();
  const queryClient = useQueryClient();
  const pushToast = useUiStore((s) => s.pushToast);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await redeemCode.mutateAsync(data.code);
      // Wait for the refreshed identity to land before navigating. Redeeming
      // is what creates the membership, and `RequireAcademy` reads memberships
      // — navigating while the refetch is still in flight bounces a first-time
      // parent straight back to onboarding, one screen after being told it
      // worked.
      await queryClient.refetchQueries({ queryKey: ['identity'] });
      pushToast({ title: 'Child linked successfully!', variant: 'success' });
      navigate('/parent/dashboard');
    } catch (error: unknown) {
      // A PostgREST error is a plain object, not an Error, so the previous
      // `instanceof Error` check reported every failure — network down, RPC
      // not granted, expired code — as "invalid or expired".
      const message = errorMessage(error) || 'Invalid or expired linking code';
      pushToast({ title: message, variant: 'error' });
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Link a Child</h1>
        <p className="text-fg-muted mt-1 text-sm">
          Enter the secure linking code provided by your child's coach.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="text-fg mb-1.5 block text-sm font-medium">Linking Code</label>
            <Input
              {...register('code')}
              placeholder="8-character code"
              disabled={isSubmitting}
              className={`uppercase ${errors.code ? 'border-danger' : ''}`}
            />
            {errors.code && <p className="text-danger mt-1 text-sm">{errors.code.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              'Linking...'
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                Link Child Profile
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
