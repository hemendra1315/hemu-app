import { useState, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Copy, RefreshCw, Check, Upload, Trash2, Building2, AlertCircle } from 'lucide-react';

import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  Select,
} from '@/components/ui';
import { FormField } from '@/components/form';
import { MobilePageHeader } from '@/components/mobile';
import { errorMessage } from '@/lib/api';
import { useUiStore } from '@/stores';
import type { UUID } from '@/types';
import {
  useAcademy,
  useActiveAcademy,
  useJoinCode,
  useRegenerateJoinCode,
  useUpdateAcademy,
} from '../hooks/useAcademies';
import { uploadAcademyLogo, removeAcademyLogo } from '../api/academiesApi';

interface FormValues {
  name: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  timezone: string;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export default function AcademySettingsPage() {
  const { academyId, membership } = useActiveAcademy();
  const pushToast = useUiStore((s) => s.pushToast);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const academyQuery = useAcademy(academyId);
  const updateAcademy = useUpdateAcademy(academyId as UUID);
  const joinCodeQuery = useJoinCode(academyId);
  const regenerateJoinCode = useRegenerateJoinCode(academyId as UUID);

  const academy = academyQuery.data;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      city: '',
      contactEmail: '',
      contactPhone: '',
      timezone: 'UTC',
    },
  });

  const watchedName = useWatch({ control, name: 'name', defaultValue: '' });

  useEffect(() => {
    if (academy) {
      reset({
        name: academy.name ?? '',
        city: academy.city ?? '',
        contactEmail: academy.contactEmail ?? '',
        contactPhone: academy.contactPhone ?? '',
        timezone: academy.timezone ?? 'UTC',
      });
    }
  }, [academy, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!academyId) return;
    try {
      await updateAcademy.mutateAsync({
        name: values.name.trim(),
        city: values.city.trim() || null,
        contactEmail: values.contactEmail.trim() || null,
        contactPhone: values.contactPhone.trim() || null,
        timezone: values.timezone,
      });
      pushToast({ title: 'Academy settings saved', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Failed to save academy settings',
        description: errorMessage(err),
        variant: 'error',
      });
    }
  });

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !academyId) return;

    // Reset input value so re-selecting same file triggers onChange
    e.target.value = '';
    setLogoError(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setLogoError('Invalid format. Please select a JPG, PNG, or WebP image.');
      return;
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setLogoError('File too large. Maximum allowed logo size is 5 MB.');
      return;
    }

    setIsUploadingLogo(true);
    try {
      await uploadAcademyLogo(academyId as UUID, file);
      await updateAcademy.mutateAsync({});
      pushToast({ title: 'Academy logo updated', variant: 'success' });
    } catch (err) {
      const msg = errorMessage(err);
      setLogoError(msg);
      pushToast({
        title: 'Failed to upload academy logo',
        description: msg,
        variant: 'error',
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!academyId) return;
    setLogoError(null);
    setIsRemovingLogo(true);
    try {
      await removeAcademyLogo(academyId as UUID, academy?.logoUrl);
      await updateAcademy.mutateAsync({});
      pushToast({ title: 'Academy logo removed', variant: 'success' });
    } catch (err) {
      const msg = errorMessage(err);
      setLogoError(msg);
      pushToast({
        title: 'Failed to remove academy logo',
        description: msg,
        variant: 'error',
      });
    } finally {
      setIsRemovingLogo(false);
    }
  };

  const handleCopyCode = async () => {
    if (!joinCodeQuery.data) return;
    try {
      await navigator.clipboard.writeText(joinCodeQuery.data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      pushToast({ title: 'Join code copied to clipboard', variant: 'success' });
    } catch {
      pushToast({ title: 'Failed to copy join code', variant: 'error' });
    }
  };

  const handleRegenerateCode = async () => {
    try {
      await regenerateJoinCode.mutateAsync();
      pushToast({ title: 'New join code generated', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Failed to regenerate join code',
        description: errorMessage(err),
        variant: 'error',
      });
    }
  };

  if (!academyId) return null;

  const currentDisplayName = watchedName.trim() || academy?.name || 'Academy';
  const currentLogoUrl = academy?.logoUrl;

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="md:hidden">
        <MobilePageHeader
          title="Academy Settings"
          subtitle={membership?.academyName ?? 'Manage Academy'}
        />
      </div>

      <div className="hidden md:block">
        <h1 className="text-fg text-2xl font-bold tracking-tight">Academy Settings</h1>
        <p className="text-fg-muted mt-1 text-sm">
          Update your academy branding, profile details, and student join codes.
        </p>
      </div>

      {/* 1. ACADEMY BRANDING & LOGO */}
      <Card>
        <CardHeader
          title="Academy Branding"
          description="Your academy's identity, visible to coaches, players, and platform administrators."
        />
        <CardBody className="space-y-6">
          {/* Logo & Live Preview Box */}
          <div className="border-border-subtle bg-surface-elevated/60 flex flex-col gap-5 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="relative flex shrink-0 items-center justify-center">
              <Avatar
                name={currentDisplayName}
                src={currentLogoUrl}
                shape="rounded"
                className="h-20 w-20 text-2xl shadow-sm sm:h-24 sm:w-24 sm:text-3xl"
              />
              {isUploadingLogo && (
                <div className="bg-bg/70 absolute inset-0 flex items-center justify-center rounded-xl backdrop-blur-xs">
                  <RefreshCw className="text-primary h-6 w-6 animate-spin" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="text-primary h-4 w-4 shrink-0" />
                <h3 className="text-fg truncate text-lg font-bold tracking-tight">
                  {currentDisplayName}
                </h3>
              </div>
              <p className="text-fg-muted text-xs">
                {academy?.city ? `${academy.city} • ` : ''}Branding active across CAM mobile & web
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoFileChange}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  aria-label="Upload Academy Logo"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-[40px] gap-2 font-medium"
                  isLoading={isUploadingLogo}
                  disabled={isUploadingLogo || isRemovingLogo}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  <span>{currentLogoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                </Button>

                {currentLogoUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger/10 min-h-[40px] gap-1.5"
                    isLoading={isRemovingLogo}
                    disabled={isUploadingLogo || isRemovingLogo}
                    onClick={handleRemoveLogo}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Remove Logo</span>
                  </Button>
                ) : null}
              </div>

              <p className="text-fg-muted text-[11px]">
                Accepts JPG, PNG, or WebP up to 5 MB. Recommended square format (min 256×256px).
              </p>
            </div>
          </div>

          {logoError && (
            <div className="border-danger/30 bg-danger/10 text-danger flex items-center gap-2 rounded-xl border p-3 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{logoError}</span>
            </div>
          )}
        </CardBody>
      </Card>

      {/* 2. GENERAL INFORMATION FORM */}
      <Card>
        <form onSubmit={onSubmit} noValidate>
          <CardHeader
            title="General Information"
            description="Academy name, location, and official contact information."
          />
          <CardBody className="space-y-4">
            <FormField label="Academy Name" required error={errors.name?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...register('name', { required: 'Academy name is required' })}
                  hasError={Boolean(errors.name)}
                />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="City / Location" error={errors.city?.message}>
                {(field) => (
                  <Input {...field} {...register('city')} placeholder="e.g. Mumbai, London" />
                )}
              </FormField>

              <FormField label="Timezone">
                {(field) => (
                  <Select {...field} {...register('timezone')}>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                  </Select>
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Contact Email" error={errors.contactEmail?.message}>
                {(field) => (
                  <Input
                    {...field}
                    {...register('contactEmail')}
                    type="email"
                    placeholder="info@academy.com"
                  />
                )}
              </FormField>

              <FormField label="Contact Phone" error={errors.contactPhone?.message}>
                {(field) => (
                  <Input
                    {...field}
                    {...register('contactPhone')}
                    type="tel"
                    placeholder="+91 9876543210"
                  />
                )}
              </FormField>
            </div>
          </CardBody>
          <CardFooter>
            <Button
              type="submit"
              isLoading={updateAcademy.isPending}
              disabled={!isDirty || updateAcademy.isPending}
              className="min-h-[44px]"
            >
              Save changes
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* 3. STUDENT JOIN CODE */}
      <Card>
        <CardHeader
          title="Student Join Code"
          description="Share this code with players to let them request joining your academy."
        />
        <CardBody className="space-y-4">
          <div className="border-border-subtle bg-surface-elevated flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
            <div>
              <p className="text-fg-muted text-xs font-semibold tracking-wider uppercase">
                Active Code
              </p>
              <p className="text-primary mt-1 font-mono text-2xl font-bold tracking-widest">
                {joinCodeQuery.isLoading ? '...' : (joinCodeQuery.data ?? 'N/A')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="min-h-[40px]"
                onClick={() => void handleCopyCode()}
                disabled={!joinCodeQuery.data}
              >
                {copied ? <Check className="text-success h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[40px]"
                onClick={() => void handleRegenerateCode()}
                isLoading={regenerateJoinCode.isPending}
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Regenerate</span>
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
