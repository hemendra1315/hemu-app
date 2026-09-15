import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProfileOnboardingPage from '@/features/onboarding/pages/ProfileOnboardingPage';
import * as authFeature from '@/features/auth';
import { isProfileComplete, getMissingProfileFields } from '../utils/profileCompletion';
import { useAuthStore, useTestModeStore, useAcademyStore } from '@/stores';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query/queryClient';
import { act } from '@testing-library/react';
import * as mediaModule from '@/lib/media';
import type { Profile } from '@/types';

describe('Profile Onboarding — Direct Google / Name Setup (No Phone Required)', () => {
  const queryWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: createQueryClient() }, children);

  beforeEach(() => {
    act(() => {
      useTestModeStore.getState().exitTestMode();
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        user: {
          id: 'user-google-uuid-52',
          email: 'googleuser@cricket.app',
          app_metadata: {},
          user_metadata: {
            full_name: 'Rahul Google User',
            avatar_url: 'https://lh3.googleusercontent.com/a/mock-photo',
          },
          aud: 'authenticated',
          created_at: '2026-01-01T00:00:00Z',
        },
        profile: {
          id: 'user-google-uuid-52',
          email: 'googleuser@cricket.app',
          fullName: 'Rahul Google User',
          phone: null,
          phoneVerified: false,
          avatarUrl: 'https://lh3.googleusercontent.com/a/mock-photo',
          dateOfBirth: null,
          locale: 'en',
          timezone: 'Asia/Kolkata',
          isSuperAdmin: false,
        },
        memberships: [],
        joinRequests: [],
      });
      useAcademyStore.getState().setActiveAcademy(null);
    });
  });

  describe('Profile Completion Utility Tests', () => {
    it('returns false for null profile and identifies fullName as missing', () => {
      expect(isProfileComplete(null)).toBe(false);
      const missing = getMissingProfileFields(null);
      expect(missing).toContain('fullName');
    });

    it('returns true when user has fullName or email', () => {
      const profileWithName: Profile = {
        id: 'p-1',
        email: 'test@cricket.app',
        fullName: 'Rahul Test',
        phone: null,
        phoneVerified: false,
        avatarUrl: null,
        dateOfBirth: null,
        locale: 'en',
        timezone: 'Asia/Kolkata',
        isSuperAdmin: false,
      };

      expect(isProfileComplete(profileWithName)).toBe(true);
      expect(getMissingProfileFields(profileWithName)).toHaveLength(0);
    });
  });

  describe('Profile Setup UI Tests', () => {
    it('renders Complete Your Profile form with Google account name pre-filled', () => {
      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      expect(screen.getByRole('heading', { name: /set up profile/i })).toBeInTheDocument();

      const nameInput = screen.getByPlaceholderText(/enter full name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('Rahul Google User');
    });

    it('validates required full name before saving', async () => {
      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      const nameInput = screen.getByPlaceholderText(/enter full name/i);
      fireEvent.change(nameInput, { target: { value: '' } });

      const submitButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(submitButton);

      expect(await screen.findByText(/please enter your full name/i)).toBeInTheDocument();
    });

    it('submits valid profile directly without asking for phone or OTP', async () => {
      const updateProfileSpy = vi.spyOn(authFeature, 'updateMyProfile').mockResolvedValue({
        id: 'user-google-uuid-52',
        email: 'googleuser@cricket.app',
        fullName: 'Rahul Sharma',
        phone: null,
        phoneVerified: false,
        avatarUrl: 'https://lh3.googleusercontent.com/a/mock-photo',
        dateOfBirth: '2000-01-15',
        locale: 'en',
        timezone: 'Asia/Kolkata',
        isSuperAdmin: false,
      });

      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      const nameInput = screen.getByPlaceholderText(/enter full name/i);
      fireEvent.change(nameInput, { target: { value: 'Rahul Sharma' } });

      const dobInput = screen.getByLabelText(/date of birth/i);
      fireEvent.change(dobInput, { target: { value: '2000-01-15' } });

      const submitButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(updateProfileSpy).toHaveBeenCalledWith('user-google-uuid-52', {
          fullName: 'Rahul Sharma',
          dateOfBirth: '2000-01-15',
          avatarUrl: 'https://lh3.googleusercontent.com/a/mock-photo',
        });
      });

      updateProfileSpy.mockRestore();
    });
  });

  describe('Avatar Upload & Storage Integration Tests', () => {
    beforeEach(() => {
      if (!globalThis.URL.createObjectURL) {
        globalThis.URL.createObjectURL = vi.fn(
          (file: Blob | MediaSource) => `blob:mock/${(file as File).name || 'avatar'}`,
        );
      }
    });

    it('renders upload control and button instead of text URL input', () => {
      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      // Verify no plain text URL input exists
      expect(
        screen.queryByPlaceholderText(/image url or keep google photo/i),
      ).not.toBeInTheDocument();

      // Verify accessible upload button exists
      expect(screen.getByRole('button', { name: /change|upload photo/i })).toBeInTheDocument();
    });

    it('displays existing Google avatar initially when present', () => {
      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      const avatarImg = screen.getByAltText(/rahul google user/i) as HTMLImageElement;
      expect(avatarImg).toBeInTheDocument();
      expect(avatarImg.src).toContain('https://lh3.googleusercontent.com/a/mock-photo');
    });

    it('updates preview upon valid image selection', async () => {
      const createObjectURLSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:mock/new-avatar.png');

      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      const validFile = new File(['valid content'], 'new-avatar.png', { type: 'image/png' });
      vi.spyOn(mediaModule, 'pickImageFile').mockResolvedValue(validFile);
      fireEvent.click(screen.getByRole('button', { name: /change|upload photo/i }));

      await waitFor(() => {
        const avatarImg = screen.getByAltText(/rahul google user/i) as HTMLImageElement;
        expect(avatarImg.src).toBe('blob:mock/new-avatar.png');
      });
      expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();

      createObjectURLSpy.mockRestore();
    });

    it('rejects invalid file types with a clear validation error', async () => {
      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      const invalidFile = new File(['pdf data'], 'document.pdf', { type: 'application/pdf' });
      vi.spyOn(mediaModule, 'pickImageFile').mockResolvedValue(invalidFile);
      fireEvent.click(screen.getByRole('button', { name: /change|upload photo/i }));

      expect(
        await screen.findByText(/please select a valid image file \(jpeg, png, or webp\)/i),
      ).toBeInTheDocument();
    });

    it('rejects oversized files exceeding 5MB with a clear validation error', async () => {
      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      // Create a 6MB file
      const bigFile = new File(['x'], 'huge.jpg', { type: 'image/jpeg' });
      Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });
      vi.spyOn(mediaModule, 'pickImageFile').mockResolvedValue(bigFile);
      fireEvent.click(screen.getByRole('button', { name: /change|upload photo/i }));

      expect(await screen.findByText(/image size must be less than 5mb/i)).toBeInTheDocument();
    });

    it('allows user to remove avatar and resets preview', () => {
      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      const removeBtn = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(removeBtn);

      // When removed, avatar defaults to initials or fallback without img
      expect(screen.queryByAltText(/rahul google user/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upload photo/i })).toBeInTheDocument();
    });

    it('handles successful avatar upload, generates public URL, and updates profile avatar_url', async () => {
      const mockUploadedUrl =
        'https://storage.supabase.co/avatars/user-google-uuid-52/1720000000000.png';
      const uploadSpy = vi.spyOn(authFeature, 'uploadAvatar').mockResolvedValue(mockUploadedUrl);
      const updateProfileSpy = vi.spyOn(authFeature, 'updateMyProfile').mockResolvedValue({
        id: 'user-google-uuid-52',
        email: 'googleuser@cricket.app',
        fullName: 'Rahul Google User',
        phone: null,
        phoneVerified: false,
        avatarUrl: mockUploadedUrl,
        dateOfBirth: '2000-01-15',
        locale: 'en',
        timezone: 'Asia/Kolkata',
        isSuperAdmin: false,
      });

      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      const validFile = new File(['valid content'], 'profile.png', { type: 'image/png' });
      vi.spyOn(mediaModule, 'pickImageFile').mockResolvedValue(validFile);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /change|upload photo/i }));
      });

      const submitButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(uploadSpy).toHaveBeenCalledWith('user-google-uuid-52', validFile);
        expect(updateProfileSpy).toHaveBeenCalledWith('user-google-uuid-52', {
          fullName: 'Rahul Google User',
          dateOfBirth: null,
          avatarUrl: mockUploadedUrl,
        });
      });

      uploadSpy.mockRestore();
      updateProfileSpy.mockRestore();
    });

    it('handles upload failure gracefully by showing an actionable error', async () => {
      const uploadSpy = vi
        .spyOn(authFeature, 'uploadAvatar')
        .mockRejectedValue(new Error('Storage upload failed'));

      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      const validFile = new File(['valid content'], 'profile.png', { type: 'image/png' });
      vi.spyOn(mediaModule, 'pickImageFile').mockResolvedValue(validFile);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /change|upload photo/i }));
      });

      const submitButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(uploadSpy).toHaveBeenCalled();
        expect(
          screen.getByText(/failed to upload profile picture\. please try again or remove it\./i),
        ).toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { name: /set up profile/i })).toBeInTheDocument();

      uploadSpy.mockRestore();
    });
  });
});
