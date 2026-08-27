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
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  },
}));

describe('Phase 52 — Google Profile + Phone OTP Onboarding Verification', () => {
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
    it('returns false for incomplete profiles and correctly identifies missing fields', () => {
      const incompleteProfile: Profile = {
        id: 'p-1',
        email: 'test@cricket.app',
        fullName: 'Rahul Test',
        phone: null,
        avatarUrl: null,
        dateOfBirth: null,
        locale: 'en',
        timezone: 'Asia/Kolkata',
        isSuperAdmin: false,
      };

      expect(isProfileComplete(incompleteProfile)).toBe(false);
      const missing = getMissingProfileFields(incompleteProfile);
      expect(missing).toContain('dateOfBirth');
      expect(missing).toContain('phone');
    });

    it('returns true for complete profiles', () => {
      const completeProfile: Profile = {
        id: 'p-2',
        email: 'complete@cricket.app',
        fullName: 'Complete User',
        phone: '+919876543210',
        avatarUrl: 'https://example.com/photo.jpg',
        dateOfBirth: '1998-05-15',
        locale: 'en',
        timezone: 'Asia/Kolkata',
        isSuperAdmin: false,
      };

      expect(isProfileComplete(completeProfile)).toBe(true);
      expect(getMissingProfileFields(completeProfile)).toHaveLength(0);
    });
  });

  describe('Profile Setup & Phone Verification UI Tests', () => {
    it('renders Complete Your Profile form with Google account name pre-filled', () => {
      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      expect(screen.getByRole('heading', { name: /complete your profile/i })).toBeInTheDocument();

      const nameInput = screen.getByPlaceholderText(/enter your full name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('Rahul Google User');
    });

    it('validates required fields before proceeding to OTP verification', async () => {
      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      const nameInput = screen.getByPlaceholderText(/enter your full name/i);
      fireEvent.change(nameInput, { target: { value: '' } });

      const submitButton = screen.getByRole('button', { name: /continue to email verification/i });
      fireEvent.click(submitButton);

      expect(await screen.findByText(/please enter your full name/i)).toBeInTheDocument();
    });

    it('advances to OTP verification step when valid profile details are submitted', async () => {
      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      const dobInput = screen.getByLabelText(/date of birth/i);
      fireEvent.change(dobInput, { target: { value: '2000-01-15' } });

      const phoneInput = screen.getByPlaceholderText(/98765 43210/i);
      fireEvent.change(phoneInput, { target: { value: '9876543210' } });

      const submitButton = screen.getByRole('button', { name: /continue to email verification/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /verify your email/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/googleuser@cricket.app/i)).toBeInTheDocument();
    });

    it('allows user to return to edit phone number from OTP step', async () => {
      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      const dobInput = screen.getByLabelText(/date of birth/i);
      fireEvent.change(dobInput, { target: { value: '2000-01-15' } });

      const phoneInput = screen.getByPlaceholderText(/98765 43210/i);
      fireEvent.change(phoneInput, { target: { value: '9876543210' } });

      const submitButton = screen.getByRole('button', { name: /continue to email verification/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /verify your email/i })).toBeInTheDocument();
      });

      const changeEmailBtn = screen.getByRole('button', { name: /back to details/i });
      fireEvent.click(changeEmailBtn);

      expect(screen.getByRole('heading', { name: /complete your profile/i })).toBeInTheDocument();
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

      // Verify accessible upload button (fires the native/file picker via
      // pickImageFile) is the upload control — not a plain text URL input.
      expect(
        screen.getByRole('button', { name: /change photo|upload profile picture/i }),
      ).toBeInTheDocument();
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
      fireEvent.click(screen.getByRole('button', { name: /change photo|upload profile picture/i }));

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
      fireEvent.click(screen.getByRole('button', { name: /change photo|upload profile picture/i }));

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
      fireEvent.click(screen.getByRole('button', { name: /change photo|upload profile picture/i }));

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
      expect(screen.getByRole('button', { name: /upload profile picture/i })).toBeInTheDocument();
    });

    it('handles successful avatar upload, generates public URL, and updates profile avatar_url', async () => {
      const mockUploadedUrl =
        'https://storage.supabase.co/avatars/user-google-uuid-52/1720000000000.png';
      const uploadSpy = vi.spyOn(authFeature, 'uploadAvatar').mockResolvedValue(mockUploadedUrl);
      const updateProfileSpy = vi.spyOn(authFeature, 'updateMyProfile').mockResolvedValue({
        id: 'user-google-uuid-52',
        email: 'googleuser@cricket.app',
        fullName: 'Rahul Google User',
        phone: '+919876543210',
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
        fireEvent.click(
          screen.getByRole('button', { name: /change photo|upload profile picture/i }),
        );
      });

      const dobInput = screen.getByLabelText(/date of birth/i);
      fireEvent.change(dobInput, { target: { value: '2000-01-15' } });

      const phoneInput = screen.getByPlaceholderText(/98765 43210/i);
      fireEvent.change(phoneInput, { target: { value: '9876543210' } });

      const submitButton = screen.getByRole('button', { name: /continue to email verification/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(uploadSpy).toHaveBeenCalledWith('user-google-uuid-52', validFile);
        expect(screen.getByRole('heading', { name: /verify your email/i })).toBeInTheDocument();
      });

      // Enter OTP
      const otpInputs = screen.getAllByRole('textbox');
      ['1', '2', '3', '4', '5', '6'].forEach((digit, idx) => {
        fireEvent.change(otpInputs[idx]!, { target: { value: digit } });
      });

      const verifyBtn = screen.getByRole('button', { name: /verify & complete profile/i });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(updateProfileSpy).toHaveBeenCalledWith(
          'user-google-uuid-52',
          expect.objectContaining({
            avatarUrl: mockUploadedUrl,
          }),
        );
      });

      uploadSpy.mockRestore();
      updateProfileSpy.mockRestore();
    });

    it('handles upload failure gracefully by showing an actionable error and preventing step progression', async () => {
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
        fireEvent.click(
          screen.getByRole('button', { name: /change photo|upload profile picture/i }),
        );
      });

      const dobInput = screen.getByLabelText(/date of birth/i);
      fireEvent.change(dobInput, { target: { value: '2000-01-15' } });

      const phoneInput = screen.getByPlaceholderText(/98765 43210/i);
      fireEvent.change(phoneInput, { target: { value: '9876543210' } });

      const submitButton = screen.getByRole('button', { name: /continue to email verification/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(uploadSpy).toHaveBeenCalled();
        expect(
          screen.getByText(/failed to upload profile picture\. please try again or remove it\./i),
        ).toBeInTheDocument();
      });

      // Verify user remains on profile details form and did not progress to OTP step
      expect(screen.getByRole('heading', { name: /complete your profile/i })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /verify your email/i })).not.toBeInTheDocument();

      uploadSpy.mockRestore();
    });
  });

  describe('Automatic OTP Code Detection, Paste & SMS Autofill Verification', () => {
    const advanceToOtpStep = async () => {
      render(
        <BrowserRouter>
          <ProfileOnboardingPage />
        </BrowserRouter>,
        { wrapper: queryWrapper },
      );

      const dobInput = screen.getByLabelText(/date of birth/i);
      fireEvent.change(dobInput, { target: { value: '2000-01-15' } });

      const phoneInput = screen.getByPlaceholderText(/98765 43210/i);
      fireEvent.change(phoneInput, { target: { value: '9876543210' } });

      const submitButton = screen.getByRole('button', { name: /continue to email verification/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /verify your email/i })).toBeInTheDocument();
      });

      return screen.getAllByRole('textbox');
    };

    it('renders 6 OTP inputs with autocomplete="one-time-code" and inputMode="numeric"', async () => {
      const otpInputs = await advanceToOtpStep();

      expect(otpInputs).toHaveLength(6);
      otpInputs.forEach((input, index) => {
        expect(input).toHaveAttribute('inputMode', 'numeric');
        expect(input).toHaveAttribute('autoComplete', 'one-time-code');
        expect(input).toHaveAttribute('aria-label', `Digit ${index + 1} of 6`);
      });
    });

    it('supports full 6-digit paste, distributes digits across all 6 boxes, and triggers automatic verification', async () => {
      const updateProfileSpy = vi.spyOn(authFeature, 'updateMyProfile');
      const otpInputs = await advanceToOtpStep();

      // Paste 6-digit string
      fireEvent.paste(otpInputs[0]!, {
        clipboardData: {
          getData: () => '849201',
        },
      });

      // Verify each box received its respective digit
      expect(otpInputs[0]).toHaveValue('8');
      expect(otpInputs[1]).toHaveValue('4');
      expect(otpInputs[2]).toHaveValue('9');
      expect(otpInputs[3]).toHaveValue('2');
      expect(otpInputs[4]).toHaveValue('0');
      expect(otpInputs[5]).toHaveValue('1');

      // Auto-verification executes on 6 digits
      await waitFor(() => {
        expect(updateProfileSpy).toHaveBeenCalledWith(
          'user-google-uuid-52',
          expect.objectContaining({ fullName: 'Rahul Google User' }),
        );
      });

      updateProfileSpy.mockRestore();
    });

    it('sanitizes non-numeric characters on paste and extracts numeric OTP digits correctly', async () => {
      const updateProfileSpy = vi.spyOn(authFeature, 'updateMyProfile');
      const otpInputs = await advanceToOtpStep();

      // Paste code formatted with dashes/spaces/text
      fireEvent.paste(otpInputs[0]!, {
        clipboardData: {
          getData: () => 'Code: 739-182 (Your OTP)',
        },
      });

      expect(otpInputs[0]).toHaveValue('7');
      expect(otpInputs[1]).toHaveValue('3');
      expect(otpInputs[2]).toHaveValue('9');
      expect(otpInputs[3]).toHaveValue('1');
      expect(otpInputs[4]).toHaveValue('8');
      expect(otpInputs[5]).toHaveValue('2');

      await waitFor(() => {
        expect(updateProfileSpy).toHaveBeenCalledWith(
          'user-google-uuid-52',
          expect.objectContaining({ fullName: 'Rahul Google User' }),
        );
      });

      updateProfileSpy.mockRestore();
    });

    it('handles mobile SMS autofill direct value change on first input box', async () => {
      const updateProfileSpy = vi.spyOn(authFeature, 'updateMyProfile');
      const otpInputs = await advanceToOtpStep();

      // Mobile browser assigns full OTP to the focused input during SMS autofill
      fireEvent.change(otpInputs[0]!, { target: { value: '520914' } });

      expect(otpInputs[0]).toHaveValue('5');
      expect(otpInputs[1]).toHaveValue('2');
      expect(otpInputs[2]).toHaveValue('0');
      expect(otpInputs[3]).toHaveValue('9');
      expect(otpInputs[4]).toHaveValue('1');
      expect(otpInputs[5]).toHaveValue('4');

      await waitFor(() => {
        expect(updateProfileSpy).toHaveBeenCalledWith(
          'user-google-uuid-52',
          expect.objectContaining({ fullName: 'Rahul Google User' }),
        );
      });

      updateProfileSpy.mockRestore();
    });

    it('supports manual digit-by-digit entry, editing individual digits, and keyboard backspace navigation', async () => {
      const updateProfileSpy = vi.spyOn(authFeature, 'updateMyProfile');
      const otpInputs = await advanceToOtpStep();

      // Enter digits 1 to 5
      fireEvent.change(otpInputs[0]!, { target: { value: '1' } });
      fireEvent.change(otpInputs[1]!, { target: { value: '2' } });
      fireEvent.change(otpInputs[2]!, { target: { value: '3' } });
      fireEvent.change(otpInputs[3]!, { target: { value: '4' } });
      fireEvent.change(otpInputs[4]!, { target: { value: '5' } });

      // Edit digit 2 to '9'
      fireEvent.change(otpInputs[1]!, { target: { value: '9' } });
      expect(otpInputs[1]).toHaveValue('9');

      // Backspace on empty index 5 moves focus backwards
      fireEvent.keyDown(otpInputs[5]!, { key: 'Backspace' });

      // Enter 6th digit completes the code and triggers auto-verification
      fireEvent.change(otpInputs[5]!, { target: { value: '6' } });

      await waitFor(() => {
        expect(updateProfileSpy).toHaveBeenCalledWith(
          'user-google-uuid-52',
          expect.objectContaining({ fullName: 'Rahul Google User' }),
        );
      });

      updateProfileSpy.mockRestore();
    });
  });
});
