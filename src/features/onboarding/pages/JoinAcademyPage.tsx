import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import { FormField } from '@/components/form';
import { Button, Card, CardBody, CardFooter, CardHeader, Input, Textarea } from '@/components/ui';
import { useJoinAcademy } from '@/features/academies';
import { errorMessage } from '@/lib/api';
import { joinAcademyFormSchema, type JoinAcademyFormValues } from '@/lib/validators';

/**
 * Redeems an academy join code. Approval is the owner's call, so this creates a
 * pending request and sends the user to the waiting screen.
 */
export default function JoinAcademyPage() {
  const navigate = useNavigate();
  const joinAcademy = useJoinAcademy();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinAcademyFormValues>({
    resolver: zodResolver(joinAcademyFormSchema),
    defaultValues: { code: '', message: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    await joinAcademy.mutateAsync({ code: values.code, message: values.message || undefined });
    void navigate('/onboarding/pending', { replace: true });
  });

  return (
    <Card>
      <CardHeader
        title="Join an academy"
        description="Enter the 6-character code your academy shared with you."
      />
      <form onSubmit={onSubmit} noValidate>
        <CardBody className="space-y-4">
          <FormField label="Join code" required error={errors.code?.message}>
            {(field) => (
              <Input
                {...field}
                {...register('code')}
                placeholder="ABC123"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={8}
                className="text-lg tracking-[0.3em] uppercase"
                hasError={Boolean(errors.code)}
              />
            )}
          </FormField>

          <FormField
            label="Message to the academy"
            hint="Optional — tell them who you are."
            error={errors.message?.message}
          >
            {(field) => (
              <Textarea
                {...field}
                {...register('message')}
                rows={3}
                placeholder="Hi, I'm Arjun, an under-16 batter."
              />
            )}
          </FormField>

          {joinAcademy.isError ? (
            <p role="alert" className="text-danger text-sm">
              {errorMessage(joinAcademy.error)}
            </p>
          ) : null}
        </CardBody>

        <CardFooter>
          <Link to="/onboarding" className="text-fg-muted mr-auto text-sm hover:underline">
            Back
          </Link>
          <Button type="submit" isLoading={joinAcademy.isPending}>
            Request to join
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
