import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MobilePageHeader } from '../MobilePageHeader';
import { MobileBottomNav } from '../MobileBottomNav';
import { useAuthStore, useTestModeStore, useAcademyStore } from '@/stores';
import { useCan } from '@/lib/rbac';
import { renderHook, act } from '@testing-library/react';

describe('Phase 47 — Mobile Settings Navigation Fix Verification', () => {
  beforeEach(() => {
    act(() => {
      useTestModeStore.getState().exitTestMode();
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        profile: {
          id: 'owner-id',
          email: 'owner@cricket.app',
          fullName: 'Academy Owner',
          phone: null,
          avatarUrl: null,
          dateOfBirth: null,
          locale: 'en-US',
          timezone: 'UTC',
          isSuperAdmin: false,
        },
        memberships: [
          {
            id: 'mem-1',
            academyId: 'academy-47',
            role: 'academy_owner',
            status: 'active',
            academyName: 'Mobile Test Academy',
            academySlug: 'mobile-test',
            logoUrl: null,
            city: 'London',
            timezone: 'UTC',
          },
        ],
        joinRequests: [],
      });
      useAcademyStore.getState().setActiveAcademy('academy-47');
    });
  });

  it('renders Settings quick-nav button in MobilePageHeader by default', () => {
    render(
      <BrowserRouter>
        <MobilePageHeader title="Test Page" subtitle="Mobile Header Test" />
      </BrowserRouter>,
    );

    const settingsButton = screen.getByRole('button', { name: /settings/i });
    expect(settingsButton).toBeInTheDocument();
  });

  it('routes Academy Owner and Super Admin to /settings/academy upon tapping Settings action', () => {
    act(() => {
      useAuthStore.setState({
        profile: {
          id: 'owner-id',
          email: 'owner@cricket.app',
          fullName: 'Academy Owner',
          phone: null,
          avatarUrl: null,
          dateOfBirth: null,
          locale: 'en-US',
          timezone: 'UTC',
          isSuperAdmin: false,
        },
        memberships: [
          {
            id: 'mem-1',
            academyId: 'academy-47',
            role: 'academy_owner',
            status: 'active',
            academyName: 'Mobile Test Academy',
            academySlug: 'mobile-test',
            logoUrl: null,
            city: 'London',
            timezone: 'UTC',
          },
        ],
      });
    });

    const canUpdate = renderHook(() => useCan('academy:update')).result.current;
    expect(canUpdate).toBe(true);
  });

  it('routes Player and Coach to /profile upon tapping Settings action', () => {
    act(() => {
      useAuthStore.setState({
        profile: {
          id: 'player-id',
          email: 'player@cricket.app',
          fullName: 'Student Player',
          phone: null,
          avatarUrl: null,
          dateOfBirth: null,
          locale: 'en-US',
          timezone: 'UTC',
          isSuperAdmin: false,
        },
        memberships: [
          {
            id: 'mem-2',
            academyId: 'academy-47',
            role: 'player',
            status: 'active',
            academyName: 'Mobile Test Academy',
            academySlug: 'mobile-test',
            logoUrl: null,
            city: 'London',
            timezone: 'UTC',
          },
        ],
      });
    });

    const canUpdate = renderHook(() => useCan('academy:update')).result.current;
    expect(canUpdate).toBe(false);
  });

  describe('MobileBottomNav Primary Settings Navigation', () => {
    it('renders Settings in primary bottom navigation for Academy Owner', () => {
      render(
        <BrowserRouter>
          <MobileBottomNav />
        </BrowserRouter>,
      );

      const settingsNavItem = screen.getByRole('button', { name: /settings/i });
      expect(settingsNavItem).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders Settings in primary bottom navigation for Super Admin', () => {
      act(() => {
        useAuthStore.setState({
          profile: {
            id: 'admin-id',
            email: 'admin@cricket.app',
            fullName: 'Super Admin',
            phone: null,
            avatarUrl: null,
            dateOfBirth: null,
            locale: 'en-US',
            timezone: 'UTC',
            isSuperAdmin: true,
          },
          memberships: [],
        });
      });

      render(
        <BrowserRouter>
          <MobileBottomNav />
        </BrowserRouter>,
      );

      const settingsNavItem = screen.getByRole('button', { name: /settings/i });
      expect(settingsNavItem).toBeInTheDocument();
    });

    it('does NOT expose Academy Settings in primary bottom navigation for Coach', () => {
      act(() => {
        useAuthStore.setState({
          profile: {
            id: 'coach-id',
            email: 'coach@cricket.app',
            fullName: 'Academy Coach',
            phone: null,
            avatarUrl: null,
            dateOfBirth: null,
            locale: 'en-US',
            timezone: 'UTC',
            isSuperAdmin: false,
          },
          memberships: [
            {
              id: 'mem-3',
              academyId: 'academy-47',
              role: 'coach',
              status: 'active',
              academyName: 'Mobile Test Academy',
              academySlug: 'mobile-test',
              logoUrl: null,
              city: 'London',
              timezone: 'UTC',
            },
          ],
        });
      });

      render(
        <BrowserRouter>
          <MobileBottomNav />
        </BrowserRouter>,
      );

      expect(screen.queryByRole('button', { name: /^settings$/i })).not.toBeInTheDocument();
    });

    it('does NOT expose Academy Settings in primary bottom navigation for Student', () => {
      act(() => {
        useAuthStore.setState({
          profile: {
            id: 'student-id',
            email: 'student@cricket.app',
            fullName: 'Student Player',
            phone: null,
            avatarUrl: null,
            dateOfBirth: null,
            locale: 'en-US',
            timezone: 'UTC',
            isSuperAdmin: false,
          },
          memberships: [
            {
              id: 'mem-4',
              academyId: 'academy-47',
              role: 'player',
              status: 'active',
              academyName: 'Mobile Test Academy',
              academySlug: 'mobile-test',
              logoUrl: null,
              city: 'London',
              timezone: 'UTC',
            },
          ],
        });
      });

      render(
        <BrowserRouter>
          <MobileBottomNav />
        </BrowserRouter>,
      );

      expect(screen.queryByRole('button', { name: /^settings$/i })).not.toBeInTheDocument();
    });
  });
});
