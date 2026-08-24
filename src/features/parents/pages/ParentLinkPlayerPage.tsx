import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link2 } from 'lucide-react';
import { Button, Card, Input } from '@/components/ui';
import { useRedeemLinkingCode } from '../hooks/useParents';
import { useUiStore } from '@/stores';

const schema = z.object({
  code: z.string().min(6, 'Linking code must be at least 6 characters').toUpperCase(),
});

type FormValues = z.infer<typeof schema>;

export default function ParentLinkPlayerPage() {
  const navigate = useNavigate();
  const redeemCode = useRedeemLinkingCode();
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
      pushToast({ title: 'Child linked successfully!', variant: 'success' });
      navigate('/parent/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid or expired linking code';
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
              placeholder="e.g. A1B2C3"
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
