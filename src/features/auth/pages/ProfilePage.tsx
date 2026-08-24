import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Upload, RefreshCw } from 'lucide-react';

import { FormField } from '@/components/form';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
} from '@/components/ui';
import { useMemberships, useActiveAcademy } from '@/features/academies';
import { useLinkedChildren } from '@/features/parents';
import { InstallAppButton, ShareAppButton } from '@/features/pwa';
import { errorMessage } from '@/lib/api';
import { profileFormSchema, type ProfileFormValues } from '@/lib/validators';
import { useUiStore } from '@/stores';
import { ROLE_LABELS } from '@/types/enums';

import { useAuth } from '../hooks/useAuth';
import { useUpdateProfile } from '../hooks/useProfile';
import { uploadAvatar, removeAvatar } from '../api/profileApi';
import { pickImageFile } from '@/lib/media';

function LinkedChildrenSection() {
  const { academyId } = useActiveAcademy();
  const { data: children = [], isLoading } = useLinkedChildren(academyId || undefined);

  if (!academyId) return null;

  return (
    <Card>
      <CardHeader
        title="Linked Children"
        description="Children linked to your account in this academy."
      />
      <CardBody className="space-y-2">
        {isLoading ? (
          <p className="text-fg-muted text-sm">Loading children...</p>
        ) : children.length === 0 ? (
          <p className="text-fg-muted text-sm">No children linked to your account yet.</p>
        ) : (
          children.map((child) => (
            <div
              key={child.player.id}
              className="border-border-subtle flex items-center gap-3 rounded-lg border p-3"
            >
              <Avatar name={child.player.fullName} src={child.player.avatarUrl} size="sm" />
              <div>
                <p className="text-fg text-sm font-medium">{child.player.fullName}</p>
                <p className="text-fg-muted text-xs">{child.player.batchName || 'No Batch'}</p>
              </div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

/** Lets a user complete their own profile and see where they are a member. */
export default function ProfilePage() {
  const { user, profile } = useAuth();
  const { all } = useMemberships();
  const updateProfile = useUpdateProfile();
  const pushToast = useUiStore((state) => state.pushToast);

  const isParent = all.some((m) => m.role === 'parent');

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: profile?.fullName ?? '',
      phone: profile?.phone ?? '',
      dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
    },
  });

  const onSubmit = handleSubmit(async (formValues) => {
    await updateProfile.mutateAsync({
      fullName: formValues.fullName,
      phone: formValues.phone || null,
      dateOfBirth: formValues.dateOfBirth || null,
    });
    pushToast({ title: 'Profile saved', variant: 'success' });
  });

  const handleRemovePhoto = async () => {
    if (!user?.id || !profile?.avatarUrl) return;

    try {
      const oldUrl = profile.avatarUrl;
      // Optimistically update DB
      await updateProfile.mutateAsync({ avatarUrl: null });
      pushToast({ title: 'Profile picture removed', variant: 'success' });

      // Non-blocking cleanup of actual storage
      removeAvatar(user.id, oldUrl).catch((err: unknown) => {
        console.warn('[AVATAR_DEBUG] Silent cleanup failure:', err);
      });
    } catch (err: unknown) {
      const e = err as Error;
      setAvatarError(e?.message || 'Failed to remove photo');
    }
  };

  const handlePickPhoto = async () => {
    if (!user?.id) return;

    try {
      setAvatarError(null);

      const file = await pickImageFile();

      let fileType = file.type;
      const fileName = file.name || '';
      if (!fileType && fileName) {
        if (fileName.match(/\.(jpg|jpeg)$/i)) fileType = 'image/jpeg';
        else if (fileName.match(/\.png$/i)) fileType = 'image/png';
        else if (fileName.match(/\.webp$/i)) fileType = 'image/webp';
      }

      if (!['image/jpeg', 'image/png', 'image/webp'].includes(fileType)) {
        setAvatarError('Invalid format. Please select a JPG, PNG, or WebP image.');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setAvatarError('File too large. Maximum allowed size is 5 MB.');
        return;
      }

      setIsUploadingAvatar(true);

      const newUrl = await uploadAvatar(user.id, file);

      const oldUrl = profile?.avatarUrl;

      await updateProfile.mutateAsync({ avatarUrl: newUrl });
      pushToast({ title: 'Profile picture updated', variant: 'success' });

      // Non-blocking cleanup
      if (oldUrl && oldUrl !== newUrl) {
        removeAvatar(user.id, oldUrl).catch((err: unknown) => {
          console.warn('[AVATAR_DEBUG] Silent cleanup failure:', err);
        });
      }
    } catch (err: unknown) {
      const e = err as Error;
      if (e?.message === 'Picker cancelled') {
        return;
      }
      console.error('[AVATAR] Upload failed:', e);
      setAvatarError(e?.message || 'Upload failed');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-fg text-xl font-semibold">My profile</h1>

      <Card>
        <CardHeader
          title="Personal details"
          description="Google provides your name and photo; you can correct them here."
        />
        <form onSubmit={onSubmit} noValidate>
          <CardBody className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex shrink-0 items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (!isUploadingAvatar) {
                      handlePickPhoto();
                    }
                  }}
                  className={`focus-visible:ring-primary relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${!isUploadingAvatar ? 'cursor-pointer transition-opacity hover:opacity-80' : ''}`}
                  disabled={isUploadingAvatar}
                  aria-label="Change profile picture"
                >
                  <Avatar
                    name={profile?.fullName ?? profile?.email}
                    src={profile?.avatarUrl}
                    size="lg"
                    className="h-20 w-20 text-2xl shadow-sm sm:h-24 sm:w-24 sm:text-3xl"
                  />
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-xs">
                      <RefreshCw className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                </button>
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="text-fg text-sm font-medium">{profile?.email}</p>
                <p className="text-fg-muted text-xs">Signed in with Google</p>
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-2 font-medium"
                    isLoading={isUploadingAvatar}
                    disabled={isUploadingAvatar}
                    onClick={handlePickPhoto}
                  >
                    <Upload className="h-4 w-4" />
                    <span>{profile?.avatarUrl ? 'Change photo' : 'Upload photo'}</span>
                  </Button>

                  {profile?.avatarUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-danger hover:text-danger-hover gap-2 font-medium"
                      disabled={isUploadingAvatar}
                      onClick={handleRemovePhoto}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                {avatarError && (
                  <p className="text-danger mt-1 text-xs font-medium">{avatarError}</p>
                )}
              </div>
            </div>

            <FormField label="Full name" required error={errors.fullName?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...register('fullName')}
                  autoComplete="name"
                  hasError={Boolean(errors.fullName)}
                />
              )}
            </FormField>

            <FormField
              label="Mobile number"
              hint="Used for academy communication."
              error={errors.phone?.message}
            >
              {(field) => (
                <Input
                  {...field}
                  {...register('phone')}
                  inputMode="tel"
                  placeholder="9876543210"
                  autoComplete="tel"
                  hasError={Boolean(errors.phone)}
                />
              )}
            </FormField>

            <FormField label="Date of birth" error={errors.dateOfBirth?.message}>
              {(field) => <Input {...field} {...register('dateOfBirth')} type="date" />}
            </FormField>

            {updateProfile.isError ? (
              <p role="alert" className="text-danger text-sm">
                {errorMessage(updateProfile.error)}
              </p>
            ) : null}
          </CardBody>

          <CardFooter>
            <Button type="submit" isLoading={updateProfile.isPending} disabled={!isDirty}>
              Save changes
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader title="My academies" description="Every academy you belong to." />
        <CardBody className="space-y-2">
          {all.map((membership) => (
            <div
              key={membership.id}
              className="border-border-subtle flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p className="text-fg text-sm font-medium">{membership.academyName}</p>
                <p className="text-fg-muted text-xs">{ROLE_LABELS[membership.role]}</p>
              </div>
              <Badge tone={membership.status === 'active' ? 'success' : 'warning'}>
                {membership.status}
              </Badge>
            </div>
          ))}
        </CardBody>
      </Card>

      {isParent && <LinkedChildrenSection />}

      <Card>
        <CardHeader
          title="App"
          description="Install Cricket Academy Manager on this device or share it with someone."
        />
        <CardBody className="flex flex-wrap items-center gap-3">
          <InstallAppButton />
          <ShareAppButton />
        </CardBody>
      </Card>
    </div>
  );
}
