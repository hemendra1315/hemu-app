import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, CheckCircle2, User } from 'lucide-react';

import { Avatar, Button, Card, CardBody, Input } from '@/components/ui';
import { useAuth, updateMyProfile, uploadAvatar, removeAvatar } from '@/features/auth';
import { isProfileComplete } from '@/features/auth/utils/profileCompletion';
import { pickImageFile } from '@/lib/media';
import { errorMessage as errorMessageText } from '@/lib/api/errors';
import { useAuthStore, useUiStore } from '@/stores';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ProfileOnboardingPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);
  const setProfile = useAuthStore((s) => s.setProfile);

  // Auto-redirect if profile is already complete
  useEffect(() => {
    if (profile && isProfileComplete(profile)) {
      navigate('/', { replace: true });
    }
  }, [profile, navigate]);

  // Form State
  const initialGoogleName =
    user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? profile?.fullName ?? '';
  const initialGoogleAvatar =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? profile?.avatarUrl ?? '';

  const [fullName, setFullName] = useState(initialGoogleName);
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialGoogleAvatar);
  const [previewUrl, setPreviewUrl] = useState(initialGoogleAvatar);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Max DOB is today, min DOB is 100 years ago
  const todayStr = new Date().toISOString().split('T')[0];

  // File picker handler
  const handlePickPhoto = async () => {
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

      if (!fileType || !ALLOWED_IMAGE_TYPES.includes(fileType)) {
        setAvatarError('Please select a valid image file (JPEG, PNG, or WebP).');
        return;
      }

      if (file.size > MAX_AVATAR_SIZE) {
        setAvatarError('Image size must be less than 5MB.');
        return;
      }

      setAvatarFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    } catch (err: unknown) {
      const e = err as Error;
      if (e?.message === 'Picker cancelled') {
        return;
      }
      console.error('[AVATAR] Photo pick failed:', e);
      setAvatarError(e?.message || 'Failed to select photo');
    }
  };

  // Remove photo handler
  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setPreviewUrl('');
    setAvatarUrl('');
    setAvatarError(null);
  };

  // Submit Profile details directly without phone asking
  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setAvatarError(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }

    if (dateOfBirth && new Date(dateOfBirth) > new Date()) {
      setErrorMessage('Date of birth cannot be in the future.');
      return;
    }

    // Upload avatar if a new file was chosen
    let finalAvatarUrl = avatarUrl;
    if (avatarFile && user?.id) {
      setIsUploadingAvatar(true);
      try {
        const uploadedUrl = await uploadAvatar(user.id, avatarFile);
        finalAvatarUrl = uploadedUrl;
        setAvatarUrl(uploadedUrl);
        setAvatarFile(null);
      } catch (err) {
        console.error('[PFP] error during upload:', err);
        setIsUploadingAvatar(false);
        setAvatarError('Failed to upload profile picture. Please try again or remove it.');
        return;
      } finally {
        setIsUploadingAvatar(false);
      }
    }

    if (!user?.id) {
      setErrorMessage('User session expired. Please sign in again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedProfile = await updateMyProfile(user.id, {
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth || null,
        avatarUrl: finalAvatarUrl.trim() || null,
      });

      if (profile?.avatarUrl && profile.avatarUrl !== updatedProfile.avatarUrl) {
        removeAvatar(user.id, profile.avatarUrl).catch(() => {});
      }

      setProfile(updatedProfile);

      pushToast({
        title: 'Profile set up!',
        description: 'Welcome to Cricket Academy Manager.',
        variant: 'success',
      });

      const pendingInviteToken = sessionStorage.getItem('pending_owner_invite_token');
      if (pendingInviteToken) {
        navigate(`/academy/invite/${pendingInviteToken}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      console.error('[PFP] profile update result: Failed', err);
      setErrorMessage(errorMessageText(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center p-3 sm:p-6">
      <Card className="border-border-subtle w-full max-w-lg shadow-md">
        <CardBody className="p-6 sm:p-8">
          <form onSubmit={handleSubmitProfile} className="space-y-6">
            <div className="space-y-1.5 text-center">
              <div className="bg-primary/10 text-primary mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
                <User className="h-6 w-6" />
              </div>
              <h1 className="text-fg text-2xl font-bold tracking-tight">Set Up Profile</h1>
              <p className="text-fg-muted text-sm">Quick setup to get started.</p>
            </div>

            {/* PROFILE PICTURE (OPTIONAL) */}
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="relative">
                <Avatar
                  name={fullName || user?.email || 'User'}
                  src={previewUrl || undefined}
                  size="lg"
                  className="ring-primary/20 h-24 w-24 ring-4 transition"
                />
                {isUploadingAvatar ? (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-xs">
                    <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-2 text-center">
                <label className="text-fg-muted text-xs font-semibold uppercase">
                  Photo (Optional)
                </label>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handlePickPhoto}
                      disabled={isUploadingAvatar || isSubmitting}
                      className="gap-1.5"
                    >
                      <Camera className="h-4 w-4" />
                      {previewUrl ? 'Change' : 'Upload Photo'}
                    </Button>

                    {previewUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveAvatar}
                        disabled={isUploadingAvatar || isSubmitting}
                        className="text-fg-muted hover:text-danger text-xs"
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>

                  {avatarError ? (
                    <p className="text-danger text-xs">{avatarError}</p>
                  ) : (
                    <p className="text-fg-muted text-[11px]">JPEG, PNG, or WebP (max 5MB)</p>
                  )}
                </div>
              </div>
            </div>

            {/* FULL NAME */}
            <div>
              <label
                htmlFor="fullName"
                className="text-fg-muted mb-1.5 block text-xs font-semibold uppercase"
              >
                Full Name <span className="text-danger">*</span>
              </label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full name"
                className="h-11 text-sm"
              />
            </div>

            {/* DATE OF BIRTH */}
            <div>
              <label
                htmlFor="dateOfBirth"
                className="text-fg-muted mb-1.5 block text-xs font-semibold uppercase"
              >
                Date of Birth{' '}
                <span className="text-fg-muted text-[10px] font-normal">(Optional)</span>
              </label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                min="1920-01-01"
                max={todayStr}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="h-11 text-sm"
              />
            </div>

            {errorMessage && (
              <div className="border-danger/30 bg-danger/10 text-danger rounded-xl border p-3 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting || isUploadingAvatar}
              disabled={isSubmitting || isUploadingAvatar}
              className="w-full font-bold shadow-2xs"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Continue
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
