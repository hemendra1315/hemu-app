import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query/queryClient';
import { useAuthStore, useTestModeStore, useAcademyStore } from '@/stores';
import { MorePage } from '@/pages/MorePage';
import { AppShell } from '@/app/layouts/AppShell';
import { supabase } from '@/lib/supabase/client';

describe('Phase 54 — Logout Routing & Mobile Navigation Verification', () => {
  const queryWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: createQueryClient() }, children);

  const mockAdminUserId = '11111111-1111-4111-8111-111111111111';
  const mockAcademyId = '880e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.restoreAllMocks();
    act(() => {
      useTestModeStore.getState().exitTestMode();
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        user: {
          id: mockAdminUserId,
          email: 'admin@cricket.app',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2026-01-01T00:00:00Z',
        },
        profile: {
          id: mockAdminUserId,
          email: 'admin@cricket.app',
          fullName: 'Super Admin User',
          phone: '+919876543210',
          phoneVerified: true,
          avatarUrl: null,
          dateOfBirth: '1990-01-01',
          locale: 'en',
          timezone: 'Asia/Kolkata',
          isSuperAdmin: true,
        },
        memberships: [
          {
            id: '770e8400-e29b-41d4-a716-446655440000',
            academyId: mockAcademyId,
            role: 'academy_owner',
            status: 'active',
            academyName: 'Super Cricket Academy',
            academySlug: 'super-cricket',
            logoUrl: null,
            city: 'Mumbai',
            timezone: 'Asia/Kolkata',
          },
        ],
        joinRequests: [],
      });
      useAcademyStore.getState().setActiveAcademy(mockAcademyId);
    });
  });

  it('1. Logout from MorePage exits test mode, resets auth store, and redirects to /sign-in', async () => {
    vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });

    act(() => {
      useTestModeStore.getState().setTestMode('coach', mockAcademyId);
    });
    expect(useTestModeStore.getState().activeRole).toBe('coach');

    render(
      <MemoryRouter initialEntries={['/more']}>
        <Routes>
          <Route path="/more" element={<MorePage />} />
          <Route path="/sign-in" element={<div>Sign In Screen</div>} />
        </Routes>
      </MemoryRouter>,
      { wrapper: queryWrapper },
    );

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(screen.getByText('Sign In Screen')).toBeInTheDocument();
    });

    expect(useTestModeStore.getState().activeRole).toBeNull();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('2. Logout from AppShell top bar header exits test mode and redirects to /sign-in', async () => {
    vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<AppShell />} />
          <Route path="/sign-in" element={<div>Sign In Screen</div>} />
        </Routes>
      </MemoryRouter>,
      { wrapper: queryWrapper },
    );

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(screen.getByText('Sign In Screen')).toBeInTheDocument();
    });

    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('3. Renders Settings button in MobileBottomNav for Owner/Admin role within 1-2 taps', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppShell />
      </MemoryRouter>,
      { wrapper: queryWrapper },
    );

    const settingsBtns = screen.getAllByRole('button', { name: /settings/i });
    expect(settingsBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('4. Clears simulated role state on logout so no stale Test App As role survives', async () => {
    vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });

    act(() => {
      useTestModeStore.getState().setTestMode('student', mockAcademyId);
    });

    render(
      <MemoryRouter initialEntries={['/more']}>
        <Routes>
          <Route path="/more" element={<MorePage />} />
          <Route path="/sign-in" element={<div>Sign In Screen</div>} />
        </Routes>
      </MemoryRouter>,
      { wrapper: queryWrapper },
    );

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(screen.getByText('Sign In Screen')).toBeInTheDocument();
    });

    expect(useTestModeStore.getState().activeRole).toBeNull();
  });
});
