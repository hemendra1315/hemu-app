import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MembersPage from '../pages/MembersPage';
import { useAuthStore, useTestModeStore, useAcademyStore } from '@/stores';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query/queryClient';
import { act } from '@testing-library/react';

vi.mock('../hooks/useMembers', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useMembers')>('../hooks/useMembers');
  return {
    ...actual,
    useAcademyMembers: () => ({
      data: [
        {
          id: 'mem-p1',
          academyId: 'academy-uuid-50',
          userId: 'u-1',
          role: 'player',
          status: 'active',
          fullName: 'Rahul Kumar',
          email: 'rahul@cricket.app',
          avatarUrl: null,
          joinedAt: '2026-01-01',
        },
      ],
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    }),
    usePendingJoinRequests: () => ({ data: [], isPending: false }),
  };
});

describe('Phase 50 — Academy Owner Players Page UI Redesign Verification', () => {
  const queryWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: createQueryClient() }, children);

  beforeEach(() => {
    act(() => {
      useTestModeStore.getState().exitTestMode();
      useAuthStore.setState({
        status: 'authenticated',
        identityStatus: 'ready',
        profile: {
          id: 'owner-uuid-50',
          email: 'owner@cricket.app',
          fullName: 'Owner Player Manager',
          phone: '+91 98765 43210',
          avatarUrl: null,
          dateOfBirth: null,
          locale: 'en-US',
          timezone: 'Asia/Kolkata',
          isSuperAdmin: false,
        },
        memberships: [
          {
            id: 'mem-owner-50',
            academyId: 'academy-uuid-50',
            role: 'academy_owner',
            status: 'active',
            academyName: 'Phase 50 Cricket Academy',
            academySlug: 'phase-50-academy',
            logoUrl: null,
            city: 'Mumbai',
            timezone: 'Asia/Kolkata',
          },
        ],
        joinRequests: [],
      });
      useAcademyStore.getState().setActiveAcademy('academy-uuid-50');
    });
  });

  it('renders Players page header, count badge, and + Add Player action for Owner', () => {
    render(
      <BrowserRouter>
        <MembersPage />
      </BrowserRouter>,
      { wrapper: queryWrapper },
    );

    const headers = screen.getAllByRole('heading', { name: /^players$/i });
    expect(headers.length).toBeGreaterThan(0);

    const addPlayerButtons = screen.getAllByRole('button', { name: /add player/i });
    expect(addPlayerButtons.length).toBeGreaterThan(0);
  });

  it('renders the roster count badge and the search + status/batch/role management toolbar', () => {
    render(
      <BrowserRouter>
        <MembersPage />
      </BrowserRouter>,
      { wrapper: queryWrapper },
    );

    // The redesign replaced the old stat cards with a live member count badge ...
    expect(screen.getByText(/1\s*found/i)).toBeInTheDocument();
    // ... and a filter toolbar for managing the roster.
    expect(screen.getByText('All Status')).toBeInTheDocument();
    expect(screen.getByText('All Batches')).toBeInTheDocument();
    expect(screen.getByText('All Roles')).toBeInTheDocument();
  });

  it('renders search field filtering players dynamically', () => {
    render(
      <BrowserRouter>
        <MembersPage />
      </BrowserRouter>,
      { wrapper: queryWrapper },
    );

    expect(screen.getAllByText('Rahul Kumar').length).toBeGreaterThan(0);

    const searchInput = screen.getByPlaceholderText(/search players/i);
    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'NonExistentPlayerQuery' } });
    expect(screen.getByText(/no players found matching your filters/i)).toBeInTheDocument();
  });

  it('opens Add Player Modal displaying Join Code card and copy instructions when Add Player is clicked', () => {
    render(
      <BrowserRouter>
        <MembersPage />
      </BrowserRouter>,
      { wrapper: queryWrapper },
    );

    const addPlayerButtons = screen.getAllByRole('button', { name: /add player/i });
    expect(addPlayerButtons.length).toBeGreaterThan(0);
    const targetButton = addPlayerButtons[0];
    if (targetButton) {
      fireEvent.click(targetButton);
    }

    expect(screen.getByText(/share this join code with your players/i)).toBeInTheDocument();
  });
});
