import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import { FormField } from '@/components/form';
import { Button, Card, CardBody, CardFooter, CardHeader, Input, Select } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { useCreateAcademy } from '@/features/academies';
import { errorMessage } from '@/lib/api';
import { createAcademyFormSchema, type CreateAcademyFormValues } from '@/lib/validators';
import { useUiStore } from '@/stores';
import { FEE_MODES, FEE_MODE_LABELS } from '@/types/enums';

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Colombo', 'UTC'];

/** Creates the academy and makes the signed-in user its owner. (Restricted to Super Admin) */
export default function CreateAcademyPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const createAcademy = useCreateAcademy();
  const pushToast = useUiStore((state) => state.pushToast);

  // Restrict to platform super admins
  useEffect(() => {
    if (profile && !profile.isSuperAdmin) {
      navigate('/onboarding', { replace: true });
    }
  }, [profile, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAcademyFormValues>({
    resolver: zodResolver(createAcademyFormSchema),
    defaultValues: { name: '', city: '', timezone: 'Asia/Kolkata', feeMode: 'player_pays' },
  });

  const onSubmit = handleSubmit(async (values) => {
    const academy = await createAcademy.mutateAsync({
      name: values.name,
      city: values.city || undefined,
      timezone: values.timezone,
      feeMode: values.feeMode,
    });
    pushToast({ title: `${academy.name} is ready`, variant: 'success' });
    void navigate('/dashboard', { replace: true });
  });

  return (
    <Card>
      <CardHeader
        title="Create your academy"
        description="You become the owner. Coaches and players join later with a code."
      />
      <form onSubmit={onSubmit} noValidate>
        <CardBody className="space-y-4">
          <FormField label="Academy name" required error={errors.name?.message}>
            {(field) => (
              <Input
                {...field}
                {...register('name')}
                placeholder="Chennai Super Academy"
                autoComplete="organization"
                hasError={Boolean(errors.name)}
              />
            )}
          </FormField>

          <FormField label="City" error={errors.city?.message}>
            {(field) => (
              <Input
                {...field}
                {...register('city')}
                placeholder="Chennai"
                autoComplete="address-level2"
              />
            )}
          </FormField>

          <FormField
            label="Timezone"
            hint="Session times are shown in this timezone."
            error={errors.timezone?.message}
          >
            {(field) => (
              <Select {...field} {...register('timezone')}>
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField
            label="Who pays the monthly fee?"
            hint="You can change this later in academy settings."
            error={errors.feeMode?.message}
          >
            {(field) => (
              <Select {...field} {...register('feeMode')}>
                {FEE_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {FEE_MODE_LABELS[mode]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          {createAcademy.isError ? (
            <p role="alert" className="text-danger text-sm">
              {errorMessage(createAcademy.error)}
            </p>
          ) : null}
        </CardBody>

        <CardFooter>
          <Link to="/onboarding" className="text-fg-muted mr-auto text-sm hover:underline">
            Back
          </Link>
          <Button type="submit" isLoading={createAcademy.isPending}>
            Create academy
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
